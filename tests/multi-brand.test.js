'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BRANDING_PATH = path.join(__dirname, '..', 'config', 'branding.json');
const ROOT_DIR = path.join(__dirname, '..');

test('Multi-Brand Configuration & Profiles Integrity', async (t) => {
  await t.test('branding.json exists and contains configured distinct hotel brands', () => {
    assert.ok(fs.existsSync(BRANDING_PATH), 'branding.json should exist');
    const config = JSON.parse(fs.readFileSync(BRANDING_PATH, 'utf8'));

    assert.ok(config.brands, 'config.brands must exist');
    assert.ok(config.brands.hotel_1, 'hotel_1 must exist');
    assert.ok(config.brands.hotel_2, 'hotel_2 must exist');
    assert.ok(config.brands.hotel_3, 'hotel_3 must exist');
    assert.ok(config.brands.hotel_4, 'hotel_4 must exist');
    assert.ok(config.brands.general, 'general brand must exist');
    assert.ok(Object.keys(config.brands).includes(config.activeBrand), 'activeBrand must be valid');
  });

  await t.test('each brand profile has complete required fields', () => {
    const config = JSON.parse(fs.readFileSync(BRANDING_PATH, 'utf8'));
    const requiredKeys = ['id', 'nameAr', 'nameEn', 'companyAr', 'crNumber', 'phone', 'logo', 'seal', 'signature'];

    for (const [id, brand] of Object.entries(config.brands)) {
      for (const key of requiredKeys) {
        assert.ok(brand[key], `Brand [${id}] must have property ${key}`);
      }
    }
  });

  await t.test('each brand has corresponding asset files on disk', () => {
    const config = JSON.parse(fs.readFileSync(BRANDING_PATH, 'utf8'));

    for (const [id, brand] of Object.entries(config.brands)) {
      const logoPath = path.join(ROOT_DIR, brand.logo);
      const sealPath = path.join(ROOT_DIR, brand.seal);
      const sigPath = path.join(ROOT_DIR, brand.signature);

      assert.ok(fs.existsSync(logoPath), `Brand [${id}] logo must exist: ${brand.logo}`);
      assert.ok(fs.existsSync(sealPath), `Brand [${id}] seal must exist: ${brand.seal}`);
      assert.ok(fs.existsSync(sigPath), `Brand [${id}] signature must exist: ${brand.signature}`);

      assert.ok(fs.statSync(logoPath).size > 0, `Logo file for [${id}] cannot be empty`);
      assert.ok(fs.statSync(sealPath).size > 0, `Seal file for [${id}] cannot be empty`);
      assert.ok(fs.statSync(sigPath).size > 0, `Signature file for [${id}] cannot be empty`);
    }
  });

  await t.test('distinct properties between brands', () => {
    const config = JSON.parse(fs.readFileSync(BRANDING_PATH, 'utf8'));
    const h1 = config.brands.hotel_1;
    const h2 = config.brands.hotel_2;
    const h3 = config.brands.hotel_3;

    assert.notEqual(h1.nameAr, h2.nameAr);
    assert.notEqual(h2.nameAr, h3.nameAr);
    assert.notEqual(h1.crNumber, h2.crNumber);
    assert.notEqual(h2.crNumber, h3.crNumber);
    assert.notEqual(h1.seal, h2.seal);
    assert.notEqual(h2.seal, h3.seal);
  });
});

