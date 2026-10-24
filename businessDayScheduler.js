'use strict';

const CHECK_INTERVAL_MS = 30_000; // Check every 30 seconds for more responsive day rollover

function getNow() {
  const override = process.env.RAYHANA_DEV_NOW;
  if (override) {
    const simulated = new Date(override);
    if (!Number.isNaN(simulated.getTime())) return simulated;
    console.warn('[BusinessDay] Ignoring invalid RAYHANA_DEV_NOW value.');
  }
  return new Date();
}

function zonedParts(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

function shouldBeBusinessDate(now, timezone, cutoffTime) {
  const [cutoffHour, cutoffMinute] = String(cutoffTime || '06:00').split(':').map(Number);
  if (!Number.isInteger(cutoffHour) || !Number.isInteger(cutoffMinute)
      || cutoffHour < 0 || cutoffHour > 23 || cutoffMinute < 0 || cutoffMinute > 59) {
    throw new Error('وقت القطع لليوم الفندقي غير صالح.');
  }
  const parts = zonedParts(new Date(now), timezone);
  const calendarDate = `${parts.year}-${parts.month}-${parts.day}`;
  if (Number(parts.hour) * 60 + Number(parts.minute) >= cutoffHour * 60 + cutoffMinute) return calendarDate;
  const previous = new Date(`${calendarDate}T00:00:00.000Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}-${String(previous.getUTCDate()).padStart(2, '0')}`;
}

function addCalendarDay(isoDate) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function createBusinessDayScheduler({ db, powerMonitor, getMainWindow = () => null, clock = getNow }) {
  let interval = null;
  let running = false;
  let lastBackwardWarning = '';

  async function checkAndClose() {
    if (running) return { advancedDays: 0, skipped: 'already-running' };
    running = true;
    try {
      const settings = db.getBusinessDaySettings();
      if (!settings.auto_rollover_enabled) return { advancedDays: 0, skipped: 'disabled' };

      const now = clock();
      const targetDate = shouldBeBusinessDate(now, settings.hotel_timezone, settings.business_day_cutoff_time);
      let openDate = db.getCurrentBusinessDate();
      if (targetDate < openDate) {
        const key = `${openDate}:${targetDate}`;
        if (lastBackwardWarning !== key) {
          console.warn(`[BusinessDay] Clock moved behind open business date (${targetDate} < ${openDate}); no rollback performed.`);
          lastBackwardWarning = key;
        }
        return { advancedDays: 0, skipped: 'clock-behind-open-date' };
      }
      lastBackwardWarning = '';
      if (targetDate === openDate) return { advancedDays: 0 };

      const firstClosedDate = openDate;
      let advancedDays = 0;
      while (openDate < targetDate) {
        const nextDate = addCalendarDay(openDate);
        const result = db.runNightAudit(null, openDate, {
          closedBy: 'system',
          now: clock(),
          maxBusinessDate: targetDate,
          markShiftReconciliation: false
        });
        if (!result?.success || !result.advanced) break;
        openDate = result.currentBusinessDate;
        advancedDays += 1;
      }

      if (advancedDays) {
        console.info(`[BusinessDay] Automatically closed ${advancedDays} day(s): ${firstClosedDate} → ${openDate}.`);
        const payload = {
          businessDate: openDate,
          closedDays: advancedDays,
          shiftReconciliationRequired: false
        };
        const mainWindow = getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('hotel-business-day:changed', payload);
        }
      }
      return { advancedDays, businessDate: openDate };
    } catch (error) {
      console.error('[BusinessDay] Automatic rollover failed:', error);
      return { advancedDays: 0, error: error.message };
    } finally {
      running = false;
    }
  }

  function start() {
    if (interval) return;
    interval = setInterval(() => { void checkAndClose(); }, CHECK_INTERVAL_MS);
    if (powerMonitor) powerMonitor.on('resume', checkAndClose);
    void checkAndClose();
  }

  function stop() {
    if (interval) clearInterval(interval);
    interval = null;
    if (powerMonitor) powerMonitor.removeListener('resume', checkAndClose);
  }

  return { start, stop, checkAndClose };
}

module.exports = { createBusinessDayScheduler, getNow, shouldBeBusinessDate, CHECK_INTERVAL_MS };
