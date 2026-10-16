/**
 * Rayhana ERP - System, Backup, Print & External IPC Handlers
 * Domain: ipc/system.js
 */

const path = require('path');
const fs = require('fs');
function toDataUrl(file) {
  try {
    const buf = fs.readFileSync(path.join(__dirname, '../assets', file));
    return 'data:image/svg+xml;base64,' + buf.toString('base64');
  } catch (err) {
    console.error('Failed to load asset:', file, err.message);
    return '';
  }
}
const sealUrl = toDataUrl('seal.svg');
const signatureUrl = toDataUrl('signature.svg');
function embedAssets(html) {
  return html
    .replace(/assets\/seal\.svg/g, sealUrl)
    .replace(/assets\/signature\.svg/g, signatureUrl);
}
module.exports = function registerSystemIpc(ipcMain, { app, BrowserWindow, dialog, shell, db, backupScheduler, session, helpers }) {
  // 8. System Info & Database Path
  ipcMain.handle('app:get-info', async () => {
    return {
      dbPath: session.dbPath,
      user: session.currentUser,
      logId: session.currentLogId,
      version: app.getVersion()
    };
  });

  ipcMain.handle('app:open-db-folder', async () => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: هذا الإجراء مخصص لمدير النظام (Admin).' };
    }
    try {
      if (fs.existsSync(session.dbPath)) {
        shell.showItemInFolder(session.dbPath);
        return { success: true };
      } else {
        shell.openPath(path.dirname(session.dbPath));
        return { success: true };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 8.1 Secure Factory Reset (Requires Admin Role & Admin Password)
  ipcMain.handle('app:factory-reset', async (event, { password }) => {
    try {
      if (!session.currentUser || session.currentUser.role !== 'Admin') {
        return { success: false, error: 'غير مصرح: تصفير بيانات النظام يتطلب صلاحيات مدير النظام (Admin).' };
      }
      if (!password || !password.trim()) {
        return { success: false, error: 'يرجى إدخال كلمة المرور لتأكيد تصفير البيانات.' };
      }

      // Verify admin credentials
      const verify = db.verifyUser(session.currentUser.username, password);
      if (!verify.success) {
        return { success: false, error: 'كلمة المرور غير صحيحة. تم إلغاء عملية التصفير لأسباب أمنية.' };
      }

      // Emergency pre-reset safety snapshot in backups folder
      try {
        const backupDir = path.join(path.dirname(session.dbPath), 'backups');
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        fs.copyFileSync(session.dbPath, path.join(backupDir, `pre_reset_backup_${timestamp}.sqlite`));
      } catch (bErr) {
        console.warn('[Factory Reset] Pre-reset backup warning:', bErr.message);
      }

      // Perform factory reset in db layer
      await db.factoryReset(session.dbPath);

      // Re-link admin user in session
      const recheck = db.verifyUser('admin', 'admin');
      if (recheck.success) {
        session.currentUser = recheck.user;
      }

      return { success: true, message: 'تم تصفير كافة بيانات النظام واستعادة تهيئة المصنع بنجاح!' };
    } catch (err) {
      console.error('[Factory Reset Error]:', err);
      return { success: false, error: 'حدث خطأ أثناء تصفير قاعدة البيانات: ' + err.message };
    }
  });

  // 11. Database Backup & Restore
  ipcMain.handle('db:create-backup', async () => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: النسخ الاحتياطي يتطلب صلاحيات مدير النظام (Admin).' };
    }
    try {
      const defaultName = `rayhana_backup_${helpers.getLocalDateString()}.sqlite`;
      const { canceled, filePath } = await dialog.showSaveDialog(session.mainWindow, {
        title: 'حفظ نسخة احتياطية من قاعدة بيانات ريحانة للوحدات السكنية',
        defaultPath: defaultName,
        filters: [{ name: 'SQLite Database (*.sqlite)', extensions: ['sqlite', 'db'] }]
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      db.createBackupCopy(filePath);

      // Automated local archive copy
      try {
        const autoBackupDir = path.join(path.dirname(session.dbPath), 'backups');
        if (!fs.existsSync(autoBackupDir)) {
          fs.mkdirSync(autoBackupDir, { recursive: true });
        }
        db.createBackupCopy(path.join(autoBackupDir, defaultName));
      } catch (e) {
        console.warn('[Auto-Backup Archive]:', e);
      }

      return { success: true, path: filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:restore-backup', async () => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: استعادة النسخة الاحتياطية تتطلب صلاحيات مدير النظام (Admin).' };
    }
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(session.mainWindow, {
        title: 'اختر ملف النسخة الاحتياطية للاستعادة (*.sqlite)',
        filters: [{ name: 'SQLite Database (*.sqlite, *.db)', extensions: ['sqlite', 'db'] }],
        properties: ['openFile']
      });

      if (canceled || !filePaths || filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      await db.restoreDatabaseFile(filePaths[0]);
      return { success: true, restoredPath: filePaths[0] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 11.1 Daily Automated 12:00 AM Backup IPCs
  ipcMain.handle('backups:get-status', async () => {
    try {
      const status = backupScheduler.getBackupStatus();
      return { success: true, data: status };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backups:run-now', async () => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: تشغيل النسخ الاحتياطي يتطلب صلاحيات مدير النظام (Admin).' };
    }
    try {
      const result = await backupScheduler.performDailyBackup('manual_request');
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backups:open-folder', async () => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: فتح مجلد النسخ الاحتياطي يتطلب صلاحيات مدير النظام (Admin).' };
    }
    try {
      return await backupScheduler.openBackupsFolder();
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backups:restore-file', async (event, targetFilePath) => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: استعادة النسخة الاحتياطية تتطلب صلاحيات مدير النظام (Admin).' };
    }
    if (!targetFilePath || !fs.existsSync(targetFilePath)) {
      return { success: false, error: 'ملف النسخة الاحتياطية المحدد غير موجود.' };
    }
    try {
      await db.restoreDatabaseFile(targetFilePath);
      return { success: true, restoredPath: targetFilePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backups:run-onedrive-backup', async () => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: النسخ الاحتياطي يتطلب صلاحيات مدير النظام (Admin).' };
    }
    return helpers.backupDatabase();
  });

  ipcMain.handle('backups:select-folder', async () => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: تغيير مجلد النسخ الاحتياطي يتطلب صلاحيات مدير النظام (Admin).' };
    }
    try {
      const result = await dialog.showOpenDialog(session.mainWindow, {
        title: 'اختر مجلد حفظ النسخ الاحتياطية التلقائية',
        buttonLabel: 'اختيار هذا المجلد لحفظ النسخ',
        properties: ['openDirectory', 'createDirectory']
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const selectedDir = result.filePaths[0];
      const updateRes = backupScheduler.setCustomBackupDirectory(selectedDir);
      return {
        ...updateRes,
        folderPath: selectedDir
      };
    } catch (err) {
      console.error('[IPC backups:select-folder error]:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backups:reset-folder', async () => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: إعادة ضبط مجلد النسخ الاحتياطي تتطلب صلاحيات مدير النظام (Admin).' };
    }
    try {
      const resetRes = backupScheduler.resetBackupDirectoryToDefault();
      return resetRes;
    } catch (err) {
      console.error('[IPC backups:reset-folder error]:', err);
      return { success: false, error: err.message };
    }
  });

  // 12. Native PDF Export & Dedicated Print Preview Window
  ipcMain.handle('print:to-pdf', async (event, { html, title, defaultFilename }) => {
    try {
      const isReceiptDocument = title === 'سند استلام';
      const defaultName = defaultFilename || `hotel_document_${helpers.getLocalDateString()}.pdf`;
      const { canceled, filePath } = await dialog.showSaveDialog(session.mainWindow, {
        title: 'تصدير وحفظ ملف PDF',
        defaultPath: defaultName,
        filters: [{ name: 'PDF Document (*.pdf)', extensions: ['pdf'] }]
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      // Invisible offscreen window to generate pixel-perfect A4 PDF
      const pdfWin = new BrowserWindow({
        width: 794,
        height: 1123,
        useContentSize: true,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      const fullHtml = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>${title || 'مستند فندقي'}</title>
          <style>
            ${isReceiptDocument ? '' : '@page { size: A4; margin: 10mm; }'}
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body { margin: 0; padding: 0; }
            html { font-size: 18px; }
            body {
              font-family: "Segoe UI", Tahoma, "Cairo", Arial, sans-serif;
              direction: rtl;
              text-align: right;
              background: white;
              color: #0f172a;
              padding: 0;
              margin: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            table { width: 100%; border-collapse: collapse; }
          </style>
        </head>
        <body>
          <div style="padding: ${isReceiptDocument ? '0' : '10px'}; width: 100%;">
            ${html}
          </div>
        </body>
        </html>
      `;

await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(embedAssets(fullHtml))}`);
      let receiptScale = 1;
      if (isReceiptDocument) {
        const fit = await pdfWin.webContents.executeJavaScript('window.prepareReceiptForPrint ? window.prepareReceiptForPrint({ applyZoom: false }) : null');
        receiptScale = Number(fit && fit.scale) || 0.92;
      }
      const pdfData = await pdfWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        landscape: false,
        preferCSSPageSize: true,
        ...(isReceiptDocument ? { scale: Math.max(0.88, Math.min(1, receiptScale)) } : {})
      });

      fs.writeFileSync(filePath, pdfData);
      pdfWin.destroy();

      // Automatically open the saved PDF for the user!
      try {
        shell.openPath(filePath);
      } catch (e) {}

      return { success: true, filePath };
    } catch (err) {
      console.error('[PDF Export Error]:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('print:open-preview-window', async (event, { html, title }) => {
    try {
      const isReceiptDocument = String(title || '').includes('سند الاستلام');
      const previewWin = new BrowserWindow({
        width: 960,
        height: 900,
        minWidth: 800,
        minHeight: 650,
        title: title || 'معاينة الطباعة الرسمية',
        autoHideMenuBar: true,
        backgroundColor: '#f8fafc',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      const fullHtml = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>${title || 'معاينة الطباعة'}</title>
          <style>
            ${isReceiptDocument ? '' : '@page { size: A4; margin: 10mm; }'}
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html { font-size: 18px; }
            body {
              font-family: "Segoe UI", Tahoma, "Cairo", Arial, sans-serif;
              direction: rtl;
              text-align: right;
              background: #f1f5f9;
              color: #0f172a;
              padding: 24px;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .preview-toolbar {
              max-width: 820px;
              margin: 0 auto 16px auto;
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 16px;
              background: #1e1b4b;
              color: white;
              padding: 14px 20px;
              border-radius: 10px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .preview-title { font-weight: 800; font-size: 1.05rem; }
            .preview-close, .preview-footer button {
              border: 1px solid transparent;
              border-radius: 8px;
              padding: 10px 18px;
              font: inherit;
              font-weight: 700;
              cursor: pointer;
            }
            .preview-close {
              flex: 0 0 auto;
              color: white;
              background: rgba(255,255,255,0.12);
              border-color: rgba(255,255,255,0.16);
              padding: 7px 12px;
              font-size: 1.15rem;
            }
            .btn-preview-print {
              background: #4f46e5;
              color: white;
              border: 1px solid #4f46e5 !important;
              display: inline-flex;
              align-items: center;
              gap: 8px;
            }
            .btn-preview-print:hover { background: #4338ca; }
            .preview-footer {
              max-width: 820px;
              margin: 14px auto 0;
              padding: 14px 18px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 12px;
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              box-shadow: 0 4px 10px rgba(15,23,42,0.05);
            }
            .btn-preview-close {
              color: #334155;
              background: white;
              border-color: #cbd5e1 !important;
            }
            .sheet-card {
              max-width: 820px;
              margin: 0 auto;
              background: white;
              box-shadow: 0 10px 25px rgba(0,0,0,0.08);
              border-radius: 12px;
              padding: 30px;
            }
            @media (max-width: 600px) {
              body { padding: 12px; }
              .preview-toolbar { padding: 12px; }
              .preview-footer { padding: 12px; }
              .sheet-card { padding: 16px; }
            }
            @media print {
              html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
              .preview-toolbar, .preview-footer { display: none !important; }
              .sheet-card { box-shadow: none !important; border: none !important; border-radius: 0 !important; padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; }
            }
          </style>
        </head>
        <body>
          <div class="preview-toolbar">
            <div class="preview-title">📄 ${title || 'معاينة الطباعة الرسمية'}</div>
            <button class="preview-close" type="button" onclick="window.close()" aria-label="إغلاق المعاينة">×</button>
          </div>
          <div class="sheet-card">
            ${html}
          </div>
          <div class="preview-footer">
            <button class="btn-preview-print" type="button" onclick="window.print()">طباعة المستند الرسمي 🖨️</button>
            <button class="btn-preview-close" type="button" onclick="window.close()">إغلاق</button>
          </div>
        </body>
        </html>
      `;

const finalHtml = fullHtml
  .replace(/assets\/seal\.svg/g, sealUrl)
  .replace(/assets\/signature\.svg/g, signatureUrl);

previewWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(embedAssets(finalHtml))}`);
      return { success: true };
    } catch (err) {
      console.error('[Preview Window Error]:', err);
      return { success: false, error: err.message };
    }
  });

  // 13. Open WhatsApp via OS Default Browser / App
  ipcMain.handle('open-whatsapp', async (event, url) => {
    try {
      if (!url || typeof url !== 'string' || !url.startsWith('https://wa.me/')) {
        return { success: false, error: 'رابط واتساب غير صالح.' };
      }
      await shell.openExternal(url);
      return { success: true };
    } catch (err) {
      console.error('[WhatsApp Open External Error]:', err);
      return { success: false, error: err.message };
    }
  });
};
