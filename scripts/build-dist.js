#!/usr/bin/env node
'use strict';

/**
 * Multi-Brand Automated Distribution & Packaging Tool
 *
 * Automatically builds standalone Windows .exe installers for every configured
 * hotel brand (or a specific brand) and packages them into a compressed archive (.zip / .tar.gz).
 *
 * Usage:
 *   npm run dist                        (Builds all hotel brands and packages into a compressed zip)
 *   npm run dist:all                    (Explicitly builds all hotel brands)
 *   npm run dist:single                 (Builds only the currently active hotel brand)
 *   node scripts/build-dist.js --brand <hotel_id> (Builds only the specified hotel brand)
 */

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const { applyBrand, loadBranding } = require('./apply-brand');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PACKAGE_PATH = path.join(ROOT_DIR, 'package.json');

function getPackageVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
    return pkg.version || '2.0.0';
  } catch (_) {
    return '2.0.0';
  }
}

function compressInstallers(distDir, exeFiles, archiveBaseName) {
  const zipName = `${archiveBaseName}.zip`;
  const tarName = `${archiveBaseName}.tar.gz`;
  const zipPath = path.join(distDir, zipName);
  const tarPath = path.join(distDir, tarName);

  if (fs.existsSync(zipPath)) {
    try { fs.unlinkSync(zipPath); } catch (_) {}
  }
  if (fs.existsSync(tarPath)) {
    try { fs.unlinkSync(tarPath); } catch (_) {}
  }

  let createdZip = false;
  let createdTar = false;

  // Attempt using Windows built-in tar.exe
  try {
    execFileSync('tar.exe', ['-acvf', zipPath, '-C', distDir, ...exeFiles], { stdio: 'pipe' });
    if (fs.existsSync(zipPath)) createdZip = true;
  } catch (err) {
    // Fallback to PowerShell Compress-Archive for zip
    try {
      const psItems = exeFiles.map(f => `'${path.join(distDir, f)}'`).join(',');
      const psCmd = `Compress-Archive -Path ${psItems} -DestinationPath '${zipPath}' -Force`;
      execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: 'pipe' });
      if (fs.existsSync(zipPath)) createdZip = true;
    } catch (psErr) {
      console.warn('[Archive] ZIP fallback error:', psErr.message);
    }
  }

  try {
    execFileSync('tar.exe', ['-czvf', tarPath, '-C', distDir, ...exeFiles], { stdio: 'pipe' });
    if (fs.existsSync(tarPath)) createdTar = true;
  } catch (err) {
    console.warn('[Archive] TAR.GZ error:', err.message);
  }

  return { zipName: createdZip ? zipName : null, tarName: createdTar ? tarName : null };
}

async function runBuildPipeline() {
  const config = loadBranding();
  const brands = config.brands || {};
  const originalActiveBrand = config.activeBrand || 'hotel_1';
  const version = getPackageVersion();

  const isSingle = process.argv.includes('--single') || process.argv.includes('-s');
  const brandIdx = process.argv.indexOf('--brand');
  const specificBrand = brandIdx !== -1 ? process.argv[brandIdx + 1] : null;

  let targetBrandIds = [];
  if (specificBrand) {
    if (!brands[specificBrand]) {
      console.error(`\n❌ Error: Specified brand [${specificBrand}] does not exist in config/branding.json`);
      console.error(`Available brands: ${Object.keys(brands).join(', ')}\n`);
      process.exit(1);
    }
    targetBrandIds = [specificBrand];
  } else if (isSingle) {
    targetBrandIds = [originalActiveBrand];
  } else {
    targetBrandIds = Object.keys(brands);
  }

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  console.log('\n======================================================');
  console.log(' 🚀 Multi-Brand Distribution Pipeline Started');
  console.log('======================================================');
  console.log(` Target Brands to Build (${targetBrandIds.length}): ${targetBrandIds.join(', ')}`);
  console.log(` Application Version: ${version}`);
  console.log(` Output Directory   : dist/`);
  console.log('======================================================\n');

  const generatedExes = [];

  for (let i = 0; i < targetBrandIds.length; i++) {
    const brandId = targetBrandIds[i];
    const brand = brands[brandId];
    console.log(`\n------------------------------------------------------`);
    console.log(` [${i + 1}/${targetBrandIds.length}] Packaging: ${brand.nameAr} (${brand.nameEn})`);
    console.log(`------------------------------------------------------`);

    // 1. Apply brand assets, icon.ico, HTML stamping, and package.json configuration
    applyBrand(brandId);

    // Snapshot existing .exe files in dist before build
    const beforeExes = new Set(fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.exe')));

    // 2. Execute electron-builder
    try {
      console.log(`🔨 Compiling NSIS Windows Installer for [${brandId}]...`);
      execSync('npx electron-builder --win', { cwd: ROOT_DIR, stdio: 'inherit' });
    } catch (buildErr) {
      console.error(`\n❌ Build failed for brand [${brandId}]:`, buildErr.message);
      process.exit(1);
    }

    // Identify newly created or updated .exe
    const afterExes = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.exe'));
    const newExes = afterExes.filter(f => !beforeExes.has(f));

    let targetExe = null;
    if (newExes.length > 0) {
      targetExe = newExes[0];
    } else {
      // Find matching by product name or newest file
      const match = afterExes.find(f => f.toLowerCase().includes(brand.nameEn.toLowerCase().replace(/[^a-z0-9]/g, '')) || f.includes(brand.id));
      targetExe = match || afterExes[0];
    }

    if (targetExe && !generatedExes.includes(targetExe)) {
      generatedExes.push(targetExe);
      console.log(`✅ Generated: dist/${targetExe}`);
    }
  }

  // Restore developer's original active brand
  applyBrand(originalActiveBrand);

  // 3. Compress all generated installers into zip and tar.gz
  console.log('\n------------------------------------------------------');
  console.log(' 📦 Compressing Installers into Distribution Archive');
  console.log('------------------------------------------------------');

  const archiveBase = targetBrandIds.length === 1
    ? `${brands[targetBrandIds[0]].nameEn.replace(/[^a-zA-Z0-9_-]/g, '_')}-Setup-${version}`
    : `Hotel_Brands_Installers_v${version}`;

  const { zipName, tarName } = compressInstallers(DIST_DIR, generatedExes, archiveBase);

  console.log('\n======================================================');
  console.log(' 🎉 Multi-Brand Packaging & Compression Complete!');
  console.log('======================================================');
  console.log(' Generated Setup Executables:');
  for (const exe of generatedExes) {
    const exePath = path.join(DIST_DIR, exe);
    const sizeMb = (fs.statSync(exePath).size / (1024 * 1024)).toFixed(2);
    console.log(`   • dist/${exe} (${sizeMb} MB)`);
  }

  if (zipName) {
    const zipPath = path.join(DIST_DIR, zipName);
    const zipSizeMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
    console.log(`\n 📦 Compressed ZIP Archive: dist/${zipName} (${zipSizeMb} MB)`);
  }
  if (tarName) {
    const tarPath = path.join(DIST_DIR, tarName);
    const tarSizeMb = (fs.statSync(tarPath).size / (1024 * 1024)).toFixed(2);
    console.log(` 📦 Compressed TAR.GZ Archive: dist/${tarName} (${tarSizeMb} MB)`);
  }
  console.log('======================================================\n');
}

runBuildPipeline().catch(err => {
  console.error('\n❌ Fatal build error:', err);
  process.exit(1);
});
