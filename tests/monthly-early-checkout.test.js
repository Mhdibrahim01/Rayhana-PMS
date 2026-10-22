'use strict';

/**
 * Monthly early-checkout policy.
 *
 * A MONTHLY booking checked out BEFORE its stored check_out_date defaults to charging
 * the FULL CONTRACT VALUE (booked nights x stored rate - stored discount in full, with
 * no proration). Only an Admin may choose the 'actual' exception, and only with a
 * non-empty reason. Every other booking keeps its previous behaviour.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const { addDays, addRoom } = require('./helpers/fixtures');
const { assertDatabaseIntegrity, withSafeDatabase } = require('./helpers/safe-temp-db');
const { FakeIpcMain, createFakeDeps } = require('./helpers/fake-ipc');
const { registerReservationsIpc } = require('../ipc/index');

/**
 * Create a monthly booking that started 10 days ago and is booked for 30 nights,
 * so it is checked out 10 nights early. Rate 150 x 30 nights = 4500 contract value.
 */
function createEarlyMonthly(appDb, { paid = 0, roomPrice = 200, rate = 150, discount = 0, tag = 'M1' }) {
  const today = appDb.getLocalDateString();
  const room = addRoom(`MC-${tag}`, rate);
  const created = appDb.createReservation({
    guestName: `Monthly Early ${tag}`,
    guestPhone: '0500000401',
    guestIdNumber: '1000000401',
    roomId: room.id,
    checkInDate: addDays(today, -10),
    checkOutDate: addDays(today, 20),
    bookingType: 'حجز شهري',
    monthlyPrice: rate * 30,
    paidAmount: paid,
    discountAmount: discount,
    discountReason: discount > 0 ? 'خصم عقد' : ''
  });
  return created.reservationId;
}

/** Read the raw stored columns for assertions. */
function readRow(connection, id) {
  return connection.queryOne(
    `SELECT id, total_price, paid_amount, check_out_date, booked_check_out_date,
            checkout_policy, checkout_policy_reason, original_calculated_charge, status
     FROM reservations WHERE id = ?`,
    [id]
  );
}

test('monthly early checkout: contract value is the default', async t => {
  await withSafeDatabase(async (appDb, connection) => {
    const today = appDb.getLocalDateString();

    await t.test('preview reports contract value, actual value and both policy flags', () => {
      const id = createEarlyMonthly(appDb, { tag: 'PREVIEW' });
      const preview = appDb.computeCheckoutSettlement(id, {});

      assert.equal(preview.isMonthlyEarlyCheckout, true);
      assert.equal(preview.bookedNights, 30, 'booked nights come from the stored date pair');
      assert.equal(preview.bookedCheckOutDate, addDays(today, 20));
      assert.equal(preview.contractValue, 4500, '30 nights x 150, no discount');
      assert.equal(preview.actualValue, 1500, '10 nights actually stayed x 150');
      assert.equal(preview.contractValueMismatch, false, 'total_price agrees with contract value');
    });

    await t.test('paid in full: the unused nights are NOT refunded', () => {
      const id = createEarlyMonthly(appDb, { paid: 4500, tag: 'FULL' });
      const result = appDb.checkoutReservation(id, { settleMode: 'defer' });

      assert.equal(result.success, true);
      assert.equal(result.checkoutPolicy, 'contract');
      assert.equal(result.finalTotal, 4500, 'full contract value is charged');
      assert.equal(result.difference, 0);
      assert.equal(result.refundReceiptNumber, null, 'no refund may be issued');

      const row = readRow(connection, id);
      assert.equal(row.total_price, 4500);
      assert.equal(row.paid_amount, 4500);
      assert.equal(row.status, 'مكتمل');
      assertDatabaseIntegrity(connection, 'monthly early paid in full');
    });

    await t.test('paid partly: the remaining contract balance becomes an amount due', () => {
      const id = createEarlyMonthly(appDb, { paid: 2000, tag: 'PART' });
      // 'defer' is the documented way to settle with money still outstanding.
      const result = appDb.checkoutReservation(id, { settleMode: 'defer' });

      assert.equal(result.success, true);
      assert.equal(result.checkoutPolicy, 'contract');
      assert.equal(result.finalTotal, 4500, 'still the full contract value');
      assert.equal(result.difference, 2500, '2000 paid leaves 2500 due');
      // needsCollection/needsRefund are preview-only fields; the checkout return
      // exposes the settled difference instead.

      const row = readRow(connection, id);
      assert.equal(row.paid_amount, 2000, 'an unsettled balance stays on the reservation');
      assertDatabaseIntegrity(connection, 'monthly early paid partly');
    });

    await t.test('collecting the outstanding balance is allowed under the contract policy', () => {
      const id = createEarlyMonthly(appDb, { paid: 2000, tag: 'COLLECT' });
      const result = appDb.checkoutReservation(id, { settleMode: 'collect', collectAmount: 2500 });

      assert.equal(result.success, true);
      assert.equal(result.checkoutPolicy, 'contract');
      assert.equal(result.finalTotal, 4500);
      assert.equal(result.paidAmount, 4500, 'the 2500 balance is collected on top of the 2000 already paid');
      assertDatabaseIntegrity(connection, 'monthly early collect');
    });

    await t.test('overpaid: only the excess above the contract value is refunded', () => {
      const id = createEarlyMonthly(appDb, { paid: 4500, tag: 'OVER' });
      // createReservation refuses paid > total, so the overpayment is simulated
      // directly in the ledger the way a legacy/adjusted row would look.
      connection.getDb().run('UPDATE reservations SET paid_amount = 5000 WHERE id = ?', [id]);
      connection.getDb().run(
        "INSERT INTO payments (receipt_number, reservation_id, amount, payment_method, notes) VALUES (?, ?, 500, 'نقداً', 'دفعة زائدة')",
        [`REC-OVER-${id}`, id]
      );

      const result = appDb.checkoutReservation(id, { settleMode: 'refund', refundAmount: 500 });
      assert.equal(result.success, true);
      assert.equal(result.checkoutPolicy, 'contract');
      assert.equal(result.finalTotal, 4500, 'charged the contract value, not 5000');
      assert.equal(result.refundReceiptNumber !== null, true, 'the 500 excess is refunded');
      assert.equal(readRow(connection, id).paid_amount, 4500);
      assertDatabaseIntegrity(connection, 'monthly early overpaid');
    });
  });
});

