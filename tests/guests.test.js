'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { assertDatabaseIntegrity, withSafeDatabase } = require('./helpers/safe-temp-db');
const { addRoom } = require('./helpers/fixtures');

test('guest validation, imports, bans, search, and pagination', async t => {
  await withSafeDatabase(async (db, connection) => {
    let firstGuest;
    let secondGuest;

    await t.test('phone and identity validation reject invalid data and duplicate identities', () => {
      firstGuest = db.addCustomer({ name: 'ضيف عربي للاختبار', phone: '0500000401', id_number: '1000000401' });
      secondGuest = db.addCustomer({ name: 'English Guest', phone: '0500000402', id_number: '1000000402' });
      assert.equal(firstGuest.phone, '0500000401');
      assert.throws(() => db.addCustomer({ name: 'Bad Phone', phone: '123', id_number: '1000000403' }), /رقم الجوال غير صحيح/);
      assert.throws(() => db.addCustomer({ name: 'Bad ID', phone: '0500000403', id_number: '123' }), /رقم الهوية الوطنية/);
      assert.throws(() => db.addCustomer({ name: 'Duplicate ID', phone: '0500000404', id_number: '1000000401' }), /مسجل مسبقاً/);
      assert.throws(() => db.updateGuest(secondGuest.id, { name: 'Duplicate Phone', phone: firstGuest.phone, id_number: '1000000402' }), /رقم الجوال .* مسجل مسبقاً/);
      assertDatabaseIntegrity(connection, 'guest validation');
    });

    await t.test('ban state and reason appear in banned and active filters', () => {
      db.setGuestBanStatus(firstGuest.id, true, 'مراجعة مطلوبة');
      const banned = db.getGuestsPaginated({ page: 1, limit: 10, banFilter: 'banned' });
      const active = db.getGuestsPaginated({ page: 1, limit: 10, banFilter: 'active' });
      assert.ok(banned.data.some(guest => guest.id === firstGuest.id && guest.ban_reason === 'مراجعة مطلوبة'));
      assert.equal(active.data.some(guest => guest.id === firstGuest.id), false);
      db.setGuestBanStatus(firstGuest.id, false, '');
      assert.equal(db.getGuestsPaginated({ page: 1, limit: 10, banFilter: 'banned' }).data.some(guest => guest.id === firstGuest.id), false);
      assertDatabaseIntegrity(connection, 'guest ban state');
    });

    await t.test('bulk import recognizes English and Arabic headers and normalizes +966 phones', () => {
      const imported = db.bulkImportGuests([
        { Name: 'English Bulk Guest', Phone: '+966500009001', id_number: '1000000901' },
        { 'اسم النزيل': 'ضيف الاستيراد العربي', 'رقم الجوال': '00966500009002', 'رقم الهوية': '1000000902' },
        { name: '', phone: '+966500009003' }
      ]);
      assert.equal(imported.inserted, 2);
      assert.equal(imported.skipped, 1);
      assert.equal(db.findGuestByPhoneOrId('0500009001').name, 'English Bulk Guest');
      assert.equal(db.findGuestByPhoneOrId('0500009002').name, 'ضيف الاستيراد العربي');
      const updated = db.bulkImportGuests([{ Name: 'English Bulk Updated', Phone: '+966500009001', id_number: '1000000901' }]);
      assert.equal(updated.updated, 1);
      assert.equal(db.findGuestByPhoneOrId('1000000901').name, 'English Bulk Updated');
      assertDatabaseIntegrity(connection, 'guest bulk import normalization');
    });

    await t.test('guest search and pagination return the expected page and matching guest', () => {
      for (let index = 0; index < 5; index += 1) {
        db.addCustomer({ name: `Pagination Guest ${index}`, phone: `05000005${String(index).padStart(2, '0')}`, id_number: `10000005${String(index).padStart(2, '0')}` });
      }
      const firstPage = db.getGuestsPaginated({ page: 1, limit: 2 });
      const secondPage = db.getGuestsPaginated({ page: 2, limit: 2 });
      const search = db.getGuestsPaginated({ page: 1, limit: 10, search: 'ضيف الاستيراد العربي' });
      assert.equal(firstPage.data.length, 2);
      assert.equal(firstPage.pagination.hasNext, true);
      assert.equal(secondPage.pagination.page, 2);
      assert.notEqual(firstPage.data[0].id, secondPage.data[0].id);
      assert.equal(search.pagination.totalCount, 1);
      assert.equal(search.data[0].name, 'ضيف الاستيراد العربي');
      assertDatabaseIntegrity(connection, 'guest search and pagination');
    });
    await t.test('reservation history returns every status for only the requested guest', () => {
      const firstRoom = addRoom('GUEST-HISTORY-1');
      const secondRoom = addRoom('GUEST-HISTORY-2');
      const otherRoom = addRoom('GUEST-HISTORY-3');
      const sharedGuest = {
        guestName: 'Guest With History',
        guestPhone: '0500000711',
        guestIdNumber: '1000000711'
      };
      const completedId = db.createReservation({
        ...sharedGuest, roomId: firstRoom.id, checkInDate: '2026-01-01', checkOutDate: '2026-01-02', totalPrice: 200, paidAmount: 200
      }).reservationId;
      const cancelledId = db.createReservation({
        ...sharedGuest, roomId: secondRoom.id, checkInDate: '2026-02-01', checkOutDate: '2026-02-02', totalPrice: 200
      }).reservationId;
      db.createReservation({
        guestName: 'Different Guest', guestPhone: '0500000712', guestIdNumber: '1000000712',
        roomId: otherRoom.id, checkInDate: '2026-03-01', checkOutDate: '2026-03-02', totalPrice: 200
      });
      connection.db.run("UPDATE reservations SET status = 'مكتمل' WHERE id = ?", [completedId]);
      connection.db.run("UPDATE reservations SET status = 'ملغي' WHERE id = ?", [cancelledId]);

      const guestId = connection.queryOne('SELECT id FROM guests WHERE phone = ?', [sharedGuest.guestPhone]).id;
      const history = db.getGuestReservationHistory(guestId);
      assert.deepEqual(new Set(history.map(reservation => reservation.id)), new Set([completedId, cancelledId]));
      assert.deepEqual(new Set(history.map(reservation => reservation.status)), new Set(['مكتمل', 'ملغي']));
      assert.throws(() => db.getGuestReservationHistory('invalid'), /معرف النزيل غير صالح/);
      assertDatabaseIntegrity(connection, 'guest reservation history');
    });

    await t.test('guest payment totals reflect ledger payments, not reservation prices', () => {
      const room = addRoom('GUEST-PAID-TOTAL');
      const reservationId = db.createReservation({
        guestName: 'Guest Paid Total',
        guestPhone: '0500000721',
        guestIdNumber: '1000000721',
        roomId: room.id,
        checkInDate: '2026-04-01',
        checkOutDate: '2026-04-03',
        totalPrice: 500,
        paidAmount: 125
      }).reservationId;
      connection.db.run("UPDATE reservations SET status = 'مكتمل' WHERE id = ?", [reservationId]);

      const guest = connection.queryOne('SELECT id FROM guests WHERE phone = ?', ['0500000721']);
      const allGuestsRow = db.getAllGuests().find(item => item.id === guest.id);
      const pagedGuestRow = db.getGuestsPaginated({ search: 'Guest Paid Total' }).data[0];

      assert.equal(allGuestsRow.total_stays, 1);
      assert.equal(allGuestsRow.total_spent, 125);
      assert.equal(pagedGuestRow.total_spent, 125);
      assertDatabaseIntegrity(connection, 'guest payment total');
    });
  });
});
