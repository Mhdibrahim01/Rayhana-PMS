'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { assertDatabaseIntegrity, withSafeDatabase } = require('./helpers/safe-temp-db');
const { addRoom } = require('./helpers/fixtures');

test('reservation companions management and nationality', async t => {
  await withSafeDatabase(async (db, connection) => {
    const testRoom = addRoom('COMP-TEST-101');

    await t.test('companion CRUD operations and input validation', () => {
      const res = db.createReservation({
        guestName: 'أحمد بن فهد الدوسري',
        guestPhone: '0511112233',
        guestIdNumber: '1011112233',
        guestNationality: 'سعودي',
        roomId: testRoom.id,
        checkInDate: '2026-05-01',
        checkOutDate: '2026-05-03',
        totalPrice: 400,
        paidAmount: 400
      });
      const reservationId = res.reservationId;
      assert.ok(reservationId > 0);

      // 1. Initial companions list is empty
      let companions = db.getReservationCompanions(reservationId);
      assert.equal(companions.length, 0);

      // 2. Add companion with complete details
      const c1 = db.addReservationCompanion({
        reservationId,
        name: 'سارة الدوسري',
        relationship: 'زوجة',
        id_number: '1022223344',
        nationality: 'سعودي',
        phone: '0522223344'
      });
      assert.ok(c1.id > 0);
      assert.equal(c1.name, 'سارة الدوسري');
      assert.equal(c1.relationship, 'زوجة');
      assert.equal(c1.id_number, '1022223344');
      assert.equal(c1.nationality, 'سعودي');
      assert.equal(c1.phone, '0522223344');

      // 3. Add second companion with default nationality
      const c2 = db.addReservationCompanion({
        reservationId,
        name: 'عمر الدوسري',
        relationship: 'ابن'
      });
      assert.ok(c2.id > 0);
      assert.equal(c2.nationality, 'سعودي'); // default
      assert.equal(c2.id_number, '');
      assert.equal(c2.phone, '');

      // 4. Retrieve companions
      companions = db.getReservationCompanions(reservationId);
      assert.equal(companions.length, 2);
      assert.equal(companions[0].name, 'سارة الدوسري');
      assert.equal(companions[1].name, 'عمر الدوسري');

      // 5. Update companion
      const updated = db.updateReservationCompanion({
        companionId: c2.id,
        name: 'عمر أحمد الدوسري',
        relationship: 'ابن',
        id_number: '1033334455',
        nationality: 'سعودي',
        phone: '0533334455'
      });
      assert.equal(updated.name, 'عمر أحمد الدوسري');
      assert.equal(updated.id_number, '1033334455');

      const reloaded = db.getReservationCompanions(reservationId);
      assert.equal(reloaded[1].name, 'عمر أحمد الدوسري');
      assert.equal(reloaded[1].phone, '0533334455');

      // 6. Validation rejections
      assert.throws(() => db.addReservationCompanion({ reservationId }), /اسم المرافق مطلوب/);
      assert.throws(() => db.addReservationCompanion({ reservationId: 999999, name: 'مرافق وهمي' }), /الحجز غير موجود/);
      assert.throws(() => db.updateReservationCompanion({ companionId: 999999, name: 'تعديل وهمي' }), /سجل المرافق غير موجود/);
      assert.throws(() => db.deleteReservationCompanion(999999), /سجل المرافق غير موجود/);

      // 7. Delete companion
      const delRes = db.deleteReservationCompanion(c1.id);
      assert.equal(delRes.deleted, true);

      companions = db.getReservationCompanions(reservationId);
      assert.equal(companions.length, 1);
      assert.equal(companions[0].id, c2.id);

      assertDatabaseIntegrity(connection, 'companion CRUD operations');
    });

    await t.test('createReservation with embedded companions and guest nationality', () => {
      const room2 = addRoom('COMP-TEST-102');
      const res = db.createReservation({
        guestName: 'سلطان القاسمي',
        guestPhone: '0544445566',
        guestIdNumber: '1044445566',
        guestNationality: 'إماراتي',
        roomId: room2.id,
        checkInDate: '2026-06-01',
        checkOutDate: '2026-06-05',
        totalPrice: 1200,
        paidAmount: 1200,
        companions: [
          { name: 'مريم القاسمي', relationship: 'زوجة', id_number: '1088123456', nationality: 'إماراتي' },
          { name: 'زايد القاسمي', relationship: 'ابن', id_number: '1088234567', nationality: 'إماراتي' },
          { name: 'جون سميث', relationship: 'سائق', id_number: 'A98765432', nationality: 'بريطاني', phone: '0555556677' }
        ]
      });

      const reservationId = res.reservationId;
      assert.ok(reservationId > 0);

      // Check reservation details by ID
      const fullRes = db.getReservationById(reservationId);
      assert.equal(fullRes.guest_nationality, 'إماراتي');
      assert.equal(Array.isArray(fullRes.companions), true);
      assert.equal(fullRes.companions.length, 3);
      assert.equal(fullRes.companions[0].name, 'مريم القاسمي');
      assert.equal(fullRes.companions[1].name, 'زايد القاسمي');
      assert.equal(fullRes.companions[2].name, 'جون سميث');
      assert.equal(fullRes.companions[2].nationality, 'بريطاني');

      // Check companions count in list view
      const allRes = db.getAllReservations();
      const listRow = allRes.find(r => r.id === reservationId);
      assert.ok(listRow);
      assert.equal(listRow.companions_count, 3);
      assert.equal(listRow.guest_nationality, 'إماراتي');

      // Check guest record nationality
      const guestRow = connection.queryOne('SELECT nationality FROM guests WHERE phone = ?', ['0544445566']);
      assert.equal(guestRow.nationality, 'إماراتي');

      assertDatabaseIntegrity(connection, 'createReservation with companions');
    });

    await t.test('search filters by guest nationality and companion details', () => {
      // Search by guest nationality
      const byNationality = db.getAllReservations({ search: 'إماراتي' });
      assert.ok(byNationality.some(r => r.guest_name === 'سلطان القاسمي'));

      // Search by companion name
      const byCompName = db.getAllReservations({ search: 'جون سميث' });
      assert.ok(byCompName.some(r => r.guest_name === 'سلطان القاسمي'));

      // Search by companion ID number
      const byCompId = db.getAllReservations({ search: 'A98765432' });
      assert.ok(byCompId.some(r => r.guest_name === 'سلطان القاسمي'));

      assertDatabaseIntegrity(connection, 'companions search filter');
    });

    await t.test('foreign key cascade deletes companions when reservation is deleted', () => {
      const room3 = addRoom('COMP-TEST-103');
      const res = db.createReservation({
        guestName: 'نزيل للحذف والتفريغ',
        guestPhone: '0599998877',
        roomId: room3.id,
        checkInDate: '2026-07-01',
        checkOutDate: '2026-07-02',
        totalPrice: 200,
        companions: [
          { name: 'مرافق الحذف 1', relationship: 'صديق' },
          { name: 'مرافق الحذف 2', relationship: 'صديق' }
        ]
      });

      const resId = res.reservationId;
      assert.equal(db.getReservationCompanions(resId).length, 2);

      // Delete reservation directly from database
      connection.db.run('DELETE FROM reservations WHERE id = ?', [resId]);

      // Verify companions are deleted by CASCADE
      const remainingComps = connection.queryAll('SELECT * FROM reservation_companions WHERE reservation_id = ?', [resId]);
      assert.equal(remainingComps.length, 0);

      assertDatabaseIntegrity(connection, 'cascade deletion on reservation delete');
    });

    await t.test('updateReservationReceipt updates and persists guest nationality', () => {
      const room4 = addRoom('COMP-TEST-104');
      const res = db.createReservation({
        guestName: 'خالد عبد الرحمن',
        guestPhone: '0577778899',
        guestIdNumber: '1077778899',
        guestNationality: 'سعودي',
        roomId: room4.id,
        checkInDate: '2026-08-01',
        checkOutDate: '2026-08-02',
        totalPrice: 300,
        paidAmount: 300
      });

      const resId = res.reservationId;
      const initialInv = db.getReservationById(resId);
      assert.equal(initialInv.guest_nationality, 'سعودي');

      // Update receipt with new nationality
      db.updateReservationReceipt({
        reservationId: resId,
        guestName: 'خالد عبد الرحمن',
        guestNationality: 'قطري',
        guestPhone: '0577778899',
        guestIdNumber: '1077778899',
        totalPrice: 300,
        paidAmount: 300,
        paymentMethod: 'نقداً'
      });

      const updatedInv = db.getReservationById(resId);
      assert.equal(updatedInv.guest_nationality, 'قطري');

      assertDatabaseIntegrity(connection, 'updateReservationReceipt nationality persistence');
    });
  });
});