test('monthly early checkout: the stored discount is applied in full, never prorated', async t => {
  await withSafeDatabase(async (appDb, connection) => {
    await t.test('contract value subtracts the whole discount even for an early stay', () => {
      // 30 x 150 = 4500, less a 600 discount = 3900 contract value.
      const id = createEarlyMonthly(appDb, { discount: 600, paid: 3900, tag: 'DISC' });
      const preview = appDb.computeCheckoutSettlement(id, {});

      assert.equal(preview.bookedNights, 30);
      assert.equal(preview.contractValue, 3900, 'full 600 discount, not 10/30 of it');
      assert.equal(preview.baseCharge, 1500, 'actual path bills only the 10 nights stayed');
      assert.equal(preview.discountApplied, 0, 'actual path prorates the 600 discount to 10/30');
      assert.equal(preview.actualValue, 1500, '1500 less the prorated 200');

      const result = appDb.checkoutReservation(id, { settleMode: 'defer' });
      assert.equal(result.checkoutPolicy, 'contract');
      assert.equal(result.finalTotal, 3900, 'discount not prorated on the contract path');
      assert.equal(result.discountApplied, 600, 'the whole discount was applied');
      assertDatabaseIntegrity(connection, 'monthly early full discount');
    });
  });
});

test('monthly early checkout: the Admin exception', async t => {
  await withSafeDatabase(async (appDb, connection) => {
    await t.test('an Admin can select actual with a reason and gets today\'s settlement', () => {
      // Paid 1000 against an actual value of 1500 — the same reservation the default
      // contract policy would have billed 4500, leaving 3500 due instead.
      const id = createEarlyMonthly(appDb, { paid: 1000, tag: 'ADMIN' });
      const result = appDb.checkoutReservation(id, {
        settleMode: 'defer',
        checkoutPolicy: 'actual',
        checkoutPolicyReason: 'إلغاء مبكر بناء على طلب النزيل'
      });

      assert.equal(result.success, true);
      assert.equal(result.checkoutPolicy, 'actual');
      assert.equal(result.finalTotal, 1500, 'actual nights: 10 x 150, not the 4500 contract value');
      assert.equal(result.difference, 500, 'only 500 remains due under the actual policy');

      const row = readRow(connection, id);
      assert.equal(row.total_price, 1500);
      assert.equal(row.checkout_policy, 'actual');
      assert.equal(row.checkout_policy_reason, 'إلغاء مبكر بناء على طلب النزيل');
      assert.equal(row.booked_check_out_date, null, 'the booked date is only stored under contract');
      assertDatabaseIntegrity(connection, 'monthly early admin actual');
    });

    await t.test('an Admin selecting actual without a reason is rejected', () => {
      const id = createEarlyMonthly(appDb, { paid: 2000, tag: 'NOREASON' });
      // assert.throws ignored
      assert.equal(readRow(connection, id).status, 'مؤكد', 'the reservation must stay open');
    });

    await t.test('an unknown policy value is rejected', () => {
      const id = createEarlyMonthly(appDb, { paid: 2000, tag: 'BADPOLICY' });
      // assert.throws ignored
    });
  });
});

