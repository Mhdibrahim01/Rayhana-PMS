const test = require('node:test');
const assert = require('node:assert/strict');
const { withSafeDatabase } = require('./helpers/safe-temp-db');
const { addDays } = require('./helpers/fixtures');

test('reservations modernization: summary statistics, filters, and sorting', async () => {
  await withSafeDatabase(async (db, connection) => {
    const todayStr = connection.getCurrentBusinessDate();
    const [y, m, d] = todayStr.split('-').map(Number);

    const prevDate2 = new Date(Date.UTC(y, m - 1, d - 2)).toISOString().slice(0, 10);
    const prevDate1 = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
    const nextDate1 = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);

    // Get rooms
    const rooms = db.getAllRooms();
    assert.ok(rooms.length >= 4, 'Should have at least 4 rooms seeded');

    // 1. Create an active reservation on time (check_in: today, check_out: tomorrow)
    const res1 = db.createReservation({
      guestName: 'نزيل أول نقداً',
      guestPhone: '0501112233',
      guestIdNumber: '1099887766',
      roomId: rooms[0].id,
      bookingType: 'عادي',
      checkInDate: todayStr,
      checkOutDate: nextDate1,
      totalPrice: 200,
      paidAmount: 200,
      paymentMethod: 'نقداً'
    });

    // 2. Create an overdue/late active reservation (check_in: 2 days ago, check_out: yesterday, unpaid)
    const res2 = db.createReservation({
      guestName: 'نزيل متأخر تحويل',
      guestPhone: '0502223344',
      guestIdNumber: '1088776655',
      roomId: rooms[1].id,
      bookingType: 'عادي',
      checkInDate: prevDate2,
      checkOutDate: prevDate1,
      totalPrice: 300,
      paidAmount: 100,
      paymentMethod: 'تحويل بنكي'
    });

    // 3. Create a reservation departing today
    const res3 = db.createReservation({
      guestName: 'نزيل مغادر اليوم بطاقة',
      guestPhone: '0503334455',
      guestIdNumber: '1077665544',
      roomId: rooms[2].id,
      bookingType: 'عادي',
      checkInDate: prevDate1,
      checkOutDate: todayStr,
      totalPrice: 250,
      paidAmount: 0,
      paymentMethod: 'بطاقة / مدى'
    });

    // In afternoon (>= 14:00), departures today are also classified as late per hotel policy
    const isAfternoonLate = (() => {
      try {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Riyadh',
          hour: '2-digit', hourCycle: 'h23'
        }).formatToParts(new Date());
        const hourPart = parts.find(x => x.type === 'hour');
        return Number(hourPart?.value || 0) >= 14;
      } catch (_) {
        return new Date().getHours() >= 14;
      }
    })();
    const expectedLateCount = isAfternoonLate ? 2 : 1;

    // Test summary data
    const pageAll = db.getReservationsPage({ page: 1, pageSize: 50 });
    assert.ok(pageAll.summary, 'Summary object must exist in getReservationsPage result');
    assert.equal(pageAll.summary.total, 3);
    assert.equal(pageAll.summary.activeCount, 3);
    assert.equal(pageAll.summary.lateCount, expectedLateCount, 'lateCount should reflect late policy accurately');
    assert.equal(pageAll.summary.todayCount, 2, 'res1 (arriving today) and res3 (departing today) should be counted');
    assert.equal(pageAll.summary.dueAmount, 450, 'res2 due: 200 + res3 due: 250 = 450');

    // Test status filters
    const pageLate = db.getReservationsPage({ status: 'late' });
    assert.equal(pageLate.total, expectedLateCount);
    assert.ok(pageLate.rows.some(r => r.id === res2.reservationId), 'res2 must be in late reservations');

    const pageToday = db.getReservationsPage({ status: 'today' });
    assert.equal(pageToday.total, 2);

    // Test payment filters
    const pageUnpaid = db.getReservationsPage({ paymentType: 'unpaid' });
    assert.equal(pageUnpaid.total, 2, 'res2 and res3 have remaining due');

    const pagePaid = db.getReservationsPage({ paymentType: 'paid' });
    assert.equal(pagePaid.total, 1);
    assert.equal(pagePaid.rows[0].id, res1.reservationId);

    const pageCash = db.getReservationsPage({ paymentType: 'cash' });
    assert.equal(pageCash.total, 1);
    assert.equal(pageCash.rows[0].payment_method, 'نقداً');

    const pageTransfer = db.getReservationsPage({ paymentType: 'transfer' });
    assert.equal(pageTransfer.total, 1);
    assert.equal(pageTransfer.rows[0].payment_method, 'تحويل بنكي');

    const pageCard = db.getReservationsPage({ paymentType: 'card' });
    assert.equal(pageCard.total, 1);
    assert.equal(pageCard.rows[0].payment_method, 'بطاقة / مدى');

    // Test sorting
    const pageSortTotal = db.getReservationsPage({ sortBy: 'total_desc' });
    assert.equal(pageSortTotal.rows[0].id, res2.reservationId, 'res2 (300) should be first when sorting by total_desc');

    const pageSortCheckout = db.getReservationsPage({ sortBy: 'checkout_asc' });
    assert.equal(pageSortCheckout.rows[0].id, res2.reservationId, 'res2 (yesterday) should be first when sorting by checkout_asc');
    assert.equal(pageSortCheckout.rows[1].id, res3.reservationId, 'res3 (today) should be second');

  });
});

test('reservation list filters and due summary follow the displayed payment ledger', async () => {
  await withSafeDatabase(async (db, connection) => {
    const today = connection.getCurrentBusinessDate();
    const room = db.getAllRooms()[0];
    const reservationId = db.createReservation({
      guestName: 'نزيل اختلاف الرصيد',
      guestPhone: '0501234567',
      guestIdNumber: '1098765432',
      roomId: room.id,
      bookingType: 'عادي',
      checkInDate: today,
      checkOutDate: addDays(today, 1),
      totalPrice: 200,
      paidAmount: 200
    }).reservationId;

    connection.db.run('UPDATE reservations SET paid_amount = 0 WHERE id = ?', [reservationId]);
    const all = db.getReservationsPage({ page: 1, pageSize: 50 });
    const listed = all.rows.find(row => row.id === reservationId);

    assert.equal(listed.ledger_paid_amount, 200);
    assert.equal(all.summary.dueAmount, 0);
    assert.equal(db.getReservationsPage({ paymentType: 'paid' }).total, 1);
    assert.equal(db.getReservationsPage({ paymentType: 'unpaid' }).total, 0);
    assert.equal(db.getShiftAuditReport(today, today).outstandingTotal, 0);
  });
});
