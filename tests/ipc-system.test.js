'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { withSafeDatabase } = require('./helpers/safe-temp-db');
const { FakeIpcMain, createFakeDeps } = require('./helpers/fake-ipc');
const { registerSystemIpc } = require('../ipc/index');
const fs = require('fs');

test('IPC System handlers', async t => {
  await withSafeDatabase(async (db, connection) => {
    const ipcMain = new FakeIpcMain();
    const deps = createFakeDeps();
    registerSystemIpc(ipcMain, deps);

    await t.test('Factory reset and restore require Admin', async () => {
      deps.session.currentUser = { id: 2, username: 'staff', role: 'User' };
      
      const reset = await ipcMain.invoke('app:factory-reset', {}, { password: 'admin' });
      assert.equal(reset.success, false);
      assert.match(reset.error, /Admin/);

      const restore = await ipcMain.invoke('db:restore-backup', {});
      assert.equal(restore.success, false);
      assert.match(restore.error, /Admin/);
    });

    await t.test('Factory reset requires correct admin password', async () => {
      deps.session.currentUser = { id: 1, username: 'admin', role: 'Admin' };
      const reset = await ipcMain.invoke('app:factory-reset', {}, { password: 'wrong' });
      assert.equal(reset.success, false);
      assert.match(reset.error, /غير صحيحة/);
    });

    await t.test('Factory reset succeeds with correct admin password', async () => {
      deps.session.currentUser = { id: 1, username: 'admin', role: 'Admin' };
      const reset = await ipcMain.invoke('app:factory-reset', {}, { password: 'admin' });
      assert.equal(reset.success, true);
    });

    await t.test('app:get-info returns system metadata including isPackaged', async () => {
      const info = await ipcMain.invoke('app:get-info', {});
      assert.ok('isPackaged' in info);
      assert.equal(typeof info.isPackaged, 'boolean');
    });
  });
});