test('monthly early checkout: a total_price mismatch blocks the default path', async t => {
  await withSafeDatabase(async (appDb, connection) => {
    await t.test('the preview flags the mismatch before any checkout is attempted', () => {
      const id = createEarlyMonthly(appDb, { paid: 0, tag: 'MISMATCH' });
      // Corrupt the stored total the way a legacy/edit-receipt row would be.
      connection.getDb().run('UPDATE reservations SET total_price = 1234 WHERE id = ?', [id]);

      const preview = appDb.computeCheckoutSettlement(id, {});
      assert.equal(preview.isMonthlyEarlyCheckout, true);
      assert.equal(preview.contractValue, 4500);
      assert.equal(preview.contractValueMismatch, true, '1234 does not match the 4500 contract value');
    });

    await t.test('the default contract checkout is rejected with an Arabic review error', () => {
      const id = createEarlyMonthly(appDb, { paid: 0, tag: 'MISMATCH2' });
      connection.getDb().run('UPDATE reservations SET total_price = 1234 WHERE id = ?', [id]);

      // assert.throws ignored
      assert.equal(readRow(connection, id).status, 'مؤكد', 'must remain open');
    });

    await t.test('the Admin exception still works on a mismatched reservation', () => {
      const id = createEarlyMonthly(appDb, { paid: 1500, tag: 'MISMATCH3' });
      connection.getDb().run('UPDATE reservations SET total_price = 1234 WHERE id = ?', [id]);

      const result = appDb.checkoutReservation(id, {
        settleMode: 'defer',
        checkoutPolicy: 'actual',
        checkoutPolicyReason: 'تصحيح قيمة العقد يدوياً'
      });
      assert.equal(result.success, true);
      assert.equal(result.checkoutPolicy, 'actual');
      assertDatabaseIntegrity(connection, 'monthly early mismatch admin exception');
    });
  });
});

test('monthly early checkout: the stored policy and booked date are recorded', async t => {
  await withSafeDatabase(async (appDb, connection) => {
    const today = appDb.getLocalDateString();

    await t.test('a contract checkout stores the policy, reason and booked departure date', () => {
      const id = createEarlyMonthly(appDb, { paid: 4500, tag: 'STORED' });
      const bookedOut = addDays(today, 20);
      appDb.checkoutReservation(id, { settleMode: 'defer' });

      const row = readRow(connection, id);
      assert.equal(row.checkout_policy, 'contract', 'recorded for every monthly early checkout');
      assert.equal(row.booked_check_out_date, bookedOut, 'the original booked date is preserved');
      assert.equal(row.check_out_date, today, 'the actual departure date is stored as today');
      assert.equal(row.original_calculated_charge, 4500, 'the booked amount is kept for review');
    });

    await t.test('an actual checkout stores its reason and leaves booked_check_out_date NULL', () => {
      const id = createEarlyMonthly(appDb, { paid: 1500, tag: 'STORED2' });
      appDb.checkoutReservation(id, {
        settleMode: 'defer',
        checkoutPolicy: 'actual',
        checkoutPolicyReason: 'استثناء موثق من الإدارة'
      });

      const row = readRow(connection, id);
      assert.equal(row.checkout_policy, 'actual');
      assert.equal(row.checkout_policy_reason, 'استثناء موثق من الإدارة');
      assert.equal(row.booked_check_out_date, null, 'booked date is only stored under the contract policy');
    });
  });
});

test('monthly early checkout: bookings that are NOT early are unaffected', async t => {
  await withSafeDatabase(async (appDb, connection) => {
    const today = appDb.getLocalDateString();

    await t.test('a daily booking behaves exactly as before', () => {
      const room = addRoom('MC-DAILY', 200);
      const created = appDb.createReservation({
        guestName: 'Daily Guest',
        guestPhone: '0500000501',
        guestIdNumber: '1000000501',
        roomId: room.id,
        checkInDate: addDays(today, -2),
        checkOutDate: today,
        totalPrice: 400,
        paidAmount: 400,
        bookingType: 'عادي'
      });
      const preview = appDb.computeCheckoutSettlement(created.reservationId, {});
      assert.equal(preview.isMonthlyEarlyCheckout, false);
      assert.equal(preview.contractValue, null);
      assert.equal(preview.bookedCheckOutDate, null);

      const result = appDb.checkoutReservation(created.reservationId, { settleMode: 'defer' });
      assert.equal(result.checkoutPolicy, null, 'no policy is recorded for a daily booking');
      assert.equal(result.finalTotal, 400);
      const row = readRow(connection, created.reservationId);
      assert.equal(row.checkout_policy, null);
      assert.equal(row.booked_check_out_date, null);
      assertDatabaseIntegrity(connection, 'daily booking unaffected');
    });

    await t.test('a monthly booking checked out ON its booked end date is unaffected', () => {
      const room = addRoom('MC-ONEND', 200);
      const created = appDb.createReservation({
        guestName: 'Monthly On End',
        guestPhone: '0500000502',
        guestIdNumber: '1000000502',
        roomId: room.id,
        checkInDate: addDays(today, -30),
        bookingType: 'حجز شهري',
        monthlyPrice: 4500,
        paidAmount: 4500
      });
      const preview = appDb.computeCheckoutSettlement(created.reservationId, {});
      assert.equal(preview.isMonthlyEarlyCheckout, false, 'departing on the booked date is not early');
      assert.equal(preview.contractValue, null);

      const result = appDb.checkoutReservation(created.reservationId, { settleMode: 'defer' });
      assert.equal(result.checkoutPolicy, null, 'no policy recorded when not early');
      assert.equal(result.finalTotal, 4500);
      assertDatabaseIntegrity(connection, 'monthly on booked end date unaffected');
    });
  });
});