test('Multi-Brand IPC Handlers & Access Control', async (t) => {
  const registerBrandingIpc = require('../ipc/branding');

  class FakeIpcMain {
    constructor() {
      this.handlers = new Map();
    }
    handle(channel, fn) {
      this.handlers.set(channel, fn);
    }
    async invoke(channel, event, ...args) {
      const fn = this.handlers.get(channel);
      if (!fn) throw new Error(`No handler for channel ${channel}`);
      return fn(event, ...args);
    }
  }

  const fakeIpc = new FakeIpcMain();
  const session = { currentUser: { id: 1, username: 'admin', role: 'Admin' } };
  const fakeBrowserWindow = { getAllWindows: () => [] };

  registerBrandingIpc(fakeIpc, { BrowserWindow: fakeBrowserWindow, session });

  await t.test('brand:get-config returns active brand, catalog, and hideBrandSwitcherInExe flag', async () => {
    const res = await fakeIpc.invoke('brand:get-config', {});
    assert.equal(res.success, true);
    assert.ok(res.current);
    assert.ok(res.brands);
    assert.equal(typeof res.hideBrandSwitcherInExe, 'boolean');
  });

  await t.test('non-Admin role cannot switch active brand', async () => {
    session.currentUser = { id: 2, username: 'receptionist', role: 'User' };
    const res = await fakeIpc.invoke('brand:set-active', {}, 'hotel_2');
    assert.equal(res.success, false);
    assert.match(res.error, /غير مصرح/);
  });

  await t.test('non-Admin role cannot update brand profile', async () => {
    session.currentUser = { id: 2, username: 'receptionist', role: 'User' };
    const res = await fakeIpc.invoke('brand:update-profile', {}, { brandId: 'hotel_2', profile: { phone: '0599999999' } });
    assert.equal(res.success, false);
    assert.match(res.error, /غير مصرح/);
  });

  await t.test('Admin role can switch brand and update profile in dev mode', async () => {
    session.currentUser = { id: 1, username: 'admin', role: 'Admin' };
    const originalConfig = JSON.parse(fs.readFileSync(BRANDING_PATH, 'utf8'));

    try {
      const switchRes = await fakeIpc.invoke('brand:set-active', {}, 'hotel_2');
      assert.equal(switchRes.success, true);
      assert.equal(switchRes.activeBrandId, 'hotel_2');

      const updateRes = await fakeIpc.invoke('brand:update-profile', {}, {
        brandId: 'hotel_2',
        profile: { phone: '0500000002' }
      });
      assert.equal(updateRes.success, true);
      assert.equal(updateRes.brands.hotel_2.phone, '0500000002');
    } finally {
      // Restore original config
      fs.writeFileSync(BRANDING_PATH, JSON.stringify(originalConfig, null, 2), 'utf8');
    }
  });

  await t.test('Admin role can update general brand profile including showSeal and showSignature toggles', async () => {
    session.currentUser = { id: 1, username: 'admin', role: 'Admin' };
    const originalConfig = JSON.parse(fs.readFileSync(BRANDING_PATH, 'utf8'));

    try {
      const updateRes = await fakeIpc.invoke('brand:update-profile', {}, {
        brandId: 'general',
        profile: {
          nameAr: 'مكتب الاختبار العام',
          companyAr: 'مؤسسة الاختبار العقاري',
          showSeal: false,
          showSignature: false
        }
      });
      assert.equal(updateRes.success, true);
      assert.equal(updateRes.brands.general.nameAr, 'مكتب الاختبار العام');
      assert.equal(updateRes.brands.general.companyAr, 'مؤسسة الاختبار العقاري');
      assert.equal(updateRes.brands.general.showSeal, false);
      assert.equal(updateRes.brands.general.showSignature, false);
    } finally {
      fs.writeFileSync(BRANDING_PATH, JSON.stringify(originalConfig, null, 2), 'utf8');
    }
  });

  await t.test('Packaged mode isolates client to their active hotel only and rejects switching', async () => {
    const os = require('node:os');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'branding-test-'));
    try {
      const packagedIpc = new FakeIpcMain();
      const packagedApp = { isPackaged: true, getPath: () => tempDir };
      registerBrandingIpc(packagedIpc, { app: packagedApp, BrowserWindow: fakeBrowserWindow, session });

      session.currentUser = { id: 1, username: 'admin', role: 'Admin' };

      // Get config in packaged mode returns only active hotel
      const cfg = await packagedIpc.invoke('brand:get-config', {});
      assert.equal(cfg.success, true);
      assert.equal(cfg.isPackaged, true);
      assert.equal(Object.keys(cfg.brands).length, 1);
      assert.ok(cfg.brands[cfg.activeBrandId]);

      // Switching is blocked in packaged mode
      const switchAttempt = await packagedIpc.invoke('brand:set-active', {}, 'hotel_3');
      assert.equal(switchAttempt.success, false);
      assert.match(switchAttempt.error, /غير مصرح/);

      // Profile update in packaged mode targets their hotel
      const updateAttempt = await packagedIpc.invoke('brand:update-profile', {}, {
        brandId: 'hotel_1',
        profile: { address: 'الخبر - شارع الملك عبدالعزيز' }
      });
      assert.equal(updateAttempt.success, true);
      assert.equal(updateAttempt.isPackaged, true);
      assert.equal(Object.keys(updateAttempt.brands).length, 1);
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });
});

test('White-Label Neutralization in UI Modals and Templates', async (t) => {
  await t.test('dashboard.html operational modals do not leak hardcoded brand strings', () => {
    const dashboardHtml = fs.readFileSync(path.join(ROOT_DIR, 'dashboard.html'), 'utf8');

    // Payment modal subtitle
    assert.doesNotMatch(dashboardHtml, /ريحانة للوحدات السكنية - سند سداد حجز/);
    // Settlement modal subtitle
    assert.doesNotMatch(dashboardHtml, /ريحانة للوحدات السكنية - احتساب الليالي وتصفية المستحقات/);
    // User manual heading & intro
    assert.doesNotMatch(dashboardHtml, /دليل مستخدم نظام ريحانة/);
    assert.doesNotMatch(dashboardHtml, /Rayhana ERP User Manual/);
  });

  await t.test('dashboard.js topbar section titleMap does not hardcode brand in overview', () => {
    const dashboardJs = fs.readFileSync(path.join(ROOT_DIR, 'dashboard.js'), 'utf8');
    assert.doesNotMatch(dashboardJs, /overview:\s*\['ريحانة للوحدات السكنية'/);
  });
});
