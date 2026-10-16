#!/usr/bin/env node
'use strict';

/**
 * Multi-Brand / White-Label Switcher & Build Prep Tool
 *
 * Usage:
 *   node scripts/apply-brand.js <hotel_1 | hotel_2 | hotel_3>
 *   node scripts/apply-brand.js --list
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const BRANDING_PATH = path.join(ROOT_DIR, 'config', 'branding.json');
const PACKAGE_PATH = path.join(ROOT_DIR, 'package.json');

function loadBranding() {
  if (!fs.existsSync(BRANDING_PATH)) {
    console.error('Error: config/branding.json not found!');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(BRANDING_PATH, 'utf8'));
}

function copyFileIfExists(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    return true;
  }
  return false;
}

function applyBrand(targetBrandId) {
  const config = loadBranding();
  const brands = config.brands || {};

  if (targetBrandId === '--create' || targetBrandId === '-c') {
    const newId = process.argv[3];
    if (!newId) {
      console.error('Usage: node scripts/apply-brand.js --create <brand_id> [Name_AR] [Name_EN]');
      process.exit(1);
    }
    const nameAr = process.argv[4] || `فندق ${newId}`;
    const nameEn = process.argv[5] || `${newId} Hotel`;
    const targetFolder = path.join(ROOT_DIR, 'assets', 'brands', newId);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    const baseFolder = path.join(ROOT_DIR, 'assets', 'brands', 'hotel_1');
    copyFileIfExists(path.join(baseFolder, 'logo.png'), path.join(targetFolder, 'logo.png'));
    copyFileIfExists(path.join(baseFolder, 'seal.svg'), path.join(targetFolder, 'seal.svg'));
    copyFileIfExists(path.join(baseFolder, 'signature.svg'), path.join(targetFolder, 'signature.svg'));

    config.brands[newId] = {
      id: newId,
      nameAr,
      nameEn,
      companyAr: nameAr,
      subtitle: nameAr,
      crNumber: '7000000000',
      vatNumber: '300000000000003',
      address: 'المملكة العربية السعودية',
      postalCode: '10000',
      phone: '0500000000',
      invoiceHeader: `فاتورة ضريبية - ${nameAr}`,
      primaryColor: '#2563eb',
      accentColor: '#f59e0b',
      logo: `assets/brands/${newId}/logo.png`,
      seal: `assets/brands/${newId}/seal.svg`,
      signature: `assets/brands/${newId}/signature.svg`
    };
    fs.writeFileSync(BRANDING_PATH, JSON.stringify(config, null, 2), 'utf8');
    console.log(`\n✅ Brand [${newId}] created successfully!`);
    console.log(` Assets initialized in: assets/brands/${newId}/`);
    console.log(` You can customize them or edit details in config/branding.json\n`);
    return;
  }

  if (!targetBrandId || targetBrandId === '--list' || targetBrandId === '-l') {
    console.log('\n======================================================');
    console.log(' Available Hotel Brand Profiles:');
    console.log('======================================================');
    for (const [id, b] of Object.entries(brands)) {
      const activeMark = id === config.activeBrand ? ' (★ ACTIVE)' : '';
      console.log(` • [${id}] ${b.nameAr} | ${b.nameEn}${activeMark}`);
      console.log(`     CR: ${b.crNumber} | VAT: ${b.vatNumber} | Color: ${b.primaryColor}`);
    }
    console.log('\nUsage:');
    console.log('  node scripts/apply-brand.js <brand_id>');
    console.log('  node scripts/apply-brand.js --create <new_brand_id> [Name_AR] [Name_EN]\n');
    return;
  }

  const brand = brands[targetBrandId];
  if (!brand) {
    console.error(`\n❌ Error: Brand "${targetBrandId}" does not exist in config/branding.json`);
    console.error(`Available brands: ${Object.keys(brands).join(', ')}\n`);
    process.exit(1);
  }

  // 1. Update config/branding.json activeBrand
  config.activeBrand = targetBrandId;
  fs.writeFileSync(BRANDING_PATH, JSON.stringify(config, null, 2), 'utf8');

  // 2. Synchronize root assets for build-time assets fallback
  const brandFolder = path.join(ROOT_DIR, 'assets', 'brands', targetBrandId);
  const rootAssets = path.join(ROOT_DIR, 'assets');

  const brandLogo = path.join(brandFolder, 'logo.png');
  const brandSeal = path.join(brandFolder, 'seal.svg');
  const brandSig = path.join(brandFolder, 'signature.svg');

  copyFileIfExists(brandLogo, path.join(rootAssets, 'logo.png'));
  copyFileIfExists(brandLogo, path.join(rootAssets, 'rayhana-logo.png'));
  copyFileIfExists(brandSeal, path.join(rootAssets, 'seal.svg'));
  copyFileIfExists(brandSig, path.join(rootAssets, 'signature.svg'));

  // 3. Update package.json product metadata
  if (fs.existsSync(PACKAGE_PATH)) {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
    pkg.description = `${brand.nameAr} - ${brand.nameEn} ERP`;
    if (pkg.build) {
      pkg.build.productName = brand.nameEn;
      pkg.build.appId = `com.rayhana.${targetBrandId}`;
    }
    fs.writeFileSync(PACKAGE_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  }

  // 4. Update static titles and headings in dashboard.html and login.html
  const dashboardHtmlPath = path.join(ROOT_DIR, 'dashboard.html');
  if (fs.existsSync(dashboardHtmlPath)) {
    let dHtml = fs.readFileSync(dashboardHtmlPath, 'utf8');
    dHtml = dHtml.replace(/<title>.*?<\/title>/, `<title>لوحة التحكم | ${brand.nameAr} - ${brand.nameEn || ''}</title>`);
    dHtml = dHtml.replace(/<h2 id="sidebar-brand-title">.*?<\/h2>/, `<h2 id="sidebar-brand-title">${brand.nameAr}</h2>`);
    dHtml = dHtml.replace(/<p id="sidebar-brand-subtitle">.*?<\/p>/, `<p id="sidebar-brand-subtitle">${brand.nameEn || ''}</p>`);
    dHtml = dHtml.replace(/<h1 id="topbar-heading">.*?<\/h1>/, `<h1 id="topbar-heading">${brand.nameAr}</h1>`);
    dHtml = dHtml.replace(/<p id="topbar-subheading">.*?<\/p>/, `<p id="topbar-subheading">${brand.nameEn || ''} • لوحة التحكم وإدارة العمليات</p>`);
    fs.writeFileSync(dashboardHtmlPath, dHtml, 'utf8');
  }

  const loginHtmlPath = path.join(ROOT_DIR, 'login.html');
  if (fs.existsSync(loginHtmlPath)) {
    let lHtml = fs.readFileSync(loginHtmlPath, 'utf8');
    lHtml = lHtml.replace(/<title>.*?<\/title>/, `<title>تسجيل الدخول | ${brand.nameAr} - ${brand.nameEn || ''}</title>`);
    lHtml = lHtml.replace(/<h1 id="login-brand-title"[^>]*>.*?<\/h1>/, `<h1 id="login-brand-title" class="login-title">${brand.nameAr}</h1>`);
    lHtml = lHtml.replace(/<p id="login-brand-subtitle"[^>]*>.*?<\/p>/, `<p id="login-brand-subtitle" class="login-subtitle">${brand.nameEn || ''} • ${brand.subtitle || 'نظام إدارة الحجوزات الفندقية'}</p>`);
    fs.writeFileSync(loginHtmlPath, lHtml, 'utf8');
  }

  console.log('\n======================================================');
  console.log(` ✅ Brand Successfully Switched to: [${targetBrandId}]`);
  console.log('======================================================');
  console.log(` Hotel Name (AR) : ${brand.nameAr}`);
  console.log(` Hotel Name (EN) : ${brand.nameEn}`);
  console.log(` Company (Legal) : ${brand.companyAr}`);
  console.log(` Unified CR No.  : ${brand.crNumber}`);
  console.log(` VAT Number      : ${brand.vatNumber}`);
  console.log(` Reception Phone : ${brand.phone}`);
  console.log(` Primary Color   : ${brand.primaryColor}`);
  console.log(' Root Assets     : logo.png, seal.svg, signature.svg synchronized.');
  console.log(' Package.json    : productName & appId updated.');
  console.log('======================================================\n');
}

const targetArg = process.argv[2];
applyBrand(targetArg);