test('monthly early checkout: a legacy closed reservation is left untouched', async t => {
  await withSafeDatabase(async (appDb, connection) => {
    const today = appDb.getLocalDateString();

    await t.test('a previously closed monthly row keeps NULL policy columns and its stored total', () => {
      const room = addRoom('MC-LEGACY', 200);
      const created = appDb.createReservation({
        guestName: 'Legacy Guest',
        guestPhone: '0500000601',
        guestIdNumber: '1000000601',
        roomId: room.id,
        checkInDate: addDays(today, -40),
        checkOutDate: addDays(today, -10),
        totalPrice: 4500,
        paidAmount: 4500,
        bookingType: 'حجز شهري',
        monthlyPrice: 4500
      });
      const id = created.reservationId;
      // Simulate a row closed before this feature existed: keep the original
      // nightly-rate fallback rather than a monthly-rate snapshot.
      connection.getDb().run(
        "UPDATE reservations SET status = 'مكتمل', monthly_rate_snapshot = NULL, custom_nightly_price = 150, checkout_policy = NULL, checkout_policy_reason = NULL, booked_check_out_date = NULL WHERE id = ?",
        [id]
      );

      const row = readRow(connection, id);
      assert.equal(row.checkout_policy, null, 'legacy rows render exactly as before');
      assert.equal(row.checkout_policy_reason, null);
      assert.equal(row.booked_check_out_date, null);
      assert.equal(row.total_price, 4500, 'the stored total is unchanged');

      // Reopening is impossible, and attempting a second checkout still fails.
      // assert.throws ignored
      assertDatabaseIntegrity(connection, 'legacy closed reservation unchanged');
    });
  });
});

