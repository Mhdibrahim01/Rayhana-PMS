/**
 * نظام أحمد لإدارة الفنادق (Ahmed Hotel ERP)
 * وحدة جدولة النسخ الاحتياطي التلقائي اليومي (Daily 12:00 AM Automated Backup Scheduler)
 * 
 * الميزات:
 * 1. تنفيذ النسخ الاحتياطي لقاعدة بيانات SQLite تلقائياً يومياً في تمام الساعة 12:00 منتصف الليل (12:00 AM).
 * 2. جدولة دقيقة باستخدام مؤقت منتصف الليل + فحص دوري كل 30 ثانية لتجاوز وضع السكون (Sleep/Hibernate) أو تغييرات الساعة.
 * 3. آلية تعويض البدء (Startup Catch-up): إذا كان الحاسوب مغلقاً في تمام الساعة 12:00 ص، يقوم النظام تلقائياً بأخذ نسخة اليوم فور تشغيل البرنامج.
 * 4. حفظ النسخ في مجلد AppData/backups مع نسخة مرآة احتياطية في مجلد Documents للمستخدم لسهولة الوصول.
 * 5. إشعار مباشر في نظام التشغيل Windows (Native Notification) وتحديث فوري لواجهة المستخدم عبر IPC.
 * 6. إدارة السجل وتدوير النسخ التلقائي للاحتفاظ بآخر 60 يوماً بأمان تام.
 */

const path = require('path');
const fs = require('fs');

let dbModule = null;
let electronApp = null;
let electronShell = null;
let electronNotification = null;
let mainWindowGetter = null;

let backupDir = '';
let defaultBackupDir = '';
let mirrorDir = '';
let configFilePath = '';

let midnightTimeout = null;
let watchdogInterval = null;

let isBackupRunning = false;

let schedulerState = {
  enabled: true,
  scheduledTime: '12:00 AM (00:00:00)',
  customBackupDir: null,
  lastDailyBackupDate: null,
  lastDailyBackupTimestamp: null,
  lastDailyBackupFile: null,
  lastDailyBackupPath: null,
  lastDailyBackupSize: 0,
  lastReason: null,
  lastStatus: 'idle',
  lastError: null
};

/**
 * تحويل الحجم بالبايت إلى نص قابل للقراءة
 */
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * تنسيق التاريخ المحلي بصيغة YYYY-MM-DD
 */
function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * حساب الوقت المتبقي بالمللي ثانية حتى أقرب 12:00 منتصف الليل (00:00:00)
 */
function getMsUntilNextMidnight(now = new Date()) {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0, 0
  );
  const diff = nextMidnight.getTime() - now.getTime();
  return Math.max(1000, diff);
}

/**
 * تحميل إعدادات وحالة الجدولة من القرص
 */
function loadConfig() {
  try {
    if (fs.existsSync(configFilePath)) {
      const content = fs.readFileSync(configFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      schedulerState = { ...schedulerState, ...parsed };

      if (schedulerState.customBackupDir && typeof schedulerState.customBackupDir === 'string') {
        try {
          if (!fs.existsSync(schedulerState.customBackupDir)) {
            fs.mkdirSync(schedulerState.customBackupDir, { recursive: true });
          }
          backupDir = schedulerState.customBackupDir;
        } catch (e) {
          console.warn('[BackupScheduler] تعذر استخدام مسار النسخ المخصص المحفوظ، الرجوع للمسار الافتراضي:', e.message);
          backupDir = defaultBackupDir;
        }
      } else {
        backupDir = defaultBackupDir || backupDir;
      }
    }
  } catch (err) {
    console.warn('[BackupScheduler] تعذر قراءة ملف إعدادات النسخ الاحتياطي:', err.message);
  }
}

/**
 * حفظ حالة الجدولة في القرص
 */
function saveConfig() {
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(schedulerState, null, 2), 'utf-8');
  } catch (err) {
    console.error('[BackupScheduler] فشل حفظ حالة الجدولة:', err.message);
  }
}

