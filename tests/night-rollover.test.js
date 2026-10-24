'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const {
  createBusinessDayScheduler,
  shouldBeBusinessDate,
  addCalendarDay
} = require('../businessDayScheduler');
const { addRoom, createReservation } = require('./helpers/fixtures');
const { assertDatabaseIntegrity, withSafeDatabase } = require('./helpers/safe-temp-db');
const { FakeIpcMain, createFakeDeps } = require('./helpers/fake-ipc');
const { registerReportsIpc } = require('../ipc/index');

test('Night Rollover Feature - Date & Cutoff Time Calculation', async t => {
  await t.test('standard 06:00 cutoff in Asia/Riyadh (+03:00)', () => {
    const tz = 'Asia/Riyadh';
    const cutoff = '06:00';

    // 05:59:59 AM on 2026-10-07 -> still business date 2026-10-06
    assert.equal(shouldBeBusinessDate('2026-10-07T05:59:59+03:00', tz, cutoff), '2026-10-06');

    // Exactly 06:00:00 AM on 2026-10-07 -> rolls over to 2026-10-07
    assert.equal(shouldBeBusinessDate('2026-10-07T06:00:00+03:00', tz, cutoff), '2026-10-07');

    // 06:01:00 AM on 2026-10-07 -> 2026-10-07
    assert.equal(shouldBeBusinessDate('2026-10-07T06:01:00+03:00', tz, cutoff), '2026-10-07');

    // 14:30:00 PM on 2026-10-07 -> 2026-10-07
    assert.equal(shouldBeBusinessDate('2026-10-07T14:30:00+03:00', tz, cutoff), '2026-10-07');

    // 23:59:59 PM on 2026-10-07 -> 2026-10-07
    assert.equal(shouldBeBusinessDate('2026-10-07T23:59:59+03:00', tz, cutoff), '2026-10-07');

    // 00:01:00 AM post-midnight on 2026-10-08 -> belongs to operational day 2026-10-07
    assert.equal(shouldBeBusinessDate('2026-10-08T00:01:00+03:00', tz, cutoff), '2026-10-07');
  });

  await t.test('month and year boundary transitions', () => {
    const tz = 'Asia/Riyadh';
    const cutoff = '06:00';

    // Month boundary: Nov 1 at 03:00 AM rolls back to Oct 31
    assert.equal(shouldBeBusinessDate('2026-11-01T03:00:00+03:00', tz, cutoff), '2026-10-31');
    assert.equal(shouldBeBusinessDate('2026-11-01T06:05:00+03:00', tz, cutoff), '2026-11-01');

    // Year boundary: Jan 1 at 04:00 AM rolls back to Dec 31 of prior year
    assert.equal(shouldBeBusinessDate('2027-01-01T04:00:00+03:00', tz, cutoff), '2026-12-31');
    assert.equal(shouldBeBusinessDate('2027-01-01T06:00:00+03:00', tz, cutoff), '2027-01-01');

    // Leap year boundary: March 1 on leap year 2028 at 02:00 AM rolls back to Feb 29
    assert.equal(shouldBeBusinessDate('2028-03-01T02:00:00+03:00', tz, cutoff), '2028-02-29');
  });

  await t.test('custom cutoff times (00:00 midnight and 14:00 afternoon)', () => {
    const tz = 'Asia/Riyadh';

    // Midnight cutoff (00:00)
    assert.equal(shouldBeBusinessDate('2026-10-07T23:59:59+03:00', tz, '00:00'), '2026-10-07');
    assert.equal(shouldBeBusinessDate('2026-10-08T00:00:00+03:00', tz, '00:00'), '2026-10-08');

    // Afternoon cutoff (14:00)
    assert.equal(shouldBeBusinessDate('2026-10-07T13:59:59+03:00', tz, '14:00'), '2026-10-06');
    assert.equal(shouldBeBusinessDate('2026-10-07T14:00:00+03:00', tz, '14:00'), '2026-10-07');
  });

  await t.test('different timezones (UTC vs Asia/Riyadh)', () => {
    // 04:00 UTC = 07:00 in Riyadh (+03:00)
    // For cutoff 06:00:
    // In UTC: 04:00 is before 06:00 cutoff -> rolls back to 2026-10-06
    assert.equal(shouldBeBusinessDate('2026-10-07T04:00:00Z', 'UTC', '06:00'), '2026-10-06');

    // In Asia/Riyadh: 07:00 is past 06:00 cutoff -> current day 2026-10-07
    assert.equal(shouldBeBusinessDate('2026-10-07T04:00:00Z', 'Asia/Riyadh', '06:00'), '2026-10-07');
  });

  await t.test('invalid cutoff inputs throw clear error', () => {
    assert.throws(() => shouldBeBusinessDate(new Date(), 'UTC', '24:00'), /غير صالح/);
    assert.throws(() => shouldBeBusinessDate(new Date(), 'UTC', 'invalid'), /غير صالح/);
    assert.throws(() => shouldBeBusinessDate(new Date(), 'UTC', '-01:00'), /غير صالح/);
  });
});

