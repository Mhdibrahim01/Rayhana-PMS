/**
 * Rayhana ERP - IPC Handlers Master Orchestrator
 * Domain: ipc/index.js
 */

const registerAuthIpc = require('./auth');
const registerUsersIpc = require('./users');
const registerRoomsIpc = require('./rooms');
const registerReservationsIpc = require('./reservations');
const registerGuestsIpc = require('./guests');
const registerReportsIpc = require('./reports');
const registerSystemIpc = require('./system');
const registerAppLockIpc = require('./app-lock');

/**
 * Registers all domain IPC handlers on the electron ipcMain instance.
 * @param {import('electron').IpcMain} ipcMain
 * @param {Object} deps Application dependencies and live session wrappers
 */
function registerAllIpcHandlers(ipcMain, deps) {
  registerAppLockIpc(ipcMain, deps);
  registerAuthIpc(ipcMain, deps);
  registerUsersIpc(ipcMain, deps);
  registerRoomsIpc(ipcMain, deps);
  registerReservationsIpc(ipcMain, deps);
  registerGuestsIpc(ipcMain, deps);
  registerReportsIpc(ipcMain, deps);
  registerSystemIpc(ipcMain, deps);
}

module.exports = {
  registerAllIpcHandlers,
  registerAppLockIpc,
  registerAuthIpc,
  registerUsersIpc,
  registerRoomsIpc,
  registerReservationsIpc,
  registerGuestsIpc,
  registerReportsIpc,
  registerSystemIpc
};