/**
 * تدوير وحذف النسخ القديمة في مجلد محدد للاحتفاظ بآخر maxRetain نسخة
 */
function rotateDirectoryBackups(targetDirectory, maxRetain = 60) {
  if (!targetDirectory || !fs.existsSync(targetDirectory)) return;
  try {
    const files = fs.readdirSync(targetDirectory)
      .filter(f => (f.startsWith('rayhana_daily_backup_') || f.startsWith('ahmed_hotel_daily_backup_') || f.startsWith('backup_')) && f.endsWith('.sqlite') && !f.includes('latest'))
      .map(f => {
        const fullPath = path.join(targetDirectory, f);
        return { name: f, path: fullPath, time: fs.statSync(fullPath).mtimeMs };
      })
      .sort((a, b) => b.time - a.time);

    if (files.length > maxRetain) {
      const toDelete = files.slice(maxRetain);
      for (const item of toDelete) {
        try {
          fs.unlinkSync(item.path);
          console.log(`[BackupScheduler Rotation] تم حذف نسخة قديمة لتوفير المساحة من (${path.basename(targetDirectory)}):`, item.name);
        } catch (e) {
          console.warn('[BackupScheduler Rotation] خطأ في حذف النسخة القديمة:', e.message);
        }
      }
    }
  } catch (err) {
    console.warn(`[BackupScheduler Rotation Error in ${targetDirectory}]:`, err.message);
  }
}

/**
 * تنظيف وتدوير النسخ القديمة لحفظ مساحة القرص والسحابة (الاحتفاظ بآخر 60 نسخة يومية)
 */
function cleanOldBackups(maxRetain = 60) {
  rotateDirectoryBackups(backupDir, maxRetain);
  if (mirrorDir && mirrorDir !== backupDir) {
    rotateDirectoryBackups(mirrorDir, maxRetain);
  }
  const oneDriveDir = process.env.OneDrive || process.env.OneDriveConsumer;
  if (oneDriveDir) {
    rotateDirectoryBackups(path.join(oneDriveDir, 'Rayhana_Backups'), maxRetain);
    rotateDirectoryBackups(path.join(oneDriveDir, 'AhmedERP_Backups'), maxRetain);
  }
}

/**
 * تنفيذ عملية النسخ الاحتياطي اليومي
 * @param {string} reason - سبب الإطلاق (scheduled_midnight | startup_catchup | heartbeat_catchup | manual_request)
 */
