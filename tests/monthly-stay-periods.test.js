'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const connection = require('../db/connection');
const { assertDatabaseIntegrity, withSafeDatabase } = require('./helpers/safe-temp-db');
const { addDays, addRoom, createReservation } = require('./helpers/fixtures');

function calendarMonthCheckout(startDate, months = 1) {
  const [year, month, day] = String(startDate).split('-').map(Number);
  const targetMonthLastDay = new Date(year, month + months, 0).getDate();
  const targetDay = Math.min(day, targetMonthLastDay);
  const target = new Date(year, month - 1 + months, 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

test('monthly stay periods are independent from payment receipts', async () => {
  await withSafeDatabase(async appDb => {
    const today = appDb.getLocalDateString();
    const room = addRoom('MSP-101', 150);
    const reservationId = createReservation({
      roomId: room.id,
      checkIn: today,
      checkOut: calendarMonthCheckout(today, 2),
      totalPrice: 9000,
      bookingType: 'حجز شهري',
      monthlyPrice: 4500
    });
    let periods = appDb.getMonthlyBillingPeriods(reservationId);
    assert.equal(periods.length, 2, 'two booked months produce two stay periods');

    appDb.addPaymentToReservation({ reservationId, amount: 1000, monthlyPeriodId: periods[0].id });
    periods = appDb.getMonthlyBillingPeriods(reservationId);
    assert.equal(periods[0].remaining, 3500, 'first payment reduces the selected month balance');
    appDb.addPaymentToReservation({ reservationId, amount: 500, monthlyPeriodId: periods[0].id });
    periods = appDb.getMonthlyBillingPeriods(reservationId);
    assert.equal(periods[0].remaining, 3000, 'another installment reduces the same month balance');
    appDb.addPaymentToReservation({ reservationId, amount: 4500, monthlyPeriodId: periods[1].id });

    periods = appDb.getMonthlyBillingPeriods(reservationId);
    assert.equal(periods.length, 2, 'three receipts do not create a third month');
    assert.deepEqual(periods.map(period => period.amount), [1500, 4500]);
    assert.deepEqual(periods.map(period => period.remaining), [3000, 0]);
    assert.equal(periods[0].payments.length, 2, 'both partial payments are shown under month one');
    assert.equal(appDb.getReservationPayments(reservationId).length, 3);
    assertDatabaseIntegrity(connection, 'monthly payments remain attached to their stay periods');
  });
});

test('monthly extension periods exist unpaid and separate monthly discount from extra nights', async () => {
  await withSafeDatabase(async appDb => {
    const today = appDb.getLocalDateString();
    const room = addRoom('MSP-102', 150);
    const firstCheckout = calendarMonthCheckout(today);
    const reservationId = createReservation({
      roomId: room.id,
      checkIn: today,
      checkOut: firstCheckout,
      totalPrice: 4500,
      bookingType: 'حجز شهري',
      monthlyPrice: 4500
    });
    const extendedCheckout = addDays(calendarMonthCheckout(firstCheckout), 2);
    const extension = appDb.extendReservation({
      reservationId,
      newCheckOutDate: extendedCheckout,
      discountAmount: 200,
      settleAmount: 0
    });

    assert.equal(extension.success, true);
    assert.equal(extension.additionalCost, 4600, 'one discounted month plus two undiscounted nights');
    const periods = appDb.getMonthlyBillingPeriods(reservationId);
    assert.equal(periods.length, 2, 'a partial-night extension does not create a third month tab');
    assert.equal(periods[1].grossCharge, 4800);
    assert.equal(periods[1].discount, 200);
    assert.equal(periods[1].totalCharge, 4600);
    assert.equal(periods[1].remaining, 4600, 'the unpaid extension is still presented as due');
    assert.equal(periods[1].partialItems.length, 1);
    assert.equal(periods[1].partialItems[0].grossAmount, 300);
    assert.equal(periods[1].partialItems[0].discount, 0);

    const row = appDb.getReservationById(reservationId);
    const contract = appDb.computeContractValue(row);
    const preview = appDb.computeCheckoutSettlement(reservationId, {});
    assert.equal(row.total_price, 9100);
    assert.equal(row.discount_amount, 200);
    assert.equal(contract.baseCharge, 9300);
    assert.equal(contract.contractValue, 9100, 'extension discount is subtracted exactly once');
    assert.equal(preview.contractValue, 9100);
    assert.equal(preview.contractValueMismatch, false);
    assertDatabaseIntegrity(connection, 'unpaid monthly extension stays in the period ledger');
  });
});

test('legacy FIFO payments stay ahead of newer period-linked receipts in the display', async () => {
  await withSafeDatabase(async appDb => {
    const today = appDb.getLocalDateString();
    const room = addRoom('MSP-105', 150);
    const reservationId = createReservation({
      roomId: room.id,
      checkIn: today,
      checkOut: calendarMonthCheckout(today, 2),
      totalPrice: 9000,
      paidAmount: 5000,
      bookingType: 'حجز شهري',
      monthlyPrice: 4500
    });
    const oldReceipt = appDb.getReservationPayments(reservationId)[0].receipt_number;
    connection.db.run('DELETE FROM monthly_payment_allocations WHERE payment_id IN (SELECT id FROM payments WHERE reservation_id = ?)', [reservationId]);
    let periods = appDb.getMonthlyBillingPeriods(reservationId);
    assert.equal(periods[0].amount, 4500, 'legacy payment displays against the oldest month first');
    assert.equal(periods[1].amount, 500);

    const newPayment = appDb.addPaymentToReservation({
      reservationId,
      amount: 1000,
      monthlyPeriodId: periods[1].id
    });
    periods = appDb.getMonthlyBillingPeriods(reservationId);
    assert.deepEqual(
      periods[1].payments.map(payment => payment.receiptNumber),
      [oldReceipt, newPayment.receiptNumber],
      'legacy display allocation is applied chronologically before the newer saved allocation'
    );
    assert.equal(periods[1].amount, 1500);
  });
});

test('monthly discount multiplies by full months and legacy period migration preserves saved totals', async () => {
  await withSafeDatabase(async appDb => {
    const today = appDb.getLocalDateString();
    const room = addRoom('MSP-103', 150);
    const reservationId = createReservation({
      roomId: room.id,
      checkIn: today,
      checkOut: calendarMonthCheckout(today, 2),
      totalPrice: 8800,
      bookingType: 'حجز شهري',
      monthlyPrice: 4500,
      discountAmount: 100,
      discountReason: 'خصم شهري'
    });
    let periods = appDb.getMonthlyBillingPeriods(reservationId);
    assert.equal(periods.reduce((sum, period) => sum + period.grossCharge, 0), 9000);
    assert.equal(periods.reduce((sum, period) => sum + period.discount, 0), 200);
    assert.equal(periods.reduce((sum, period) => sum + period.totalCharge, 0), 8800);

    const initial = appDb.getReservationById(reservationId);
    const extension = appDb.extendReservation({
      reservationId,
      newCheckOutDate: calendarMonthCheckout(initial.check_out_date, 2),
      discountAmount: 200,
      settleAmount: 0
    });
    assert.equal(extension.additionalCost, 8600, 'a two-month extension applies two monthly discounts');
    periods = appDb.getMonthlyBillingPeriods(reservationId);
    assert.equal(periods.length, 4);
    assert.equal(periods.reduce((sum, period) => sum + period.grossCharge, 0), 18000);
    assert.equal(periods.reduce((sum, period) => sum + period.discount, 0), 600);
    assert.equal(periods.reduce((sum, period) => sum + period.totalCharge, 0), 17400);

    // Simulate a pre-migration reservation with a historical aggregate total that
    // differs from the current room price. Backfill must preserve these amounts.
    connection.db.run('DELETE FROM monthly_stay_periods WHERE reservation_id = ?', [reservationId]);
    connection.db.run('UPDATE reservations SET total_price = 7000, discount_amount = 500 WHERE id = ?', [reservationId]);
    const receiptsBefore = appDb.getReservationPayments(reservationId);
    periods = appDb.getMonthlyBillingPeriods(reservationId);
    const receiptsAfter = appDb.getReservationPayments(reservationId);
    assert.equal(periods.length, 4);
    assert.equal(periods.reduce((sum, period) => sum + period.grossCharge, 0), 7500);
    assert.equal(periods.reduce((sum, period) => sum + period.discount, 0), 500);
    assert.equal(periods.reduce((sum, period) => sum + period.totalCharge, 0), 7000);
    assert.deepEqual(receiptsAfter, receiptsBefore, 'migration does not rewrite old payment receipts');
    assertDatabaseIntegrity(connection, 'legacy monthly totals are retained during period migration');
  });
});

test('early checkout after a discounted extension matches preview and saved settlement', async () => {
  await withSafeDatabase(async appDb => {
    const today = appDb.getLocalDateString();
    const room = addRoom('MSP-104', 150);
    const firstCheckout = calendarMonthCheckout(today);
    const reservationId = createReservation({
      roomId: room.id,
      checkIn: today,
      checkOut: firstCheckout,
      totalPrice: 4400,
      paidAmount: 4400,
      bookingType: 'حجز شهري',
      monthlyPrice: 4500,
      discountAmount: 100,
      discountReason: 'خصم شهري'
    });
    const extensionCheckout = calendarMonthCheckout(firstCheckout);
    const extension = appDb.extendReservation({
      reservationId,
      newCheckOutDate: extensionCheckout,
      discountAmount: 200,
      settleAmount: 0
    });
    assert.equal(extension.success, true);

    const contract = appDb.computeContractValue(appDb.getReservationById(reservationId));
    const preview = appDb.computeCheckoutSettlement(reservationId, {});
    assert.equal(contract.contractValue, 8700);
    assert.equal(preview.contractValue, 8700);
    assert.equal(preview.contractValueMismatch, false);

    const settled = appDb.checkoutReservation(reservationId, { settleMode: 'defer' });
    assert.equal(settled.success, true);
    assert.equal(settled.finalTotal, 8700);
    const finalRow = appDb.getReservationById(reservationId);
    const periods = appDb.getMonthlyBillingPeriods(reservationId);
    assert.equal(finalRow.total_price, 8700);
    assert.equal(finalRow.discount_amount, 300);
    assert.equal(periods.reduce((sum, period) => sum + period.grossCharge, 0), 9000);
    assert.equal(periods.reduce((sum, period) => sum + period.discount, 0), 300);
    assert.equal(periods.reduce((sum, period) => sum + period.totalCharge, 0), finalRow.total_price);
    assertDatabaseIntegrity(connection, 'discounted monthly extension checkout matches preview');
  });
});
