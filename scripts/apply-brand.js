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

  if (!targetBrandId || targetBrandId === '--list' || targetBrandId === '-l') {
    console.log('\n======================================================');
    console.log(' Available Hotel Brand Profiles:');
    console.log('======================================================');
    for (const [id, b] of Object.entries(brands)) {
      const activeMark = id === config.activeBrand ? ' (★ ACTIVE)' : '';
      console.log(` • [${id}] ${b.nameAr} | ${b.nameEn}${activeMark}`);
      console.log(`     CR: ${b.crNumber} | VAT: ${b.vatNumber} | Color: ${b.primaryColor}`);
    }
    console.log('\nUsage: node scripts/apply-brand.js <brand_id>\n');
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