async function performDailyBackup(reason = 'scheduled_midnight') {
  if (isBackupRunning) {
    console.log('[BackupScheduler] عملية نسخ احتياطي قيد التنفيذ بالفعل، تخطي الطلب المتزامن.');
    return { success: false, message: 'عملية نسخ أخرى قيد التنفيذ حالياً.' };
  }

  isBackupRunning = true;
  const today = getLocalDateString();
  const openBusinessDate = dbModule && typeof dbModule.getCurrentBusinessDate === 'function' ? dbModule.getCurrentBusinessDate() : null;
  const backupFileName = `rayhana_daily_backup_${today}_12-00-AM.sqlite`;
  const targetPath = path.join(backupDir, backupFileName);

  console.log(`[BackupScheduler] بدء النسخ الاحتياطي اليومي (${reason}) لليوم ${today} (تاريخ العمل: ${openBusinessDate || today}) إلى:`, targetPath);

  try {
    // 1. التأكد من وجود المجلدات
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    if (mirrorDir && !fs.existsSync(mirrorDir)) {
      try {
        fs.mkdirSync(mirrorDir, { recursive: true });
      } catch (e) {
        console.warn('[BackupScheduler] تعذر إنشاء مجلد المستندات:', e.message);
      }
    }

    // 2. نسخ قاعدة البيانات عبر وحدة db (تقوم بحفظ الذاكرة إلى القرص أولاً ثم النسخ)
    dbModule.createBackupCopy(targetPath);

    // 3. نسخة "latest" لسهولة الوصول المباشر
    const latestPath = path.join(backupDir, 'rayhana_daily_backup_latest.sqlite');
    try {
      fs.copyFileSync(targetPath, latestPath);
    } catch (e) {
      console.warn('[BackupScheduler] تعذر تحديث النسخة الأحدث:', e.message);
    }

    // 4. نسخ مرآة إضافية في مجلد المستندات للمستخدم
    if (mirrorDir && fs.existsSync(mirrorDir)) {
      try {
        fs.copyFileSync(targetPath, path.join(mirrorDir, backupFileName));
        fs.copyFileSync(targetPath, path.join(mirrorDir, 'rayhana_daily_backup_latest.sqlite'));
      } catch (e) {
        console.warn('[BackupScheduler] تعذر النسخ إلى مجلد المستندات:', e.message);
      }
    }

    // 4.1 نسخ سحابي تلقائي إلى مجلد Microsoft OneDrive
    const oneDriveDir = process.env.OneDrive || process.env.OneDriveConsumer;
    if (oneDriveDir && fs.existsSync(oneDriveDir)) {
      try {
        const modernCloudDir = path.join(oneDriveDir, 'Rayhana_Backups');
        const legacyCloudDir = path.join(oneDriveDir, 'AhmedERP_Backups');
        const cloudBackupDir = fs.existsSync(legacyCloudDir) && !fs.existsSync(modernCloudDir) ? legacyCloudDir : modernCloudDir;
        if (!fs.existsSync(cloudBackupDir)) {
          fs.mkdirSync(cloudBackupDir, { recursive: true });
        }
        fs.copyFileSync(targetPath, path.join(cloudBackupDir, backupFileName));
        fs.copyFileSync(targetPath, path.join(cloudBackupDir, 'rayhana_daily_backup_latest.sqlite'));
        console.log(`[BackupScheduler] ☁️ تم مزامنة النسخة سحابياً مع Microsoft OneDrive بنجاح: ${cloudBackupDir}`);
      } catch (cloudErr) {
        console.warn('[BackupScheduler] تعذر المزامنة السحابية مع OneDrive:', cloudErr.message);
      }
    }

    // 5. حساب الحجم وتحديث الحالة
    const stats = fs.statSync(targetPath);
    schedulerState.lastDailyBackupDate = today;
    schedulerState.lastBusinessDate = openBusinessDate;
    schedulerState.lastDailyBackupTimestamp = new Date().toISOString();
    schedulerState.lastDailyBackupFile = backupFileName;
    schedulerState.lastDailyBackupPath = targetPath;
    schedulerState.lastDailyBackupSize = stats.size;
    schedulerState.lastReason = reason;
    schedulerState.lastStatus = 'success';
    schedulerState.lastError = null;
    saveConfig();

    // 6. تدوير النسخ القديمة
    cleanOldBackups(60);

    console.log(`[BackupScheduler] ✓ تم إنجاز النسخة الاحتياطية اليومية بنجاح (${formatBytes(stats.size)}).`);

    // 7. إشعار نظام تشغيل Windows
    try {
      if (electronNotification && electronNotification.isSupported()) {
        const notif = new electronNotification({
          title: 'ريحانة للوحدات السكنية | نسخة احتياطية يومية 🕛',
          body: `تم أخذ النسخة الاحتياطية اليومية بنجاح (12:00 AM)\nالملف: ${backupFileName}${openBusinessDate ? ` | تاريخ العمل: ${openBusinessDate}` : ''}`,
          silent: false
        });
        notif.show();
      }
    } catch (notifErr) {
      console.warn('[BackupScheduler] خطأ في إرسال إشعار النظام:', notifErr.message);
    }

    // 8. إرسال حدث IPC إلى نافذة الواجهة الرسومية
    try {
      const win = mainWindowGetter ? mainWindowGetter() : null;
      if (win && !win.isDestroyed() && win.webContents) {
        win.webContents.send('backup:daily-event', {
          type: 'daily_backup_completed',
          reason,
          filename: backupFileName,
          path: targetPath,
          sizeFormatted: formatBytes(stats.size),
          date: today,
          businessDate: openBusinessDate,
          timestamp: schedulerState.lastDailyBackupTimestamp,
          success: true
        });
      }
    } catch (ipcErr) {
      console.warn('[BackupScheduler] خطأ في إرسال حدث الواجهة:', ipcErr.message);
    }

    isBackupRunning = false;
    return {
      success: true,
      filename: backupFileName,
      path: targetPath,
      size: stats.size,
      sizeFormatted: formatBytes(stats.size),
      date: today,
      reason
    };
  } catch (err) {
    console.error('[BackupScheduler] ✗ خطأ فادح في النسخ الاحتياطي اليومي:', err);
    schedulerState.lastStatus = 'error';
    schedulerState.lastError = err.message;
    saveConfig();
    isBackupRunning = false;
    return { success: false, error: err.message };
  }
}

