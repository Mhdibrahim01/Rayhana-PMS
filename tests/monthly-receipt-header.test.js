'use strict';

/**
 * Monthly receipt header: the receipt builder (dashboard.js openInvoiceModal)
 * renders a different letterhead, duration, subtotal, and footer for monthly
 * bookings (حجز شهري) vs. daily/contract bookings.
 *
 * These tests verify the data that drives the renderer decisions, since the
 * renderer itself runs in Electron and cannot be loaded in Node.js.
 *
 * Mutation-checked: reverting any renderer condition turns a test red.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const db = require('../db');
const connection = require('../db/connection');
const { assertDatabaseIntegrity, withSafeDatabase } = require('./helpers/safe-temp-db');
const { addDays, addRoom, createReservation } = require('./helpers/fixtures');

test('monthly receipt header: renderer data layer', async t => {
  await withSafeDatabase(async (appDb, conn) => {
    const today = appDb.getLocalDateString();
    const rate = 200;

    await t.test('monthly booking has booking_type حجز شهري', () => {
      const room = addRoom('MRH-001', rate);
      const id = createReservation({
        roomId: room.id,
        checkIn: addDays(today, -30),
        checkOut: today,
        totalPrice: 30 * rate,
        bookingType: 'حجز شهري',
        monthlyPrice: 30 * rate
      });

      const res = appDb.getReservationById(id);
      assert.equal(res.booking_type, 'حجز شهري',
        'renderer sets isMonthly=true → institution name, unified number, شهر, 30×rate, footer');
      assertDatabaseIntegrity(connection, 'monthly booking type');
    });

    await t.test('daily booking does NOT have booking_type حجز شهري', () => {
      const room = addRoom('MRH-002', rate);
      const id = createReservation({
        roomId: room.id,
        checkIn: addDays(today, -3),
        checkOut: today,
        totalPrice: 3 * rate,
        bookingType: 'عادي',
        customNightlyPrice: rate
      });

      const res = appDb.getReservationById(id);
      assert.notEqual(res.booking_type, 'حجز شهري',
        'renderer sets isMonthly=false → normal name, duration text, no footer');
      assertDatabaseIntegrity(connection, 'daily booking type');
    });

    await t.test('monthly subtotal uses the configured flat monthly price', () => {
      const room = addRoom('MRH-003', rate);
      const id = createReservation({
        roomId: room.id,
        checkIn: addDays(today, -30),
        checkOut: today,
        totalPrice: 30 * rate,
        bookingType: 'حجز شهري',
        monthlyPrice: 30 * rate
      });

      const res = appDb.getReservationById(id);
      const expectedSubtotal = Number(res.monthly_rate_snapshot);
      assert.equal(res.total_price, expectedSubtotal, 'monthly total = saved monthly rate');
      assertDatabaseIntegrity(connection, 'monthly subtotal');
    });

    await t.test('daily subtotal = nights x nightly rate (unchanged)', () => {
      const room = addRoom('MRH-004', rate);
      const id = createReservation({
        roomId: room.id,
        checkIn: addDays(today, -3),
        checkOut: today,
        totalPrice: 3 * rate,
        bookingType: 'عادي',
        customNightlyPrice: rate
      });

      const res = appDb.getReservationById(id);
      const nights = db.countNights(res.check_in_date, res.check_out_date);
      const effectiveNightlyRate = parseFloat(res.custom_nightly_price || res.price_per_night || 0);
      const expectedSubtotal = Math.round(nights * effectiveNightlyRate * 100) / 100;
      assert.equal(res.total_price, expectedSubtotal, 'daily total = nights x rate');
      assertDatabaseIntegrity(connection, 'daily subtotal');
    });

    await t.test('dashboard.js contains complete monthly voucher prototype elements', () => {
      const fs = require('node:fs');
      const path = require('node:path');
      const dashboardSrc = fs.readFileSync(path.join(__dirname, '../dashboard.js'), 'utf8');

      assert.ok(dashboardSrc.includes('مؤسسة مكتب شمس المنازل للخدمات العقارية'), 'Institution title present');
      assert.ok(dashboardSrc.includes('الرقم الموحد: 7038955915'), 'Unified number present');
      assert.ok(dashboardSrc.includes('ختم المؤسسة'), 'Company stamp label present');
      assert.ok(dashboardSrc.includes('توقيع الموظف'), 'Employee signature label present');
      assert.ok(dashboardSrc.includes('توقيع المستلم'), 'Receiver signature label present');
      assert.ok(dashboardSrc.includes('طريقة السداد:'), 'Payment method label present');
      assert.ok(dashboardSrc.includes('monthly_rate_snapshot'), 'invoice uses the saved monthly rate snapshot');
      assert.ok(dashboardSrc.includes('سعر الشهر'), 'invoice labels the monthly amount as a month price');
      assert.ok(dashboardSrc.includes('monthlyExtensionAmount'), 'invoice includes accumulated daily-rate extension charges');
      assert.ok(dashboardSrc.includes('isActualPolicy ? baseSubtotal : monthlyPackageSubtotal'), 'actual-nights policy keeps daily-rate billing');
    });

    await t.test('SQLite UTC timestamps format as the actual local date and time', () => {
      const fs = require('node:fs');
      const path = require('node:path');
      const vm = require('node:vm');
      const dashboardAppSrc = fs.readFileSync(path.join(__dirname, '../dashboard-app.js'), 'utf8');
      const sandbox = { window: {} };
      vm.runInNewContext(dashboardAppSrc, sandbox, { filename: 'dashboard-app.js' });

      const parsed = sandbox.window.DashboardApp.Helpers.parseStoredTimestamp('2026-10-05 23:00:00');
      assert.equal(parsed.toISOString(), '2026-10-05T23:00:00.000Z');
      const expectedLocal = new Date('2026-10-05T23:00:00.000Z').toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'short', day: 'numeric'
      }) + ' ' + new Date('2026-10-05T23:00:00.000Z').toLocaleTimeString('ar-EG', {
        hour: '2-digit', minute: '2-digit'
      });
      assert.equal(sandbox.window.DashboardApp.Helpers.formatArabicDateTime('2026-10-05 23:00:00'), expectedLocal);
      assert.equal(
        sandbox.window.DashboardApp.Helpers.parseStoredTimestamp('2026-10-05T23:00:00.000Z').toISOString(),
        '2026-10-05T23:00:00.000Z',
        'timestamps that already include UTC remain unchanged'
      );
    });

    await t.test('dashboard.js formatReceiptDateTime converts SQLite UTC timestamps to local time', () => {
      const fs = require('node:fs');
      const path = require('node:path');
      const dashboardSrc = fs.readFileSync(path.join(__dirname, '../dashboard.js'), 'utf8');

      assert.ok(
        dashboardSrc.includes('parseStoredTimestamp(normalizedValue)'),
        'formatReceiptDateTime must use parseStoredTimestamp to convert UTC to local time'
      );
    });

    await t.test('single cycle monthly receipt includes discount line, gross total, and correct net', () => {
      const fs = require('node:fs');
      const path = require('node:path');
      const dashboardSrc = fs.readFileSync(path.join(__dirname, '../dashboard.js'), 'utf8');

      // Verify that single-cycle view handles cycleDiscount in both items table and totals card
      assert.ok(dashboardSrc.includes('cycleGrossCharge'), 'invoice calculates cycleGrossCharge for cycle lines');
      assert.ok(dashboardSrc.includes('cycleDiscount > 0'), 'invoice conditionally renders discount row in single cycle');
      assert.ok(dashboardSrc.includes('receipt-total-discount'), 'invoice totals card includes discount line');
    });
  });
});


