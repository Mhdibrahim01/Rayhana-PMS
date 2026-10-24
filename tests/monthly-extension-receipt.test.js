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

function getTestCalendarMonthCheckOut(checkInDateStr, months = 1) {
  const [y, m, d] = String(checkInDateStr).split('-').map(Number);
  const numMonths = Math.max(1, parseInt(months, 10) || 1);
  const lastDayOfTargetMonth = new Date(y, m + numMonths, 0).getDate();
  const clampedDay = Math.min(d, lastDayOfTargetMonth);
  const targetMonth = new Date(y, m - 1 + numMonths, 1);
  return `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

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
      assert.ok(dashboardSrc.includes("label: 'كشف الحساب الشامل'"), 'monthly receipt tabs must include a cumulative view');
      assert.ok(dashboardSrc.includes('monthlyReceiptCyclesByNumber'), 'monthly receipts must be grouped into separate receipt cycles');
      assert.ok(dashboardSrc.includes('data-cycle-index="${tab.index}"'), 'each receipt cycle must have a selectable tab');
      assert.ok(dashboardSrc.includes('إقامة سكنية - وحدة ${escapeHtml(receiptDigits(inv.room_number))} (${escapeHtml(cycle.tabLabel)})'), 'the cumulative view must show one row per receipt cycle');
      assert.ok(dashboardSrc.includes('معاينة: ${currentCycle.tabLabel}'), 'the selected tab preview must show its label and receipt number');
      assert.ok(dashboardSrc.includes('سند القبض: <span style="font-family: monospace; font-weight: 700;">${escapeHtml(receiptDigits(currentCycle.receiptNumber))}</span> — ${formatReceiptMoney(cyclePaid)} ر.س'), 'a multi-month receipt must be shown once with its total amount');
      assert.ok(!dashboardSrc.includes('الدفعات المرتبطة:'), 'single receipt preview must not show duplicated monthly allocations as separate payments');

      // Multi-month duration options in HTML
      assert.ok(dashboardHtml.includes('id="monthly-duration-container"'), 'HTML must have monthly-duration-container');
      assert.ok(dashboardHtml.includes('id="monthly-duration-select"'), 'HTML must have monthly-duration-select');
      assert.ok(dashboardHtml.includes('class="btn btn-secondary btn-sm btn-quick-month"'), 'HTML must have btn-quick-month');
      assert.ok(dashboardHtml.includes('id="extend-monthly-pills-container"'), 'HTML must have extend-monthly-pills-container');
      assert.ok(dashboardHtml.includes('class="btn btn-secondary btn-sm btn-quick-extend-month"'), 'HTML must have btn-quick-extend-month');
    });

    await t.test('multi-month initial reservation (3 months) calculates duration and contract value accurately', () => {
      const room = addRoom('MREC-103', 150);
      const start1 = today;
      const expectedCheckout = getTestCalendarMonthCheckOut(start1, 3);

      const resResult = appDb.createReservation({
        guestName: 'نزيل ثلاثة أشهر',
        guestPhone: '0501234567',
        roomId: room.id,
        checkInDate: start1,
        totalPrice: monthlyRate * 3,
        paidAmount: monthlyRate * 3,
        bookingType: 'حجز شهري',
        monthlyPrice: monthlyRate,
        monthsCount: 3
      });

      assert.ok(resResult && resResult.success, 'Multi-month booking must succeed');
      const resId = resResult.reservationId;
      const resRow = appDb.getReservationById(resId);

      assert.equal(resRow.monthly_months_count, 3, 'monthly_months_count should be 3');
      assert.equal(resRow.total_price, monthlyRate * 3, 'Total price is 3 * 4500 = 13500');
      assert.equal(resRow.check_out_date, expectedCheckout, 'Checkout date should span 3 calendar months');

      const contract = appDb.computeContractValue(resRow);
      assert.equal(contract.contractValue, monthlyRate * 3, 'Contract value must equal 3 * monthlyRate');
      assertDatabaseIntegrity(connection, 'multi-month booking integrity');
    });

    await t.test('multi-month extension (+2 months) calculates extension cost and preserves contract value', () => {
      const room = addRoom('MREC-104', 150);
      const start1 = today;

      const resResult = appDb.createReservation({
        guestName: 'نزيل تمديد شهرين',
        guestPhone: '0507654321',
        roomId: room.id,
        checkInDate: start1,
        totalPrice: monthlyRate,
        paidAmount: monthlyRate,
        bookingType: 'حجز شهري',
        monthlyPrice: monthlyRate,
        monthsCount: 1
      });

      const resId = resResult.reservationId;
      const initialRes = appDb.getReservationById(resId);
      const initialCheckout = initialRes.check_out_date;

      // Extend by 2 calendar months
      const targetNewCheckout = getTestCalendarMonthCheckOut(initialCheckout, 2);
      const extendRes = appDb.extendReservation({
        reservationId: resId,
        newCheckOutDate: targetNewCheckout,
        settleAmount: monthlyRate * 2,
        paymentMethod: 'مدى',
        notes: 'تمديد شهرين تقويميين'
      });

      assert.ok(extendRes.success, '2-month extension must succeed');
      assert.equal(extendRes.additionalCost, monthlyRate * 2, 'Extension cost must be 2 * 4500 = 9000');
      assert.equal(extendRes.cycleCost, monthlyRate * 2);

      const updatedRes = appDb.getReservationById(resId);
      assert.equal(updatedRes.total_price, monthlyRate * 3, 'New total price is 4500 + 9000 = 13500');
      assert.equal(updatedRes.check_out_date, targetNewCheckout);

      const contract = appDb.computeContractValue(updatedRes);
      assert.equal(contract.contractValue, monthlyRate * 3, 'Contract value after extension must be 13500');
      assertDatabaseIntegrity(connection, 'multi-month extension integrity');
    });

    await t.test('multi-month extension (+6 months) stamps correct period, cost, and calculates 6-month receipt cycle', () => {
      const room = addRoom('MREC-105', 150);
      const start1 = today;
      const end1 = getTestCalendarMonthCheckOut(start1, 1);
      const end2 = getTestCalendarMonthCheckOut(end1, 1);
      const end3 = getTestCalendarMonthCheckOut(end2, 6);

      // Month 1
      const resId = createReservation({
        roomId: room.id,
        checkIn: start1,
        checkOut: end1,
        totalPrice: monthlyRate,
        paidAmount: monthlyRate,
        bookingType: 'حجز شهري',
        monthlyPrice: monthlyRate,
        monthsCount: 1
      });

      // Month 2 extension (+1 month)
      const ext1 = appDb.extendReservation({
        reservationId: resId,
        newCheckOutDate: end2,
        settleAmount: monthlyRate,
        paymentMethod: 'مدى',
        notes: 'تمديد شهر ثاني'
      });
      assert.ok(ext1.success);

      // Month 3 to 8 extension (+6 months)
      const ext2 = appDb.extendReservation({
        reservationId: resId,
        newCheckOutDate: end3,
        settleAmount: monthlyRate * 6,
        paymentMethod: 'مدى',
        notes: 'تمديد ستة أشهر تقويمية'
      });
      assert.ok(ext2.success, '6-month extension must succeed');
      assert.equal(ext2.additionalCost, 27000, 'Extension cost for 6 months is 27,000 SAR');
      assert.equal(ext2.cycleCost, 27000);

      const payments = appDb.getReservationPayments(resId);
      assert.equal(payments.length, 3, 'Must have 3 payment records');

      const p3 = payments[2];
      assert.equal(p3.amount, 27000);
      assert.equal(p3.period_start_date, end2);
      assert.equal(p3.period_end_date, end3);

      // Verify dashboard monthly cycles computation
      const [sy, sm, sd] = p3.period_start_date.split('-').map(Number);
      let calculatedMonths = 1;
      for (let m = 1; m <= 36; m++) {
        const lastDay = new Date(sy, sm + m, 0).getDate();
        const clamped = Math.min(sd, lastDay);
        const tgt = new Date(sy, sm - 1 + m, 1);
        const expEnd = `${tgt.getFullYear()}-${String(tgt.getMonth() + 1).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`;
        if (p3.period_end_date === expEnd) {
          calculatedMonths = m;
          break;
        }
      }
      assert.equal(calculatedMonths, 6, 'Cycle duration must be exactly 6 months');
      const cycleTotalCharge = monthlyRate * calculatedMonths;
      assert.equal(cycleTotalCharge, 27000, 'Cycle total charge must be 27,000 SAR');
      const cycleRemaining = Math.max(0, cycleTotalCharge - p3.amount);
      assert.equal(cycleRemaining, 0, 'Remaining must be 0 for paid in full 6-month extension');

      assertDatabaseIntegrity(connection, 'multi-month 6-month extension integrity');
    });

    await t.test('single-month booking with multiple partial payments (installments) generates correct installment receipt tabs and cumulative rows', () => {
      const room = addRoom('MREC-106', 150);
      const start1 = today;
      const monthlyPrice = 2400;

      // 1. Initial booking with 1st payment: 1200 SAR
      const resResult = appDb.createReservation({
        guestName: 'نزيل دفعات جزئية',
        guestPhone: '0555555555',
        roomId: room.id,
        checkInDate: start1,
        totalPrice: monthlyPrice,
        paidAmount: 1200,
        bookingType: 'حجز شهري',
        monthlyPrice: monthlyPrice,
        monthsCount: 1
      });
      assert.ok(resResult && resResult.success);
      const resId = resResult.reservationId;

      let periods = appDb.getMonthlyBillingPeriods(resId);
      assert.equal(periods.length, 1, 'Only 1 month period booked');
      assert.equal(periods[0].remaining, 1200);

      // 2. 2nd payment: 100 SAR
      const pay2 = appDb.addPaymentToReservation({
        reservationId: resId,
        amount: 100,
        paymentMethod: 'نقداً',
        monthlyPeriodId: periods[0].id
      });
      assert.ok(pay2.success);

      // 3. 3rd payment: 1100 SAR
      const pay3 = appDb.addPaymentToReservation({
        reservationId: resId,
        amount: 1100,
        paymentMethod: 'نقداً',
        monthlyPeriodId: periods[0].id
      });
      assert.ok(pay3.success);

      periods = appDb.getMonthlyBillingPeriods(resId);
      assert.equal(periods.length, 1, 'Still exactly 1 month period despite 3 payments');
      assert.equal(periods[0].amount, 2400);
      assert.equal(periods[0].remaining, 0);
      assert.equal(periods[0].payments.length, 3);

      const payments = appDb.getReservationPayments(resId);
      assert.equal(payments.length, 3);

      // Simulate the exact dashboard.js cycle calculation
      const monthlyCycles = [];
      periods.forEach((period, idx) => {
        const periodPayments = Array.isArray(period.payments) ? period.payments : [];
        monthlyCycles.push({
          index: idx,
          periodId: period.id,
          title: period.title || `الشهر ${idx + 1}`,
          startDate: period.startDate,
          endDate: period.endDate,
          amount: Number(period.amount || 0),
          payments: periodPayments,
          partialItems: Array.isArray(period.partialItems) ? period.partialItems : [],
          rate: monthlyPrice,
          monthsCount: 1,
          durationText: 'شهر',
          monthGrossCharge: Number(period.monthGrossCharge ?? period.grossCharge ?? 0),
          grossCharge: Number(period.grossCharge || 0),
          discount: Number(period.discount || 0),
          totalCharge: Number(period.totalCharge || 0),
          paymentMethod: period.paymentMethod || ''
        });
      });

      const roundMoney = appDb.roundMoney;
      const monthlyReceiptCyclesByNumber = new Map();
      monthlyCycles.forEach(cycle => {
        let periodAllocatedCumulative = 0;
        cycle.payments.forEach((payment, paymentIdx) => {
          const receiptNumber = String(payment.receiptNumber || '').trim();
          const allocatedAmount = Number(payment.amount || 0);
          if (!receiptNumber || allocatedAmount <= 0) return;

          const previousAllocatedInPeriod = periodAllocatedCumulative;
          periodAllocatedCumulative = roundMoney(periodAllocatedCumulative + allocatedAmount);

          let receiptCycle = monthlyReceiptCyclesByNumber.get(receiptNumber);
          if (!receiptCycle) {
            receiptCycle = {
              receiptNumber,
              startDate: cycle.startDate,
              endDate: cycle.endDate,
              amount: 0,
              payments: [],
              periodIds: new Set(),
              periods: [],
              partialItems: [],
              rate: cycle.rate,
              monthsCount: 0,
              monthGrossCharge: 0,
              grossCharge: 0,
              discount: 0,
              totalCharge: 0,
              previousPaid: 0,
              paymentDate: payment.paymentDate || cycle.paymentDate,
              paymentMethod: payment.paymentMethod || cycle.paymentMethod
            };
            monthlyReceiptCyclesByNumber.set(receiptNumber, receiptCycle);
          }

          receiptCycle.amount = roundMoney(receiptCycle.amount + allocatedAmount);
          receiptCycle.previousPaid = roundMoney(receiptCycle.previousPaid + previousAllocatedInPeriod);
          receiptCycle.payments.push({
            receiptNumber,
            amount: allocatedAmount,
            periodId: cycle.periodId,
            periodTitle: cycle.title,
            paymentIndex: paymentIdx,
            periodPaymentsCount: cycle.payments.length
          });
          if (!receiptCycle.periodIds.has(cycle.periodId)) {
            receiptCycle.periodIds.add(cycle.periodId);
            receiptCycle.periods.push(cycle);
            receiptCycle.monthsCount += cycle.monthsCount;
            receiptCycle.monthGrossCharge = roundMoney(receiptCycle.monthGrossCharge + cycle.monthGrossCharge);
            receiptCycle.grossCharge = roundMoney(receiptCycle.grossCharge + cycle.grossCharge);
            receiptCycle.discount = roundMoney(receiptCycle.discount + cycle.discount);
            receiptCycle.totalCharge = roundMoney(receiptCycle.totalCharge + cycle.totalCharge);
            receiptCycle.partialItems.push(...cycle.partialItems);
          }
        });
      });

      const monthlyReceiptCycles = Array.from(monthlyReceiptCyclesByNumber.values()).map(cycle => {
        const monthsCount = Number(cycle.monthsCount) || 1;
        const durationText = cycle.monthsCount === 1 ? 'شهر' : `${monthsCount} أشهر`;
        cycle.durationText = durationText;

        if (cycle.periods.length === 1) {
          const period = cycle.periods[0];
          if (period.payments.length > 1) {
            const pInfo = cycle.payments.find(p => p.periodId === period.periodId);
            const defaIdx = (pInfo ? pInfo.paymentIndex : 0) + 1;
            cycle.tabLabel = `سند ${period.title} - دفعة ${defaIdx}`;
            cycle.installmentText = `دفعة ${defaIdx}`;
          } else {
            cycle.tabLabel = `سند ${period.title} (${durationText})`;
            cycle.installmentText = '';
          }
        }
        return cycle;
      });

      assert.equal(monthlyReceiptCycles.length, 3, 'Should have 3 receipt cycles for 3 payments');
      assert.equal(monthlyReceiptCycles[0].tabLabel, 'سند الشهر الأول - دفعة 1');
      assert.equal(monthlyReceiptCycles[1].tabLabel, 'سند الشهر الأول - دفعة 2');
      assert.equal(monthlyReceiptCycles[2].tabLabel, 'سند الشهر الأول - دفعة 3');

      // Verify receipt financial balances (previousPaid + thisPaid + remaining)
      // Receipt 1 (1200 SAR)
      const r1 = monthlyReceiptCycles[0];
      assert.equal(r1.amount, 1200);
      assert.equal(r1.previousPaid, 0);
      const r1Cumul = roundMoney(r1.previousPaid + r1.amount);
      assert.equal(r1Cumul, 1200);
      assert.equal(roundMoney(r1.totalCharge - r1Cumul), 1200);

      // Receipt 2 (100 SAR)
      const r2 = monthlyReceiptCycles[1];
      assert.equal(r2.amount, 100);
      assert.equal(r2.previousPaid, 1200);
      const r2Cumul = roundMoney(r2.previousPaid + r2.amount);
      assert.equal(r2Cumul, 1300);
      assert.equal(roundMoney(r2.totalCharge - r2Cumul), 1100, 'Remaining after 2nd payment must be 1100, NOT 2300!');

      // Receipt 3 (1100 SAR)
      const r3 = monthlyReceiptCycles[2];
      assert.equal(r3.amount, 1100);
      assert.equal(r3.previousPaid, 1300);
      const r3Cumul = roundMoney(r3.previousPaid + r3.amount);
      assert.equal(r3Cumul, 2400);
      assert.equal(roundMoney(r3.totalCharge - r3Cumul), 0, 'Remaining after 3rd payment must be 0, NOT 1300!');

      // Cumulative view rows verification
      const displayedCycles = monthlyCycles.map(cycle => ({
        ...cycle,
        tabLabel: cycle.title,
        monthGrossCharge: Number(cycle.monthGrossCharge ?? cycle.grossCharge ?? 0)
      }));
      assert.equal(displayedCycles.length, 1, 'Cumulative statement must show exactly 1 row for Month 1, NOT 3 rows!');
      assert.equal(displayedCycles[0].monthGrossCharge, 2400);

      assertDatabaseIntegrity(connection, 'monthly partial payment installments integrity');
    });
  });
});
