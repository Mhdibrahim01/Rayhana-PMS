/**
 * Rayhana ERP - Multi-Brand / White-Label IPC Handlers
 * Domain: ipc/branding.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BRANDING_FILE_PATH = path.join(__dirname, '..', 'config', 'branding.json');

const DEFAULT_BRANDING = {
  activeBrand: 'hotel_1',
  hideBrandSwitcherInExe: true,
  brands: {
    hotel_1: {
      id: 'hotel_1',
      nameAr: 'ريحانة للوحدات السكنية',
      nameEn: 'Rayhana Suites',
      companyAr: 'مؤسسة مكتب شمس المنازل للخدمات العقارية',
      subtitle: 'ريحانة للوحدات السكنية المفروشة',
      crNumber: '7038955915',
      vatNumber: '310123456700003',
      address: 'الخبر - الثقبة',
      postalCode: '34625',
      phone: '0560631783',
      monthlyNameEn: 'Shams Al-Manazil Real Estate Services',
      monthlyCrNumber: '7038955915',
      monthlyVatNumber: '',
      monthlyPhone: '0560631783',
      monthlyAddress: 'الخبر - الثقبة',
      monthlyPostalCode: '34625',
      invoiceHeader: 'فاتورة ضريبية - ريحانة للوحدات السكنية',
      primaryColor: '#1a428a',
      accentColor: '#f59e0b',
      logo: 'assets/brands/hotel_1/logo.png',
      seal: 'assets/brands/hotel_1/seal.svg',
      signature: 'assets/brands/hotel_1/signature.svg',
      showSeal: true,
      showSignature: true
    },
    general: {
      id: 'general',
      nameAr: 'نظام إدارة الإيواء والوحدات العقارية',
      nameEn: 'Property & Hospitality ERP',
      companyAr: 'مكتب الخدمات العقارية وإدارة الأملاك',
      subtitle: 'إدارة الحجوزات والوحدات السكنية والعقارية',
      crNumber: '7000000000',
      vatNumber: '300000000000003',
      address: 'المملكة العربية السعودية',
      postalCode: '10000',
      phone: '0500000000',
      monthlyNameEn: 'Property & Real Estate Services',
      monthlyCrNumber: '7000000000',
      monthlyVatNumber: '',
      monthlyPhone: '0500000000',
      monthlyAddress: 'المملكة العربية السعودية',
      monthlyPostalCode: '10000',
      invoiceHeader: 'فاتورة ضريبية',
      primaryColor: '#1e3a8a',
      accentColor: '#f59e0b',
      logo: 'assets/brands/general/logo.png',
      seal: 'assets/brands/general/seal.svg',
      signature: 'assets/brands/general/signature.svg',
      showSeal: true,
      showSignature: true
    }
  }
};

function readBrandingConfigFromDisk(app) {
  let userPath = null;
  if (app && typeof app.getPath === 'function') {
    try {
      userPath = path.join(app.getPath('userData'), 'branding.json');
    } catch (_) {}
  }

  let baseConfig = null;
  try {
    if (fs.existsSync(BRANDING_FILE_PATH)) {
      const raw = fs.readFileSync(BRANDING_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.brands && parsed.activeBrand && parsed.brands[parsed.activeBrand]) {
        baseConfig = parsed;
      }
    }
  } catch (err) {
    console.error('[Branding] Failed to read bundled config:', err.message);
  }

  if (!baseConfig || !baseConfig.brands) {
    baseConfig = JSON.parse(JSON.stringify(DEFAULT_BRANDING));
  }

  if (userPath && fs.existsSync(userPath)) {
    try {
      const raw = fs.readFileSync(userPath, 'utf8');
      const parsed = JSON.parse(raw);
      // Validate that cached activeBrand actually exists in baseConfig
      if (parsed && parsed.activeBrand && baseConfig.brands[parsed.activeBrand]) {
        for (const brandId of Object.keys(baseConfig.brands)) {
          if (parsed.brands && parsed.brands[brandId]) {
            baseConfig.brands[brandId] = Object.assign({}, baseConfig.brands[brandId], parsed.brands[brandId]);
          }
        }
        baseConfig.activeBrand = parsed.activeBrand;
        if (typeof parsed.hideBrandSwitcherInExe === 'boolean') {
          baseConfig.hideBrandSwitcherInExe = parsed.hideBrandSwitcherInExe;
        }
        return baseConfig;
      } else {
        // Obsolete or non-existent brand cached in userData (e.g. deleted demo hotel_2)!
        // Clean up userData file so stale cache does not linger
        try {
          fs.writeFileSync(userPath, JSON.stringify(baseConfig, null, 2), 'utf8');
        } catch (_) {}
      }
    } catch (err) {
      console.warn('[Branding] Failed reading userData config:', err.message);
    }
  }

  return baseConfig;
}

function writeBrandingConfigToDisk(config, app) {
  let written = false;
  const isPackaged = Boolean(app && app.isPackaged);

  if (!isPackaged) {
    try {
      const dir = path.dirname(BRANDING_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(BRANDING_FILE_PATH, JSON.stringify(config, null, 2), 'utf8');
      written = true;
    } catch (err) {
      console.warn('[Branding] Could not write to workspace branding.json:', err.message);
    }
  }

  let userPath = null;
  if (app && typeof app.getPath === 'function') {
    try {
      userPath = path.join(app.getPath('userData'), 'branding.json');
    } catch (_) {}
  }

  if (userPath && (isPackaged || !written)) {
    try {
      const dir = path.dirname(userPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(userPath, JSON.stringify(config, null, 2), 'utf8');
      written = true;
    } catch (err) {
      console.error('[Branding] Could not write to userData branding.json:', err.message);
    }
  }

  return written;
}

function registerBrandingIpc(ipcMain, { app, BrowserWindow, session }) {
  // Get active branding and brand profiles (sanitized for packaged client vs dev)
  ipcMain.handle('brand:get-config', async () => {
    const isPackaged = Boolean(app && app.isPackaged);
    const config = readBrandingConfigFromDisk(app);
    const activeId = config.activeBrand || 'hotel_1';
    const activeBrand = config.brands[activeId] || config.brands.hotel_1;

    // Packaged builds only expose their own active hotel. Dev environment exposes all.
    const brandsPayload = isPackaged
      ? { [activeId]: activeBrand }
      : config.brands;

    return {
      success: true,
      isPackaged,
      activeBrandId: activeId,
      current: activeBrand,
      brands: brandsPayload,
      hideBrandSwitcherInExe: Boolean(config.hideBrandSwitcherInExe)
    };
  });

  // Switch the active brand (Admin only, Dev environment only)
  ipcMain.handle('brand:set-active', async (_event, brandId) => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: تغيير هوية الفندق يتطلب صلاحيات المدير (Admin).' };
    }
    const isPackaged = Boolean(app && app.isPackaged);
    if (isPackaged) {
      return { success: false, error: 'غير مصرح: تغيير هوية الفندق غير متاح في النسخة المثبتة للعميل.' };
    }
    const config = readBrandingConfigFromDisk(app);
    if (!config.brands[brandId]) {
      return { success: false, error: `معرف الهوية غير معروف: ${brandId}` };
    }
    config.activeBrand = brandId;
    const ok = writeBrandingConfigToDisk(config, app);
    if (!ok) {
      return { success: false, error: 'فشل حفظ إعدادات الهوية على القرص.' };
    }

    const payload = {
      isPackaged,
      activeBrandId: brandId,
      current: config.brands[brandId],
      brands: config.brands
    };

    // Broadcast to all active browser windows if available
    if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
      for (const win of BrowserWindow.getAllWindows()) {
        try {
          win.webContents.send('brand:changed', payload);
        } catch (_) {}
      }
    }

    return { success: true, ...payload };
  });

  // Update a brand profile (Admin only; in packaged mode updates current hotel)
  ipcMain.handle('brand:update-profile', async (_event, { brandId, profile }) => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: تحديث بيانات المنشأة يتطلب صلاحيات المدير (Admin).' };
    }
    const isPackaged = Boolean(app && app.isPackaged);
    const config = readBrandingConfigFromDisk(app);

    const targetBrandId = isPackaged ? (config.activeBrand || 'hotel_1') : (brandId || config.activeBrand || 'hotel_1');

    if (!config.brands[targetBrandId]) {
      return { success: false, error: `معرف الهوية غير معروف: ${targetBrandId}` };
    }
    config.brands[targetBrandId] = Object.assign({}, config.brands[targetBrandId], profile, { id: targetBrandId });
    const ok = writeBrandingConfigToDisk(config, app);
    if (!ok) {
      return { success: false, error: 'فشل حفظ تحديثات بيانات المنشأة.' };
    }

    const payload = {
      isPackaged,
      activeBrandId: config.activeBrand,
      current: config.brands[config.activeBrand],
      brands: isPackaged ? { [config.activeBrand]: config.brands[config.activeBrand] } : config.brands
    };

    if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
      for (const win of BrowserWindow.getAllWindows()) {
        try {
          win.webContents.send('brand:changed', payload);
        } catch (_) {}
      }
    }

    return { success: true, ...payload };
  });
}

module.exports = registerBrandingIpc;
