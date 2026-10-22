#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const appDb = require('../db');
const connection = require('../db/connection');

const DEFAULT_OUT = path.join('scratch', 'userdata', 'rayhana_erp.sqlite');
const PAYMENT_METHODS = ['نقداً', 'بطاقة / مدى', 'تحويل بنكي'];
const ROOM_DEFINITIONS = [
  ['101', 'مفردة قياسية (Single)', 250], ['102', 'مفردة اقتصادية (Economy)', 220],
  ['103', 'مفردة قياسية (Single)', 250], ['104', 'مزدوجة قياسية (Double)', 380],
  ['201', 'جناح عائلي (Family Suite)', 750], ['202', 'جناح ملكي (Royal Suite)', 1200],
  ['203', 'إطلالة بانورامية (Panoramic)', 600], ['204', 'غرفة أعمال (Business)', 520],
  ['205', 'مفردة مريحة (Single)', 280], ['206', 'جناح صغير (Junior Suite)', 680],
  ['207', 'مزدوجة ديلوكس (Double Deluxe)', 450], ['208', 'غرفة ثلاثية (Triple)', 500],
  ['209', 'مفردة اقتصادية (Economy)', 200], ['210', 'غرفة أعمال (Business)', 520],
  ['211', 'مفردة قياسية (Single)', 200], ['212', 'مزدوجة قياسية (Double)', 380],
  ['213', 'جناح صغير (Junior Suite)', 680], ['214', 'غرفة ثلاثية (Triple)', 500],
  ['215', 'إطلالة بانورامية (Panoramic)', 600], ['216', 'جناح عائلي (Family Suite)', 750],
  ['217', 'مزدوجة كلاسيكية (Classic Double)', 250], ['218', 'جناح ملكي (Royal Suite)', 1200],
  ['219', 'غرفة أعمال (Business)', 520], ['220', 'غرفة ثلاثية (Triple)', 500],
  ['221', 'مزدوجة ديلوكس (Double Deluxe)', 450], ['222', 'جناح صغير (Junior Suite)', 680],
  // 400-406 are reserved for the monthly early-checkout policy scenarios (SC-30..34).
  // 400-404 stay OPEN for manual testing; 405-406 hold the already-settled invoice rows,
  // so they never overlap the open ones.
  ['400', 'شقة شهرية (Monthly 1BR)', 150], ['401', 'شقة شهرية (Monthly 2BR)', 180],
  ['402', 'شقة شهرية (Monthly Studio)', 130], ['403', 'شقة شهرية مفروشة شهرياً', 200],
  ['404', 'شقة شهرية عائلية', 250], ['405', 'شقة شهرية (مغادرة مبكرة)', 150],
  ['406', 'شقة شهرية (استثناء مدير)', 150],
  ...Array.from({ length: 20 }, (_, i) => [String(300 + i), `وحدة تاريخية ${i + 1} (Archive)`, 240 + (i % 5) * 90])
];

