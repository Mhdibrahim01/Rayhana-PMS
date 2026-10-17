/**
 * Rayhana ERP - Authentication & Activity Logs IPC Handlers
 * Domain: ipc/auth.js
 */

const path = require('path');

module.exports = function registerAuthIpc(ipcMain, { db, session }) {
  // 1. Authentication & Session with Employee Logging
  ipcMain.handle('auth:login', async (event, { username, password }) => {
    try {
      const result = db.verifyUser(username, password);
      if (result.success) {
        session.currentUser = result.user;
        // Insert login activity record into EmployeeLogs
        session.currentLogId = db.logEmployeeLogin(session.currentUser.id);
        result.logId = session.currentLogId;
        if (session.mainWindow) {
          session.mainWindow.loadFile(path.join(__dirname, '..', 'dashboard.html'));
        }
      }
      return result;
    } catch (err) {
      console.error('[Main IPC] خطأ في تسجيل الدخول:', err);
      return { success: false, message: 'حدث خطأ أثناء تسجيل الدخول.' };
    }
  });

  ipcMain.handle('auth:logout', async () => {
    const targetLogId = session.currentLogId;
    if (targetLogId) {
      db.logEmployeeLogout(targetLogId);
      session.currentLogId = null;
    }
    session.currentUser = null;
    if (session.mainWindow) {
      session.mainWindow.loadFile(path.join(__dirname, '..', 'login.html'));
      session.mainWindow.webContents.once('did-finish-load', () => {
        if (session.mainWindow && !session.mainWindow.isDestroyed()) {
          session.mainWindow.webContents.focus();
          session.mainWindow.focus();
        }
      });
    }
    return { success: true };
  });

  ipcMain.handle('auth:get-current-user', async () => {
    return session.currentUser;
  });

  // Employee Activity Logs (Admin Only)
  ipcMain.handle('logs:get-all', async () => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: هذا القسم مخصص لمدير النظام فقط.' };
    }
    try {
      const logs = db.getEmployeeLogs();
      return { success: true, data: logs };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
};
