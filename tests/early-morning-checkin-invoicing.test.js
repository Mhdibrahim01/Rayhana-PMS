'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { addDays, addRoom } = require('./helpers/fixtures');
const { assertDatabaseIntegrity, withSafeDatabase } = require('./helpers/safe-temp-db');

test('early morning check-in invoicing and calendar date display', async t => {
  await t.test('dashboard.js contains explicit early morning labels and explanatory notes', () => {
    const dashboardPath = path.join(__dirname, '..', 'dashboard.js');
    const content = fs.readFileSync(dashboardPath, 'utf8');

    assert.ok(
      content.includes("isEarlyMorningCheckin ? 'تاريخ الوصول الفعلي:' : 'تاريخ الوصول:'"),
      'Invoice must display "تاريخ الوصول الفعلي:" for early morning check-in'
    );
    assert.ok(
      content.includes("isEarlyMorningCheckin || inv.status === 'مكتمل' ? 'تاريخ المغادرة الفعلي' : 'تاريخ المغادرة'"),
      'Invoice must display "تاريخ المغادرة الفعلي" for early morning check-in or completed checkout'
    );
    assert.ok(
      content.includes('تشمل مبيت الليلة السابقة - دخول فجر مبكر'),
      'Invoice must include explanatory note: (تشمل مبيت الليلة السابقة - دخول فجر مبكر)'
    );

    const reservationsPath = path.join(__dirname, '..', 'dashboard-reservations.js');
    const reservationsContent = fs.readFileSync(reservationsPath, 'utf8');
    assert.ok(
      reservationsContent.includes('getActualCheckinCalendarDate(r)') && reservationsContent.includes("'وصول فعلي:'"),
      'Reservation list must show the actual hotel-local arrival date for early morning check-ins'
    );

    const overviewPath = path.join(__dirname, '..', 'dashboard-overview.js');
    const overviewContent = fs.readFileSync(overviewPath, 'utf8');
    assert.ok(
      overviewContent.includes('getActualArrivalCalendarDate(r)') && overviewContent.includes("isEarlyMorningCheckin ? 'فعلي' : 'من'"),
      'Overview active reservations must show the actual arrival date for early morning check-ins'
    );
    assert.ok(
      overviewContent.includes('displayedCheckIn = isEarlyMorningCheckin ? getActualArrivalCalendarDate(r) : checkIn'),
      'Reservation preview must display actual arrival while retaining check_in_date for billing calculations'
    );
  });

  await withSafeDatabase(async (db, connection) => {
    const today = db.getCurrentBusinessDate();
    const yesterday = addDays(today, -1);

    await t.test('early morning walk-in is billed for previous night while storing actual check-in timestamp', () => {
      const room = addRoom('EARLY-101', 200);

      // Simulate hotel business date is yesterday (night audit has not yet run, time is 03:00 AM)
      connection.db.run('UPDATE hotel_business_state SET current_business_date = ? WHERE id = 1', [yesterday]);

      // Physical arrival timestamp is today at 03:00 AM
      const actualArrivalTs = `${today} 03:00:00`;

      const res = db.createReservation({
        guestName: 'Early Bird Guest',
        guestPhone: '0512345678',
        roomId: room.id,
        checkInDate: yesterday,
        checkOutDate: today,
        totalPrice: 200, // 1 night (yesterday night)
        paidAmount: 200,
        isEarlyCheckin: 1,
        actualCheckInAt: actualArrivalTs
      });

      assert.ok(res.reservationId > 0, 'Reservation created successfully');

      const inv = db.getReservationById(res.reservationId);
      assert.equal(inv.is_early_checkin, 1, 'is_early_checkin flag must be 1');
      assert.equal(inv.check_in_date, yesterday, 'Billing check-in date must be yesterday to bill previous night');
      assert.equal(inv.check_out_date, today, 'Billing check-out date must be today');
      assert.equal(inv.total_price, 200, 'Must be billed for 1 night');
      assert.equal(inv.actual_check_in_at, actualArrivalTs, 'Actual arrival timestamp must be stored');

      // Now checkout the guest at 13:00 PM on same calendar day
      connection.db.run('UPDATE hotel_business_state SET current_business_date = ? WHERE id = 1', [today]);
      const checkoutResult = db.checkoutReservation(res.reservationId, { paymentMethod: 'نقداً' });
      assert.equal(checkoutResult.finalTotal, 200, 'Stay settled for 1 night rate');

      const checkedOutRes = db.getReservationById(res.reservationId);
      assert.equal(checkedOutRes.status, 'مكتمل');
      assert.equal(checkedOutRes.is_early_checkin, 1);
      assert.ok(checkedOutRes.checked_out_at, 'checked_out_at must be populated');

      assertDatabaseIntegrity(connection, 'early morning check-in stay');
    });

    await t.test('multi-night early morning arrival accumulates previous night plus subsequent nights', () => {
      const room = addRoom('EARLY-102', 150);
      connection.db.run('UPDATE hotel_business_state SET current_business_date = ? WHERE id = 1', [yesterday]);

      const departDate = addDays(today, 2); // 3 nights total: yesterday, today, tomorrow
      const actualArrivalTs = `${today} 02:45:00`;

      const res = db.createReservation({
        guestName: 'Multi Night Early Guest',
        guestPhone: '0587654321',
        roomId: room.id,
        checkInDate: yesterday,
        checkOutDate: departDate,
        totalPrice: 450, // 3 nights x 150
        paidAmount: 450,
        isEarlyCheckin: 1,
        actualCheckInAt: actualArrivalTs
      });

      const inv = db.getReservationById(res.reservationId);
      assert.equal(inv.is_early_checkin, 1);
      assert.equal(inv.total_price, 450);
      assert.equal(db.countNights(inv.check_in_date, inv.check_out_date), 3, 'Must count 3 billed nights');

      assertDatabaseIntegrity(connection, 'multi-night early morning stay');
    });

    await t.test('explicit exemption by receptionist saves is_early_checkin = 0', () => {
      const room = addRoom('EARLY-103', 200);
      connection.db.run('UPDATE hotel_business_state SET current_business_date = ? WHERE id = 1', [today]);

      const res = db.createReservation({
        guestName: 'Exempted VIP Guest',
        guestPhone: '0599998888',
        roomId: room.id,
        checkInDate: today,
        checkOutDate: addDays(today, 1),
        totalPrice: 200,
        paidAmount: 200,
        isEarlyCheckin: 0
      });

      const inv = db.getReservationById(res.reservationId);
      assert.equal(inv.is_early_checkin, 0, 'Exemption sets is_early_checkin to 0');
      assertDatabaseIntegrity(connection, 'exempted early check-in');
    });
  });
});
