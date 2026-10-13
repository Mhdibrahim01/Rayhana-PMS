const { app, BrowserWindow, ipcMain, shell, dialog, Notification, powerMonitor } = require('electron');

// =============================================================================
// GPU & RENDERING ACCELERATION FLAGS (must be called before app.whenReady)
// These eliminate stuttering caused by heavy backdrop-filter on the Glassmorphism UI
// =============================================================================
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-oop-rasterization');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,CanvasOopRasterization');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const backupScheduler = require('./backupScheduler');
const { createBusinessDayScheduler } = require('./businessDayScheduler');
const { registerAllIpcHandlers } = require('./ipc');

let mainWindow = null;
let dbPath = '';
let currentUser = null;
let currentLogId = null;
let businessDayScheduler = null;

/**
 * Creates the primary application window, starting on the login view.
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    title: 'بوابة الوصول الآمن | Secure System Access',
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: '#f1f5f9',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',
      symbolColor: '#1e293b',
      height: 32
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Enable GPU compositing for smooth Glassmorphism backdrop-filter
      enableBlinkFeatures: 'CSSBackdropFilter',
      backgroundThrottling: false
    }
  });

  mainWindow.setMenuBarVisibility(false);

  // Initial screen is the master application lock gate
  mainWindow.loadFile('app-lock.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Handle keyboard shortcuts (F11 fullscreen toggle & prevent accidental reload in production)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
      return;
    }
    if (app.isPackaged && ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5')) {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Resolves persistent SQLite database path in Windows AppData
 * Seamlessly migrates existing database to rayhana_erp.sqlite if found.
 */
function resolveDatabasePath() {
  const userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const newDbPath = path.join(userDataDir, 'rayhana_erp.sqlite');
  const legacyDbInUserData = path.join(userDataDir, 'ahmed_hotel_erp.sqlite');
  const legacyDbInOldAppData = path.join(app.getPath('appData'), 'ahmed-hotel-erp', 'ahmed_hotel_erp.sqlite');

  // Automatic Migration: If new DB does not exist yet, preserve old records
  if (!fs.existsSync(newDbPath)) {
    if (fs.existsSync(legacyDbInUserData)) {
      try {
        fs.copyFileSync(legacyDbInUserData, newDbPath);
        console.log('[DB Migration] تم ترحيل قاعدة البيانات السابقة إلى rayhana_erp.sqlite');
      } catch (e) {
        console.warn('[DB Migration Warning]:', e.message);
        return legacyDbInUserData;
      }
    } else if (fs.existsSync(legacyDbInOldAppData)) {
      try {
        fs.copyFileSync(legacyDbInOldAppData, newDbPath);
        console.log('[DB Migration] تم ترحيل قاعدة البيانات القديمة من ahmed-hotel-erp إلى rayhana_erp.sqlite');
      } catch (e) {
        console.warn('[DB Migration Warning]:', e.message);
      }
    }
  }

  return fs.existsSync(newDbPath) ? newDbPath : (fs.existsSync(legacyDbInUserData) ? legacyDbInUserData : newDbPath);
}

/**
 * Format local date as YYYY-MM-DD (immune to UTC timezone offsets)
 */
function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Automated SQLite database backup with Microsoft OneDrive cloud sync
 * and multi-tier smart fallback (D:\ Drive -> AppData).
 */