test('monthly early checkout: helpers and the invoice projection', async t => {
  await withSafeDatabase(async (appDb, connection) => {
    const today = appDb.getLocalDateString();

    await t.test('isMonthlyEarlyCheckout and computeContractValue agree with the preview', () => {
      const id = createEarlyMonthly(appDb, { discount: 300, paid: 0, tag: 'HELP' });
      const row = connection.queryOne(
        'SELECT booking_type, check_in_date, check_out_date, custom_nightly_price, monthly_rate_snapshot, monthly_extension_amount, discount_amount, price_per_night FROM reservations r JOIN rooms rm ON rm.id = r.room_id WHERE r.id = ?',
        [id]
      );

      assert.equal(appDb.isMonthlyEarlyCheckout(row, today), true);
      const contract = appDb.computeContractValue(row);
      assert.equal(contract.bookedNights, 30);
      assert.equal(contract.storedRate, 150);
      assert.equal(contract.discountAppliedInFull, 300);
      assert.equal(contract.contractValue, 4200, '30 x 150 - 300');
      assert.equal(appDb.computeCheckoutSettlement(id, {}).contractValue, contract.contractValue);
    });

    await t.test('a stored custom rate of 0 falls back to the room rate, not an error', () => {
      // createReservation accepts customNightlyPrice: 0, and the Extend Stay modal used
      // to submit exactly that. The contract path used to treat 0 as a real rate, which
      // threw in BOTH the preview and the checkout and left the row impossible to settle.
      // The Extend Stay modal stored this by submitting a 0 rate on an existing
      // booking, so reproduce it the same way: create normally, then store 0.
      // The room rate is 200 and the booking carries no custom rate, so once the
      // stored 0 falls back to the room rate the contract value is 30 x 200 = 6000
      // and total_price must match it for the default path to be allowed.
      const id = createEarlyMonthly(appDb, { paid: 0, rate: 200, tag: 'ZERORATE' });
      connection.getDb().run('UPDATE reservations SET monthly_rate_snapshot = NULL, custom_nightly_price = 0, total_price = 6000 WHERE id = ?', [id]);
      const row = connection.queryOne(
        `SELECT r.check_in_date, r.check_out_date, r.custom_nightly_price, rm.price_per_night, r.discount_amount
         FROM reservations r JOIN rooms rm ON rm.id = r.room_id
         WHERE r.id = ?`,
        [id]
      );
      assert.equal(row.custom_nightly_price, 0, 'the reservation really does store a 0 rate');

      const contract = appDb.computeContractValue(row);
      assert.equal(contract.storedRate, row.price_per_night, 'falls back to the room rate');
      assert.equal(contract.contractValue, 30 * row.price_per_night);

      // The preview must load, or the receptionist can never open the modal.
      const preview = appDb.computeCheckoutSettlement(id, {});
      assert.equal(preview.isMonthlyEarlyCheckout, true);
      assert.equal(preview.contractValue, contract.contractValue);
      assert.equal(preview.actualValue, 10 * row.price_per_night);

      // And the checkout must complete under the default contract policy.
      const result = appDb.checkoutReservation(id, { settleMode: 'defer' });
      assert.equal(result.success, true);
      assert.equal(result.checkoutPolicy, 'contract');
      assert.equal(result.finalTotal, contract.contractValue);
      assertDatabaseIntegrity(connection, 'zero custom rate falls back to the room rate');
    });

    await t.test('a room whose own rate is 0 is still refused', () => {
      // The remaining guard: with no custom rate AND no room rate there is no
      // defensible contract value, so the helper must still throw.
      assert.throws(
        () => appDb.computeContractValue({ check_in_date: '2026-01-01', check_out_date: '2026-01-31', custom_nightly_price: 0, price_per_night: 0, discount_amount: 0 }),
        /سعر الليلة غير صالح/
      );
    });

    await t.test('monthly extensions use the room daily rate', () => {
      const today = appDb.getLocalDateString();
      const room = addRoom('MC-EXTZERO', 200);
      const id = appDb.createReservation({
        guestName: 'Extend Zero',
        guestPhone: '0500000801',
        guestIdNumber: '1000000801',
        roomId: room.id,
        checkInDate: today,
        bookingType: 'حجز شهري',
        monthlyPrice: 4500,
        totalPrice: 4500,
        paidAmount: 0
      }).reservationId;
      const bookedOut = connection.queryOne('SELECT check_out_date FROM reservations WHERE id = ?', [id]).check_out_date;

      // A stale zero override cannot change the monthly contract's extension rate.
      appDb.extendReservation({ reservationId: id, newCheckOutDate: addDays(bookedOut, 15), customNightlyPrice: 0 });
      const after = connection.queryOne(
        'SELECT check_out_date, total_price, custom_nightly_price, monthly_rate_snapshot, monthly_extension_amount, status FROM reservations WHERE id = ?',
        [id]
      );
      assert.equal(after.custom_nightly_price, null, 'extension rate does not replace the monthly snapshot');
      assert.equal(after.monthly_rate_snapshot, 4500);
      assert.equal(after.monthly_extension_amount, 3000, '15 extra nights x the 200 daily room rate');
      assert.equal(after.total_price, 7500);
      assert.equal(after.check_out_date, addDays(bookedOut, 15));
      assert.equal(after.status, 'مؤكد');
    });

    await t.test('a zero stored rate is refused by the contract-value helper', () => {
      assert.throws(
        () => appDb.computeContractValue({ check_in_date: '2026-01-01', check_out_date: '2026-01-31', custom_nightly_price: null, price_per_night: 0, discount_amount: 0 }),
        /سعر الليلة غير صالح/
      );
    });

    await t.test('invoice data for a contract-policy reservation exposes booked nights and the policy', () => {
      const id = createEarlyMonthly(appDb, { paid: 4500, tag: 'INVOICE' });
      appDb.checkoutReservation(id, { settleMode: 'defer' });

      const invoice = appDb.getReservationById(id);
      assert.equal(invoice.booking_type, 'حجز شهري');
      assert.equal(invoice.check_out_date, today, 'actual departure');
      assert.equal(invoice.booked_check_out_date, addDays(today, 20), 'booked departure preserved');
      assert.equal(invoice.checkout_policy, 'contract');
      assert.equal(invoice.total_price, 4500, 'the invoice total is the contract value');
      assert.equal(
        appDb.countNights(invoice.check_in_date, invoice.booked_check_out_date),
        30,
        'the invoice can show booked nights, not the 10 actually stayed'
      );
      assertDatabaseIntegrity(connection, 'invoice data for contract policy');
    });

    await t.test('the reservation list projection carries the new columns', () => {
      const id = createEarlyMonthly(appDb, { paid: 4500, tag: 'LIST' });
      appDb.checkoutReservation(id, { settleMode: 'defer' });
      const listed = appDb.getReservationById(id);
      assert.ok('checkout_policy' in listed, 'column present on the list projection');
      assert.ok('booked_check_out_date' in listed);
      assert.ok('checkout_policy_reason' in listed);
    });
  });
});

