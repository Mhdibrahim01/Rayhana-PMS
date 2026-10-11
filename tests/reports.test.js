'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { addDays, addRoom, createReservation } = require('./helpers/fixtures');
const { assertDatabaseIntegrity, withSafeDatabase } = require('./helpers/safe-temp-db');

test('revenue and dashboard reports include completed, active, and refunded ledger data', async t => {
  await withSafeDatabase(async (db, connection) => {
    const today = db.getLocalDateString();
    let partialRoom;
    let completedRoom;

    await t.test('seed an early checkout with a negative refund row', () => {
      partialRoom = addRoom('RP-REFUND', 200);
      const id = createReservation({
        roomId: partialRoom.id,
        name: 'Report Partial Refund',
        checkIn: addDays(today, -3),
        checkOut: addDays(today, 5),
        totalPrice: 1600,
        paidAmount: 800
      });
      const r = db.checkoutReservation(id, { settleMode: 'refund', refundAmount: 200, checkoutPolicy: 'actual', checkoutPolicyReason: 'test' }); console.log('Partial Room Checkout Result:', r);
      assert.equal(connection.queryAll('SELECT amount FROM payments WHERE reservation_id = ? ORDER BY id DESC LIMIT 1', [id])[0].amount, -200);
      assertDatabaseIntegrity(connection, 'report seed: partial refund');
    });

    await t.test('seed a fully paid completed stay and a fully refunded pre-arrival cancellation', () => {
      completedRoom = addRoom('RP-COMPLETE', 150);
      const completedId = createReservation({
        roomId: completedRoom.id,
        name: 'Report Completed Stay',
        checkIn: addDays(today, -2),
        checkOut: addDays(today, 4),
        totalPrice: 900,
        paidAmount: 300
      });
      db.checkoutReservation(completedId, { checkoutPolicy: 'actual', checkoutPolicyReason: 'test' });
      assert.equal(db.getReservationById(completedId).status, 'مكتمل');

      const cancelledRoom = addRoom('RP-CANCELLED', 100);
      const cancelledId = createReservation({
        roomId: cancelledRoom.id,
        name: 'Report Full Refund',
        checkIn: addDays(today, 5),
        checkOut: addDays(today, 8),
        totalPrice: 300,
        paidAmount: 100
      });
      db.cancelReservation(cancelledId);
      assert.equal(db.getReservationById(cancelledId).status, 'ملغي');
      assert.equal(connection.queryAll('SELECT amount FROM payments WHERE reservation_id = ? ORDER BY id DESC LIMIT 1', [cancelledId])[0].amount, -100);
      assertDatabaseIntegrity(connection, 'report seed: completed and fully refunded');
    });

    await t.test('seed active and future bookings for dashboard status totals', () => {
      const activeRoom = addRoom('RP-ACTIVE', 100);
      createReservation({ roomId: activeRoom.id, name: 'Report Active', checkIn: today, checkOut: addDays(today, 2), totalPrice: 200 });
      const futureRoom = addRoom('RP-FUTURE', 100);
      createReservation({ roomId: futureRoom.id, name: 'Report Future', checkIn: addDays(today, 3), checkOut: addDays(today, 5), totalPrice: 200 });
      assertDatabaseIntegrity(connection, 'report seed: active and future');
    });

    await t.test('monthly revenue nets partial refunds and includes cancelled stay payments', () => {
      const month = today.slice(0, 7);
      const monthly = db.getMonthlyRevenue().find(row => row.month === month);
      assert.ok(monthly, `Expected monthly data for ${month}`);
      assert.equal(monthly.expected, 1300);
      assert.equal(monthly.collected, 900);
      assertDatabaseIntegrity(connection, 'monthly revenue report');
    });

    await t.test('dashboard stats derive room and reservation totals from seeded data', () => {
      const stats = db.getDashboardStats();
      assert.equal(stats.totalRooms, 12);
      assert.equal(stats.totalReservations, 5);
      assert.equal(stats.activeReservations, 2);
      assert.equal(stats.totalRevenue, 1300);
      assert.equal(stats.totalGuests, 5);
      assert.ok(stats.occupiedRooms >= 1);
      assert.ok(stats.reservedRooms >= 1);
      assert.ok(stats.cleaningRooms >= 1);
      assertDatabaseIntegrity(connection, 'dashboard stats report');
    });

    await t.test('current-day payment summary separates legacy card and bank transfer methods', () => {
      const before = db.getCurrentShiftRevenueSummary();
      const room = addRoom('RP-SHIFT-METHODS', 100);
      const reservationId = createReservation({
        roomId: room.id,
        name: 'Report Shift Methods',
        checkIn: today,
        checkOut: addDays(today, 2),
        totalPrice: 300,
        paidAmount: 60
      });
      const payment = connection.queryOne(
        'SELECT id FROM payments WHERE reservation_id = ? ORDER BY id ASC LIMIT 1',
        [reservationId]
      );
      connection.db.run("UPDATE payments SET payment_method = 'شبكة' WHERE id = ?", [payment.id]);
      db.addPaymentToReservation({ reservationId, amount: 20, paymentMethod: 'تحويل بنكي' });

      const summary = db.getCurrentShiftRevenueSummary();
      assert.equal(summary.totalRevenue - before.totalRevenue, 80);
      assert.equal(summary.cashTotal, before.cashTotal);
      assert.equal(summary.cardTotal - before.cardTotal, 60);
      assert.equal(summary.transferTotal - before.transferTotal, 20);

      const auditFinancials = db.getShiftAuditReport(today).financials;
      assert.equal(auditFinancials.totalRevenue, summary.totalRevenue);
      assert.equal(auditFinancials.cashTotal, summary.cashTotal);
      assert.equal(auditFinancials.cardTotal, summary.cardTotal);
      assert.equal(auditFinancials.transferTotal, summary.transferTotal);
      assertDatabaseIntegrity(connection, 'current shift payment methods');
    });

    await t.test('room revenue report includes its negative refund row in collected totals', () => {
      const roomReport = db.getRoomRevenueStats(partialRoom.id);
      assert.equal(roomReport.total_expected, 600);
      assert.equal(roomReport.total_collected, 600);
      assert.equal(roomReport.total_outstanding, 0);
      assert.equal(roomReport.breakdown[0].amount_collected, 600);
      const completedReport = db.getRoomRevenueStats(completedRoom.id);
      assert.equal(completedReport.total_expected, 300);
      assert.equal(completedReport.total_collected, 300);
      assertDatabaseIntegrity(connection, 'room revenue report');
    });
  });
});
