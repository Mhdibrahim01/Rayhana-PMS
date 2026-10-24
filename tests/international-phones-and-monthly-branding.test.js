'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const connection = require('../db/connection');
const { assertDatabaseIntegrity, withSafeDatabase } = require('./helpers/safe-temp-db');
const { addRoom } = require('./helpers/fixtures');

test('international phone numbers and independent monthly branding profile', async (t) => {
  await withSafeDatabase(async (appDb) => {
    const today = appDb.getLocalDateString();

    await t.test('accepts international phone numbers from Oman, Egypt, etc. in reservation and customer creation', () => {
      const room1 = addRoom('INT-101', 200);
      const room2 = addRoom('INT-102', 200);
      const room3 = addRoom('INT-103', 200);

      // 1. Oman phone (+968 91234567 or 96891234567)
      const resOman = appDb.createReservation({
        guestName: 'نزيل سلطنة عمان',
        guestPhone: '+96891234567',
        roomId: room1.id,
        checkInDate: today,
        checkOutDate: '2026-11-01',
        totalPrice: 200,
        paidAmount: 200
      });
      assert.ok(resOman && resOman.success, 'Oman phone must be accepted');

      const omanRow = appDb.getReservationById(resOman.reservationId);
      assert.equal(omanRow.guest_phone, '+96891234567');

      // 2. Egypt phone (+201012345678 or 01012345678)
      const resEgypt = appDb.createReservation({
        guestName: 'نزيل جمهورية مصر',
        guestPhone: '+201012345678',
        roomId: room2.id,
        checkInDate: today,
        checkOutDate: '2026-11-01',
        totalPrice: 200,
        paidAmount: 200
      });
      assert.ok(resEgypt && resEgypt.success, 'Egypt phone must be accepted');

      const egyptRow = appDb.getReservationById(resEgypt.reservationId);
      assert.equal(egyptRow.guest_phone, '+201012345678');

      // 3. Local Saudi phone (0501234567)
      const resSaudi = appDb.createReservation({
        guestName: 'نزيل سعودي',
        guestPhone: '0501234567',
        roomId: room3.id,
        checkInDate: today,
        checkOutDate: '2026-11-01',
        totalPrice: 200,
        paidAmount: 200
      });
      assert.ok(resSaudi && resSaudi.success, 'Local Saudi phone must still be accepted');

      // 4. Add customer directly with international phone
      const custRes = appDb.addCustomer({
        name: 'عميل دولي',
        phone: '+971501234567',
        nationality: 'إماراتي'
      });
      assert.ok(custRes && custRes.id, 'International customer phone must be accepted');
      assert.equal(custRes.phone, '+971501234567');

      // 5. Invalid short phone (e.g. 1234) should be rejected
      assert.throws(() => {
        appDb.addCustomer({ name: 'رقم قصير', phone: '1234' });
      }, /رقم الجوال غير صحيح/);

      // 6. Invalid characters should be rejected
      assert.throws(() => {
        appDb.addCustomer({ name: 'أحرف بالهاتف', phone: '+968abc91234' });
      }, /رقم الجوال غير صحيح/);

      assertDatabaseIntegrity(connection, 'international phone validation');
    });

    await t.test('branding config includes independent monthly fields and UI renders them', () => {
      const brandingJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/branding.json'), 'utf8'));
      const hotel1 = brandingJson.brands.hotel_1;

      assert.ok(hotel1.monthlyCrNumber, 'hotel_1 must have monthlyCrNumber');
      assert.ok(hotel1.monthlyPhone, 'hotel_1 must have monthlyPhone');
      assert.ok(hotel1.monthlyAddress, 'hotel_1 must have monthlyAddress');
      assert.ok(hotel1.monthlyPostalCode, 'hotel_1 must have monthlyPostalCode');

      const dashboardHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');
      assert.ok(dashboardHtml.includes('id="brand-edit-monthly-cr"'), 'HTML must have brand-edit-monthly-cr');
      assert.ok(dashboardHtml.includes('id="brand-edit-monthly-phone"'), 'HTML must have brand-edit-monthly-phone');
      assert.ok(dashboardHtml.includes('id="brand-edit-monthly-vat"'), 'HTML must have brand-edit-monthly-vat');
      assert.ok(dashboardHtml.includes('id="brand-edit-monthly-address"'), 'HTML must have brand-edit-monthly-address');

      const dashboardJs = fs.readFileSync(path.join(__dirname, '../dashboard.js'), 'utf8');
      assert.ok(dashboardJs.includes('activeBrand.monthlyCrNumber'), 'dashboard.js must support activeBrand.monthlyCrNumber');
      assert.ok(dashboardJs.includes('activeBrand.monthlyPhone'), 'dashboard.js must support activeBrand.monthlyPhone');
      assert.ok(dashboardJs.includes('!isMonthly && activeBrand.logo'), 'hotel logo badge must be omitted for monthly contracts');
    });
  });
});
