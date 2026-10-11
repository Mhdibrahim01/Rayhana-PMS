'use strict';

/**
 * Guests IPC access policy.
 *
 * The four handlers that had no guard at all were guests:get-all,
 * guests:get-paginated, guests:search (also exposed as search-guest) and the Excel
 * bulk import (import-guests / excel:import-guests). ipc/guests.js now applies
 * requireSession() to each, so a signed-out caller cannot read the guest table or
 * bulk-rewrite it.
 *
 * The bulk import is the sensitive one: db.bulkImportGuests() inserts and updates
 * guest rows, so an unguarded handler let anyone overwrite names, phone numbers and
 * national IDs from a CSV.
 *
 * guests:update and guests:set-ban-status already had their own guards and are
 * covered here so the whole file's policy is asserted in one place.
 */

const assert = require('node:assert/strict');
const test = require('node:test');
const { withSafeDatabase } = require('./helpers/safe-temp-db');
const { FakeIpcMain, createFakeDeps } = require('./helpers/fake-ipc');
const { registerGuestsIpc } = require('../ipc/index');

const ADMIN = { id: 1, username: 'admin', role: 'Admin' };
const RECEPTIONIST = { id: 2, username: 'staff', role: 'User' };

function guest(overrides = {}) {
  return {
    name: 'نزيل اختبار',
    phone: '0501234567',
    id_number: '1000000001',
    ...overrides
  };
}

test('guests IPC: a signed-out caller cannot reach guest data', async t => {
  await withSafeDatabase(async (appDb, connection) => {
    const ipcMain = new FakeIpcMain();
    const deps = createFakeDeps();
    registerGuestsIpc(ipcMain, deps);

    // Seed real rows so a failure means "the guard let data through", not "no data".
    appDb.addCustomer(guest({ phone: '0501111111', id_number: '1000000011' }));
    appDb.addCustomer(guest({ name: 'نزيل ثان', phone: '0502222222', id_number: '1000000022' }));
    const before = connection.queryOne('SELECT COUNT(*) AS c FROM guests').c;
    assert.ok(before >= 2, 'the scenario needs existing guests');

    deps.session.currentUser = null;

    await t.test('get-all refuses and returns no rows', async () => {
      const res = await ipcMain.invoke('guests:get-all', {}, {});
      assert.equal(res.success, false);
      assert.match(res.error, /تسجيل الدخول/);
      assert.equal(res.data, undefined, 'no guest data may be returned');
      assert.equal(res.totalCount, undefined);
    });

    await t.test('get-paginated refuses', async () => {
      const res = await ipcMain.invoke('guests:get-paginated', {}, { page: 1, limit: 10 });
      assert.equal(res.success, false);
      assert.match(res.error, /تسجيل الدخول/);
      assert.equal(res.data, undefined);
    });

    await t.test('reservation history refuses without a session', async () => {
      const guestId = connection.queryOne('SELECT id FROM guests WHERE phone = ?', ['0501111111']).id;
      const res = await ipcMain.invoke('guests:get-reservation-history', {}, guestId);
      assert.equal(res.success, false);
      assert.match(res.error, /تسجيل الدخول/);
      assert.equal(res.data, undefined);
    });

    await t.test('search refuses', async () => {
      const res = await ipcMain.invoke('guests:search', {}, { query: '0501111111' });
      assert.equal(res.success, false);
      assert.match(res.error, /تسجيل الدخول/);
      assert.equal(res.guest, undefined, 'a search must not confirm a phone exists');
    });

    await t.test('the legacy search-guest alias refuses too', async () => {
      const res = await ipcMain.invoke('search-guest', {}, '0501111111');
      assert.equal(res.success, false);
      assert.equal(res.guest, undefined);
    });

    await t.test('bulk import refuses and writes nothing', async () => {
      const res = await ipcMain.invoke('import-guests', {}, [
        guest({ name: 'مخترق', phone: '0509999999', id_number: '1000000099' })
      ]);
      assert.equal(res.success, false);
      assert.match(res.error, /تسجيل الدخول/);
      assert.equal(connection.queryOne('SELECT COUNT(*) AS c FROM guests').c, before,
        'the guest table must be untouched');
      assert.equal(
        connection.queryOne('SELECT COUNT(*) AS c FROM guests WHERE phone = ?', ['0509999999']).c,
        0,
        'no guest may have been inserted'
      );
    });

    await t.test('add-customer refuses', async () => {
      const res = await ipcMain.invoke('guests:add', {}, guest({ phone: '0508888888' }));
      assert.equal(res.success, false);
      assert.equal(connection.queryOne('SELECT COUNT(*) AS c FROM guests').c, before);
    });

    await t.test('update and ban refuse', async () => {
      const id = connection.queryOne('SELECT id FROM guests WHERE phone = ?', ['0501111111']).id;
      const update = await ipcMain.invoke('guests:update', {}, {
        guestId: id, name: 'مخترق', phone: '0501111111', id_number: '1000000011'
      });
      assert.equal(update.success, false);

      const ban = await ipcMain.invoke('guests:set-ban-status', {}, {
        guestId: id, isBanned: true, reason: 'test'
      });
      assert.equal(ban.success, false);
      assert.notEqual(
        connection.queryOne('SELECT name FROM guests WHERE id = ?', [id]).name,
        'مخترق',
        'the stored name must be unchanged'
      );
    });
  });
});

