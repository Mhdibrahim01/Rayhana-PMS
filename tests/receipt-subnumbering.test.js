'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const db = require('../db/index.js');
const { withSafeDatabase } = require('./helpers/safe-temp-db.js');

test('Receipt sub-numbering: payments for a reservation are sequentially numbered under the reservation base', async () => {
  await withSafeDatabase(async () => {
    const currentYear = new Date().getFullYear();

    // 1. Add room and customer
    const room1 = db.addRoom({
      room_number: 'SUB-101',
      type: 'مفردة',
      price_per_night: 100,
      monthly_price: 2400
    });
    const room2 = db.addRoom({
      room_number: 'SUB-102',
      type: 'مفردة',
      price_per_night: 200,
      monthly_price: 2400
    });

    const guest1 = db.addCustomer({
      name: 'علي عبد الله',
      phone: '0501112233',
      id_number: '1022334455'
    });
    const guest2 = db.addCustomer({
      name: 'خالد محمد',
      phone: '0509998877',
      id_number: '1099887766'
    });

    // 2. Create reservation 1 with partial payment (1200 out of 2400)
    const res1 = db.createReservation({
      guestName: guest1.name,
      guestPhone: guest1.phone,
      guestIdNumber: guest1.id_number,
      roomId: room1.id,
      checkInDate: '2026-11-01',
      checkOutDate: '2026-12-01',
      totalPrice: 2400,
      paidAmount: 1200,
      paymentMethod: 'نقداً',
      bookingType: 'حجز شهري'
    });

    assert.ok(res1.success);
    const resId1 = res1.reservationId;
    const paddedResId1 = String(resId1).padStart(4, '0');

    // Verify first payment receipt number: REC-YYYY-RRRR-01
    const payments1 = db.getReservationPayments(resId1);
    assert.equal(payments1.length, 1);
    assert.equal(payments1[0].receipt_number, `REC-${currentYear}-${paddedResId1}-01`);

    // 3. Add second payment of 600 to reservation 1
    const monthlyPeriods = db.getMonthlyBillingPeriods(resId1);
    const pay2Res = db.addPaymentToReservation({
      reservationId: resId1,
      amount: 600,
      paymentMethod: 'شبكة',
      notes: 'سداد دفعة ثانية',
      monthlyPeriodId: monthlyPeriods[0]?.id
    });
    assert.ok(pay2Res.success);

    const paymentsAfter2 = db.getReservationPayments(resId1);
    assert.equal(paymentsAfter2.length, 2);
    assert.equal(paymentsAfter2[0].receipt_number, `REC-${currentYear}-${paddedResId1}-01`);
    assert.equal(paymentsAfter2[1].receipt_number, `REC-${currentYear}-${paddedResId1}-02`);

    // 4. Add third payment of 600 to reservation 1
    const pay3Res = db.addPaymentToReservation({
      reservationId: resId1,
      amount: 600,
      paymentMethod: 'نقداً',
      notes: 'سداد دفعة ثالثة وأخيرة',
      monthlyPeriodId: monthlyPeriods[0]?.id
    });
    assert.ok(pay3Res.success);

    const paymentsAfter3 = db.getReservationPayments(resId1);
    assert.equal(paymentsAfter3.length, 3);
    assert.equal(paymentsAfter3[0].receipt_number, `REC-${currentYear}-${paddedResId1}-01`);
    assert.equal(paymentsAfter3[1].receipt_number, `REC-${currentYear}-${paddedResId1}-02`);
    assert.equal(paymentsAfter3[2].receipt_number, `REC-${currentYear}-${paddedResId1}-03`);

    // 5. Create reservation 2: its first payment should start at -01 for reservation 2
    const res2 = db.createReservation({
      guestName: guest2.name,
      guestPhone: guest2.phone,
      guestIdNumber: guest2.id_number,
      roomId: room2.id,
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-05',
      totalPrice: 800,
      paidAmount: 400,
      paymentMethod: 'نقداً'
    });
    assert.ok(res2.success);
    const resId2 = res2.reservationId;
    const paddedResId2 = String(resId2).padStart(4, '0');

    const payments2 = db.getReservationPayments(resId2);
    assert.equal(payments2.length, 1);
    assert.equal(payments2[0].receipt_number, `REC-${currentYear}-${paddedResId2}-01`);
    assert.notEqual(paddedResId1, paddedResId2);
  });
});
