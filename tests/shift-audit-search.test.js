'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadDashboardAppHelpers() {
  const windowObj = {};
  const filePath = path.join(__dirname, '..', 'dashboard-app.js');
  const code = fs.readFileSync(filePath, 'utf8');
  vm.runInNewContext(code, {
    window: windowObj,
    console,
    Intl,
    Date,
    Math,
    String,
    Number,
    Boolean,
    Map
  });
  return windowObj.DashboardApp.Helpers;
}

const Helpers = loadDashboardAppHelpers();
const { normalizeSearchText, filterShiftAuditReport } = Helpers;

const sampleAuditReport = {
  date: '2026-11-04',
  startDate: '2026-11-04',
  endDate: '2026-11-04',
  financials: {
    totalRevenue: 1500,
    cashTotal: 1000,
    cardTotal: 500
  },
  payments: [
    {
      id: 1,
      reservation_id: 101,
      receipt_number: 'REC-2026-001',
      guest_name: 'أحمد بن عبد الله السعيد',
      room_number: '105',
      payment_type: 'advance_payment',
      payment_method: 'نقداً',
      amount: 600,
      business_date: '2026-11-04'
    },
    {
      id: 2,
      reservation_id: 102,
      receipt_number: 'REC-2026-002',
      guest_name: 'فاطمة الزهراء',
      room_number: '204',
      payment_type: 'balance_payment',
      payment_method: 'شبكة',
      amount: 500,
      business_date: '2026-11-04'
    },
    {
      id: 3,
      reservation_id: 103,
      receipt_number: 'REC-2026-003',
      guest_name: 'خالد عبد الرحمن',
      room_number: '301',
      payment_type: 'refund',
      payment_method: 'نقداً',
      amount: -150,
      business_date: '2026-11-04'
    }
  ],
  transactions: [
    {
      id: 101,
      guest_name: 'أحمد بن عبد الله السعيد',
      room_number: '105',
      check_in_date: '2026-11-04',
      check_out_date: '2026-11-06',
      status: 'مؤكد',
      paid_amount: 600
    },
    {
      id: 102,
      guest_name: 'فاطمة الزهراء',
      room_number: '204',
      check_in_date: '2026-11-04',
      check_out_date: '2026-11-05',
      status: 'مؤكد',
      paid_amount: 500
    },
    {
      id: 103,
      guest_name: 'خالد عبد الرحمن',
      room_number: '301',
      check_in_date: '2026-11-02',
      check_out_date: '2026-11-04',
      status: 'مكتمل',
      paid_amount: 850
    }
  ],
  transfers: [
    {
      id: 1,
      reservation_id: 101,
      guest_name: 'أحمد بن عبد الله السعيد',
      from_room_number: '102',
      to_room_number: '105',
      transfer_mode: 'keep_rate',
      reason_category: 'guest_request'
    }
  ],
  depositMovements: [
    {
      id: 1,
      reservation_id: 102,
      guest_name: 'فاطمة الزهراء',
      room_number: '204',
      movement_type: 'collected',
      amount: 200,
      payment_method: 'نقداً'
    }
  ]
};

test('normalizeSearchText correctly normalizes Arabic text and numbers', () => {
  assert.equal(normalizeSearchText('١٠٥'), '105', 'Arabic-Indic digits normalized to Latin');
  assert.equal(normalizeSearchText('أحمد إبراهيم آمنة'), 'احمد ابراهيم امنه', 'Alef forms normalized');
  assert.equal(normalizeSearchText('فاطمة'), 'فاطمه', 'Ta Marbuta normalized to Ha');
  assert.equal(normalizeSearchText('عَلِيٌّ'), 'علي', 'Tashkeel and Harakat removed');
  assert.equal(normalizeSearchText('  غرفة 105  '), 'غرفه 105', 'Trims whitespace');
});

test('filterShiftAuditReport with empty query returns full report unfiltered', () => {
  const result = filterShiftAuditReport(sampleAuditReport, { query: '', field: 'all' });
  assert.equal(result.isSearchActive, false);
  assert.equal(result.payments.length, 3);
  assert.equal(result.transactions.length, 3);
  assert.equal(result.transfers.length, 1);
  assert.equal(result.depositMovements.length, 1);
  assert.equal(result.totalMatches, 8);
  assert.equal(result.filteredPaymentsTotal, 950); // 600 + 500 - 150 = 950
});

test('filterShiftAuditReport searches by guest name', async t => {
  await t.test('matches exact and normalized name with alef and spacing', () => {
    // Note: query 'عبدالله' (without space) matches 'أحمد بن عبد الله السعيد' (with space and alef)
    const res1 = filterShiftAuditReport(sampleAuditReport, { query: 'عبدالله', field: 'all' });
    assert.equal(res1.isSearchActive, true);
    assert.equal(res1.payments.length, 1);
    assert.equal(res1.payments[0].guest_name, 'أحمد بن عبد الله السعيد');
    assert.equal(res1.transactions.length, 1);
    assert.equal(res1.transfers.length, 1);
    assert.equal(res1.filteredPaymentsTotal, 600);
    assert.equal(res1.totalMatches, 3);
  });

  await t.test('matches Ta Marbuta variants (فاطمة vs فاطمه)', () => {
    const res2 = filterShiftAuditReport(sampleAuditReport, { query: 'فاطمه', field: 'name' });
    assert.equal(res2.isSearchActive, true);
    assert.equal(res2.payments.length, 1);
    assert.equal(res2.payments[0].guest_name, 'فاطمة الزهراء');
    assert.equal(res2.depositMovements.length, 1);
  });

  await t.test('field=name does not match room number or receipt number', () => {
    const res3 = filterShiftAuditReport(sampleAuditReport, { query: '105', field: 'name' });
    assert.equal(res3.totalMatches, 0);
    assert.equal(res3.payments.length, 0);
  });
});