function backupDatabase() {
  try {
    // 1. Resolve source SQLite database file
    let sourceDb = '';
    if (fs.existsSync(path.join(__dirname, 'database.sqlite'))) {
      sourceDb = path.join(__dirname, 'database.sqlite');
    } else if (typeof dbPath !== 'undefined' && dbPath && fs.existsSync(dbPath)) {
      sourceDb = dbPath;
    } else if (fs.existsSync(path.join(app.getPath('userData'), 'rayhana_erp.sqlite'))) {
      sourceDb = path.join(app.getPath('userData'), 'rayhana_erp.sqlite');
    } else {
      sourceDb = path.join(__dirname, 'database.sqlite');
    }

    if (!fs.existsSync(sourceDb)) {
      throw new Error(`ملف قاعدة البيانات المصدر غير موجود: ${sourceDb}`);
    }

    // 2. Prepare dynamic filename with current date (backup_YYYY-MM-DD.sqlite)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const backupFileName = `backup_${dateStr}.sqlite`;

    // 3. Detect custom backup directory or Microsoft OneDrive local path
    const customBackupDir = typeof backupScheduler !== 'undefined' && typeof backupScheduler.getCustomBackupDirectory === 'function' ? backupScheduler.getCustomBackupDirectory() : null;
    const oneDrivePath = process.env.OneDrive || process.env.OneDriveConsumer;
    let targetDir = '';
    let destinationLabel = '';

    if (customBackupDir && fs.existsSync(customBackupDir)) {
      targetDir = customBackupDir;
      destinationLabel = `مجلد النسخ المخصص المختار (${path.basename(customBackupDir)})`;
    } else if (oneDrivePath && fs.existsSync(oneDrivePath)) {
      // Step 2: Target Cloud Folder inside OneDrive
      targetDir = path.join(oneDrivePath, 'AhmedERP_Backups');
      destinationLabel = 'Microsoft OneDrive (سحابي - Cloud Sync)';
    } else {
      // Step 4: Smart Fallback (D:\AhmedERP_Backups or AppData)
      const dDrive = 'D:\\';
      const dDriveBackup = 'D:\\AhmedERP_Backups';

      if (fs.existsSync(dDrive)) {
        try {
          if (!fs.existsSync(dDriveBackup)) {
            fs.mkdirSync(dDriveBackup, { recursive: true });
          }
          targetDir = dDriveBackup;
          destinationLabel = 'القرص المحلي (D:\\ Drive Fallback)';
        } catch (dErr) {
          console.warn('[Backup] تعذر استخدام القرص D:\\:', dErr.message);
        }
      }

      // Last resort fallback to app.getPath('userData')
      if (!targetDir) {
        targetDir = path.join(app.getPath('userData'), 'AhmedERP_Backups');
        destinationLabel = 'مجلد بيانات التطبيق المحلي (AppData Last Resort)';
      }
    }

    // Ensure target folder exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetFilePath = path.join(targetDir, backupFileName);

    // Step 3: Copy SQLite database file into destination
    if (typeof db !== 'undefined' && db && typeof db.createBackupCopy === 'function') {
      db.createBackupCopy(targetFilePath);
    } else {
      fs.copyFileSync(sourceDb, targetFilePath);
    }

    // Step 5: Log outcome to console for developer verification
    console.log(`=======================================================`);
    console.log(`[Backup System] ✓ تم إنشاء النسخة الاحتياطية بنجاح!`);
    console.log(`[Backup System] 📂 الوجهة: ${destinationLabel}`);
    console.log(`[Backup System] 📁 مسار المجلد: ${targetDir}`);
    console.log(`[Backup System] 📄 اسم الملف: ${backupFileName}`);
    console.log(`[Backup System] 📍 المسار النهائي: ${targetFilePath}`);
    console.log(`=======================================================`);

    return {
      success: true,
      destinationLabel,
      targetDir,
      backupFileName,
      targetFilePath
    };
  } catch (error) {
    console.error(`[Backup System] ✗ فشل إنشاء النسخة الاحتياطية:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Automated Room Status updater function in main.js
 * Checks Reservations table against the currently open hotel business date:
 * - If today's date falls between check_in_date and check_out_date -> update room to 'مشغولة' (Occupied)
 * - If check_out_date has passed -> update room to 'تنظيف' (Cleaning)
 */
function updateAutomatedRoomStatuses() {
  try {
    const today = db.getCurrentBusinessDate();
    const result = db.autoUpdateRoomStatuses(today);
    return result;
  } catch (err) {
    console.error('[Auto Room Status Error]:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Register all IPC channels via modular domain handlers
 */
function registerIpcHandlers() {
  const session = {
    get currentUser() { return currentUser; },
    set currentUser(val) { currentUser = val; },
    get currentLogId() { return currentLogId; },
    set currentLogId(val) { currentLogId = val; },
    get mainWindow() { return mainWindow; },
    get dbPath() { return dbPath; }
  };

  const helpers = {
    getLocalDateString,
    getHotelBusinessDate: db.getHotelBusinessDate,
    getCurrentBusinessDate: db.getCurrentBusinessDate,
    checkBusinessDayRollover: () => businessDayScheduler?.checkAndClose(),
    updateAutomatedRoomStatuses,
    backupDatabase
  };

  registerAllIpcHandlers(ipcMain, {
    app,
    BrowserWindow,
    dialog,
    shell,
    Notification,
    db,
    backupScheduler,
    session,
    helpers
  });
}

// Set Windows Application User Model ID for pinned taskbar grouping and branding
app.setAppUserModelId('com.rayhana.suites');

// Enforce single instance lock to prevent concurrent database access conflicts
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  console.warn('[Main] نسخة أخرى قيد التشغيل بالفعل. جاري إغلاق المثيل المكرر.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // App Lifecycle
  app.whenReady().then(async () => {
    try {
      dbPath = resolveDatabasePath();
      console.log('[Main] مسار قاعدة البيانات:', dbPath);
      await db.init(dbPath);
      updateAutomatedRoomStatuses();

      businessDayScheduler = createBusinessDayScheduler({
        db,
        powerMonitor,
        getMainWindow: () => mainWindow
      });

      registerIpcHandlers();
      createWindow();
      businessDayScheduler.start();

      // Start Daily 12:00 AM Automated Backup Scheduler
      await backupScheduler.initBackupScheduler({
        db,
        app,
        shell,
        Notification,
        getMainWindow: () => mainWindow
      });

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });
    } catch (error) {
      console.error('[Main] فشل في تشغيل التطبيق:', error);
      app.quit();
    }
  });
}

app.on('window-all-closed', () => {
  if (businessDayScheduler) businessDayScheduler.stop();
  backupScheduler.stopBackupScheduler();
  if (currentLogId) {
    db.logEmployeeLogout(currentLogId);
    currentLogId = null;
  }
  db.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
