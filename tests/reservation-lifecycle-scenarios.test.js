'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { addDays, addRoom } = require('./helpers/fixtures');
const { assertDatabaseIntegrity, withSafeDatabase } = require('./helpers/safe-temp-db');

let guestSequence = 0;

function createBooking(db, {
  name,
  room,
  bookingType,
  checkInDate,
  checkOutDate,
  totalPrice,
  paidAmount = 0,
  ...options
}) {
  guestSequence += 1;
  const suffix = String(guestSequence).padStart(8, '0');
  return db.createReservation({
    guestName: name,
    guestPhone: `05${suffix}`,
    guestIdNumber: String(1000000000 + guestSequence),
    roomId: room.id,
    bookingType,
    checkInDate,
    checkOutDate,
    totalPrice,
    paidAmount,
    ...options
  }).reservationId;
}

function assertLedgerMatchesSummary(connection, reservationId) {
  const reservation = connection.queryOne(
    'SELECT paid_amount FROM reservations WHERE id = ?', [reservationId]
  );
  const ledger = connection.queryOne(
    'SELECT COALESCE(SUM(amount), 0) AS amount FROM payments WHERE reservation_id = ?', [reservationId]
  );
  assert.equal(Number(reservation.paid_amount), Number(ledger.amount));
}

function transferRoom(db, connection, reservationId, fromRoom, toRoom) {
  const preview = db.previewRoomTransfer({
    reservationId,
    targetRoomId: toRoom.id,
    userRole: 'Admin',
    mode: 'keep_rate'
  });
  assert.equal(preview.currentRoomId, fromRoom.id);
  assert.equal(preview.targetRoomId, toRoom.id);
  assert.equal(preview.totalDelta, 0);

  const result = db.executeRoomTransfer({
    reservationId,
    targetRoomId: toRoom.id,
    userRole: 'Admin',
    mode: 'keep_rate',
    reasonCategory: 'guest_request',
    reasonDetails: 'Integrated lifecycle test'
  });
  assert.equal(result.success, true);
  assert.equal(connection.queryOne('SELECT room_id FROM reservations WHERE id = ?', [reservationId]).room_id, toRoom.id);
  assert.equal(connection.queryOne('SELECT status FROM rooms WHERE id = ?', [fromRoom.id]).status, 'تنظيف');
  assert.equal(connection.queryOne('SELECT status FROM rooms WHERE id = ?', [toRoom.id]).status, 'مشغولة');
  assert.equal(connection.queryOne('SELECT COUNT(*) AS count FROM reservation_transfers WHERE reservation_id = ?', [reservationId]).count, 1);
}

function assertCheckedOut(db, connection, reservationId, occupiedRoom) {
  const reservation = db.getReservationById(reservationId);
  assert.equal(reservation.status, 'مكتمل');
  assert.ok(reservation.checked_out_at);
  assert.equal(connection.queryOne('SELECT status FROM rooms WHERE id = ?', [occupiedRoom.id]).status, 'تنظيف');
  assertLedgerMatchesSummary(connection, reservationId);
  assertDatabaseIntegrity(connection, `completed reservation ${reservationId}`);
  return reservation;
}