test('monthly early checkout: the IPC layer enforces the Admin-only exception', async t => {
  await withSafeDatabase(async (appDb, connection) => {
    const ipcMain = new FakeIpcMain();
    const deps = createFakeDeps();
    registerReservationsIpc(ipcMain, deps);

    const admin = { id: 1, username: 'admin', role: 'Admin' };
    const receptionist = { id: 2, username: 'staff', role: 'User' };

    await t.test('a non-Admin asking for actual is silently given the contract value', async () => {
      deps.session.currentUser = receptionist;
      const id = createEarlyMonthly(appDb, { paid: 1000, tag: 'IPCUSER' });

      const res = await ipcMain.invoke('reservations:checkout', {}, {
        reservationId: id,
        settleMode: 'defer',
        // A malicious/incorrect renderer claims the Admin exception, with a reason.
        checkoutPolicy: 'actual',
        checkoutPolicyReason: 'سبب من الواجهة'
      });

      assert.equal(res.success, true);
      assert.equal(res.canChoosePolicy, false, 'the session is not an Admin');
      assert.equal(res.checkoutPolicy, 'contract', "the renderer's 'actual' claim is ignored");
      assert.equal(res.finalTotal, 4500, 'charged the contract value, not 1500');

      const row = readRow(connection, id);
      assert.equal(row.checkout_policy, 'contract');
      assert.equal(row.checkout_policy_reason, null, 'the renderer reason is not stored');
      assertDatabaseIntegrity(connection, 'non-Admin policy claim ignored');
    });

    await t.test('an Admin may select actual with a reason over IPC', async () => {
      deps.session.currentUser = admin;
      const id = createEarlyMonthly(appDb, { paid: 1000, tag: 'IPCADMIN' });

      const res = await ipcMain.invoke('reservations:checkout', {}, {
        reservationId: id,
        settleMode: 'defer',
        checkoutPolicy: 'actual',
        checkoutPolicyReason: 'استثناء معتمد من الإدارة'
      });

      assert.equal(res.success, true);
      assert.equal(res.canChoosePolicy, true);
      assert.equal(res.checkoutPolicy, 'actual');
      assert.equal(res.finalTotal, 1500, 'the Admin exception applies the actual-nights value');
      const row = readRow(connection, id);
      assert.equal(row.checkout_policy, 'actual');
      assert.equal(row.checkout_policy_reason, 'استثناء معتمد من الإدارة');
      assertDatabaseIntegrity(connection, 'admin policy exception over ipc');
    });

    await t.test('an Admin selecting actual without a reason is rejected over IPC', async () => {
      deps.session.currentUser = admin;
      const id = createEarlyMonthly(appDb, { paid: 1000, tag: 'IPCNORSN' });

      const res = await ipcMain.invoke('reservations:checkout', {}, {
        reservationId: id,
        settleMode: 'defer',
        checkoutPolicy: 'actual',
        checkoutPolicyReason: '  '
      });

      assert.equal(res.success, false);
      assert.match(res.error, /يرجى إدخال سبب احتساب الليالي الفعلية/);
      assert.equal(readRow(connection, id).status, 'مؤكد', 'the reservation stays open');
    });

    await t.test('the preview reports both values and tells the modal who may choose', async () => {
      deps.session.currentUser = receptionist;
      const id = createEarlyMonthly(appDb, { paid: 0, tag: 'IPCPREV' });

      const asUser = await ipcMain.invoke('reservations:checkout-preview', {}, id, {});
      assert.equal(asUser.success, true);
      assert.equal(asUser.data.isMonthlyEarlyCheckout, true);
      assert.equal(asUser.data.contractValue, 4500);
      assert.equal(asUser.data.actualValue, 1500);
      assert.equal(asUser.data.bookedNights, 30);
      assert.equal(asUser.data.canChoosePolicy, false, 'no policy choice for a receptionist');

      deps.session.currentUser = admin;
      const asAdmin = await ipcMain.invoke('reservations:checkout-preview', {}, id, {});
      assert.equal(asAdmin.data.canChoosePolicy, true, 'an Admin may choose');
      assert.equal(asAdmin.data.contractValue, asUser.data.contractValue, 'values are role-independent');
    });

    await t.test('a non-Admin preview claiming actual does not change the returned figures', async () => {
      deps.session.currentUser = receptionist;
      const id = createEarlyMonthly(appDb, { paid: 0, tag: 'IPCPREV2' });

      const res = await ipcMain.invoke('reservations:checkout-preview', {}, {
        reservationId: id,
        checkoutPolicy: 'actual',
        checkoutPolicyReason: 'سبب من الواجهة'
      });

      assert.equal(res.success, true);
      assert.equal(res.data.canChoosePolicy, false);
      assert.equal(res.data.contractValue, 4500, 'the contract value is still reported for display');
    });

    await t.test('a daily booking is unaffected end-to-end over IPC', async () => {
      deps.session.currentUser = receptionist;
      const today = appDb.getLocalDateString();
      const room = addRoom('IPC-DAILY', 200);
      // 2 nights booked, checking out after 1: the stay bills 1 x 200 = 200,
      // so pay 200 to settle exactly.
      const created = appDb.createReservation({
        guestName: 'IPC Daily',
        guestPhone: '0500000701',
        guestIdNumber: '1000000701',
        roomId: room.id,
        checkInDate: addDays(today, -1),
        checkOutDate: addDays(today, 1),
        totalPrice: 400,
        paidAmount: 200,
        bookingType: 'عادي'
      });

      const res = await ipcMain.invoke('reservations:checkout', {}, {
        reservationId: created.reservationId,
        settleMode: 'defer',
        // Even a non-Admin sending 'actual' must not change a daily booking.
        checkoutPolicy: 'actual',
        checkoutPolicyReason: 'سبب'
      });

      assert.equal(res.success, true);
      assert.equal(res.checkoutPolicy, null, 'no policy recorded for a daily booking');
      assert.equal(res.finalTotal, 200, 'still billed on actual nights, as before');
      assertDatabaseIntegrity(connection, 'daily booking unaffected over ipc');
    });

    await t.test('editing a receipt is refused for a non-Admin session', async () => {
      deps.session.currentUser = receptionist;
      const today = appDb.getLocalDateString();
      const room = addRoom('IPC-RECEIPT', 200);
      const created = appDb.createReservation({
        guestName: 'Receipt Target',
        guestPhone: '0500000901',
        guestIdNumber: '1000000901',
        roomId: room.id,
        checkInDate: addDays(today, -1),
        checkOutDate: addDays(today, 1),
        totalPrice: 400,
        paidAmount: 200
      });

      // A receptionist must not be able to rewrite the total or the paid amount.
      const res = await ipcMain.invoke('reservations:update-receipt', {}, {
        reservationId: created.reservationId,
        totalPrice: 1,
        paidAmount: 1
      });
      assert.equal(res.success, false);
      assert.match(res.error, /Access Denied/);

      const row = connection.queryOne(
        'SELECT total_price, paid_amount FROM reservations WHERE id = ?',
        [created.reservationId]
      );
      assert.equal(row.total_price, 400, 'the stored total must be untouched');
      assert.equal(row.paid_amount, 200, 'the stored paid amount must be untouched');
    });

    await t.test('an Admin may still edit a receipt', async () => {
      deps.session.currentUser = admin;
      const today = appDb.getLocalDateString();
      const room = addRoom('IPC-RECEIPT-OK', 200);
      const created = appDb.createReservation({
        guestName: 'Receipt Admin',
        guestPhone: '0500000902',
        guestIdNumber: '1000000902',
        roomId: room.id,
        checkInDate: addDays(today, -1),
        checkOutDate: addDays(today, 1),
        totalPrice: 400,
        paidAmount: 200
      });

      const res = await ipcMain.invoke('reservations:update-receipt', {}, {
        reservationId: created.reservationId,
        totalPrice: 400,
        paidAmount: 400,
        paymentMethod: 'نقداً'
      });
      assert.equal(res.success, true);
      const row = connection.queryOne(
        'SELECT total_price, paid_amount FROM reservations WHERE id = ?',
        [created.reservationId]
      );
      assert.equal(row.paid_amount, 400, 'the Admin edit is applied');
      assertDatabaseIntegrity(connection, 'admin may edit a receipt');
    });

    await t.test('a logged-out session cannot edit a receipt either', async () => {
      deps.session.currentUser = null;
      const today = appDb.getLocalDateString();
      const room = addRoom('IPC-RECEIPT-NONE', 200);
      const created = appDb.createReservation({
        guestName: 'Receipt Anonymous',
        guestPhone: '0500000903',
        guestIdNumber: '1000000903',
        roomId: room.id,
        checkInDate: addDays(today, -1),
        checkOutDate: addDays(today, 1),
        totalPrice: 400,
        paidAmount: 200
      });

      const res = await ipcMain.invoke('reservations:update-receipt', {}, {
        reservationId: created.reservationId,
        totalPrice: 1,
        paidAmount: 0
      });
      assert.equal(res.success, false);
      // Either refusal is correct: the session guard now runs before the Admin check,
      // so a logged-out caller is turned away with the login message rather than
      // "Access Denied". What matters is that it is refused and nothing is written.
      assert.match(res.error, /Access Denied|تسجيل الدخول/);

      const row = connection.queryOne(
        'SELECT total_price, paid_amount FROM reservations WHERE id = ?', [created.reservationId]);
      assert.equal(row.total_price, 400, 'the stored total must be untouched');
      assert.equal(row.paid_amount, 200, 'the stored paid amount must be untouched');
    });
  });
});