test('filterShiftAuditReport searches by room number', async t => {
  await t.test('matches plain room number in payments, txs, deposits, and transfers', () => {
    const res1 = filterShiftAuditReport(sampleAuditReport, { query: '105', field: 'room' });
    assert.equal(res1.isSearchActive, true);
    assert.equal(res1.payments.length, 1);
    assert.equal(res1.payments[0].room_number, '105');
    assert.equal(res1.transactions.length, 1);
    assert.equal(res1.transfers.length, 1); // transferred to 105
    assert.equal(res1.totalMatches, 3);
  });

  await t.test('matches room with Arabic word prefix "غرفة 204"', () => {
    const res2 = filterShiftAuditReport(sampleAuditReport, { query: 'غرفة 204', field: 'all' });
    assert.equal(res2.payments.length, 1);
    assert.equal(res2.payments[0].room_number, '204');
    assert.equal(res2.depositMovements.length, 1);
  });

  await t.test('matches from_room_number in transfers', () => {
    const res3 = filterShiftAuditReport(sampleAuditReport, { query: '102', field: 'room' });
    assert.equal(res3.payments.length, 0);
    assert.equal(res3.transfers.length, 1);
    assert.equal(res3.transfers[0].from_room_number, '102');
  });

  await t.test('field=room does not match guest name', () => {
    const res4 = filterShiftAuditReport(sampleAuditReport, { query: 'خالد', field: 'room' });
    assert.equal(res4.totalMatches, 0);
  });
});

test('filterShiftAuditReport searches by receipt number / voucher', async t => {
  await t.test('matches receipt_number directly', () => {
    const res1 = filterShiftAuditReport(sampleAuditReport, { query: 'REC-2026-002', field: 'receipt' });
    assert.equal(res1.isSearchActive, true);
    assert.equal(res1.payments.length, 1);
    assert.equal(res1.payments[0].receipt_number, 'REC-2026-002');
    assert.equal(res1.filteredPaymentsTotal, 500);
  });

  await t.test('matches receipt with prefix "سند #001" or "#1"', () => {
    const res2 = filterShiftAuditReport(sampleAuditReport, { query: 'سند 001', field: 'receipt' });
    assert.equal(res2.payments.length, 1);
    assert.equal(res2.payments[0].receipt_number, 'REC-2026-001');
  });

  await t.test('matches reservation id and associated receipts', () => {
    const res3 = filterShiftAuditReport(sampleAuditReport, { query: '#103', field: 'receipt' });
    assert.equal(res3.payments.length, 1);
    assert.equal(res3.payments[0].reservation_id, 103);
    assert.equal(res3.transactions.length, 1);
    assert.equal(res3.transactions[0].id, 103);
    assert.equal(res3.filteredPaymentsTotal, -150); // refund row
  });

  await t.test('field=receipt does not match room number or guest name', () => {
    const res4 = filterShiftAuditReport(sampleAuditReport, { query: 'فاطمة', field: 'receipt' });
    assert.equal(res4.totalMatches, 0);
  });
});

test('filterShiftAuditReport handles non-matching query cleanly', () => {
  const result = filterShiftAuditReport(sampleAuditReport, { query: 'غير موجود إطلاقاً', field: 'all' });
  assert.equal(result.isSearchActive, true);
  assert.equal(result.totalMatches, 0);
  assert.equal(result.payments.length, 0);
  assert.equal(result.transactions.length, 0);
  assert.equal(result.transfers.length, 0);
  assert.equal(result.depositMovements.length, 0);
  assert.equal(result.filteredPaymentsTotal, 0);
});

test('dashboard.js integration checks for shift audit search UI', () => {
  const dashContent = fs.readFileSync(path.join(__dirname, '..', 'dashboard.js'), 'utf8');

  // Verify search input & clear button
  assert.ok(dashContent.includes('id="shift-audit-search-input"'), 'dashboard.js must contain search input element');
  assert.ok(dashContent.includes('id="btn-clear-shift-audit-search"'), 'dashboard.js must contain clear search button');
  assert.ok(dashContent.includes('id="shift-audit-search-badge"'), 'dashboard.js must contain search matches badge');

  // Verify field pills
  assert.ok(dashContent.includes('data-field="all"'), 'dashboard.js must have "الكل" field pill');
  assert.ok(dashContent.includes('data-field="name"'), 'dashboard.js must have "بالاسم" field pill');
  assert.ok(dashContent.includes('data-field="room"'), 'dashboard.js must have "رقم الغرفة" field pill');
  assert.ok(dashContent.includes('data-field="receipt"'), 'dashboard.js must have "رقم السند" field pill');

  // Verify helper wiring & banner
  assert.ok(dashContent.includes('filterShiftAuditReport'), 'dashboard.js must call filterShiftAuditReport');
  assert.ok(dashContent.includes('audit-filter-banner'), 'dashboard.js must render audit filter banner');
  assert.ok(dashContent.includes('highlightAuditText'), 'dashboard.js must define highlightAuditText');
  assert.ok(dashContent.includes('btn-clear-audit-filter'), 'dashboard.js must have banner clear filter button');
});
