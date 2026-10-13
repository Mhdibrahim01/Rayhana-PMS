/**
 * Rayhana ERP - Application Master Lock & Security Gate
 * Domain: ipc/app-lock.js
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Default Master Recovery Passwords in case the custom password is forgotten
const DEFAULT_RECOVERY_PASSWORDS = [
  'Rayhana@9988',
  '998877'
];

module.exports = function registerAppLockIpc(ipcMain, { app, session }) {
  function getSecurityFilePath() {
    const userDataDir = app.getPath('userData');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
    return path.join(userDataDir, 'app_security.json');
  }

  function getSecurityConfig() {
    try {
      const filePath = getSecurityFilePath();
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('[App Lock] فشل قراءة ملف الأمان:', e.message);
    }
    return { masterHash: null };
  }

  function saveSecurityConfig(config) {
    try {
      const filePath = getSecurityFilePath();
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('[App Lock] فشل حفظ ملف الأمان:', e.message);
      return false;
    }
  }

  // 1. Check if user has set a custom password
  ipcMain.handle('app-lock:status', async () => {
    const config = getSecurityConfig();
    return {
      isConfigured: Boolean(config && config.masterHash)
    };
  });

  // 2. Set custom password (first-time setup)
  ipcMain.handle('app-lock:setup', async (_event, newPassword) => {
    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
      return { success: false, message: 'رمز المرور يجب أن لا يقل عن 4 خانات' };
    }
    const hash = bcrypt.hashSync(newPassword.trim(), 10);
    const ok = saveSecurityConfig({
      masterHash: hash,
      createdAt: new Date().toISOString()
    });
    if (!ok) {
      return { success: false, message: 'تعذر حفظ رمز المرور' };
    }
    return { success: true };
  });

  // 3. Verify either Custom Password OR Default Recovery Password
  ipcMain.handle('app-lock:verify', async (_event, password) => {
    const cleanPass = typeof password === 'string' ? password.trim() : '';
    if (!cleanPass) {
      return { success: false, message: 'يرجى إدخال رمز المرور' };
    }

    const config = getSecurityConfig();
    let isValid = false;

    // A) Check Default Recovery Password (Always works as master fallback)
    if (DEFAULT_RECOVERY_PASSWORDS.includes(cleanPass)) {
      isValid = true;
    } else if (config && config.masterHash) {
      // B) Check Custom User Password
      try {
        isValid = bcrypt.compareSync(cleanPass, config.masterHash);
      } catch (e) {
        isValid = false;
      }
    }

    if (isValid) {
      if (session.mainWindow && !session.mainWindow.isDestroyed()) {
        session.mainWindow.setTitle('ريحانة للوحدات السكنية | Rayhana Residential Units');
        if (typeof session.mainWindow.setTitleBarOverlay === 'function') {
          session.mainWindow.setTitleBarOverlay({
            color: '#ffffff',
            symbolColor: '#1e293b',
            height: 32
          });
        }
        session.mainWindow.loadFile('login.html');
      }
      return { success: true };
    }

    return { success: false, message: 'رمز المرور غير صحيح' };
  });

  // 4. Reset custom password using the Default Emergency Password
  ipcMain.handle('app-lock:reset-with-default', async (_event, { defaultPassword, newPassword }) => {
    const cleanDefault = typeof defaultPassword === 'string' ? defaultPassword.trim() : '';
    if (!DEFAULT_RECOVERY_PASSWORDS.includes(cleanDefault)) {
      return { success: false, message: 'رمز الطوارئ الافتراضي غير صحيح' };
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
      return { success: false, message: 'رمز المرور الجديد يجب أن لا يقل عن 4 خانات' };
    }

    const hash = bcrypt.hashSync(newPassword.trim(), 10);
    const ok = saveSecurityConfig({
      masterHash: hash,
      resetAt: new Date().toISOString()
    });

    if (!ok) {
      return { success: false, message: 'تعذر حفظ رمز المرور الجديد' };
    }

    return { success: true };
  });

  // 5. Exit Application
  ipcMain.handle('app-lock:exit', async () => {
    app.quit();
  });
};