test('Night Rollover Feature - Scheduler & Database Execution', async t => {
  await withSafeDatabase(async (db, connection) => {
    const startDate = '2026-10-05';
    connection.db.run('UPDATE hotel_business_state SET current_business_date = ? WHERE id = 1', [startDate]);
    db.updateBusinessDaySettings({
      business_day_cutoff_time: '06:00',
      hotel_timezone: 'Asia/Riyadh',
      auto_rollover_enabled: true
    });

    await t.test('single day automatic rollover when cutoff is crossed', async () => {
      let dispatchedPayload = null;
      const fakeMainWindow = {
        isDestroyed: () => false,
        webContents: {
          send: (channel, payload) => {
            if (channel === 'hotel-business-day:changed') dispatchedPayload = payload;
          }
        }
      };

      // Set clock to 06:15 AM on 2026-10-06 (Riyadh time)
      const simulatedNow = new Date('2026-10-06T06:15:00+03:00');
      const scheduler = createBusinessDayScheduler({
        db,
        getMainWindow: () => fakeMainWindow,
        clock: () => simulatedNow
      });

      const result = await scheduler.checkAndClose();
      assert.equal(result.advancedDays, 1);
      assert.equal(result.businessDate, '2026-10-06');
      assert.equal(db.getCurrentBusinessDate(), '2026-10-06');

      // Verify night_audits entry was stamped
      const audit = connection.queryOne('SELECT * FROM night_audits WHERE closed_business_date = ?', [startDate]);
      assert.ok(audit, 'Audit row must be created');
      assert.equal(audit.closed_by, 'system', 'Night rollover must record system actor');
      assert.equal(audit.next_business_date, '2026-10-06');

      // Verify IPC broadcast
      assert.ok(dispatchedPayload, 'IPC notification must be emitted');
      assert.equal(dispatchedPayload.businessDate, '2026-10-06');
      assert.equal(dispatchedPayload.closedDays, 1);

      assertDatabaseIntegrity(connection, 'single day night rollover');
    });

    await t.test('subsequent check on the same business day does not advance again', async () => {
      const simulatedNow = new Date('2026-10-06T12:00:00+03:00');
      const scheduler = createBusinessDayScheduler({
        db,
        clock: () => simulatedNow
      });

      const result = await scheduler.checkAndClose();
      assert.equal(result.advancedDays, 0);
      assert.equal(db.getCurrentBusinessDate(), '2026-10-06');
    });

    await t.test('multi-day catch-up rollover advances consecutive days in order', async () => {
      // Simulate system staying offline until 2026-10-09 at 08:00 AM (3 days forward)
      const simulatedNow = new Date('2026-10-09T08:00:00+03:00');
      let dispatchedPayload = null;
      const scheduler = createBusinessDayScheduler({
        db,
        getMainWindow: () => ({
          isDestroyed: () => false,
          webContents: {
            send: (_channel, payload) => { dispatchedPayload = payload; }
          }
        }),
        clock: () => simulatedNow
      });

      const result = await scheduler.checkAndClose();
      assert.equal(result.advancedDays, 3);
      assert.equal(result.businessDate, '2026-10-09');
      assert.equal(db.getCurrentBusinessDate(), '2026-10-09');

      // Audits must exist for each closed day: 2026-10-06, 2026-10-07, 2026-10-08
      const audit6 = connection.queryOne('SELECT * FROM night_audits WHERE closed_business_date = ?', ['2026-10-06']);
      const audit7 = connection.queryOne('SELECT * FROM night_audits WHERE closed_business_date = ?', ['2026-10-07']);
      const audit8 = connection.queryOne('SELECT * FROM night_audits WHERE closed_business_date = ?', ['2026-10-08']);
      assert.ok(audit6 && audit7 && audit8, 'Audits for all catch-up days must be recorded');
      assert.equal(audit8.next_business_date, '2026-10-09');

      assert.equal(dispatchedPayload.closedDays, 3);
      assert.equal(dispatchedPayload.businessDate, '2026-10-09');

      assertDatabaseIntegrity(connection, 'multi-day catch-up rollover');
    });

    await t.test('auto_rollover_enabled=false disables automatic rollover', async () => {
      db.updateBusinessDaySettings({ auto_rollover_enabled: false });

      const simulatedNow = new Date('2026-10-10T08:00:00+03:00');
      const scheduler = createBusinessDayScheduler({
        db,
        clock: () => simulatedNow
      });

      const result = await scheduler.checkAndClose();
      assert.equal(result.advancedDays, 0);
      assert.equal(result.skipped, 'disabled');
      assert.equal(db.getCurrentBusinessDate(), '2026-10-09', 'Business date must remain unchanged');

      // Re-enable for subsequent tests
      db.updateBusinessDaySettings({ auto_rollover_enabled: true });
    });

    await t.test('open employee session does not require reconciliation after automatic rollover', async () => {
      // Simulate open receptionist session
      connection.db.run(`
        INSERT INTO EmployeeLogs (user_id, login_time, logout_time)
        VALUES (1, '2026-10-09 20:00:00', NULL)
      `);

      const simulatedNow = new Date('2026-10-10T06:30:00+03:00');
      const scheduler = createBusinessDayScheduler({
        db,
        clock: () => simulatedNow
      });

      const result = await scheduler.checkAndClose();
      assert.equal(result.advancedDays, 1);
      assert.equal(result.businessDate, '2026-10-10');

      const audit = connection.queryOne('SELECT * FROM night_audits WHERE closed_business_date = ?', ['2026-10-09']);
      assert.equal(audit.shift_reconciliation_required, 0, 'Automatic rollover must not require shift reconciliation');

      const pending = db.getPendingShiftReconciliationAudits();
      assert.ok(!pending.some(p => p.closed_business_date === '2026-10-09'), 'Automatically rolled day must not appear in pending reconciliations');

      assertDatabaseIntegrity(connection, 'shift reconciliation flag on rollover');
    });

    await t.test('autoUpdateRoomStatuses runs during rollover for incoming reservations', async () => {
      const room = addRoom('ROLL-101', 150);
      // Reservation arriving on 2026-10-11
      createReservation({
        roomId: room.id,
        name: 'Rollover Guest',
        checkIn: '2026-10-11',
        checkOut: '2026-10-13',
        totalPrice: 300,
        paidAmount: 300
      });

      assert.equal(connection.queryOne('SELECT status FROM rooms WHERE id = ?', [room.id]).status, 'محجوزة');

      // Advance date to 2026-10-11
      const simulatedNow = new Date('2026-10-11T07:00:00+03:00');
      const scheduler = createBusinessDayScheduler({
        db,
        clock: () => simulatedNow
      });

      await scheduler.checkAndClose();
      assert.equal(db.getCurrentBusinessDate(), '2026-10-11');

      // Room status should now automatically be occupied (مشغولة)
      assert.equal(connection.queryOne('SELECT status FROM rooms WHERE id = ?', [room.id]).status, 'مشغولة');
      assertDatabaseIntegrity(connection, 'room status transition on rollover');
    });

    await t.test('clock backward jump protection prevents rollback', async () => {
      // Current date is 2026-10-11. Simulate clock jumping backward to 2026-10-08
      const simulatedNow = new Date('2026-10-08T07:00:00+03:00');
      const scheduler = createBusinessDayScheduler({
        db,
        clock: () => simulatedNow
      });

      const result = await scheduler.checkAndClose();
      assert.equal(result.advancedDays, 0);
      assert.equal(result.skipped, 'clock-behind-open-date');
      assert.equal(db.getCurrentBusinessDate(), '2026-10-11');
      assertDatabaseIntegrity(connection, 'clock backward protection');
    });

    await t.test('powerMonitor resume trigger executes checkAndClose', async () => {
      const powerMonitor = new EventEmitter();
      let triggered = false;
      const fakeClock = () => {
        triggered = true;
        return new Date('2026-10-11T08:00:00+03:00');
      };

      const scheduler = createBusinessDayScheduler({
        db,
        powerMonitor,
        clock: fakeClock
      });

      scheduler.start();
      powerMonitor.emit('resume');
      scheduler.stop();

      assert.equal(triggered, true, 'Resume event should trigger checkAndClose');
    });
  }, { businessDate: '2026-10-05' });
});

test('Night Rollover Feature - IPC Integration', async t => {
  await withSafeDatabase(async () => {
    const ipcMain = new FakeIpcMain();
    const deps = createFakeDeps();
    let rolloverCalled = false;
    deps.helpers.checkBusinessDayRollover = async () => {
      rolloverCalled = true;
      return { advancedDays: 1, businessDate: '2026-10-06' };
    };
    registerReportsIpc(ipcMain, deps);

    await t.test('unauthenticated call is denied', async () => {
      deps.session.currentUser = null;
      const res = await ipcMain.invoke('hotel-business-day:check-rollover', {});
      assert.equal(res.success, false);
      assert.match(res.error, /غير مصرح/);
    });

    await t.test('authenticated user triggers check-rollover and returns result', async () => {
      deps.session.currentUser = { id: 1, username: 'admin', role: 'Admin' };
      const res = await ipcMain.invoke('hotel-business-day:check-rollover', {});
      assert.equal(res.success, true);
      assert.equal(res.data.advancedDays, 1);
      assert.equal(res.data.businessDate, '2026-10-06');
      assert.equal(rolloverCalled, true);
    });
  });
});
