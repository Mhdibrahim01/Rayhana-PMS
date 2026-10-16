'use strict';

const assert = require('node:assert/strict');
const { withSafeDatabase } = require('../tests/helpers/safe-temp-db');
const { addDays } = require('../tests/helpers/fixtures');

async function runComprehensiveMatrix() {
  const results = [];

  await withSafeDatabase(async (db, connection, tempDbPath) => {
    const today = db.getLocalDateString();
    let roomCounter = 1;

    function getFreshRoom(price = 100, type = 'مفردة') {
      const roomNum = `R-${String(roomCounter++).padStart(3, '0')}`;
      db.addRoom({
        room_number: roomNum,
        type,
        price_per_night: price,
        monthly_price: price * 30,
        status: 'متاحة'
      });
      return db.getAllRooms().find(r => r.room_number === roomNum);
    }

    async function recordScenario(category, id, name, fn) {
      const start = Date.now();
      try {
        const details = await fn();
        const duration = Date.now() - start;
        results.push({ category, id, name, status: 'PASS', duration, details, error: null });
      } catch (err) {
        const duration = Date.now() - start;
        results.push({ category, id, name, status: 'FAIL', duration, details: null, error: err.message });
      }
    }

    // =========================================================================
    // CATEGORY 1: Standard Daily Reservations (حجز يومي)
    // =========================================================================
    await recordScenario('1. حجز يومي (Standard Daily)', 'S1.1', 'سداد كامل عند الحجز ومغادرة عادية', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'نزيل عادي 1', roomId: room.id,
        checkInDate: addDays(today, -2), checkOutDate: today,
        bookingType: 'يومي', totalPrice: 200, paidAmount: 200, paymentMethod: 'نقداً'
      });
      const preview = db.computeCheckoutSettlement(res.reservationId);
      assert.equal(preview.isSettled, true);
      assert.equal(preview.difference, 0);

      const co = db.checkoutReservation(res.reservationId, { settleMode: 'defer' });
      assert.equal(co.success, true);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.status, 'مكتمل');
      assert.equal(after.payment_status, 'مدفوع بالكامل');
      assert.equal(after.paid_amount, 200);
      assert.equal(after.total_price, 200);
      const roomAfter = db.getRoomById(room.id);
      assert.equal(roomAfter.status, 'تنظيف');
      return { total: 200, paid: 200, status: after.payment_status };
    });

    await recordScenario('1. حجز يومي (Standard Daily)', 'S1.2', 'سداد جزئي عند الحجز وتحصيل المتبقي عند المغادرة (Collect)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'نزيل عادي 2', roomId: room.id,
        checkInDate: addDays(today, -2), checkOutDate: today,
        bookingType: 'يومي', totalPrice: 200, paidAmount: 50, paymentMethod: 'نقداً'
      });
      const preview = db.computeCheckoutSettlement(res.reservationId);
      assert.equal(preview.needsCollection, true);
      assert.equal(preview.difference, 150);

      const co = db.checkoutReservation(res.reservationId, { settleMode: 'collect', collectAmount: 150, paymentMethod: 'شبكة' });
      assert.equal(co.success, true);
      assert.ok(co.collectionReceiptNumber);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.status, 'مكتمل');
      assert.equal(after.payment_status, 'مدفوع بالكامل');
      assert.equal(after.paid_amount, 200);
      const pays = db.getReservationPayments(res.reservationId);
      assert.equal(pays.length, 2);
      assert.equal(pays[1].amount, 150);
      assert.equal(pays[1].payment_method, 'شبكة');
      return { total: 200, collected: 150, finalPaid: after.paid_amount };
    });

    await recordScenario('1. حجز يومي (Standard Daily)', 'S1.3', 'سداد جزئي عند الحجز وترحيل المتبقي كدين آجل (Defer)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'نزيل عادي 3', roomId: room.id,
        checkInDate: addDays(today, -2), checkOutDate: today,
        bookingType: 'يومي', totalPrice: 200, paidAmount: 50, paymentMethod: 'نقداً'
      });
      const co = db.checkoutReservation(res.reservationId, { settleMode: 'defer' });
      assert.equal(co.success, true);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.status, 'مكتمل');
      assert.equal(after.payment_status, 'مدفوع جزئياً');
      assert.equal(after.paid_amount, 50);
      return { total: 200, paid: 50, remaining: 150, status: after.payment_status };
    });

    await recordScenario('1. حجز يومي (Standard Daily)', 'S1.4', 'بدون سداد مسبق وتحصيل كامل المبلغ عند المغادرة (Zero -> Collect)', async () => {
      const room = getFreshRoom(150);
      const res = db.createReservation({
        guestName: 'نزيل عادي 4', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: today,
        bookingType: 'يومي', totalPrice: 150, paidAmount: 0, paymentMethod: 'نقداً'
      });
      const co = db.checkoutReservation(res.reservationId, { settleMode: 'collect', collectAmount: 150 });
      assert.equal(co.success, true);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.payment_status, 'مدفوع بالكامل');
      assert.equal(after.paid_amount, 150);
      return { total: 150, collected: 150, status: after.payment_status };
    });

    await recordScenario('1. حجز يومي (Standard Daily)', 'S1.5', 'بدون سداد مسبق وترحيل المبلغ كاملاً كآجل (Zero -> Defer)', async () => {
      const room = getFreshRoom(150);
      const res = db.createReservation({
        guestName: 'نزيل عادي 5', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: today,
        bookingType: 'يومي', totalPrice: 150, paidAmount: 0, paymentMethod: 'نقداً'
      });
      const co = db.checkoutReservation(res.reservationId, { settleMode: 'defer' });
      assert.equal(co.success, true);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.payment_status, 'غير مدفوع');
      assert.equal(after.paid_amount, 0);
      return { total: 150, paid: 0, status: after.payment_status };
    });

    await recordScenario('1. حجز يومي (Standard Daily)', 'S1.6', 'مغادرة مبكرة مع استرداد الفائض (Early Departure Refund)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'نزيل مغادر مبكراً', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: addDays(today, 2),
        bookingType: 'يومي', totalPrice: 300, paidAmount: 300, paymentMethod: 'نقداً'
      });
      const preview = db.computeCheckoutSettlement(res.reservationId);
      assert.equal(preview.needsRefund, true);
      assert.equal(preview.difference, -200);

      const co = db.checkoutReservation(res.reservationId, { settleMode: 'refund', refundAmount: 200, paymentMethod: 'نقداً' });
      assert.equal(co.success, true);
      assert.ok(co.refundReceiptNumber);

      const after = db.getReservationById(res.reservationId);
      assert.equal(after.status, 'مكتمل');
      assert.equal(after.total_price, 100);
      assert.equal(after.paid_amount, 100);
      assert.equal(after.payment_status, 'مدفوع بالكامل');

      const pays = db.getReservationPayments(res.reservationId);
      assert.equal(pays.length, 2);
      assert.equal(pays[1].amount, -200);
      assert.ok(pays[1].notes.startsWith('استرداد - تسوية مغادرة'));
      return { originalPaid: 300, consumed: 100, refunded: 200, finalPaid: after.paid_amount };
    });

    await recordScenario('1. حجز يومي (Standard Daily)', 'S1.7', 'منع إغلاق الحجز ذي الفائض بدون اختيار استرداد (Overpaid Defer Blocked)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'محاولة إغلاق خاطئة', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: addDays(today, 2),
        bookingType: 'يومي', totalPrice: 300, paidAmount: 300, paymentMethod: 'نقداً'
      });
      assert.throws(
        () => db.checkoutReservation(res.reservationId, { settleMode: 'defer' }),
        /يجب اختيار "استرداد"/
      );
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.status, 'مؤكد');
      return { blockedSuccessfully: true };
    });

    await recordScenario('1. حجز يومي (Standard Daily)', 'S1.8', 'رفض مبلغ استرداد لا يطابق الفرق المحاسبي الفعلي (Mismatched Refund)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'مبلغ استرداد غير مطابق', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: addDays(today, 2),
        bookingType: 'يومي', totalPrice: 300, paidAmount: 300, paymentMethod: 'نقداً'
      });
      assert.throws(
        () => db.checkoutReservation(res.reservationId, { settleMode: 'refund', refundAmount: 150 }),
        /يجب أن يساوي الفرق الفعلي المستحق/
      );
      return { blockedSuccessfully: true };
    });

    await recordScenario('1. حجز يومي (Standard Daily)', 'S1.9', 'إضافة رسوم تأخير مغادرة وتحصيلها (Late Checkout Fee)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'تأخير مغادرة', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: today,
        bookingType: 'يومي', totalPrice: 100, paidAmount: 100, paymentMethod: 'نقداً'
      });
      const co = db.checkoutReservation(res.reservationId, {
        settleMode: 'collect', collectAmount: 50, lateCheckoutFee: 50
      });
      assert.equal(co.success, true);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.total_price, 150);
      assert.equal(after.paid_amount, 150);
      assert.equal(after.late_checkout_fee, 50);
      assert.equal(after.payment_status, 'مدفوع بالكامل');
      return { stayCharge: 100, lateFee: 50, finalTotal: after.total_price, paid: after.paid_amount };
    });

    await recordScenario('1. حجز يومي (Standard Daily)', 'S1.10', 'منح خصم إضافي عند المغادرة مع سبب إلزامي (Checkout Discount with Reason)', async () => {
      const room = getFreshRoom(200);
      const res = db.createReservation({
        guestName: 'خصم معتمد', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: today,
        bookingType: 'يومي', totalPrice: 200, paidAmount: 150, paymentMethod: 'نقداً'
      });
      const co = db.checkoutReservation(res.reservationId, {
        settleMode: 'defer', discountAmount: 50, discountReason: 'خصم موافقة الإدارة'
      });
      assert.equal(co.success, true);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.total_price, 150);
      assert.equal(after.discount_amount, 50);
      assert.equal(after.discount_reason, 'خصم موافقة الإدارة');
      assert.equal(after.payment_status, 'مدفوع بالكامل');
      return { original: 200, discount: 50, net: after.total_price };
    });

    await recordScenario('1. حجز يومي (Standard Daily)', 'S1.11', 'رفض منح خصم عند المغادرة بدون سبب (Discount without Reason Blocked)', async () => {
      const room = getFreshRoom(200);
      const res = db.createReservation({
        guestName: 'خصم بلا سبب', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: today,
        bookingType: 'يومي', totalPrice: 200, paidAmount: 150, paymentMethod: 'نقداً'
      });
      assert.throws(
        () => db.checkoutReservation(res.reservationId, { settleMode: 'defer', discountAmount: 50 }),
        /سبب الخصم مطلوب/
      );
      return { blockedSuccessfully: true };
    });

    await recordScenario('1. حجز يومي (Standard Daily)', 'S1.12', 'رفض تحصيل مبلغ أكبر من المستحق (Excess Collection Blocked)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'تحصيل زائد', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: today,
        bookingType: 'يومي', totalPrice: 100, paidAmount: 50, paymentMethod: 'نقداً'
      });
      assert.throws(
        () => db.checkoutReservation(res.reservationId, { settleMode: 'collect', collectAmount: 100 }),
        /يتجاوز المبلغ المستحق/
      );
      return { blockedSuccessfully: true };
    });

    // =========================================================================
    // CATEGORY 2: Open Contract (عقد مفتوح)
    // =========================================================================
    await recordScenario('2. عقد مفتوح (Open Contract)', 'S2.1', 'عقد مفتوح مع تحصيل إضافي عند المغادرة (Open Contract Collect)', async () => {
      const room = getFreshRoom(110);
      const res = db.createReservation({
        guestName: 'عقد مفتوح تحصيل', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: '',
        bookingType: 'عقد مفتوح', customNightlyPrice: 110, paidAmount: 50, paymentMethod: 'نقداً'
      });
      const co = db.checkoutReservation(res.reservationId, {
        settleMode: 'collect', collectAmount: 60, finalTotalPrice: 110, paymentMethod: 'نقداً'
      });
      assert.equal(co.success, true);
      assert.ok(co.collectionReceiptNumber);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.status, 'مكتمل');
      assert.equal(after.total_price, 110);
      assert.equal(after.paid_amount, 110);
      assert.equal(after.payment_status, 'مدفوع بالكامل');
      return { total: 110, advance: 50, collected: 60, finalPaid: 110 };
    });

    await recordScenario('2. عقد مفتوح (Open Contract)', 'S2.2', 'عقد مفتوح مع ترحيل المتبقي كآجل (Open Contract Defer)', async () => {
      const room = getFreshRoom(110);
      const res = db.createReservation({
        guestName: 'عقد مفتوح آجل', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: '',
        bookingType: 'عقد مفتوح', customNightlyPrice: 110, paidAmount: 50, paymentMethod: 'نقداً'
      });
      const co = db.checkoutReservation(res.reservationId, {
        settleMode: 'defer', finalTotalPrice: 110
      });
      assert.equal(co.success, true);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.status, 'مكتمل');
      assert.equal(after.total_price, 110);
      assert.equal(after.paid_amount, 50);
      assert.equal(after.payment_status, 'مدفوع جزئياً');
      return { total: 110, paid: 50, remaining: 60, status: after.payment_status };
    });

    await recordScenario('2. عقد مفتوح (Open Contract)', 'S2.3', 'عقد مفتوح مع استرداد الفائض (Open Contract Refund - السيناريو المحوري)', async () => {
      const room = getFreshRoom(110);
      const res = db.createReservation({
        guestName: 'عقد مفتوح استرداد', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: '',
        bookingType: 'عقد مفتوح', customNightlyPrice: 110, paidAmount: 200, paymentMethod: 'نقداً'
      });
      const co = db.checkoutReservation(res.reservationId, {
        settleMode: 'refund', refundAmount: 90, finalTotalPrice: 110, paymentMethod: 'نقداً'
      });
      assert.equal(co.success, true);
      assert.equal(co.settleMode, 'refund');
      assert.ok(co.refundReceiptNumber);

      const after = db.getReservationById(res.reservationId);
      assert.equal(after.status, 'مكتمل');
      assert.equal(after.total_price, 110);
      assert.equal(after.paid_amount, 110);
      assert.equal(after.payment_status, 'مدفوع بالكامل');

      const pays = db.getReservationPayments(res.reservationId);
      assert.equal(pays.length, 2);
      assert.equal(pays[0].amount, 200); // Advance untouched
      assert.equal(pays[1].amount, -90); // Refund row
      assert.ok(pays[1].notes.startsWith('استرداد - تسوية مغادرة'));
      return { stayValue: 110, advance: 200, refunded: 90, netPaid: after.paid_amount, receipt: co.refundReceiptNumber };
    });

    await recordScenario('2. عقد مفتوح (Open Contract)', 'S2.4', 'منع إغلاق عقد مفتوح ذي فائض كآجل (Open Contract Overpaid Defer Blocked)', async () => {
      const room = getFreshRoom(110);
      const res = db.createReservation({
        guestName: 'عقد مفتوح ممنوع الآجل', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: '',
        bookingType: 'عقد مفتوح', customNightlyPrice: 110, paidAmount: 200, paymentMethod: 'نقداً'
      });
      assert.throws(
        () => db.checkoutReservation(res.reservationId, { settleMode: 'defer', finalTotalPrice: 110 }),
        /يجب اختيار "استرداد"/
      );
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.status, 'مؤكد');
      assert.equal(after.paid_amount, 200);
      return { blockedSuccessfully: true };
    });

    await recordScenario('2. عقد مفتوح (Open Contract)', 'S2.5', 'رفض مبلغ استرداد غير مطابق في العقد المفتوح (Mismatched Refund in Open Contract)', async () => {
      const room = getFreshRoom(110);
      const res = db.createReservation({
        guestName: 'عقد مفتوح استرداد خاطئ', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: '',
        bookingType: 'عقد مفتوح', customNightlyPrice: 110, paidAmount: 200, paymentMethod: 'نقداً'
      });
      assert.throws(
        () => db.checkoutReservation(res.reservationId, { settleMode: 'refund', refundAmount: 50, finalTotalPrice: 110 }),
        /يجب أن يساوي الفرق الفعلي المستحق/
      );
      return { blockedSuccessfully: true };
    });

    await recordScenario('2. عقد مفتوح (Open Contract)', 'S2.6', 'سداد دفعة لاحقة بعد مغادرة العقد المفتوح الآجل (Post-Checkout Payment)', async () => {
      const room = getFreshRoom(110);
      const res = db.createReservation({
        guestName: 'عقد مفتوح سداد لاحق', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: '',
        bookingType: 'عقد مفتوح', customNightlyPrice: 110, paidAmount: 50, paymentMethod: 'نقداً'
      });
      db.checkoutReservation(res.reservationId, { settleMode: 'defer', finalTotalPrice: 110 });
      const pay = db.addPaymentToReservation({ reservationId: res.reservationId, amount: 60, notes: 'سداد آجل بعد المغادرة' });
      assert.equal(pay.success, true);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.paid_amount, 110);
      assert.equal(after.payment_status, 'مدفوع بالكامل');
      return { paidAfterCheckout: 60, totalPaid: after.paid_amount, status: after.payment_status };
    });

    await recordScenario('2. عقد مفتوح (Open Contract)', 'S2.7', 'منع تمديد حجز العقد المفتوح (Extend Stay Blocked for Open Contract)', async () => {
      const room = getFreshRoom(110);
      const res = db.createReservation({
        guestName: 'عقد مفتوح منع تمديد', roomId: room.id,
        checkInDate: today, checkOutDate: '',
        bookingType: 'عقد مفتوح', customNightlyPrice: 110, paidAmount: 110, paymentMethod: 'نقداً'
      });
      assert.throws(
        () => db.extendReservation({ reservationId: res.reservationId, newCheckOutDate: addDays(today, 5) }),
        /حجوزات العقود المفتوحة ليس لها تاريخ مغادرة محدد ليتم تمديدها/
      );
      return { blockedSuccessfully: true };
    });

    // =========================================================================
    // CATEGORY 3: Monthly Booking Early Checkout (حجز شهري ومغادرة مبكرة)
    // =========================================================================
    await recordScenario('3. حجز شهري (Monthly Booking)', 'S3.1', 'مغادرة مبكرة بالسياسة الافتراضية (Contract Policy - محاسبة بقيمة العقد كاملة)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'شهري سياسة العقد', roomId: room.id,
        checkInDate: addDays(today, -5), checkOutDate: addDays(today, 25),
        bookingType: 'حجز شهري', totalPrice: 3000, paidAmount: 3000, paymentMethod: 'نقداً'
      });
      const co = db.checkoutReservation(res.reservationId, {
        checkoutPolicy: 'contract', settleMode: 'defer'
      });
      assert.equal(co.success, true);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.status, 'مكتمل');
      assert.equal(after.total_price, 3000); // Full contract preserved
      assert.equal(after.paid_amount, 3000);
      assert.equal(after.payment_status, 'مدفوع بالكامل');
      assert.equal(after.checkout_policy, 'contract');
      return { bookedNights: 30, actualNights: 5, chargedTotal: after.total_price, policy: after.checkout_policy };
    });

    await recordScenario('3. حجز شهري (Monthly Booking)', 'S3.2', 'مغادرة مبكرة باستثناء الإدارة لليالي الفعلية واسترداد الباقي (Actual Nights Policy Refund)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'شهري ليالي فعلية', roomId: room.id,
        checkInDate: addDays(today, -5), checkOutDate: addDays(today, 25),
        bookingType: 'حجز شهري', totalPrice: 3000, paidAmount: 3000, paymentMethod: 'نقداً'
      });
      // 5 nights consumed @ 100 = 500. Refund due = 2500.
      const co = db.checkoutReservation(res.reservationId, {
        checkoutPolicy: 'actual', checkoutPolicyReason: 'ظرف طارئ للنزيل معتمد من الإدارة',
        settleMode: 'refund', refundAmount: 2500, paymentMethod: 'نقداً'
      });
      assert.equal(co.success, true);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.status, 'مكتمل');
      assert.equal(after.total_price, 500);
      assert.equal(after.paid_amount, 500);
      assert.equal(after.payment_status, 'مدفوع بالكامل');
      assert.equal(after.checkout_policy, 'actual');
      assert.equal(after.checkout_policy_reason, 'ظرف طارئ للنزيل معتمد من الإدارة');

      const pays = db.getReservationPayments(res.reservationId);
      assert.equal(pays[1].amount, -2500);
      return { actualNights: 5, charged: 500, refunded: 2500, netPaid: 500 };
    });

    await recordScenario('3. حجز شهري (Monthly Booking)', 'S3.3', 'رفض تطبيق سياسة الليالي الفعلية بدون سبب (Actual Nights without Reason Blocked)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'شهري بدون سبب استثناء', roomId: room.id,
        checkInDate: addDays(today, -5), checkOutDate: addDays(today, 25),
        bookingType: 'حجز شهري', totalPrice: 3000, paidAmount: 3000, paymentMethod: 'نقداً'
      });
      assert.throws(
        () => db.checkoutReservation(res.reservationId, {
          checkoutPolicy: 'actual', settleMode: 'refund', refundAmount: 2500
        }),
        /يرجى إدخال سبب احتساب الليالي الفعلية/
      );
      return { blockedSuccessfully: true };
    });

    // =========================================================================
    // CATEGORY 4: Day Use (استخدام يومي)
    // =========================================================================
    await recordScenario('4. استخدام يومي (Day Use)', 'S4.1', 'استخدام يومي مع سداد كامل وتسجيل خروج (Day Use Full Pay)', async () => {
      const room = getFreshRoom(80);
      const res = db.createReservation({
        guestName: 'نزيل استخدام يومي 1', roomId: room.id,
        checkInDate: today, checkOutDate: today,
        bookingType: 'استخدام يومي', totalPrice: 80, paidAmount: 80, paymentMethod: 'نقداً'
      });
      const co = db.checkoutReservation(res.reservationId, { settleMode: 'defer' });
      assert.equal(co.success, true);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.status, 'مكتمل');
      assert.equal(after.total_price, 80);
      assert.equal(after.payment_status, 'مدفوع بالكامل');
      return { total: 80, paid: 80, status: after.payment_status };
    });

    await recordScenario('4. استخدام يومي (Day Use)', 'S4.2', 'استخدام يومي بدون سداد مسبق وتحصيل عند المغادرة (Day Use Collect)', async () => {
      const room = getFreshRoom(80);
      const res = db.createReservation({
        guestName: 'نزيل استخدام يومي 2', roomId: room.id,
        checkInDate: today, checkOutDate: today,
        bookingType: 'استخدام يومي', totalPrice: 80, paidAmount: 0, paymentMethod: 'نقداً'
      });
      const co = db.checkoutReservation(res.reservationId, { settleMode: 'collect', collectAmount: 80 });
      assert.equal(co.success, true);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.payment_status, 'مدفوع بالكامل');
      assert.equal(after.paid_amount, 80);
      return { total: 80, collected: 80, status: after.payment_status };
    });

    // =========================================================================
    // CATEGORY 5: Cancellations (إلغاء الحجز)
    // =========================================================================
    await recordScenario('5. إلغاء الحجز (Cancellations)', 'S5.1', 'إلغاء حجز قبل الوصول مع استرداد كامل المبلغ (Pre-Arrival Full Cancellation)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'إلغاء مسبق', roomId: room.id,
        checkInDate: addDays(today, 2), checkOutDate: addDays(today, 5),
        bookingType: 'يومي', totalPrice: 300, paidAmount: 300, paymentMethod: 'نقداً'
      });
      const cancel = db.cancelReservation(res.reservationId, { reason: 'إلغاء النزيل قبل الوصول' });
      assert.equal(cancel.success, true);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.status, 'ملغي');
      assert.equal(after.paid_amount, 0);
      assert.equal(after.payment_status, 'مستردة');
      const pays = db.getReservationPayments(res.reservationId);
      assert.equal(pays.length, 2);
      assert.equal(pays[1].amount, -300);
      return { originalPaid: 300, refunded: 300, status: after.status, paymentStatus: after.payment_status };
    });

    await recordScenario('5. إلغاء الحجز (Cancellations)', 'S5.2', 'منع إلغاء الحجز بعد بدء الإقامة وإلزام تصفية المغادرة (Mid-Stay Cancel Blocked)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'محاولة إلغاء أثناء الإقامة', roomId: room.id,
        checkInDate: addDays(today, -2), checkOutDate: addDays(today, 3),
        bookingType: 'يومي', totalPrice: 500, paidAmount: 500, paymentMethod: 'نقداً'
      });
      assert.throws(
        () => db.cancelReservation(res.reservationId, { reason: 'مغادرة اضطرارية' }),
        /الإقامة بدأت بالفعل/
      );
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.status, 'مؤكد');
      return { blockedSuccessfully: true, requirement: 'إلزام استخدام تصفية المغادرة للخروج المبكر' };
    });

    // =========================================================================
    // CATEGORY 6: Deposit Ledger (دفتر التأمين)
    // =========================================================================
    await recordScenario('6. دفتر التأمين (Deposit Ledger)', 'S6.1', 'رد التأمين كاملاً عند المغادرة (Deposit Full Refund)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'تأمين مسترد', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: today,
        bookingType: 'يومي', totalPrice: 100, paidAmount: 100, depositAmount: 50, paymentMethod: 'نقداً'
      });
      const co = db.checkoutReservation(res.reservationId, {
        settleMode: 'defer', depositDisposition: 'refund'
      });
      assert.equal(co.success, true);
      assert.equal(co.depositRefunded, 50);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.deposit_ledger_balance, 0);
      return { depositHeld: 50, depositRefunded: 50, remainingDeposit: after.deposit_ledger_balance };
    });

    await recordScenario('6. دفتر التأمين (Deposit Ledger)', 'S6.2', 'تسوية التأمين وتطبيقه على إجمالي الإقامة (Deposit Applied to Stay)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'تأمين تسوية إقامة', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: today,
        bookingType: 'يومي', totalPrice: 100, paidAmount: 60, depositAmount: 40, paymentMethod: 'نقداً'
      });
      const co = db.checkoutReservation(res.reservationId, {
        settleMode: 'defer', depositDisposition: 'apply'
      });
      assert.equal(co.success, true);
      assert.equal(co.depositApplied, 40);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.paid_amount, 100);
      assert.equal(after.payment_status, 'مدفوع بالكامل');
      assert.equal(after.deposit_ledger_balance, 0);
      const pays = db.getReservationPayments(res.reservationId);
      assert.equal(pays[1].payment_method, 'من التأمين');
      assert.equal(pays[1].amount, 40);
      return { stayCost: 100, cashPaid: 60, depositApplied: 40, totalPaid: after.paid_amount };
    });

    await recordScenario('6. دفتر التأمين (Deposit Ledger)', 'S6.3', 'الاحتفاظ بالتأمين كتعويض أضرار مع سبب إلزامي (Deposit Retained for Damage)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'تأمين محتفظ به', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: today,
        bookingType: 'يومي', totalPrice: 100, paidAmount: 100, depositAmount: 50, paymentMethod: 'نقداً'
      });
      const co = db.checkoutReservation(res.reservationId, {
        settleMode: 'defer', depositDisposition: 'retain', depositRetainAmount: 50, depositRetainReason: 'تلفيات في مفروشات الغرفة'
      });
      assert.equal(co.success, true);
      assert.equal(co.depositRetained, 50);
      const after = db.getReservationById(res.reservationId);
      assert.equal(after.deposit_ledger_balance, 0);
      const pays = db.getReservationPayments(res.reservationId);
      assert.equal(pays.length, 1, 'Payments ledger strictly records stay payments, zero pollution from retained deposit');
      const depositMvs = db.getReservationDepositMovements(res.reservationId);
      const retainMv = depositMvs.find(m => m.movement_type === 'retained');
      assert.ok(retainMv, 'Retained deposit is recorded in deposit_movements');
      assert.equal(retainMv.amount, 50);
      assert.equal(retainMv.reason, 'تلفيات في مفروشات الغرفة');
      return { depositHeld: 50, depositRetained: 50, reason: 'تلفيات في مفروشات الغرفة' };
    });

    await recordScenario('6. دفتر التأمين (Deposit Ledger)', 'S6.4', 'رفض الاحتفاظ بالتأمين بدون سبب (Retain without Reason Blocked)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'تأمين بلا سبب', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: today,
        bookingType: 'يومي', totalPrice: 100, paidAmount: 100, depositAmount: 50, paymentMethod: 'نقداً'
      });
      assert.throws(
        () => db.checkoutReservation(res.reservationId, {
          settleMode: 'defer', depositDisposition: 'retain', depositRetainAmount: 50
        }),
        /سبب الاحتفاظ بالتأمين/
      );
      return { blockedSuccessfully: true };
    });

    // =========================================================================
    // CATEGORY 7: Guardrails & Invariants (حمايات النظام ومطابقة الدفاتر)
    // =========================================================================
    await recordScenario('7. حمايات النظام (System Guardrails)', 'S7.1', 'منع تكرار تسجيل المغادرة لحجز مغلق (Double Checkout Blocked)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'مغادرة مكررة', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: today,
        bookingType: 'يومي', totalPrice: 100, paidAmount: 100, paymentMethod: 'نقداً'
      });
      db.checkoutReservation(res.reservationId, { settleMode: 'defer' });
      assert.throws(
        () => db.checkoutReservation(res.reservationId, { settleMode: 'defer' }),
        /مغلق بالفعل/
      );
      return { blockedSuccessfully: true };
    });

    await recordScenario('7. حمايات النظام (System Guardrails)', 'S7.2', 'منع تسجيل مغادرة قبل تاريخ الوصول (Checkout Before Check-in Blocked)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'مغادرة مبكرة جداً', roomId: room.id,
        checkInDate: addDays(today, 1), checkOutDate: addDays(today, 3),
        bookingType: 'يومي', totalPrice: 200, paidAmount: 100, paymentMethod: 'نقداً'
      });
      assert.throws(
        () => db.checkoutReservation(res.reservationId, { settleMode: 'defer' }),
        /لم تبدأ الإقامة بعد/
      );
      return { blockedSuccessfully: true };
    });

    await recordScenario('7. حمايات النظام (System Guardrails)', 'S7.3', 'تحويل الغرفة إلى "تنظيف" فور كل مغادرة ناجحة (Room Cleaning State)', async () => {
      const room = getFreshRoom(100);
      const res = db.createReservation({
        guestName: 'تنظيف الغرفة', roomId: room.id,
        checkInDate: addDays(today, -1), checkOutDate: today,
        bookingType: 'يومي', totalPrice: 100, paidAmount: 100, paymentMethod: 'نقداً'
      });
      db.checkoutReservation(res.reservationId, { settleMode: 'defer' });
      const roomAfter = connection.queryAll('SELECT status FROM rooms WHERE id = ?', [room.id])[0];
      assert.equal(roomAfter.status, 'تنظيف');
      return { finalRoomStatus: 'تنظيف' };
    });

    await recordScenario('7. حمايات النظام (System Guardrails)', 'S7.4', 'تطابق إجمالي دفتر الأستاذ مع مدفوع الحجز وتفرد أرقام السندات (Ledger & Receipts Integrity)', async () => {
      // 1. Verify PRAGMA foreign_key_check
      const orphans = connection.queryAll('PRAGMA foreign_key_check');
      assert.deepEqual(orphans, [], 'No orphan foreign keys');

      // 2. Receipt numbers uniqueness
      const receiptStats = connection.queryAll(
        'SELECT COUNT(*) AS total, COUNT(DISTINCT receipt_number) AS unique_count FROM payments WHERE receipt_number IS NOT NULL'
      )[0];
      assert.equal(receiptStats.total, receiptStats.unique_count, 'All payment receipt numbers are unique');

      // 3. paid_amount matches sum of stay ledger payments for EVERY reservation
      const paidMismatches = connection.queryAll(`
        SELECT r.id, r.paid_amount, COALESCE(SUM(p.amount), 0) AS stay_ledger_total
        FROM reservations r
        LEFT JOIN payments p ON p.reservation_id = r.id
        GROUP BY r.id
        HAVING ABS(ROUND(COALESCE(r.paid_amount, 0), 2) - ROUND(COALESCE(SUM(p.amount), 0), 2)) > 0.005
      `);
      assert.deepEqual(paidMismatches, [], 'Zero paid_amount vs stay ledger mismatches');

      return {
        totalReceiptsTested: receiptStats.total,
        uniqueReceipts: receiptStats.unique_count,
        zeroStayLedgerMismatches: true
      };
    });

  });

  return results;
}

runComprehensiveMatrix().then(results => {
  console.log(JSON.stringify(results, null, 2));
}).catch(err => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