test('reservation lifecycle scenarios: early, daily, monthly, open contract, and room transfer', async t => {
  await withSafeDatabase(async (db, connection) => {
    const today = db.getCurrentBusinessDate();
    const previousBusinessDate = addDays(today, -1);

    await t.test('early-morning arrival: previous-night billing, room transfer, then checkout', () => {
      const originalRoom = addRoom('LIFE-EARLY-A', 100);
      const switchedRoom = addRoom('LIFE-EARLY-B', 100);
      connection.db.run('UPDATE hotel_business_state SET current_business_date = ? WHERE id = 1', [previousBusinessDate]);

      const reservationId = createBooking(db, {
        name: 'Early Arrival Lifecycle Guest',
        room: originalRoom,
        bookingType: 'يومي',
        checkInDate: previousBusinessDate,
        checkOutDate: today,
        totalPrice: 100,
        paidAmount: 100,
        isEarlyCheckin: 1,
        actualCheckInAt: `${today} 03:15:00`
      });
      const beforeTransfer = db.getReservationById(reservationId);
      assert.equal(beforeTransfer.check_in_date, previousBusinessDate);
      assert.equal(beforeTransfer.actual_check_in_at, `${today} 03:15:00`);
      assert.equal(beforeTransfer.total_price, 100);

      transferRoom(db, connection, reservationId, originalRoom, switchedRoom);
      connection.db.run('UPDATE hotel_business_state SET current_business_date = ? WHERE id = 1', [today]);
      const checkout = db.checkoutReservation(reservationId, { settleMode: 'defer' });
      assert.equal(checkout.finalTotal, 100);
      assert.equal(assertCheckedOut(db, connection, reservationId, switchedRoom).is_early_checkin, 1);
    });

    await t.test('daily stay: transfer preserves rate and collects the checkout balance', () => {
      const originalRoom = addRoom('LIFE-DAILY-A', 120);
      const switchedRoom = addRoom('LIFE-DAILY-B', 120);
      const reservationId = createBooking(db, {
        name: 'Daily Lifecycle Guest',
        room: originalRoom,
        bookingType: 'يومي',
        checkInDate: previousBusinessDate,
        checkOutDate: today,
        totalPrice: 120
      });

      transferRoom(db, connection, reservationId, originalRoom, switchedRoom);
      const checkout = db.checkoutReservation(reservationId, {
        settleMode: 'collect', collectAmount: 120, paymentMethod: 'نقداً'
      });
      assert.equal(checkout.finalTotal, 120);
      assert.equal(assertCheckedOut(db, connection, reservationId, switchedRoom).paid_amount, 120);
      assert.equal(db.getReservationPayments(reservationId).length, 1);
    });

    await t.test('monthly early checkout: room transfer keeps contract value', () => {
      const originalRoom = addRoom('LIFE-MONTH-A', 150);
      const switchedRoom = addRoom('LIFE-MONTH-B', 150);
      const reservationId = createBooking(db, {
        name: 'Monthly Lifecycle Guest',
        room: originalRoom,
        bookingType: 'حجز شهري',
        checkInDate: addDays(today, -5),
        checkOutDate: addDays(today, 25),
        totalPrice: 4500,
        paidAmount: 4500,
        monthlyPrice: 4500,
        customNightlyPrice: 150
      });

      transferRoom(db, connection, reservationId, originalRoom, switchedRoom);
      const settlement = db.computeCheckoutSettlement(reservationId);
      assert.equal(settlement.isMonthlyEarlyCheckout, true);
      assert.equal(settlement.contractValue, 4500);
      const checkout = db.checkoutReservation(reservationId, { settleMode: 'defer' });
      assert.equal(checkout.finalTotal, 4500);
      const completed = assertCheckedOut(db, connection, reservationId, switchedRoom);
      assert.equal(completed.checkout_policy, 'contract');
      assert.equal(completed.total_price, 4500);
    });

    await t.test('open contract: transfer then set final value and collect at checkout', () => {
      const originalRoom = addRoom('LIFE-CONTRACT-A', 100);
      const switchedRoom = addRoom('LIFE-CONTRACT-B', 100);
      const reservationId = createBooking(db, {
        name: 'Open Contract Lifecycle Guest',
        room: originalRoom,
        bookingType: 'عقد مفتوح',
        checkInDate: previousBusinessDate,
        checkOutDate: '',
        totalPrice: 0,
        customNightlyPrice: 100
      });

      transferRoom(db, connection, reservationId, originalRoom, switchedRoom);
      const checkout = db.checkoutReservation(reservationId, {
        settleMode: 'collect', collectAmount: 200, finalTotalPrice: 200, paymentMethod: 'شبكة'
      });
      assert.equal(checkout.finalTotal, 200);
      const completed = assertCheckedOut(db, connection, reservationId, switchedRoom);
      assert.equal(completed.booking_type, 'عقد مفتوح');
      assert.equal(completed.check_out_date, today);
      assert.equal(completed.paid_amount, 200);
    });

    await t.test('day-use: room transfer is rejected and checkout still closes the stay', () => {
      const room = addRoom('LIFE-DAYUSE-A', 80);
      const unavailableTransferTarget = addRoom('LIFE-DAYUSE-B', 80);
      const reservationId = createBooking(db, {
        name: 'Day-Use Lifecycle Guest',
        room,
        bookingType: 'استخدام يومي',
        checkInDate: today,
        checkOutDate: today,
        totalPrice: 80,
        paidAmount: 80
      });

      assert.throws(
        () => db.executeRoomTransfer({ reservationId, targetRoomId: unavailableTransferTarget.id, userRole: 'Admin' }),
        /غير قابلة لنقل الغرفة/
      );
      const completed = db.checkoutReservation(reservationId, { settleMode: 'defer' });
      assert.equal(completed.finalTotal, 80);
      assertCheckedOut(db, connection, reservationId, room);
      assert.equal(connection.queryOne('SELECT status FROM rooms WHERE id = ?', [unavailableTransferTarget.id]).status, 'متاحة');
      assert.equal(connection.queryOne('SELECT COUNT(*) AS count FROM reservation_transfers WHERE reservation_id = ?', [reservationId]).count, 0);
    });
  });
});