const SCENARIO_ROOM_STATUSES = {
  '101': 'مشغولة', '102': 'تنظيف', '103': 'مشغولة', '104': 'مشغولة',
  '201': 'تنظيف', '202': 'محجوزة', '203': 'مشغولة', '204': 'تنظيف',
  '205': 'مشغولة', '206': 'متاحة', '207': 'مشغولة', '208': 'مشغولة',
  '209': 'مشغولة', '210': 'متاحة', '211': 'متاحة', '212': 'محجوزة',
  '213': 'محجوزة', '214': 'متاحة', '215': 'متاحة', '216': 'متاحة',
  '217': 'مشغولة', '218': 'متاحة', '219': 'متاحة', '220': 'متاحة',
  '221': 'متاحة', '222': 'مشغولة'
};

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, force: false, includeFutureCases: false, today: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') {
      if (!argv[i + 1]) throw new Error('--out requires a path.');
      args.out = argv[++i];
    } else if (arg === '--today') {
      if (!argv[i + 1]) throw new Error('--today requires YYYY-MM-DD.');
      args.today = argv[++i];
    } else if (arg === '--force') {
      args.force = true;
    } else if (arg === '--include-future-cases') {
      args.includeFutureCases = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/seed-scratch.js [--out <path>] [--today YYYY-MM-DD] [--force] [--include-future-cases]\n\nDefault output: ${DEFAULT_OUT}`);
}

function canonicalPath(target) {
  const absolute = path.resolve(target);
  if (fs.existsSync(absolute)) return fs.realpathSync.native(absolute);
  try {
    const link = fs.lstatSync(absolute);
    if (link.isSymbolicLink()) throw new Error(`Refusing unresolved output symlink: ${absolute}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let ancestor = absolute;
  const tail = [];
  while (!fs.existsSync(ancestor)) {
    try {
      const link = fs.lstatSync(ancestor);
      if (link.isSymbolicLink()) throw new Error(`Refusing unresolved output path through symlink: ${ancestor}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    tail.unshift(path.basename(ancestor));
    ancestor = parent;
  }
  const canonicalAncestor = fs.existsSync(ancestor) ? fs.realpathSync.native(ancestor) : ancestor;
  return path.resolve(canonicalAncestor, ...tail);
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function assertSafeOutput(outputPath) {
  const resolved = canonicalPath(outputPath);
  const appData = process.env.APPDATA || (process.platform === 'win32' ? path.join(os.homedir(), 'AppData', 'Roaming') : null);
  if (appData) {
    const protectedRoot = canonicalPath(appData);
    if (isInside(protectedRoot, resolved)) {
      throw new Error(`Refusing to write inside the real APPDATA/userData folder: ${resolved}`);
    }
  }
  let outputExists = fs.existsSync(outputPath);
  try { fs.lstatSync(outputPath); outputExists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (outputExists && !argsForce) {
    throw new Error(`Output already exists. Use --force to replace its contents: ${resolved}`);
  }
  return resolved;
}

function validateDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function sqlRun(sql, params = []) {
  const stmt = connection.getDb().prepare(sql);
  try {
    stmt.run(params);
  } finally {
    stmt.free();
  }
}

function sqlAll(sql, params = []) {
  return connection.queryAll(sql, params);
}

function resetScratchRows() {
  const database = connection.getDb();
  database.run('DELETE FROM EmployeeLogs');
  database.run('DELETE FROM deposit_movements');
  database.run('DELETE FROM payments');
  database.run('DELETE FROM reservations');
  database.run('DELETE FROM guests');
  database.run('DELETE FROM rooms');
  try {
    database.run("DELETE FROM sqlite_sequence WHERE name IN ('payments', 'deposit_movements', 'reservations', 'guests', 'rooms', 'EmployeeLogs');");
  } catch (_) { /* sqlite_sequence exists when AUTOINCREMENT tables have been created. */ }
  connection.saveToFile();
}

function createGuest(name, serial) {
  const phone = `05${String(serial).padStart(8, '0')}`;
  const idNumber = `1000000${String(serial).padStart(3, '0')}`;
  const guest = appDb.addCustomer({ name, phone, id_number: idNumber });
  return guest.id;
}

function createReservation({ guestId, roomId, checkIn, checkOut, total, paid = 0, deposit = 0, method = 'نقداً', bookingType = 'عادي', rate = null, monthlyPrice = null, discount = 0, statusLabel }) {
  const guest = sqlAll('SELECT id, name, phone, id_number FROM guests WHERE id = ?', [guestId])[0];
  const result = appDb.createReservation({
    guestName: guest.name,
    guestPhone: guest.phone,
    guestIdNumber: guest.id_number,
    roomId,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    totalPrice: total,
    paidAmount: paid,
    depositAmount: deposit,
    paymentMethod: method,
    bookingType,
    monthlyPrice: monthlyPrice ?? (bookingType === 'حجز شهري' ? total + discount : null),
    customNightlyPrice: rate,
    discountAmount: discount,
    discountReason: discount > 0 ? 'خصم تجريبي للبيانات الوهمية' : ''
  });
  if (!result || !result.success || !result.reservationId) throw new Error(`Could not create ${statusLabel || guest.name}`);
  setReservationCreatedDate(result.reservationId, checkIn);
  return result.reservationId;
}

function addPayment(reservationId, amount, paymentMethod, notes = 'دفعة تجريبية للبيانات الوهمية') {
  if (amount <= 0) return;
  appDb.addPaymentToReservation({ reservationId, amount, paymentMethod, notes });
}

function setReservationStatus(reservationId, status, eventDate) {
  const timestamp = `${eventDate} 14:05:00`;
  sqlRun('UPDATE reservations SET status = ?, checked_out_at = ?, created_at = ? WHERE id = ?', [status, timestamp, `${eventDate} 10:00:00`, reservationId]);
  sqlRun('UPDATE payments SET payment_date = ? WHERE reservation_id = ?', [`${eventDate} 10:15:00`, reservationId]);
}

function setReservationCreatedDate(reservationId, createdDate, paymentDate = createdDate) {
  sqlRun('UPDATE reservations SET created_at = ? WHERE id = ?', [`${createdDate} 10:00:00`, reservationId]);
  sqlRun('UPDATE payments SET payment_date = ? WHERE reservation_id = ?', [`${paymentDate} 10:15:00`, reservationId]);
}

function setRoomStatus(roomNumber, status) {
  sqlRun('UPDATE rooms SET status = ? WHERE room_number = ?', [status, roomNumber]);
}

function addEntry(entries, scenario, guestName, reservationId, roomNumber, checkIn, checkOut, paid, expected, deposit = 0) {
  entries.push({ scenario, guestName, reservationId, roomNumber, checkIn, checkOut, paid, expected, deposit });
}

async function seed(outputPath, today, includeFutureCases) {
  await appDb.init(outputPath);
  resetScratchRows();

  for (const [roomNumber, type, price] of ROOM_DEFINITIONS) {
    appDb.addRoom({ room_number: roomNumber, type, price_per_night: price, monthly_price: price * 30, status: 'متاحة' });
  }
  const roomIds = Object.fromEntries(sqlAll('SELECT id, room_number FROM rooms').map(room => [room.room_number, room.id]));

  let guestSerial = 1;
  const guests = {};
  const guest = (key, name) => {
    if (!guests[key]) guests[key] = { id: createGuest(name, guestSerial++), name };
    return guests[key];
  };
  const entries = [];
  const reservations = {};
  const addScenario = (scenario, name, room, inOffset, outOffset, options, expected) => {
    const g = guest(`scenario-${scenario}-${name}`, name);
    const checkIn = addDays(today, inOffset);
    const checkOut = outOffset === null ? '' : addDays(today, outOffset);
    const id = createReservation({ guestId: g.id, roomId: roomIds[room], checkIn, checkOut, statusLabel: name, ...options });
    reservations[scenario] = id;
    addEntry(entries, scenario, name, id, room, checkIn, checkOut || 'مفتوح', options.paid || 0, expected, options.deposit || 0);
    return { id, guest: g, room, checkIn, checkOut };
  };

  // 1–8: settlement scenarios, generated through the application's reservation/payment functions.
  addScenario('01', 'SC-01 Early monthly refund', '205', 0, 30, { total: 4500, paid: 2000, method: 'نقداً', bookingType: 'حجز شهري', rate: 150 }, 'تسوية خروج مبكر واسترداد');
  addScenario('02', 'SC-02 Early monthly card refund', '207', 0, 30, { total: 4500, paid: 2000, method: 'بطاقة / مدى', bookingType: 'حجز شهري', rate: 150 }, 'طريقة استرداد مدى');
  const s3 = addScenario('03', 'SC-03 Monthly collect or defer', '208', -3, 27, { total: 4500, paid: 0, bookingType: 'حجز شهري', rate: 150 }, 'تحصيل أو تأجيل الرصيد');
  const s4 = addScenario('04', 'SC-04 Daily partial payment', '209', -1, 2, { total: 600, paid: 100 }, 'رصيد جزئي');
  addScenario('05', 'SC-05 Exact full payment', '217', -2, 0, { total: 500, paid: 500 }, 'مغادرة وتطابق المدفوع مع الإجمالي');
  addScenario('06', 'SC-06 Creation discount', '222', 0, 2, { total: 870, paid: 870, rate: 450, discount: 30 }, 'خصم 30 عند إنشاء الحجز');
  addScenario('07', 'SC-07 Room rate only', '103', -1, 1, { total: 500, paid: 500 }, 'السعر الافتراضي للغرفة بلا سعر مخصص');
  const s8 = addScenario('08', 'SC-08 Open contract two payments', '104', -10, null, { total: 3000, paid: 0, bookingType: 'عقد مفتوح' }, 'عقد مفتوح ودفعتان جزئيتان');
  addPayment(s8.id, 500, 'نقداً', 'دفعة عقد مفتوح تجريبية 1');
  addPayment(s8.id, 700, 'تحويل بنكي', 'دفعة عقد مفتوح تجريبية 2');
  setReservationCreatedDate(s8.id, s8.checkIn);
  entries.find(row => row.scenario === '08').paid = 1200;
  sqlRun('UPDATE reservations SET payment_method = ? WHERE id = ?', ['تحويل بنكي', s8.id]);

  // 9–14: deliberately stored room states for room-status review.
  addScenario('09', 'SC-09 Confirmed checkout today', '101', -3, 0, { total: 750, paid: 250 }, 'يبقى مشغولاً حتى تسجيل المغادرة');
  addScenario('10', 'SC-10 Confirmed checkout yesterday', '102', -4, -1, { total: 750, paid: 300 }, 'مؤكد مع تنظيف قديم خاطئ');
  addScenario('11', 'SC-11 Confirmed checkout three days ago', '201', -8, -3, { total: 3750, paid: 1000, bookingType: 'حجز شهري', rate: 125 }, 'مؤكد مع تنظيف قديم خاطئ');
  const turnA = addScenario('12A', 'SC-12A Turnover departing guest', '203', -2, 0, { total: 1200, paid: 600 }, 'حد تسليم/وصول في اليوم نفسه');
  const turnB = addScenario('12B', 'SC-12B Turnover arriving monthly guest', '203', 0, 30, { total: 4500, paid: 900, bookingType: 'حجز شهري', rate: 150 }, 'الغرفة مشغولة؛ وصول اليوم بعد تسليم الضيف السابق');
  addScenario('13', 'SC-13 Future booking', '202', 5, 8, { total: 3600, paid: 500 }, 'محجوزة لوصول مستقبلي');
  const s14a = addScenario('14A', 'SC-14A Completed cleaning room', '204', -20, -18, { total: 1040, paid: 1040 }, 'مكتمل والغرفة تنظيف');
  setReservationStatus(s14a.id, 'مكتمل', addDays(today, -18));
  const s14b = addScenario('14B', 'SC-14B Completed available room', '206', -17, -15, { total: 1360, paid: 800 }, 'مكتمل والغرفة متاحة');
  setReservationStatus(s14b.id, 'مكتمل', addDays(today, -15));

  // 15: pre-arrival cancellation uses the application's actual cancellation/refund behavior.
  const s15 = addScenario('15', 'SC-15 Cancel before arrival', '210', 10, 12, { total: 800, paid: 400, method: 'بطاقة / مدى' }, 'ملغي مع رد كامل سالب في السجل');
  appDb.cancelReservation(s15.id, addDays(today, 9));
  setReservationCreatedDate(s15.id, s15.checkIn, addDays(today, 9));
  entries.find(row => row.scenario === '15').paid = 0;
  // Once a stay has started, the consistent lifecycle requires checkout settlement, not cancellation.
  const s16 = addScenario('16', 'SC-16 Early checkout refund', '211', -5, 5, { total: 2000, paid: 1200 }, 'مكتمل مع استرداد فرق الإقامة');
  const earlyCheckoutRate = ROOM_DEFINITIONS.find(room => room[0] === '211')[2];
  const earlyCheckoutNights = 5;
  const earlyCheckoutTotal = earlyCheckoutRate * earlyCheckoutNights;
  appDb.checkoutReservation(s16.id, { settleMode: 'refund', refundAmount: 1200 - earlyCheckoutTotal });
  sqlRun('UPDATE payments SET payment_date = ? WHERE reservation_id = ?', [`${addDays(today, -1)} 14:05:00`, s16.id]);
  entries.find(row => row.scenario === '16').paid = earlyCheckoutTotal;

  // 17: guest lookup cases — banned guests, a returning guest, and a duplicate-looking name.
  const bannedA = guest('banned-a', 'SC-17 بدر التجريبي (محظور A)');
  const bannedB = guest('banned-b', 'SC-17 Lina Example (Banned B)');
  appDb.setGuestBanStatus(bannedA.id, true, 'حظر تجريبي للبيانات الوهمية');
  appDb.setGuestBanStatus(bannedB.id, true, 'حظر تجريبي للبيانات الوهمية');
  const repeatGuest = guest('repeat', 'SC-17 ناصر الحربي (Returning Guest)');
  const duplicateA = guest('duplicate-a', 'SC-17 مريم العتيبي (Duplicate Name)');
  const duplicateB = guest('duplicate-b', 'SC-17 مريم العتيبي (Duplicate Name)');
  const repeat1 = createReservation({ guestId: repeatGuest.id, roomId: roomIds['215'], checkIn: addDays(today, -50), checkOut: addDays(today, -48), total: 1200, paid: 1200 });
  setReservationStatus(repeat1, 'مكتمل', addDays(today, -48));
  const repeat2 = createReservation({ guestId: repeatGuest.id, roomId: roomIds['216'], checkIn: addDays(today, -20), checkOut: addDays(today, -18), total: 1500, paid: 700 });
  setReservationStatus(repeat2, 'مكتمل', addDays(today, -18));
  const dup1 = createReservation({ guestId: duplicateA.id, roomId: roomIds['212'], checkIn: addDays(today, 12), checkOut: addDays(today, 14), total: 760, paid: 200 });
  const dup2 = createReservation({ guestId: duplicateB.id, roomId: roomIds['213'], checkIn: addDays(today, 12), checkOut: addDays(today, 14), total: 1360, paid: 300 });
  addEntry(entries, '17', 'SC-17 Guest lookup examples (same name, different phones)', `${repeat1}, ${repeat2}, ${dup1}, ${dup2}`, '215/216/212/213', `${addDays(today, -50)}; ${addDays(today, 12)}`, `${addDays(today, -48)}; ${addDays(today, 14)}`, 2400, 'ضيف بحجزين، حظر ضيفين، واسم متكرر بهاتفين مختلفين');

  // 20–24: deposit ledger, checkout disposition, and explicit legacy reconciliation cases.
  const depositRefund = addScenario('20', 'SC-20 Deposit refund at checkout', '214', 0, 3,
    { total: 1500, paid: 500, deposit: 25, method: 'نقداً' }, 'تأمين مستلم ثم مردود عند المغادرة');
  const refundResult = appDb.checkoutReservation(depositRefund.id, { settleMode: 'defer', depositDisposition: 'refund' });
  entries.find(row => row.scenario === '20').expected += ` (${refundResult.depositRefunded} ريال مردود)`;
  entries.find(row => row.scenario === '20').deposit = appDb.getReservationById(depositRefund.id).deposit_ledger_balance;

  const depositApply = addScenario('21', 'SC-21 Deposit applied to stay', '221', 0, 2,
    { total: 900, paid: 0, deposit: 40, method: 'بطاقة / مدى' }, 'تطبيق التأمين على رصيد الإقامة');
  const applyDue = ROOM_DEFINITIONS.find(room => room[0] === '221')[2];
  const applyResult = appDb.checkoutReservation(depositApply.id, {
    settleMode: 'collect', collectAmount: applyDue - 40,
    paymentMethod: 'نقداً', depositDisposition: 'apply'
  });
  entries.find(row => row.scenario === '21').paid = applyResult.paidAmount;
  entries.find(row => row.scenario === '21').deposit = appDb.getReservationById(depositApply.id).deposit_ledger_balance;
  entries.find(row => row.scenario === '21').expected += ` (${applyResult.depositApplied} ريال من التأمين + تحصيل الباقي)`;

  const depositRetain = addScenario('22', 'SC-22 Deposit partial retention', '210', 0, 2,
    { total: 1600, paid: 0, deposit: 50, method: 'نقداً' }, 'احتفاظ بجزء مع توثيق السبب ورد الباقي');
  const retainResult = appDb.checkoutReservation(depositRetain.id, {
    settleMode: 'defer', depositDisposition: 'retain', depositRetainAmount: 10,
    depositRetainReason: 'تلف تجريبي موثق', depositRefundMethod: 'نقداً'
  });
  entries.find(row => row.scenario === '22').expected += ` (${retainResult.depositRetained} ريال محتفظ به، ${retainResult.depositRefunded} ريال مردود)`;
  entries.find(row => row.scenario === '22').deposit = appDb.getReservationById(depositRetain.id).deposit_ledger_balance;

  const legacyDeposit = addScenario('23', 'SC-23 Legacy deposit needs review', '219', 4, 6,
    { total: 1040, paid: 0, deposit: 35 }, 'تأمين تاريخي بلا حركات؛ يتطلب تأكيد المدير');
  sqlRun('DELETE FROM deposit_movements WHERE reservation_id = ?', [legacyDeposit.id]);
  sqlRun('UPDATE reservations SET deposit_amount = 35 WHERE id = ?', [legacyDeposit.id]);

  const cancelledDeposit = addScenario('24', 'SC-24 Future cancellation returns deposit', '220', 10, 12,
    { total: 800, paid: 400, deposit: 15, method: 'بطاقة / مدى' }, 'إلغاء قبل الوصول ورد الإقامة والتأمين');
  appDb.cancelReservation(cancelledDeposit.id);
  setReservationCreatedDate(cancelledDeposit.id, cancelledDeposit.checkIn, addDays(today, 9));
  entries.find(row => row.scenario === '24').paid = 0;
  entries.find(row => row.scenario === '24').deposit = appDb.getReservationById(cancelledDeposit.id).deposit_ledger_balance;
  entries.find(row => row.scenario === '24').expected += ' (تأمين 15 ريال مردود)';

  // 30–34: monthly early-checkout policy (see db/reservations.js computeContractValue).
  // Every case below is a REAL 'حجز شهري' booking left open at checkout time so the
  // modal can be driven by hand, plus two already-settled rows for the invoice.
  const MONTHLY_RATE = 150;
  const MONTHLY_TOTAL = MONTHLY_RATE * 30; // 4500 = the contract value

  // SC-30: fully paid, leaving 10 days in. Contract default => nothing owed, no refund.
  const p30 = addScenario('30', 'SC-30 Policy: fully paid monthly early exit', '400', -10, 20,
    { total: MONTHLY_TOTAL, paid: MONTHLY_TOTAL, method: 'نقداً', bookingType: 'حجز شهري', rate: MONTHLY_RATE },
    'مدفوع بالكامل: يعرض "مُسوّى" — لا تحصيل ولا استرداد (قيمة العقد 4500)');
  sqlRun('UPDATE reservations SET check_in_date = ?, check_out_date = ? WHERE id = ?', [addDays(today, -10), addDays(today, 20), p30.id]);

  // SC-31: partly paid. Contract default => the remaining 2500 is an amount due.
  addScenario('31', 'SC-31 Policy: partly paid monthly early exit', '401', -10, 20,
    { total: MONTHLY_TOTAL, paid: 2000, method: 'بطاقة / مدى', bookingType: 'حجز شهري', rate: MONTHLY_RATE },
    'تحصيل أو تأجيل 2500 ريال (قيمة العقد) — تحصيل 1000 و2500 معاً كدليل على تجاوز المبلغ');

  // SC-32: overpaid. Contract default => only the 500 excess is refundable.
  // createReservation refuses paid > total, so the extra payment is booked directly in
  // the ledger the way an adjusted or legacy row would look.
  const p32 = addScenario('32', 'SC-32 Policy: overpaid monthly early exit', '402', -10, 20,
    { total: MONTHLY_TOTAL, paid: MONTHLY_TOTAL, method: 'تحويل بنكي', bookingType: 'حجز شهري', rate: MONTHLY_RATE },
    'مدفوع 500 زيادة: الاسترداد المعروض يجب أن يكون 500 فقط (فائض فوق قيمة العقد)');
  sqlRun('UPDATE reservations SET paid_amount = ? WHERE id = ?', [MONTHLY_TOTAL + 500, p32.id]);
  sqlRun(
    `INSERT INTO payments (receipt_number, reservation_id, amount, payment_method, payment_date, notes)
     VALUES (?, ?, 500, 'تحويل بنكي', datetime('now', 'localtime'), 'دفعة زائدة عن قيمة العقد')`,
    [`REC-2026-0032-${p32.id}`, p32.id]
  );
  entries.find(row => row.scenario === '32').paid = MONTHLY_TOTAL + 500;

  // SC-33: a stored discount that is NOT prorated under the contract policy.
  // 30 x 150 = 4500 less a 600 contract discount = 3900.
  const p33 = addScenario('33', 'SC-33 Policy: monthly discount is not prorated', '403', -10, 20,
    { total: MONTHLY_TOTAL - 600, paid: MONTHLY_TOTAL - 600, method: 'نقداً', bookingType: 'حجز شهري', rate: MONTHLY_RATE, discount: 600 },
    'قيمة العقد 3900 (خصم 600 كامل). استثناء "الليالي الفعلية" يعطي 1300 بعد prorate');
  sqlRun('UPDATE reservations SET discount_reason = ? WHERE id = ?', ['خصم تعاقد سنوي', p33.id]);

  // SC-34: total_price deliberately disagrees with the computed contract value, so the
  // default path must be rejected with the Arabic review error and only the Admin
  // 'actual' exception can proceed. Mirrors a legacy / edited-receipt row.
  const p34 = addScenario('34', 'SC-34 Policy: contract value mismatch needs review', '404', -10, 20,
    { total: 3200, paid: 3200, method: 'نقداً', bookingType: 'حجز شهري', rate: MONTHLY_RATE },
    'تحذير عدم تطابق: قيمة العقد 4500 ≠ المخزن 3200 — يُرفض "قيمة العقد" ويُقبل استثناء المدير');
  sqlRun('UPDATE reservations SET total_price = 3200 WHERE id = ?', [p34.id]);

  // Two already-settled rows so the INVOICE can be inspected for both policies.
  // Both start 10 days ago and were booked 30 nights, so settling them today is an
  // EARLY checkout and the policy actually applies. check_out_date is then rewritten
  // to the settlement date so they read as completed history.
  const invContract = addScenario('30I', 'SC-30I Settled under the contract policy', '405', -10, 20,
    { total: MONTHLY_TOTAL, paid: MONTHLY_TOTAL, method: 'نقداً', bookingType: 'حجز شهري', rate: MONTHLY_RATE },
    'فاتورة تُظهر الليالي المحجوزة وتاريخ المغادرة الأصلي');
  const settledContract = appDb.checkoutReservation(invContract.id, { settleMode: 'defer' });
  entries.find(row => row.scenario === '30I').expected =
    `مكتمل بقيمة العقد ${settledContract.finalTotal} ريال — الفاتورة تعرض الليالي المحجوزة`;
  setReservationStatus(invContract.id, 'مكتمل', addDays(today, -10));

  const invActual = addScenario('34I', 'SC-34I Settled under the Admin actual exception', '406', -10, 20,
    { total: MONTHLY_TOTAL, paid: 0, method: 'نقداً', bookingType: 'حجز شهري', rate: MONTHLY_RATE },
    'فاتورة تُظهر الليالي الفعلية وسبب الاستثناء');
  const settledActual = appDb.checkoutReservation(invActual.id, {
    settleMode: 'defer',
    checkoutPolicy: 'actual',
    checkoutPolicyReason: 'إنهاء مبكر بناء على طلب النزيل'
  });
  entries.find(row => row.scenario === '34I').expected =
    `مكتمل بالليالي الفعلية ${settledActual.finalTotal} ريال مع تسجيل سبب الاستثناء`;
  setReservationStatus(invActual.id, 'مكتمل', addDays(today, -10));

  // Keep exactly 60 invented guests, including all scenario guests.
  const names = ['سارة النور', 'Omar Cedar', 'ليان الغيم', 'Mira Harbor', 'زياد الورد', 'Nour Atlas', 'هيا السحاب', 'Rami Palm', 'تالا البحر', 'Adam Oasis'];
  let generatedGuest = 1;
  while (Object.keys(guests).length < 60) {
    const label = String(generatedGuest).padStart(2, '0');
    guest(`volume-${label}`, `SC-18 ${names[generatedGuest % names.length]} ${label}`);
    generatedGuest++;
  }

  // 18: about 150 historical records, spread over 20 archive rooms and the last three months.
  const random = seededRandom(0x52415948);
  const guestList = Object.values(guests);
  let historicalCount = 0;
  const historicalIds = [];
  for (let i = 0; i < 150; i++) {
    const roomNumber = String(300 + (i % 20));
    const slot = Math.floor(i / 20);
    const startOffset = -89 + slot * 11 + Math.floor(random() * 3);
    const nights = 1 + Math.floor(random() * 4);
    const checkIn = addDays(today, startOffset);
    const checkOut = addDays(checkIn, nights);
    const price = ROOM_DEFINITIONS.find(room => room[0] === roomNumber)[2];
    const total = Math.round(price * nights * 100) / 100;
    const paidRatio = [0, 0.4, 0.65, 1][Math.floor(random() * 4)];
    const initialPaid = Math.round(total * paidRatio * 100) / 100;
    const paymentMethod = PAYMENT_METHODS[Math.floor(random() * PAYMENT_METHODS.length)];
    const selectedGuest = guestList[i % guestList.length];
    const id = createReservation({ guestId: selectedGuest.id, roomId: roomIds[roomNumber], checkIn, checkOut, total, paid: initialPaid, method: paymentMethod });

    if (initialPaid > 0 && initialPaid < total && random() > 0.35) {
      const extra = Math.round((total - initialPaid) * (0.2 + random() * 0.8) * 100) / 100;
      addPayment(id, extra, PAYMENT_METHODS[Math.floor(random() * PAYMENT_METHODS.length)], 'دفعة تاريخية تجريبية');
    }

    if (i % 10 === 0) {
      // Mid-stay cancellations are no longer supported; keep historical volume as completed stays.
      setReservationStatus(id, 'مكتمل', checkOut);
    } else {
      setReservationStatus(id, 'مكتمل', checkOut);
    }
    historicalIds.push(id);
    historicalCount++;
  }

  if (includeFutureCases) {
    const futureGuest = guest('optional-same-day', 'SC-19 Optional same-day SQL case');
    sqlRun(`INSERT INTO reservations (guest_id, room_id, check_in_date, check_out_date, total_price, paid_amount, payment_method, payment_status, status, booking_type, created_at)
            VALUES (?, ?, ?, ?, ?, 0, 'نقداً', 'غير مدفوع', 'مؤكد', 'عادي', ?)`,
      [futureGuest.id, roomIds['218'], addDays(today, 1), addDays(today, 1), 200, `${today} 10:00:00`]);
    const optionalId = sqlAll('SELECT last_insert_rowid() AS id')[0].id;
    addEntry(entries, '19', 'SC-19 Optional same-day SQL case', optionalId, '218', addDays(today, 1), addDays(today, 1), 0, 'حالة اختيارية غير صالحة للتسجيل من النموذج');
  }

  // Set every room's stored status deliberately; the updater under review is never called here.
  sqlRun('UPDATE rooms SET created_at = ?', [`${today} 08:00:00`]);
  sqlRun('UPDATE guests SET created_at = ?', [`${today} 08:30:00`]);
  sqlRun("UPDATE rooms SET status = 'متاحة'");
  for (const [roomNumber, status] of Object.entries(SCENARIO_ROOM_STATUSES)) setRoomStatus(roomNumber, status);
  setRoomStatus('203', 'مشغولة');
  connection.saveToFile();

  const integrity = checkIntegrity(SCENARIO_ROOM_STATUSES);
  printReport(entries, historicalCount, historicalIds, integrity, outputPath);
  if (Object.values(integrity).some(check => !check.pass)) {
    throw new Error('Seed integrity check failed. Review the FAIL details above.');
  }
  return { entries, historicalCount, integrity };
}

function checkIntegrity(expectedStatuses) {
  // Retained deposit is strictly recorded in deposit_movements, so payments tracks
  // guest stay payments only and paid_amount must match SUM(payments.amount).
  const paymentMismatches = sqlAll(`
    SELECT r.id, r.paid_amount, COALESCE(SUM(p.amount), 0) AS payment_sum
    FROM reservations r LEFT JOIN payments p
      ON p.reservation_id = r.id
    GROUP BY r.id
    HAVING ABS(COALESCE(r.paid_amount, 0) - COALESCE(SUM(p.amount), 0)) > 0.005
  `);
  const receiptRows = sqlAll('SELECT COUNT(*) AS total, COUNT(DISTINCT receipt_number) AS distinct_total FROM payments')[0];
  const duplicateReceipts = sqlAll(`SELECT receipt_number, COUNT(*) AS copies FROM payments GROUP BY receipt_number HAVING COUNT(*) > 1`);
  const overlaps = sqlAll(`
    SELECT a.id AS reservation_a, b.id AS reservation_b, a.room_id, a.check_in_date, a.check_out_date, b.check_in_date, b.check_out_date
    FROM reservations a
    JOIN reservations b ON a.room_id = b.room_id AND a.id < b.id
    WHERE a.status NOT IN ('ملغي', 'ملغي جزئي') AND b.status NOT IN ('ملغي', 'ملغي جزئي')
      AND COALESCE(NULLIF(NULLIF(a.check_out_date, ''), 'مفتوح'), '9999-12-31') > b.check_in_date
      AND COALESCE(NULLIF(NULLIF(b.check_out_date, ''), 'مفتوح'), '9999-12-31') > a.check_in_date
  `);
  const roomStatusMismatches = [];
  for (const [roomNumber, expected] of Object.entries(expectedStatuses)) {
    const row = sqlAll('SELECT status FROM rooms WHERE room_number = ?', [roomNumber])[0];
    if (!row || row.status !== expected) roomStatusMismatches.push({ roomNumber, expected, actual: row ? row.status : '(missing)' });
  }
  const historicalRooms = sqlAll("SELECT COUNT(*) AS count FROM rooms WHERE CAST(room_number AS INTEGER) BETWEEN 300 AND 319")[0].count;
  const historicalReservations = sqlAll("SELECT COUNT(*) AS count FROM reservations r JOIN rooms rm ON rm.id = r.room_id WHERE CAST(rm.room_number AS INTEGER) BETWEEN 300 AND 319")[0].count;
  const guestCount = sqlAll('SELECT COUNT(*) AS count FROM guests')[0].count;
  const depositMismatches = sqlAll(`
    SELECT r.id, r.deposit_amount,
      SUM(CASE WHEN dm.movement_type IN ('collected', 'reconciled') THEN dm.amount ELSE -dm.amount END) AS ledger_balance
    FROM reservations r JOIN deposit_movements dm ON dm.reservation_id = r.id
    GROUP BY r.id
    HAVING ABS(COALESCE(r.deposit_amount, 0) - COALESCE(ledger_balance, 0)) > 0.005 OR ledger_balance < -0.005
  `);
  const legacyDeposits = sqlAll(`
    SELECT COUNT(*) AS count FROM reservations r
    WHERE r.deposit_amount > 0 AND NOT EXISTS (SELECT 1 FROM deposit_movements dm WHERE dm.reservation_id = r.id)
  `)[0].count;
  const results = {
    paidMatchesLedger: { pass: paymentMismatches.length === 0, detail: paymentMismatches },
    depositBalancesMatchLedger: { pass: depositMismatches.length === 0, detail: depositMismatches },
    legacyDepositReviewCase: { pass: legacyDeposits === 1, detail: { expected: 1, actual: legacyDeposits } },
    uniqueReceipts: { pass: Number(receiptRows.total) === Number(receiptRows.distinct_total) && duplicateReceipts.length === 0, detail: { ...receiptRows, duplicates: duplicateReceipts } },
    noUnexpectedOverlaps: { pass: overlaps.length === 0, detail: overlaps },
    scenarioRoomStatuses: { pass: roomStatusMismatches.length === 0, detail: roomStatusMismatches },
    volumeSetup: { pass: historicalRooms === 20 && historicalReservations === 150 && guestCount >= 60, detail: { historicalRooms, historicalReservations, guests: guestCount } }
  };
  return results;
}

function printReport(entries, historicalCount, historicalIds, integrity, outputPath) {
  const scenarioRows = entries
    .filter(row => row.scenario !== '19')
    .map(row => [row.scenario, row.guestName, row.reservationId, row.roomNumber, `${row.checkIn} → ${row.checkOut}`, row.paid, row.deposit, row.expected]);
  const optionalRows = entries
    .filter(row => row.scenario === '19')
    .map(row => [row.scenario, row.guestName, row.reservationId, row.roomNumber, `${row.checkIn} → ${row.checkOut}`, row.paid, row.deposit, row.expected]);
  const allRows = [
    ...scenarioRows,
    ['18', 'SC-18 Historical volume (150 records)', `${historicalIds[0]}–${historicalIds[historicalIds.length - 1]}`, '300–319', 'آخر 3 أشهر حتى T-9 تقريباً', 'mixed', '-', 'جداول طويلة، تنقل صفحات، ومخططات إيرادات'],
    ...optionalRows
  ];
  const headers = ['Scenario', 'Guest name', 'Reservation ID', 'Room', 'Dates', 'Paid (SAR)', 'Deposit balance (SAR)', 'Expected behavior'];
  const widths = headers.map((header, index) => Math.max(header.length, ...allRows.map(row => String(row[index]).length)));
  const line = values => `| ${values.map((value, index) => String(value).padEnd(widths[index])).join(' | ')} |`;
  console.log('\nScenario seed summary (T = ' + todayForReport + '):');
  console.log(line(headers));
  console.log(`|-${widths.map(width => '-'.repeat(width)).join('-|-')}-|`);
  for (const row of allRows) console.log(line(row));

  console.log('\nIntegrity checks:');
  for (const [name, result] of Object.entries(integrity)) {
    console.log(`${result.pass ? 'PASS' : 'FAIL'}  ${name}${result.pass ? '' : `: ${JSON.stringify(result.detail)}`}`);
  }
  console.log(`Historical reservations generated: ${historicalCount}`);
  console.log(`Database: ${outputPath}`);
  console.log(`Run app against this scratch database:\n  npx electron . --user-data-dir="${path.dirname(outputPath)}"`);
}

let argsForce = false;
let todayForReport = '';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  argsForce = args.force;
  todayForReport = args.today || (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();
  if (!validateDate(todayForReport)) throw new Error(`Invalid --today date: ${todayForReport}`);

  const outputPath = path.resolve(args.out);
  const safeOutputPath = assertSafeOutput(outputPath);
  await seed(safeOutputPath, todayForReport, args.includeFutureCases);
}

main().catch(error => {
  console.error(`Seed generation failed: ${error.message}`);
  process.exitCode = 1;
});