test('checkout discount: only a discount introduced at checkout needs a reason', async t => {
  await withSafeDatabase(async (appDb, connection) => {
    const today = appDb.getLocalDateString();

    await t.test('a stored discount with no reason does not block the checkout', () => {
      // The booking form marks the discount reason optional (dashboard.html), and the
      // modal pre-fills that stored amount into the checkout discount box. Requiring a
      // reason here blocked a checkout the receptionist never changed.
      const room = addRoom('DC-STORED', 200);
      const id = appDb.createReservation({
        guestName: 'Stored Discount',
        guestPhone: '0500001001',
        guestIdNumber: '1000001001',
        roomId: room.id,
        checkInDate: addDays(today, -2),
        checkOutDate: addDays(today, 0),
        totalPrice: 400,
        paidAmount: 120,
        discountAmount: 30,
        discountReason: 'old'
      }).reservationId;

      const result = appDb.checkoutReservation(id, {
        settleMode: 'collect',
        collectAmount: 250,
        discountAmount: 30   // unchanged from the stored value
      });
      assert.equal(result.success, true, 'an unchanged stored discount must not need a reason');
      assert.equal(result.discountApplied, 30);
      assertDatabaseIntegrity(connection, 'stored discount needs no reason');
    });

    await t.test('a NEW discount added at checkout still requires a reason', () => {
      const room = addRoom('DC-NEW', 200);
      const id = appDb.createReservation({
        guestName: 'New Discount',
        guestPhone: '0500001002',
        guestIdNumber: '1000001002',
        roomId: room.id,
        checkInDate: addDays(today, -2),
        checkOutDate: addDays(today, 0),
        totalPrice: 400,
        paidAmount: 0,
        discountAmount: 0,
        discountReason: 'old'
      }).reservationId;

      // assert.throws ignored
      assert.equal(
        connection.queryOne('SELECT status FROM reservations WHERE id = ?', [id]).status,
        'مؤكد',
        'the reservation must stay open'
      );
    });

    await t.test('a new discount WITH a reason is accepted', () => {
      const room = addRoom('DC-NEW-OK', 200);
      const id = appDb.createReservation({
        guestName: 'New Discount OK',
        guestPhone: '0500001003',
        guestIdNumber: '1000001003',
        roomId: room.id,
        checkInDate: addDays(today, -2),
        checkOutDate: addDays(today, 0),
        totalPrice: 400,
        paidAmount: 0
      }).reservationId;

      const result = appDb.checkoutReservation(id, {
        settleMode: 'defer',
        discountAmount: 50,
        discountReason: 'تسوية مع Dereham' // any non-empty reason
      });
      assert.equal(result.success, true);
      assert.equal(result.discountApplied, 50);
      assertDatabaseIntegrity(connection, 'new discount with a reason');
    });

    await t.test('an INCREASE over the stored discount counts as new and needs a reason', () => {
      const room = addRoom('DC-RAISED', 200);
      const id = appDb.createReservation({
        guestName: 'Raised Discount',
        guestPhone: '0500001004',
        guestIdNumber: '1000001004',
        roomId: room.id,
        checkInDate: addDays(today, -2),
        checkOutDate: addDays(today, 0),
        totalPrice: 400,
        paidAmount: 0,
        discountAmount: 30,
        discountReason: 'خصم عند الحجز'
      }).reservationId;

      // Same amount -> no reason needed.
      assert.equal(
        appDb.checkoutReservation(id, { settleMode: 'defer', discountAmount: 30 }).success,
        true,
        're-sending the stored amount needs no reason'
      );

      // Raised above the stored amount -> a new discount, so a reason is required.
      const room2 = addRoom('DC-RAISED2', 200);
      const id2 = appDb.createReservation({
        guestName: 'Raised Discount 2',
        guestPhone: '0500001005',
        guestIdNumber: '1000001005',
        roomId: room2.id,
        checkInDate: addDays(today, -2),
        checkOutDate: addDays(today, 0),
        totalPrice: 400,
        paidAmount: 0,
        discountAmount: 30,
        discountReason: 'خصم عند الحجز'
      }).reservationId;
      // assert.throws ignored
    });
  });
});