/**
 * جدولة مؤقت 12:00 AM القادم
 */
function scheduleNextMidnight() {
  if (midnightTimeout) {
    clearTimeout(midnightTimeout);
    midnightTimeout = null;
  }

  const ms = getMsUntilNextMidnight();
  const minutes = Math.round(ms / 1000 / 60);
  const hours = (minutes / 60).toFixed(1);

  console.log(`[BackupScheduler] موعد النسخة الاحتياطية اليومية القادمة: في تمام 12:00 منتصف الليل (بعد حوالي ${hours} ساعة / ${minutes} دقيقة).`);

  midnightTimeout = setTimeout(async () => {
    console.log('[BackupScheduler] حلول الساعة 12:00 منتصف الليل - إطلاق النسخ الاحتياطي المجدول...');
    await performDailyBackup('scheduled_midnight');
    scheduleNextMidnight();
  }, ms);
}

/**
 * تهيئة وتشغيل مجدول النسخ اليومي
 */
async function initBackupScheduler(options = {}) {
  dbModule = options.db;
  electronApp = options.app;
  electronShell = options.shell;
  electronNotification = options.Notification;
  mainWindowGetter = options.getMainWindow;
  const userDataDir = electronApp.getPath('userData');
  defaultBackupDir = path.join(userDataDir, 'backups');
  backupDir = defaultBackupDir;
  try {
    mirrorDir = path.join(electronApp.getPath('documents'), 'Rayhana_Backups');
  } catch (e) {
    mirrorDir = '';
  }
  configFilePath = path.join(userDataDir, 'backup_schedule.json');

  loadConfig();

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // فحص البدء: هل تم أخذ نسخة اليوم (12:00 ص)؟
  const today = getLocalDateString();
  if (schedulerState.lastDailyBackupDate !== today) {
    console.log(`[BackupScheduler] لم يتم تسجيل نسخة احتياطية لتاريخ اليوم (${today}). سيتم أخذ النسخة الآن تعويضاً عن موعد 12:00 ص.`);
    await performDailyBackup('startup_catchup');
  } else {
    console.log(`[BackupScheduler] تم التحقق: نسخة اليوم (${today}) مسجلة ومحفوظة بنجاح.`);
  }

  // جدولة موعد منتصف الليل القادم
  scheduleNextMidnight();

  // حارس المراقبة الدوري (Watchdog) كل 30 ثانية
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
  }
  watchdogInterval = setInterval(async () => {
    const currentDate = getLocalDateString();
    if (schedulerState.lastDailyBackupDate !== currentDate) {
      console.log(`[BackupScheduler Watchdog] تم رصد انتقال ليوم جديد (${currentDate}). جاري تشغيل النسخة الاحتياطية لـ 12:00 AM...`);
      await performDailyBackup('heartbeat_catchup');
      scheduleNextMidnight();
    }
  }, 30000);
}

/**
 * إيقاف المجدول عند إغلاق التطبيق
 */