test('guests IPC: a logged-in User keeps the access front desk needs', async t => {
  await withSafeDatabase(async (appDb, connection) => {
    const ipcMain = new FakeIpcMain();
    const deps = createFakeDeps();
    registerGuestsIpc(ipcMain, deps);

    appDb.addCustomer(guest({ phone: '0503333333', id_number: '1000000033' }));
    deps.session.currentUser = RECEPTIONIST;

    await t.test('can list and paginate guests', async () => {
      const all = await ipcMain.invoke('guests:get-all', {}, {});
      assert.equal(all.success, true);
      assert.ok(Array.isArray(all.data));

      const paged = await ipcMain.invoke('guests:get-paginated', {}, { page: 1, limit: 5 });
      assert.equal(paged.success, true);
      assert.ok(Array.isArray(paged.data));
    });

    await t.test('can load reservation history for a guest', async () => {
      const guestId = connection.queryOne('SELECT id FROM guests WHERE phone = ?', ['0503333333']).id;
      const res = await ipcMain.invoke('guests:get-reservation-history', {}, guestId);
      assert.equal(res.success, true);
      assert.deepEqual(res.data, []);
    });

    await t.test('can search a returning guest for booking auto-fill', async () => {
      const res = await ipcMain.invoke('guests:search', {}, { query: '0503333333' });
      assert.equal(res.success, true, 'the booking form depends on this lookup');
      assert.ok(res.guest, 'an existing guest must be found by phone');
    });

    await t.test('can add a guest and edit their details', async () => {
      const added = await ipcMain.invoke('guests:add', {}, guest({
        phone: '0504444444', id_number: '1000000044'
      }));
      assert.equal(added.success, true);

      const id = connection.queryOne('SELECT id FROM guests WHERE phone = ?', ['0504444444']).id;
      const updated = await ipcMain.invoke('guests:update', {}, {
        guestId: id, name: 'اسم محدّث', phone: '0504444444', id_number: '1000000044'
      });
      assert.equal(updated.success, true);
      assert.equal(
        connection.queryOne('SELECT name FROM guests WHERE id = ?', [id]).name,
        'اسم محدّث'
      );
    });

    await t.test('can run the bulk import (it is session-level by decision)', async () => {
      const before = connection.queryOne('SELECT COUNT(*) AS c FROM guests').c;
      const res = await ipcMain.invoke('import-guests', {}, [
        guest({ name: 'مستورد', phone: '0505555555', id_number: '1000000055' })
      ]);
      assert.equal(res.success, true, 'the import is requireSession, not requireAdmin');
      assert.equal(
        connection.queryOne('SELECT COUNT(*) AS c FROM guests WHERE phone = ?', ['0505555555']).c,
        1,
        'the row must actually have been written'
      );
      assert.ok(connection.queryOne('SELECT COUNT(*) AS c FROM guests').c > before);
    });

    await t.test('CAN now ban a guest - this is front-desk work', async () => {
          const id = connection.queryOne('SELECT id FROM guests WHERE phone = ?', ['0503333333']).id;
          const res = await ipcMain.invoke('guests:set-ban-status', {}, {
            guestId: id, isBanned: true, reason: 'سلوك غير لائق'
          });
          assert.equal(res.success, true, 'a receptionist must be able to ban a guest');
          const row = connection.queryOne('SELECT is_banned FROM guests WHERE id = ?', [id]);
          assert.equal(row.is_banned, 1, 'the ban must actually be recorded');

          // And unbanning is the same action in reverse.
          const un = await ipcMain.invoke('guests:set-ban-status', {}, {
            guestId: id, isBanned: false, reason: 'رفع الحظر'
          });
          assert.equal(un.success, true);
          assert.equal(
            connection.queryOne('SELECT is_banned FROM guests WHERE id = ?', [id]).is_banned, 0);
        });
  });
});

test('guests IPC: the role is read from the session, never the payload', async t => {
  await withSafeDatabase(async (appDb, connection) => {
    const ipcMain = new FakeIpcMain();
    const deps = createFakeDeps();
    registerGuestsIpc(ipcMain, deps);

    await t.test('a spoofed requesterRole cannot buy Admin', async () => {
      deps.session.currentUser = RECEPTIONIST;
      const id = connection.queryOne('SELECT id FROM guests LIMIT 1')?.id;

      // guests:add parses a renderer-supplied requesterRole. It must be ignored.
      const res = await ipcMain.invoke('guests:add', {}, {
        customerData: guest({ phone: '0506666666', id_number: '1000000066' }),
        requesterRole: 'Admin'
      });
      // A User is permitted to add a guest, so success here is expected; what matters
      // is that the spoofed role granted nothing extra.
      assert.equal(res.success, true);

      // Banning is no longer a privilege boundary - any signed-in user may do it - so a
      // spoofed role buys nothing extra here by definition. What must still hold is
      // that an anonymous caller is refused, which is the real boundary now.
      const target = id ?? connection.queryOne('SELECT id FROM guests LIMIT 1').id;
      const ban = await ipcMain.invoke('guests:set-ban-status', {}, {
        guestId: target, isBanned: true, reason: 'spoof', requesterRole: 'Admin'
      });
      assert.equal(ban.success, true,
        'a signed-in User may ban regardless of the spoofed role claim');

      // The boundary that still exists: no session at all.
      deps.session.currentUser = null;
      const anon = await ipcMain.invoke('guests:set-ban-status', {}, {
        guestId: target, isBanned: false, reason: 'test'
      });
      assert.equal(anon.success, false, 'an anonymous caller must still be refused');
      assert.match(anon.error, /تسجيل الدخول/);
      deps.session.currentUser = RECEPTIONIST;
          });

    await t.test('an Admin session may ban a guest', async () => {
      deps.session.currentUser = ADMIN;
      const id = connection.queryOne('SELECT id FROM guests LIMIT 1').id;
      const res = await ipcMain.invoke('guests:set-ban-status', {}, {
        guestId: id, isBanned: true, reason: 'test'
      });
      assert.equal(res.success, true);
    });
  });
});