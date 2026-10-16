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
      invoiceHeader: 'فاتورة ضريبية - ريحانة للوحدات السكنية',
      primaryColor: '#1a428a',
      accentColor: '#f59e0b',
      logo: 'assets/brands/hotel_1/logo.png',
      seal: 'assets/brands/hotel_1/seal.svg',
      signature: 'assets/brands/hotel_1/signature.svg'
    },
    hotel_2: {
      id: 'hotel_2',
      nameAr: 'أجنحة المنار الفندقية',
      nameEn: 'Al-Manar Hotel Suites',
      companyAr: 'مؤسسة المنار للضيافة الفندقية',
      subtitle: 'أجنحة فندقية مفروشة وخدمات راقية',
      crNumber: '7021489632',
      vatNumber: '310987654300003',
      address: 'الرياض - حي الملز',
      postalCode: '12836',
      phone: '0501234567',
      invoiceHeader: 'فاتورة ضريبية - أجنحة المنار الفندقية',
      primaryColor: '#0d7a5f',
      accentColor: '#d97706',
      logo: 'assets/brands/hotel_2/logo.png',
      seal: 'assets/brands/hotel_2/seal.svg',
      signature: 'assets/brands/hotel_2/signature.svg'
    },
    hotel_3: {
      id: 'hotel_3',
      nameAr: 'دار الضيافة للشقق المخدومة',
      nameEn: 'Dar Al-Diyafa Serviced Apartments',
      companyAr: 'شركة دار الضيافة للإيواء السياحي',
      subtitle: 'شقق مخدومة وإقامة استثنائية',
      crNumber: '7045981240',
      vatNumber: '311876543200003',
      address: 'جدة - حي الحمراء',
      postalCode: '23212',
      phone: '0559876543',
      invoiceHeader: 'فاتورة ضريبية - دار الضيافة للشقق المخدومة',
      primaryColor: '#7b1842',
      accentColor: '#eab308',
      logo: 'assets/brands/hotel_3/logo.png',
      seal: 'assets/brands/hotel_3/seal.svg',
      signature: 'assets/brands/hotel_3/signature.svg'
    }
  }
};

function readBrandingConfigFromDisk() {
  try {
    if (fs.existsSync(BRANDING_FILE_PATH)) {
      const raw = fs.readFileSync(BRANDING_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.brands && parsed.activeBrand && parsed.brands[parsed.activeBrand]) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[Branding] Failed to read config from disk, falling back to default:', err.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_BRANDING));
}

function writeBrandingConfigToDisk(config) {
  try {
    const dir = path.dirname(BRANDING_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BRANDING_FILE_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[Branding] Failed to write config to disk:', err.message);
    return false;
  }
}

function registerBrandingIpc(ipcMain, { BrowserWindow, session }) {
  // Get active branding and all brand profiles
  ipcMain.handle('brand:get-config', async () => {
    const config = readBrandingConfigFromDisk();
    const activeId = config.activeBrand || 'hotel_1';
    const activeBrand = config.brands[activeId] || config.brands.hotel_1;
    return {
      success: true,
      activeBrandId: activeId,
      current: activeBrand,
      brands: config.brands
    };
  });

  // Switch the active brand (Admin only)
  ipcMain.handle('brand:set-active', async (_event, brandId) => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: تغيير هوية الفندق يتطلب صلاحيات المدير (Admin).' };
    }
    const config = readBrandingConfigFromDisk();
    if (!config.brands[brandId]) {
      return { success: false, error: `معرف الهوية غير معروف: ${brandId}` };
    }
    config.activeBrand = brandId;
    const ok = writeBrandingConfigToDisk(config);
    if (!ok) {
      return { success: false, error: 'فشل حفظ إعدادات الهوية على القرص.' };
    }

    const payload = {
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

  // Update a brand profile (Admin only)
  ipcMain.handle('brand:update-profile', async (_event, { brandId, profile }) => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: تحديث بيانات الهوية يتطلب صلاحيات المدير (Admin).' };
    }
    const config = readBrandingConfigFromDisk();
    if (!config.brands[brandId]) {
      return { success: false, error: `معرف الهوية غير معروف: ${brandId}` };
    }
    config.brands[brandId] = Object.assign({}, config.brands[brandId], profile, { id: brandId });
    const ok = writeBrandingConfigToDisk(config);
    if (!ok) {
      return { success: false, error: 'فشل حفظ تحديثات الهوية.' };
    }

    const payload = {
      activeBrandId: config.activeBrand,
      current: config.brands[config.activeBrand],
      brands: config.brands
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