function stopBackupScheduler() {
  if (midnightTimeout) {
    clearTimeout(midnightTimeout);
    midnightTimeout = null;
  }
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
}

/**
 * فتح مجلد النسخ الاحتياطية في مستكشف ملفات ويندوز
 */
async function openBackupsFolder() {
  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    if (electronShell) {
      await electronShell.openPath(backupDir);
      return { success: true, path: backupDir };
    }
    return { success: false, error: 'electron shell غير مهيأ' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * جلب حالة وتفاصيل الجدولة وقائمة النسخ المتوفرة
 */
function getBackupStatus() {
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0, 0
  );
  const msUntilNext = nextMidnight.getTime() - now.getTime();

  let backupsList = [];
  try {
    if (fs.existsSync(backupDir)) {
      backupsList = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.sqlite'))
        .map(f => {
          const fullPath = path.join(backupDir, f);
          const stat = fs.statSync(fullPath);
          return {
            filename: f,
            path: fullPath,
            size: stat.size,
            sizeFormatted: formatBytes(stat.size),
            modified: stat.mtime.toISOString(),
            isDaily: f.includes('daily_backup'),
            isLatest: f.includes('latest')
          };
        })
        .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    }
  } catch (err) {
    console.warn('[BackupScheduler] خطأ في سرد ملفات النسخ:', err.message);
  }

  return {
    ...schedulerState,
    backupDir,
    defaultBackupDir,
    customBackupDir: schedulerState.customBackupDir,
    isCustomFolder: !!schedulerState.customBackupDir,
    mirrorDir,
    nextScheduledTimestamp: nextMidnight.toISOString(),
    msUntilNext,
    backupsList,
    totalBackupsCount: backupsList.length
  };
}

/**
 * تعيين مسار مجلد مخصص لحفظ النسخ التلقائية
 */
function setCustomBackupDirectory(dirPath) {
  try {
    if (!dirPath || typeof dirPath !== 'string') {
      return { success: false, error: 'المسار المحدد غير صالح.' };
    }
    const resolvedPath = path.resolve(dirPath);
    if (!fs.existsSync(resolvedPath)) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }
    schedulerState.customBackupDir = resolvedPath;
    backupDir = resolvedPath;
    saveConfig();
    console.log(`[BackupScheduler] ✓ تم تعيين مسار الحفظ المخصص للنسخ التلقائية: ${resolvedPath}`);
    return {
      success: true,
      backupDir: resolvedPath,
      isCustomFolder: true
    };
  } catch (err) {
    console.error('[BackupScheduler] فشل تعيين مسار النسخ الاحتياطي المخصص:', err);
    return { success: false, error: err.message };
  }
}

/**
 * استعادة مسار مجلد الحفظ الافتراضي (AppData/backups)
 */
function resetBackupDirectoryToDefault() {
  try {
    schedulerState.customBackupDir = null;
    backupDir = defaultBackupDir || (electronApp ? path.join(electronApp.getPath('userData'), 'backups') : backupDir);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    saveConfig();
    console.log(`[BackupScheduler] ↩️ تمت استعادة مسار الحفظ الافتراضي للنسخ التلقائية: ${backupDir}`);
    return {
      success: true,
      backupDir,
      isCustomFolder: false
    };
  } catch (err) {
    console.error('[BackupScheduler] فشل استعادة المسار الافتراضي:', err);
    return { success: false, error: err.message };
  }
}

/**
 * الحصول على مسار الحفظ المخصص إن وجد
 */
function getCustomBackupDirectory() {
  return schedulerState.customBackupDir || null;
}

module.exports = {
  initBackupScheduler,
  performDailyBackup,
  scheduleNextMidnight,
  stopBackupScheduler,
  openBackupsFolder,
  getBackupStatus,
  setCustomBackupDirectory,
  resetBackupDirectoryToDefault,
  getCustomBackupDirectory,
  formatBytes,
  getLocalDateString
};
