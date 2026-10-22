'use strict';

const db = require('../../db');

class FakeIpcMain {
  constructor() {
    this.handlers = new Map();
  }
  handle(channel, listener) {
    this.handlers.set(channel, listener);
  }
  on(channel, listener) {
    this.handlers.set(channel, listener);
  }
  async invoke(channel, event, ...args) {
    const handler = this.handlers.get(channel);
    if (!handler) throw new Error(`No handler for channel: ${channel}`);
    return handler(event, ...args);
  }
}

function createFakeDeps() {
  const session = {
    _currentUser: null,
    _currentLogId: null,
    get currentUser() { return this._currentUser; },
    set currentUser(val) { this._currentUser = val; },
    get currentLogId() { return this._currentLogId; },
    set currentLogId(val) { this._currentLogId = val; },
    _mainWindow: {},
    get mainWindow() { return this._mainWindow; },
    set mainWindow(val) { this._mainWindow = val; },
    get dbPath() { return db.getDatabaseFilePath(); }
  };

  const helpers = {
    getLocalDateString: () => db.getLocalDateString(),
    updateAutomatedRoomStatuses: () => {},
    backupDatabase: async () => ({ success: true })
  };

  const fakeBrowserWindow = class {
    constructor() { this.webContents = { printToPDF: async () => Buffer.from('pdf'), once: () => {} }; }
    loadURL() {}
    loadFile() {}
    close() {}
    static getAllWindows() { return []; }
  };

  return {
    app: {
      getPath: () => require('path').dirname(db.getDatabaseFilePath()),
      getVersion: () => '2.0.0',
      isPackaged: false
    },
    BrowserWindow: fakeBrowserWindow,
    dialog: { showOpenDialog: async () => ({ canceled: true }), showSaveDialog: async () => ({ canceled: true }), showMessageBox: async () => ({ response: 0 }) },
    shell: { showItemInFolder: () => {}, openExternal: async () => {} },
    Notification: class { show() {} },
    db,
    backupScheduler: { getBackupStatus: () => ({ enabled: false }) },
    session,
    helpers
  };
}

module.exports = {
  FakeIpcMain,
  createFakeDeps
};
