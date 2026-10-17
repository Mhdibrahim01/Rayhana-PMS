'use strict';

/**
 * Monthly Extension Receipts & Multi-Cycle Billing Tests:
 * Verifies that extending a monthly reservation creates an independent receipt
 * with its own sequential receipt number, payment timestamp, period dates,
 * and single-month clean breakdown without any "سند التمديد" or "رسوم التمديد بالسعر اليومي".
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const db = require('../db');
const connection = require('../db/connection');
const { assertDatabaseIntegrity, withSafeDatabase } = require('./helpers/safe-temp-db');
const { addDays, addRoom, createReservation } = require('./helpers/fixtures');

test('monthly extension receipts: independent receipt cycle & clean accounting', async t => {
  await withSafeDatabase(async (appDb, conn) => {
    const today = appDb.getLocalDateString();
    const monthlyRate = 4500;

    await t.test('initial monthly reservation payment stamps period start and end dates', () => {
      const room = addRoom('MREC-101', 150);
      const start1 = today;
      const end1 = addDays(today, 30);

      const resId = createReservation({
        roomId: room.id,
        checkIn: start1,
        checkOut: end1,
        totalPrice: monthlyRate,
        paidAmount: monthlyRate,
        bookingType: 'حجز شهري',
        monthlyPrice: monthlyRate
      });

      const payments = appDb.getReservationPayments(resId);
      assert.ok(Array.isArray(payments) && payments.length === 1, 'Should have initial payment');
      const p1 = payments[0];
      assert.equal(p1.amount, monthlyRate);
      assert.equal(p1.period_start_date, start1, 'Payment 1 period_start_date should match check-in');
      assert.equal(p1.period_end_date, end1, 'Payment 1 period_end_date should match initial checkout');
      assert.ok(p1.receipt_number && p1.receipt_number.startsWith('REC-'), 'Should have unique receipt number');
      assertDatabaseIntegrity(connection, 'initial monthly payment period stamped');
    });

    await t.test('extending monthly stay creates independent payment receipt for Month 2', () => {
      const room = addRoom('MREC-102', 150);
      const start1 = today;
      const end1 = addDays(today, 30);
      const end2 = addDays(today, 60);

      const resId = createReservation({
        roomId: room.id,
        checkIn: start1,
        checkOut: end1,
        totalPrice: monthlyRate,
        paidAmount: monthlyRate,
        bookingType: 'حجز شهري',
        monthlyPrice: monthlyRate
      });

      // Extend for another month (paying 4500)
      const extendRes = appDb.extendReservation({
        reservationId: resId,
        newCheckOutDate: end2,
        settleAmount: monthlyRate,
        paymentMethod: 'مدى',
        notes: 'تمديد شهر جديد'
      });
      assert.ok(extendRes.success, 'Extension should succeed');
      assert.ok(extendRes.receiptNumber, 'Should generate new receipt number');
      assert.equal(extendRes.isMonthly, true);
      assert.equal(extendRes.periodStartDate, end1);
      assert.equal(extendRes.periodEndDate, end2);
      assert.equal(extendRes.cycleCost, monthlyRate);

      const payments = appDb.getReservationPayments(resId);
      assert.equal(payments.length, 2, 'Should have exactly 2 payments for 2 months');

      const p1 = payments[0];
      const p2 = payments[1];

      assert.notEqual(p1.receipt_number, p2.receipt_number, 'Month 2 must have an independent receipt number');
      assert.equal(p2.amount, monthlyRate, 'Month 2 payment amount is 4500');
      assert.equal(p2.period_start_date, end1, 'Month 2 starts where Month 1 ended');
      assert.equal(p2.period_end_date, end2, 'Month 2 ends at new checkout');

      // Verify payment receipt query returns cycle dates and monthly rate snapshot
      const receipt1 = appDb.getPaymentReceipt(p1.id);
      const receipt2 = appDb.getPaymentReceipt(p2.id);

      assert.equal(receipt1.receipt_number, p1.receipt_number);
      assert.equal(receipt1.booking_type, 'حجز شهري');
      assert.equal(receipt2.receipt_number, p2.receipt_number);
      assert.equal(receipt2.period_start_date, end1);
      assert.equal(receipt2.period_end_date, end2);

      assertDatabaseIntegrity(connection, 'monthly extension payment verification');
    });

    await t.test('UI markup and scripts: strict absence of "رسوم التمديد بالسعر اليومي" and presence of tabs', () => {
      const dashboardSrc = fs.readFileSync(path.join(__dirname, '../dashboard.js'), 'utf8');
      const dashboardHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');

      // Strict requirement: Never say "رسوم التمديد بالسعر اليومي"
      assert.ok(!dashboardSrc.includes('رسوم التمديد بالسعر اليومي'), 'dashboard.js must NOT contain "رسوم التمديد بالسعر اليومي"');
      assert.ok(!dashboardSrc.includes('سند التمديد'), 'dashboard.js must NOT contain "سند التمديد"');

      // HTML contains tabs container
      assert.ok(dashboardHtml.includes('id="invoice-receipt-tabs-bar"'), 'HTML must have invoice-receipt-tabs-bar');
      assert.ok(dashboardHtml.includes('id="invoice-receipt-tabs-container"'), 'HTML must have invoice-receipt-tabs-container');
      assert.ok(dashboardHtml.includes('id="invoice-active-tab-indicator"'), 'HTML must have invoice-active-tab-indicator');
    });
  });
});
