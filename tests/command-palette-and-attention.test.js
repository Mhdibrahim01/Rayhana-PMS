'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createCommandPaletteEnv(mockState = {}, mockHelpers = {}, mockApi = null, initialStorage = {}) {
  const App = {
    State: {
      businessDate: '2026-10-08',
      reservationsCache: [],
      roomsCache: [],
      guestsCache: [],
      ...mockState
    },
    Helpers: {
      getLocalDateString: () => '2026-10-08',
      isLateCheckout: (res) => Boolean(res.is_late),
      getExpectedCheckoutTime: () => '14:00',
      escapeHtml: (s) => String(s || ''),
      ...mockHelpers
    }
  };

  const storageMap = new Map(Object.entries(initialStorage));
  const localStorageMock = {
    getItem: (k) => storageMap.has(k) ? storageMap.get(k) : null,
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear()
  };

  const windowMock = {
    DashboardApp: App,
    localStorage: localStorageMock,
    addEventListener: () => {},
    setTimeout: () => {},
    setInterval: () => {}
  };
  if (mockApi) {
    windowMock.api = mockApi;
  }

  const documentMock = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    readyState: 'complete'
  };

  const code = fs.readFileSync(path.resolve(__dirname, '../command-palette.js'), 'utf8');
  const context = vm.createContext({
    window: windowMock,
    document: documentMock,
    localStorage: localStorageMock,
    console,
    setTimeout: (fn) => fn(),
    setInterval: () => 1,
    Date,
    Math,
    String,
    Number,
    Array,
    Boolean,
    Set,
    Map,
    RegExp
  });
  vm.runInContext(code, context);

  return { App, CommandPalette: App.CommandPalette, window: windowMock, localStorage: localStorageMock };
}

test('Smart Command Palette (Ctrl+K) & Attention Inbox Unit Tests', async t => {

  await t.test('Natural Language & Command Intent Parsing (parseCommandIntent)', async t2 => {
    const { CommandPalette } = createCommandPaletteEnv();
    const parse = CommandPalette.parseCommandIntent;

    await t2.test('Empty input returns empty intent', () => {
      assert.equal(parse('').type, 'empty');
      assert.equal(parse('   ').type, 'empty');
      assert.equal(parse(null).type, 'empty');
    });

    await t2.test('Room inquiries correctly parse room numbers in Arabic & English', () => {
      assert.equal(parse('مين في غرفة 204؟').type, 'room-inquiry');
      assert.equal(parse('مين في غرفة 204؟').roomNumber, '204');

      assert.equal(parse('مين في 204').type, 'room-inquiry');
      assert.equal(parse('مين في 204').roomNumber, '204');

      assert.equal(parse('مين في 202').type, 'room-inquiry');
      assert.equal(parse('مين في 202').roomNumber, '202');

      assert.equal(parse('مين ساكن في 202').type, 'room-inquiry');
      assert.equal(parse('مين ساكن في 202').roomNumber, '202');

      assert.equal(parse('غرفة 302').type, 'room-inquiry');
      assert.equal(parse('غرفة 302').roomNumber, '302');

      assert.equal(parse('رقم 105').type, 'room-inquiry');
      assert.equal(parse('رقم 105').roomNumber, '105');

      assert.equal(parse('204').type, 'room-inquiry');
      assert.equal(parse('204').roomNumber, '204');
    });

    await t2.test('Booking & check-in intents parse room number when supplied', () => {
      const intentWithRoom = parse('تسكين 105');
      assert.equal(intentWithRoom.type, 'booking-intent');
      assert.equal(intentWithRoom.roomNumber, '105');

      const intentWithRoomAr = parse('حجز غرفة 201');
      assert.equal(intentWithRoomAr.type, 'booking-intent');
      assert.equal(intentWithRoomAr.roomNumber, '201');

      const intentWithoutRoom = parse('تسكين');
      assert.equal(intentWithoutRoom.type, 'booking-intent');
      assert.equal(intentWithoutRoom.roomNumber, null);

      const intentBookingEn = parse('checkin 305');
      assert.equal(intentBookingEn.type, 'booking-intent');
      assert.equal(intentBookingEn.roomNumber, '305');
    });

    await t2.test('Cash drawer, shift reports, and audit intents', () => {
      assert.equal(parse('فلوس الدرج').type, 'shift-intent');
      assert.equal(parse('الدرج').type, 'shift-intent');
      assert.equal(parse('تقرير الوردية').type, 'shift-intent');
      assert.equal(parse('الخزينة').type, 'shift-intent');
      assert.equal(parse('الكاش').type, 'shift-intent');
      assert.equal(parse('shift audit').type, 'shift-intent');
      assert.equal(parse('cash drawer').type, 'shift-intent');
    });

    await t2.test('WhatsApp messaging intents parse target guest or room', () => {
      const waRoom = parse('واتساب 102');
      assert.equal(waRoom.type, 'whatsapp-intent');
      assert.equal(waRoom.target, '102');

      const waName = parse('واتساب محمد');
      assert.equal(waName.type, 'whatsapp-intent');
      assert.equal(waName.target, 'محمد');

      const waEn = parse('whatsapp 204');
      assert.equal(waEn.type, 'whatsapp-intent');
      assert.equal(waEn.target, '204');
    });

    await t2.test('Operational query intents (unpaid, departures, late, available, occupied)', () => {
      assert.equal(parse('مين عليه فلوس').type, 'unpaid-intent');
      assert.equal(parse('مين عليه فلوس؟').type, 'unpaid-intent');
      assert.equal(parse('مين عليه مبالغ').type, 'unpaid-intent');
      assert.equal(parse('مين ما دفع').type, 'unpaid-intent');
      assert.equal(parse('المستحقات').type, 'unpaid-intent');
      assert.equal(parse('مديونية').type, 'unpaid-intent');
      assert.equal(parse('ديون').type, 'unpaid-intent');
      assert.equal(parse('unpaid').type, 'unpaid-intent');
      assert.equal(parse('debts').type, 'unpaid-intent');

      assert.equal(parse('مين خارج اليوم').type, 'departures-intent');
      assert.equal(parse('مغادرات اليوم').type, 'departures-intent');
      assert.equal(parse('departures').type, 'departures-intent');

      assert.equal(parse('مين متأخر').type, 'late-intent');
      assert.equal(parse('المتأخرين').type, 'late-intent');
      assert.equal(parse('تأخير').type, 'late-intent');
      assert.equal(parse('late').type, 'late-intent');

      assert.equal(parse('غرف فاضية').type, 'available-intent');
      assert.equal(parse('مين فاضي').type, 'available-intent');
      assert.equal(parse('غرف متاحة').type, 'available-intent');
      assert.equal(parse('available').type, 'available-intent');

      assert.equal(parse('غرف مشغولة').type, 'occupied-intent');
      assert.equal(parse('مين ساكن').type, 'occupied-intent');
      assert.equal(parse('مشغولة').type, 'occupied-intent');
      assert.equal(parse('occupied').type, 'occupied-intent');
    });

    await t2.test('General queries fall back to multi-entity search', () => {
      const res1 = parse('سعد عبدالله');
      assert.equal(res1.type, 'search');
      assert.equal(res1.query, 'سعد عبدالله');

      const res2 = parse('0555123456');
      assert.equal(res2.type, 'search');
      assert.equal(res2.query, '0555123456');
    });
  });

  await t.test('Needs-Attention Inbox Engine (computeAttentionInbox)', async t2 => {
    const bizDate = '2026-10-08';
    const mockReservations = [
      // 1. Late checkout (due yesterday 2026-10-07, active stay)
      {
        id: 101,
        status: 'مؤكد',
        room_id: 1,
        room_number: '101',
        guest_name: 'أحمد المتأخر',
        check_out_date: '2026-10-07',
        booking_type: 'يومي',
        total_price: 500,
        paid_amount: 500,
        is_late: true
      },
      // 2. Departure due today (2026-10-08, not yet late)
      {
        id: 102,
        status: 'مؤكد',
        room_id: 2,
        room_number: '102',
        guest_name: 'سالم المغادر',
        check_out_date: '2026-10-08',
        booking_type: 'يومي',
        total_price: 300,
        paid_amount: 300,
        is_late: false
      },
      // 3. Unpaid balance (checked out in future 2026-10-12, balance = 400)
      {
        id: 103,
        status: 'مؤكد',
        room_id: 3,
        room_number: '103',
        guest_name: 'خالد المدين',
        check_out_date: '2026-10-12',
        booking_type: 'يومي',
        total_price: 800,
        paid_amount: 400,
        is_late: false
      },
      // 4. Monthly rent due soon (expires 2026-10-10, 2 days left)
      {
        id: 104,
        status: 'مؤكد',
        room_id: 4,
        room_number: '104',
        guest_name: 'عبدالرحمن الشهري',
        check_out_date: '2026-10-10',
        booking_type: 'حجز شهري',
        total_price: 4500,
        paid_amount: 4500,
        is_late: false
      },
      // 5. Unreconciled legacy deposit
      {
        id: 105,
        status: 'مؤكد',
        room_id: 5,
        room_number: '105',
        guest_name: 'فيصل التأمين',
        check_out_date: '2026-10-15',
        booking_type: 'يومي',
        total_price: 600,
        paid_amount: 600,
        deposit_amount: 200,
        deposit_legacy_unreconciled: 1,
        is_late: false
      },
      // 6. Completed stay (should be completely ignored by inbox)
      {
        id: 106,
        status: 'مكتمل',
        room_id: 6,
        room_number: '106',
        guest_name: 'نزيل مغادر سابقاً',
        check_out_date: '2026-10-05',
        total_price: 400,
        paid_amount: 400,
        is_late: false
      },
      // 7. Cancelled stay (should be completely ignored by inbox)
      {
        id: 107,
        status: 'ملغي',
        room_id: 7,
        room_number: '107',
        guest_name: 'حجز ملغي',
        check_out_date: '2026-10-06',
        total_price: 300,
        paid_amount: 0,
        is_late: false
      }
    ];

    const mockRooms = [
      { id: 1, room_number: '101', status: 'مشغولة' },
      { id: 2, room_number: '102', status: 'مشغولة' },
      { id: 3, room_number: '103', status: 'مشغولة' },
      { id: 4, room_number: '104', status: 'مشغولة' },
      { id: 5, room_number: '105', status: 'مشغولة' },
      { id: 201, room_number: '201', status: 'تنظيف', type: 'غرفة وصالة', floor: '2' },
      { id: 202, room_number: '202', status: 'متاحة', type: 'استوديو', floor: '2' }
    ];

    const { CommandPalette } = createCommandPaletteEnv({
      businessDate: bizDate,
      reservationsCache: mockReservations,
      roomsCache: mockRooms
    });

    const inbox = CommandPalette.computeAttentionInbox();

    await t2.test('Aggregates late checkouts accurately', () => {
      assert.equal(inbox.lateCheckouts.length, 1);
      assert.equal(inbox.lateCheckouts[0].id, 101);
      assert.equal(inbox.lateCheckouts[0].action, 'checkout');
      assert.equal(inbox.lateCheckouts[0].badgeClass, 'danger');
    });

    await t2.test('Aggregates departures due today', () => {
      assert.equal(inbox.departuresToday.length, 1);
      assert.equal(inbox.departuresToday[0].id, 102);
      assert.equal(inbox.departuresToday[0].action, 'checkout');
      assert.equal(inbox.departuresToday[0].badgeClass, 'info');
    });

    await t2.test('Aggregates unpaid balances without duplicating late checkouts', () => {
      assert.equal(inbox.unpaidBalances.length, 1);
      assert.equal(inbox.unpaidBalances[0].id, 103);
      assert.equal(inbox.unpaidBalances[0].action, 'payment');
      assert.equal(inbox.unpaidBalances[0].badgeClass, 'warning');
    });

    await t2.test('Aggregates rooms waiting for cleaning', () => {
      assert.equal(inbox.dirtyRooms.length, 1);
      assert.equal(inbox.dirtyRooms[0].room.room_number, '201');
      assert.equal(inbox.dirtyRooms[0].action, 'mark-clean');
      assert.equal(inbox.dirtyRooms[0].badgeClass, 'purple');
    });

    await t2.test('Aggregates monthly rents expiring within 3 days', () => {
      assert.equal(inbox.monthlyDue.length, 1);
      assert.equal(inbox.monthlyDue[0].id, 104);
      assert.equal(inbox.monthlyDue[0].action, 'extend');
    });

    await t2.test('Aggregates legacy deposits requiring reconciliation', () => {
      assert.equal(inbox.legacyDeposits.length, 1);
      assert.equal(inbox.legacyDeposits[0].id, 105);
      assert.equal(inbox.legacyDeposits[0].action, 'preview');
    });

    await t2.test('Computes correct totalCount across all categories', () => {
      // 1 late + 1 departure + 1 unpaid + 1 dirty + 1 monthly + 1 deposit = 6
      assert.equal(inbox.totalCount, 6);
    });

    await t2.test('Returns zero totalCount when all operations are clean and up to date', () => {
      const cleanEnv = createCommandPaletteEnv({
        businessDate: bizDate,
        reservationsCache: [
          {
            id: 201,
            status: 'مؤكد',
            check_out_date: '2026-10-15',
            booking_type: 'يومي',
            total_price: 600,
            paid_amount: 600,
            is_late: false
          }
        ],
        roomsCache: [
          { id: 1, room_number: '101', status: 'متاحة' }
        ]
      });

      const cleanInbox = cleanEnv.CommandPalette.computeAttentionInbox();
      assert.equal(cleanInbox.totalCount, 0);
      assert.equal(cleanInbox.lateCheckouts.length, 0);
      assert.equal(cleanInbox.departuresToday.length, 0);
      assert.equal(cleanInbox.unpaidBalances.length, 0);
      assert.equal(cleanInbox.dirtyRooms.length, 0);
      assert.equal(cleanInbox.monthlyDue.length, 0);
      assert.equal(cleanInbox.legacyDeposits.length, 0);
    });
  });

  await t.test('Data Hydration & Fallback Engine', async t2 => {
    await t2.test('Falls back to local cache when App.State caches are empty and syncs from API', async () => {
      const mockRooms = [{ id: 202, room_number: '202', status: 'محجوزة' }];
      const mockRes = [{ id: 76, room_id: 202, room_number: '202', status: 'مؤكد', guest_name: 'عبدالرحمن حمد حكمي', total_price: 3000, paid_amount: 1000 }];
      const mockGuests = [{ id: 1, name: 'عبدالرحمن حمد حكمي', phone: '0555123456' }];

      const mockApi = {
        getAllRooms: async () => ({ success: true, data: mockRooms }),
        getAllReservations: async () => ({ success: true, data: mockRes }),
        getAllGuests: async () => ({ success: true, data: mockGuests })
      };

      const { App, CommandPalette } = createCommandPaletteEnv({}, {}, mockApi);

      assert.equal(CommandPalette.getRooms().length, 0);
      assert.equal(CommandPalette.getReservations().length, 0);

      await CommandPalette.syncDataFromDb();

      assert.equal(CommandPalette.getRooms().length, 1);
      assert.equal(CommandPalette.getRooms()[0].room_number, '202');
      assert.equal(CommandPalette.getReservations().length, 1);
      assert.equal(CommandPalette.getReservations()[0].guest_name, 'عبدالرحمن حمد حكمي');
      assert.equal(App.State.roomsCache.length, 1);
      assert.equal(App.State.reservationsCache.length, 1);

      // Verify that attention inbox detects the unpaid balance on room 202
      const inbox = CommandPalette.computeAttentionInbox();
      assert.equal(inbox.unpaidBalances.length, 1);
      assert.equal(inbox.unpaidBalances[0].reservation.guest_name, 'عبدالرحمن حمد حكمي');
    });

    await t2.test('Room 202 inquiry resolves active occupant even when room status is "محجوزة"', () => {
      const { CommandPalette } = createCommandPaletteEnv({
        roomsCache: [{ id: 202, room_number: '202', status: 'محجوزة' }],
        reservationsCache: [{
          id: 76,
          room_id: 202,
          room_number: '202',
          status: 'مؤكد',
          guest_name: 'عبدالرحمن حمد احمد ال ابوالسعود حكمي',
          guest_phone: '0555123456',
          total_price: 3000,
          paid_amount: 1000
        }]
      });

      const parsed = CommandPalette.parseCommandIntent('مين في 202');
      assert.equal(parsed.type, 'room-inquiry');
      assert.equal(parsed.roomNumber, '202');

      const activeRes = CommandPalette.getReservations().find(r => String(r.room_number) === '202' && r.status === 'مؤكد');
      assert.ok(activeRes);
      assert.equal(activeRes.guest_name, 'عبدالرحمن حمد احمد ال ابوالسعود حكمي');
      assert.equal(activeRes.total_price - activeRes.paid_amount, 2000);
    });
  });

  await t.test('Arabic Matching, Text Normalization & Keyboard Layout Transliteration', async t2 => {
    const { CommandPalette } = createCommandPaletteEnv();
    const { normalizeArabic, normalizeDigits, stripDiacritics, transliterateEnToAr, parseCommandIntent } = CommandPalette;

    await t2.test('Arabic-Indic digits conversion', () => {
      assert.equal(normalizeDigits('٢٠٤'), '204');
      assert.equal(normalizeDigits('١٠٥'), '105');
      assert.equal(normalizeDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
      assert.equal(normalizeDigits('غرفة ٢٠٤'), 'غرفة 204');
    });

    await t2.test('Diacritics and Tatweel stripping', () => {
      assert.equal(stripDiacritics('مُتَأَخِّرٌ'), 'متأخر');
      assert.equal(stripDiacritics('غُرْفَةٌ'), 'غرفة');
      assert.equal(stripDiacritics('تـسـكـيـن'), 'تسكين');
    });

    await t2.test('Arabic character normalization (Alef, Ta-Marbuta, Ya)', () => {
      assert.equal(normalizeArabic('أحمد'), 'احمد');
      assert.equal(normalizeArabic('إبراهيم'), 'ابراهيم');
      assert.equal(normalizeArabic('آمال'), 'امال');
      assert.equal(normalizeArabic('غرفة'), 'غرفه');
      assert.equal(normalizeArabic('موسى'), 'موسي');
      assert.equal(normalizeArabic('مُتَأَخِّرٌ'), 'متاخر');
      assert.equal(normalizeArabic('غُرْفَةٌ ٢٠٤'), 'غرفه 204');
    });

    await t2.test('Room inquiries accept Arabic-Indic digits and "غرفه" spelling', () => {
      const q1 = parseCommandIntent('مين في غرفة ٢٠٤؟');
      assert.equal(q1.type, 'room-inquiry');
      assert.equal(q1.roomNumber, '204');

      const q2 = parseCommandIntent('٢٠٤');
      assert.equal(q2.type, 'room-inquiry');
      assert.equal(q2.roomNumber, '204');

      const q3 = parseCommandIntent('غرفه 204');
      assert.equal(q3.type, 'room-inquiry');
      assert.equal(q3.roomNumber, '204');

      const q4 = parseCommandIntent('غرفة ٢٠٤');
      assert.equal(q4.type, 'room-inquiry');
      assert.equal(q4.roomNumber, '204');

      const q5 = parseCommandIntent('مين ساكن في غرفة ٢٠٢');
      assert.equal(q5.type, 'room-inquiry');
      assert.equal(q5.roomNumber, '202');
    });

    await t2.test('Booking intent with Arabic-Indic digits', () => {
      const b1 = parseCommandIntent('تسكين ١٠٥');
      assert.equal(b1.type, 'booking-intent');
      assert.equal(b1.roomNumber, '105');

      const b2 = parseCommandIntent('حجز غرفه ٢٠١');
      assert.equal(b2.type, 'booking-intent');
      assert.equal(b2.roomNumber, '201');
    });

    await t2.test('WhatsApp intent with Arabic-Indic digits', () => {
      const w1 = parseCommandIntent('واتساب ١٠٢');
      assert.equal(w1.type, 'whatsapp-intent');
      assert.equal(w1.target, '102');

      const w2 = parseCommandIntent('واتس غرفه ١٠٢');
      assert.equal(w2.type, 'whatsapp-intent');
      assert.equal(w2.target, '102');
    });

    await t2.test('Operational queries match with Ta-Marbuta or Ha', () => {
      assert.equal(parseCommandIntent('غرفه فاضيه').type, 'available-intent');
      assert.equal(parseCommandIntent('غرفة فاضية').type, 'available-intent');
      assert.equal(parseCommandIntent('غرف متاحه').type, 'available-intent');
      assert.equal(parseCommandIntent('غرف متاحة').type, 'available-intent');
      assert.equal(parseCommandIntent('مين متاخر').type, 'late-intent');
      assert.equal(parseCommandIntent('مين متأخر').type, 'late-intent');
      assert.equal(parseCommandIntent('نظافه').type, 'cleaning-intent');
      assert.equal(parseCommandIntent('نظافة').type, 'cleaning-intent');
      assert.equal(parseCommandIntent('تقرير الورديه').type, 'shift-intent');
      assert.equal(parseCommandIntent('تقرير الوردية').type, 'shift-intent');
    });

    await t2.test('English keyboard layout transliteration to Arabic', () => {
      assert.equal(transliterateEnToAr('ldk td 202'), 'مين في 202');
      assert.equal(transliterateEnToAr('tg,s hg]v['), 'فلوس الدرج');
      assert.equal(transliterateEnToAr('yvt thqdm'), 'غرف فاضية');
      assert.equal(transliterateEnToAr('js;dk 105'), 'تسكين 105');

      // Intent parsing with English layout keystrokes
      const r1 = parseCommandIntent('ldk td 202');
      assert.equal(r1.type, 'room-inquiry');
      assert.equal(r1.roomNumber, '202');

      const r2 = parseCommandIntent('ldk td 204');
      assert.equal(r2.type, 'room-inquiry');
      assert.equal(r2.roomNumber, '204');

      const s1 = parseCommandIntent('tg,s hg]v[');
      assert.equal(s1.type, 'shift-intent');

      const a1 = parseCommandIntent('yvt thqdm');
      assert.equal(a1.type, 'available-intent');

      const b1 = parseCommandIntent('js;dk 105');
      assert.equal(b1.type, 'booking-intent');
      assert.equal(b1.roomNumber, '105');
    });
  });

  await t.test('Overdue Checkouts Aggregation Matches Image 2 (5 Late Reservations)', async () => {
    // Replicating Image 2 scenario: 5 late checkouts in rooms 101, 102, 201, 203, 217
    const today = '2026-10-08';
    const mockCheckouts = [
      { id: 101, reservation_id: 101, room_number: '101', guest_name: 'نزيل 101', status: 'مؤكد', check_out_date: '2026-10-07', is_late: true },
      { id: 102, reservation_id: 102, room_number: '102', guest_name: 'نزيل 102', status: 'مؤكد', check_out_date: '2026-10-07', is_late: true },
      { id: 201, reservation_id: 201, room_number: '201', guest_name: 'نزيل 201', status: 'مؤكد', check_out_date: '2026-10-07', is_late: true },
      { id: 203, reservation_id: 203, room_number: '203', guest_name: 'نزيل 203', status: 'مؤكد', check_out_date: '2026-10-07', is_late: true },
      { id: 217, reservation_id: 217, room_number: '217', guest_name: 'نزيل 217', status: 'مؤكد', check_out_date: '2026-10-07', is_late: true },
      { id: 301, reservation_id: 301, room_number: '301', guest_name: 'نزيل 301', status: 'مؤكد', check_out_date: '2026-10-08', is_late: false }
    ];

    const { CommandPalette } = createCommandPaletteEnv({
      businessDate: today,
      todayCheckoutsRows: mockCheckouts,
      reservationsCache: mockCheckouts
    }, {
      isLateCheckout: (res) => Boolean(res.is_late || (res.check_out_date && res.check_out_date < today))
    });

    const inbox = CommandPalette.computeAttentionInbox();
    assert.equal(inbox.lateCheckouts.length, 5, 'Must report exactly 5 late checkouts');
    const lateRoomNumbers = inbox.lateCheckouts.map(item => String(item.reservation.room_number)).sort();
    assert.equal(JSON.stringify(lateRoomNumbers), JSON.stringify(['101', '102', '201', '203', '217']));

    // And departures today must be exactly 1 (room 301)
    assert.equal(inbox.departuresToday.length, 1);
    assert.equal(inbox.departuresToday[0].reservation.room_number, '301');
  });

  await t.test('Batch 1, 2, and 3 Enhancements Tests', async t2 => {
    const today = '2026-10-08';

    await t2.test('Deduplication in All tab combines multiple attention reasons for the same reservation', () => {
      // Reservation with late checkout AND unpaid balance
      const mockRes = [
        {
          id: 501,
          room_number: '501',
          guest_name: 'علي المتأخر والمدين',
          status: 'مؤكد',
          check_out_date: '2026-10-07',
          total_price: 1000,
          paid_amount: 500,
          is_late: true
        }
      ];

      const { CommandPalette } = createCommandPaletteEnv({
        businessDate: today,
        reservationsCache: mockRes
      });

      const inbox = CommandPalette.computeAttentionInbox();
      assert.equal(inbox.lateCheckouts.length, 1);
      assert.equal(inbox.unpaidBalances.length, 0); // Excluded from specific unpaid tab to avoid duplicate noise
      assert.equal(inbox.deduplicatedAllItems.length, 1, 'Should consolidate to 1 item in All tab');
      assert.equal(inbox.totalCount, 1);
      assert.equal(inbox.deduplicatedAllItems[0].action, 'checkout');
    });

    await t2.test('Correctly reports completed departures today to eliminate receptionist confusion', () => {
      const mockRes = [
        {
          id: 601,
          room_number: '203',
          guest_name: 'موزاميل نياز',
          status: 'مكتمل',
          check_out_date: today,
          total_price: 450,
          paid_amount: 450
        },
        {
          id: 602,
          room_number: '206',
          guest_name: 'محمد ربيع',
          status: 'مكتمل',
          check_out_date: today,
          total_price: 350,
          paid_amount: 350
        }
      ];

      const { CommandPalette } = createCommandPaletteEnv({
        businessDate: today,
        reservationsCache: mockRes
      });

      const inbox = CommandPalette.computeAttentionInbox();
      assert.equal(inbox.departuresToday.length, 0, 'No pending departures');
      assert.equal(inbox.completedDeparturesToday.length, 2, 'Must report both completed departures today');
      assert.equal(inbox.completedDeparturesToday[0].reservation.room_number, '203');
      assert.equal(inbox.completedDeparturesToday[1].reservation.room_number, '206');
    });

    await t2.test('Legacy deposit strictly requires deposit_legacy_unreconciled === 1 (no false positives for refunded deposits)', () => {
      const mockRes = [
        {
          id: 701,
          room_number: '701',
          guest_name: 'نزيل مسترجع تأمينه',
          status: 'مؤكد',
          check_out_date: '2026-10-15',
          total_price: 1000,
          paid_amount: 1000,
          deposit_amount: 200,
          deposit_ledger_balance: 0,
          deposit_legacy_unreconciled: 0 // Refunded or reconciled
        },
        {
          id: 702,
          room_number: '702',
          guest_name: 'نزيل تأمين معلق حقيقي',
          status: 'مؤكد',
          check_out_date: '2026-10-15',
          total_price: 1000,
          paid_amount: 1000,
          deposit_amount: 200,
          deposit_legacy_unreconciled: 1 // True unreconciled legacy
        }
      ];

      const { CommandPalette } = createCommandPaletteEnv({
        businessDate: today,
        reservationsCache: mockRes
      });

      const inbox = CommandPalette.computeAttentionInbox();
      assert.equal(inbox.legacyDeposits.length, 1, 'Only true legacy deposit must be flagged');
      assert.equal(inbox.legacyDeposits[0].id, 702);
    });

    await t2.test('Monthly overdue and due soon labels format accurately', () => {
      const mockRes = [
        {
          id: 801,
          room_number: '801',
          booking_type: 'حجز شهري',
          status: 'مؤكد',
          check_out_date: '2026-10-08' // due today
        },
        {
          id: 802,
          room_number: '802',
          booking_type: 'حجز شهري',
          status: 'مؤكد',
          check_out_date: '2026-10-06' // expired 2 days ago
        },
        {
          id: 803,
          room_number: '803',
          booking_type: 'حجز شهري',
          status: 'مؤكد',
          check_out_date: '2026-10-10' // 2 days left
        }
      ];

      const { CommandPalette } = createCommandPaletteEnv({
        businessDate: today,
        reservationsCache: mockRes
      });

      const inbox = CommandPalette.computeAttentionInbox();
      assert.equal(inbox.monthlyDue.length, 3);
      assert.ok(inbox.monthlyDue.find(m => m.id === 801).badge.includes('مستحق التجديد اليوم'));
      assert.ok(inbox.monthlyDue.find(m => m.id === 802).badge.includes('منتهي منذ 2 يوم'));
      assert.ok(inbox.monthlyDue.find(m => m.id === 803).badge.includes('يستحق بعد 2 يوم'));
    });

    await t2.test('Normalization handles Persian digits, tatweel, and whitespace', () => {
      const { CommandPalette } = createCommandPaletteEnv();
      const { normalize } = CommandPalette;

      assert.equal(normalize('غرفة   ۲۰۴'), 'غرفه 204');
      assert.equal(normalize('تـــسـكـيـن   ۱٠۵'), 'تسكين 105');
      assert.equal(normalize('مُحَمَّدُ   أَحْمَدُ'), 'محمد احمد');
    });

    await t2.test('WhatsApp intent captures full target name with remainder of query', () => {
      const { CommandPalette } = createCommandPaletteEnv();
      const parsed = CommandPalette.parseCommandIntent('واتساب محمد عبدالله آل سعود');
      assert.equal(parsed.type, 'whatsapp-intent');
      assert.equal(parsed.target, 'محمد عبدالله ال سعود');
    });

    await t2.test('Advanced Front-Desk Operational Intents (Extend, Invoice, Voucher, Floor, Blacklist, Backup)', () => {
      const { CommandPalette } = createCommandPaletteEnv();
      const parse = CommandPalette.parseCommandIntent;

      // 1. Extend intent
      const ext1 = parse('تمديد 104');
      assert.equal(ext1.type, 'extend-intent');
      assert.equal(ext1.roomNumber, '104');

      const ext2 = parse('تمديد حجز غرفه 202');
      assert.equal(ext2.type, 'extend-intent');
      assert.equal(ext2.roomNumber, '202');

      // 2. Invoice intent
      const inv1 = parse('فاتورة 202');
      assert.equal(inv1.type, 'invoice-intent');
      assert.equal(inv1.targetNumber, '202');

      const inv2 = parse('طباعة فاتورة 58');
      assert.equal(inv2.type, 'invoice-intent');
      assert.equal(inv2.targetNumber, '58');

      // 3. Voucher / Payment intent
      const pay1 = parse('قبض 103');
      assert.equal(pay1.type, 'voucher-intent');
      assert.equal(pay1.targetNumber, '103');

      const pay2 = parse('سند قبض غرفة 205');
      assert.equal(pay2.type, 'voucher-intent');
      assert.equal(pay2.targetNumber, '205');

      // 4. Floor filter intent
      const fl1 = parse('طابق 2');
      assert.equal(fl1.type, 'floor-intent');
      assert.equal(fl1.floor, '2');

      const fl2 = parse('الدور الثاني');
      assert.equal(fl2.type, 'floor-intent');
      assert.equal(fl2.floor, '2');

      // 5. Blacklist intent
      assert.equal(parse('المحظورين').type, 'blacklist-intent');
      assert.equal(parse('بلاك ليست').type, 'blacklist-intent');
      assert.equal(parse('قائمة الحظر').type, 'blacklist-intent');

      // 6. Backup intent
      assert.equal(parse('نسخة احتياطية').type, 'backup-intent');
      assert.equal(parse('باك اب').type, 'backup-intent');
    });

    await t2.test('Typo tolerance corrects common receptionist spelling errors', () => {
      const { CommandPalette } = createCommandPaletteEnv();
      const parse = CommandPalette.parseCommandIntent;

      // Typo "تسيكن" -> "تسكين"
      const t1 = parse('تسيكن 105');
      assert.equal(t1.type, 'booking-intent');
      assert.equal(t1.roomNumber, '105');

      // Typo "مغاردرات" -> "مغادرات"
      const t2 = parse('مغاردرات اليوم');
      assert.equal(t2.type, 'departures-intent');

      // Typo "تميد" -> "تمديد"
      const t3 = parse('تميد 201');
      assert.equal(t3.type, 'extend-intent');
      assert.equal(t3.roomNumber, '201');
    });
  });

  await t.test('Real-time Attention Inbox synchronization after external checkout and extension (no restart needed)', async t2 => {
    const bizDate = '2026-10-08';

    await t2.test('Checking out a guest clears them from late checkouts immediately without app restart', () => {
      const activeLateRes = {
        id: 501,
        room_id: 1,
        room_number: '101',
        guest_name: 'أحمد علي',
        status: 'مؤكد',
        check_out_date: '2026-10-07',
        is_late: true
      };
      const env = createCommandPaletteEnv({
        businessDate: bizDate,
        reservationsCache: [activeLateRes],
        todayCheckoutsRows: [activeLateRes]
      });

      // Before checkout: 1 late checkout in inbox
      let inbox = env.CommandPalette.computeAttentionInbox();
      assert.equal(inbox.lateCheckouts.length, 1);
      assert.equal(inbox.lateCheckouts[0].id, 501);

      // Simulate external checkout: status becomes 'مكتمل'
      activeLateRes.status = 'مكتمل';
      env.App.State.reservationsCache = [activeLateRes];
      env.App.State.todayCheckoutsRows = [activeLateRes];

      // Recompute attention inbox live
      inbox = env.CommandPalette.computeAttentionInbox();
      assert.equal(inbox.lateCheckouts.length, 0, 'Late checkouts should be 0 after checkout');
      assert.equal(inbox.departuresToday.length, 0);
    });

    await t2.test('Extending stay clears guest from late checkouts immediately', () => {
      const resToExtend = {
        id: 502,
        room_id: 2,
        room_number: '102',
        guest_name: 'سالم خالد',
        status: 'مؤكد',
        check_out_date: '2026-10-07',
        is_late: true
      };
      const env = createCommandPaletteEnv({
        businessDate: bizDate,
        reservationsCache: [resToExtend],
        todayCheckoutsRows: [resToExtend]
      }, {
        isLateCheckout: (r) => r.status === 'مؤكد' && r.check_out_date < bizDate
      });

      let inbox = env.CommandPalette.computeAttentionInbox();
      assert.equal(inbox.lateCheckouts.length, 1);

      // Extend stay: update check_out_date to future date
      resToExtend.check_out_date = '2026-10-15';
      resToExtend.is_late = false;
      env.App.State.reservationsCache = [resToExtend];
      env.App.State.todayCheckoutsRows = [];

      inbox = env.CommandPalette.computeAttentionInbox();
      assert.equal(inbox.lateCheckouts.length, 0, 'Extended reservation must not appear in late checkouts');
    });

    await t2.test('syncAttentionTodayCheckouts invalidates cache and updates live attention state', () => {
      const initialRow = {
        id: 503,
        room_id: 3,
        room_number: '103',
        guest_name: 'محمد عمر',
        status: 'مؤكد',
        check_out_date: '2026-10-08',
        is_late: false
      };
      const env = createCommandPaletteEnv({
        businessDate: bizDate,
        reservationsCache: [initialRow],
        todayCheckoutsRows: [initialRow]
      });

      let inbox = env.CommandPalette.computeAttentionInbox();
      assert.equal(inbox.departuresToday.length, 1);

      // Call syncAttentionTodayCheckouts with updated (checked out) data
      const updatedRow = { ...initialRow, status: 'مكتمل' };
      env.window.syncAttentionTodayCheckouts([updatedRow]);

      inbox = env.CommandPalette.computeAttentionInbox();
      assert.equal(inbox.departuresToday.length, 0);
    });

    await t2.test('Completed and cancelled reservations are never resurrected by stale localTodayCheckouts', () => {
      const completedRes = {
        id: 504,
        room_id: 4,
        room_number: '104',
        guest_name: 'ماجد فيصل',
        status: 'مكتمل',
        check_out_date: '2026-10-08'
      };
      const cancelledRes = {
        id: 505,
        room_id: 5,
        room_number: '105',
        guest_name: 'ياسر طارق',
        status: 'ملغي',
        check_out_date: '2026-10-08'
      };
      const env = createCommandPaletteEnv({
        businessDate: bizDate,
        reservationsCache: [completedRes, cancelledRes],
        todayCheckoutsRows: [completedRes, cancelledRes]
      });

      const inbox = env.CommandPalette.computeAttentionInbox();
      assert.equal(inbox.lateCheckouts.length, 0);
      assert.equal(inbox.departuresToday.length, 0);
    });

    await t2.test('syncDataFromDb with force=true fetches fresh data even when cache already populated', async () => {
      let callCount = 0;
      const mockApi = {
        getAllRooms: async () => ({ success: true, data: [{ id: 1, room_number: '101', status: 'متاحة' }] }),
        getAllReservations: async () => {
          callCount++;
          return {
            success: true,
            data: callCount === 1
              ? [{ id: 601, status: 'مؤكد', check_out_date: '2026-10-07', is_late: true }]
              : [{ id: 601, status: 'مكتمل', check_out_date: '2026-10-07' }]
          };
        },
        getAllGuests: async () => ({ success: true, data: [] }),
        getTodayCheckouts: async () => ({ success: true, data: [] })
      };

      const env = createCommandPaletteEnv({}, {}, mockApi);
      await env.CommandPalette.syncDataFromDb();
      assert.equal(callCount, 1);
      assert.equal(env.App.State.reservationsCache[0].status, 'مؤكد');

      // With force: true, it fetches from API
      await env.CommandPalette.syncDataFromDb({ force: true });
      assert.equal(callCount, 2);
      assert.equal(env.App.State.reservationsCache[0].status, 'مكتمل');
    });
  });

  await t.test('Recent Items (MRU) Execution & Auto-Healing (Fixes Ctrl+1 on Occupied Room)', async t2 => {
    const res202 = {
      id: 2020,
      room_id: 2,
      room_number: '202',
      guest_name: 'عبدالرحمن حمد احمد ال ابوالسعود حكمي',
      guest_phone: '0583409941',
      status: 'مؤكد',
      check_in_date: '2026-10-01',
      check_out_date: '2026-11-10',
      total_price: 3000,
      paid_amount: 1000
    };
    const room202 = { id: 2, room_number: '202', status: 'مشغولة' };

    const res67 = {
      id: 67,
      room_id: 3,
      room_number: '208',
      guest_name: 'شمس تبريز احمد',
      status: 'مؤكد',
      check_out_date: '2026-11-04'
    };

    const res204 = {
      id: 2040,
      room_id: 4,
      room_number: '204',
      guest_name: 'نور زمين خان شير',
      status: 'مؤكد',
      check_out_date: '2026-10-12'
    };

    await t2.test('Occupied room recent item (without actionType) auto-deduces action and opens reservation preview', () => {
      let previewedResId = null;
      const initialMRU = [
        {
          id: 'rec-1',
          title: 'غرفة 202 (مشغولة) • النزيل: عبدالرحمن حمد احمد ال ابوالسعود حكمي',
          subtitle: 'الجوال: 0583409941 • المغادرة: 2026-11-10 • المتبقي: 2,000 ر.س ⚠️',
          badge: 'مشغولة',
          actionType: null,
          actionPayload: null
        }
      ];

      const env = createCommandPaletteEnv(
        {
          reservationsCache: [res202, res67, res204],
          roomsCache: [room202]
        },
        {
          openReservationPreview: (id) => {
            previewedResId = id;
          }
        },
        null,
        {
          'rayhana_palette_recent_mru': JSON.stringify(initialMRU)
        }
      );

      const items = env.CommandPalette.getRecentItems();
      assert.equal(items.length, 1);
      // Auto-healed:
      assert.equal(items[0].actionType, 'preview');
      assert.equal(items[0].actionPayload.roomNumber, '202');

      const resolved = env.CommandPalette.resolveRecentActionItem(items[0], {
        reservations: [res202],
        rooms: [room202]
      });

      assert.ok(resolved);
      assert.equal(typeof resolved.actionFn, 'function');

      // Execute item (like pressing Ctrl+1 or clicking):
      resolved.actionFn();
      assert.equal(previewedResId, 2020);
    });

    await t2.test('Reservation details (#67) recent item auto-deduces action and opens reservation preview', () => {
      let previewedResId = null;
      const item67 = {
        title: 'تفاصيل الحجز #67 • شمس تبريز احمد (غرفة 208)',
        subtitle: 'الحالة: مؤكد • الوصول: 2026-10-05 • المغادرة: 2026-11-04 • المتبقي: 866.67 ر.س',
        badge: 'مؤكد'
      };

      const env = createCommandPaletteEnv(
        { reservationsCache: [res67] },
        { openReservationPreview: (id) => { previewedResId = id; } }
      );

      const resolved = env.CommandPalette.resolveRecentActionItem(item67, { reservations: [res67] });
      assert.ok(resolved);
      resolved.actionFn();
      assert.equal(previewedResId, 67);
    });

    await t2.test('Extend stay recent item opens extend stay modal', () => {
      let extendedResId = null;
      const itemExtend = {
        title: 'تمديد إقامة النزيل: نور زمين خان شير • غرفة 204',
        subtitle: 'المغادرة المقررة: 2026-10-12 • فتح نافذة التمديد واحتساب الليالي',
        badge: 'تمديد فوري 📅'
      };

      const env = createCommandPaletteEnv(
        { reservationsCache: [res204] },
        {}
      );
      env.window.openExtendStayModal = (id) => { extendedResId = id; };

      const resolved = env.CommandPalette.resolveRecentActionItem(itemExtend, { reservations: [res204] });
      assert.ok(resolved);
      resolved.actionFn();
      assert.equal(extendedResId, 2040);
    });

    await t2.test('Transfer room recent item opens transfer room modal', () => {
      let transferredResId = null;
      const itemTransfer = {
        title: 'نقل النزيل إلى غرفة أخرى • غرفة 202',
        subtitle: 'نقل النزيل (عبدالرحمن حمد احمد ال ابوالسعود حكمي) إلى غرفة بديلة مع الاحتفاظ بالسعر',
        badge: 'نقل الغرفة',
        actionType: 'transfer',
        actionPayload: { reservationId: 2020, roomNumber: '202' }
      };

      const env = createCommandPaletteEnv(
        { reservationsCache: [res202] },
        {}
      );
      env.window.openTransferRoomModal = (id) => { transferredResId = id; };

      const resolved = env.CommandPalette.resolveRecentActionItem(itemTransfer, { reservations: [res202] });
      assert.ok(resolved);
      resolved.actionFn();
      assert.equal(transferredResId, 2020);
    });

    await t2.test('Record recent item automatically populates actionType for occupied room', () => {
      const env = createCommandPaletteEnv(
        { reservationsCache: [res202], roomsCache: [room202] },
        {}
      );

      const newItem = {
        title: 'غرفة 202 (مشغولة) • النزيل: عبدالرحمن حمد احمد ال ابوالسعود حكمي',
        subtitle: 'الجوال: 0583409941 • المغادرة: 2026-11-10',
        badge: 'مشغولة',
        actionFn: () => {}
      };

      env.CommandPalette.recordRecentItem(newItem);
      const stored = env.CommandPalette.getRecentItems();
      assert.equal(stored.length, 1);
      assert.equal(stored[0].actionType, 'preview');
      assert.equal(stored[0].actionPayload.roomNumber, '202');
      assert.equal(stored[0].actionPayload.reservationId, 2020);
    });
  });

  await t.test('Escape (ESC) Hotkey Handling', async (t2) => {
    await t2.test('handlePaletteKeydown closes command palette on Escape', () => {
      let defaultPrevented = false;

      const mockModal = {
        style: { display: 'flex' },
        addEventListener: () => {},
        querySelectorAll: () => [],
        querySelector: () => null
      };
      const mockInput = {
        value: '',
        focus: () => {},
        select: () => {},
        addEventListener: () => {}
      };
      const mockResults = {
        innerHTML: '',
        querySelectorAll: () => []
      };

      const documentMock = {
        readyState: 'complete',
        getElementById: (id) => {
          if (id === 'command-palette-modal') return mockModal;
          if (id === 'command-palette-input') return mockInput;
          if (id === 'command-palette-results') return mockResults;
          return null;
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {}
      };

      const windowMock = {
        DashboardApp: {
          State: { reservationsCache: [], roomsCache: [], guestsCache: [] },
          Helpers: {
            getLocalDateString: () => '2026-10-08',
            isLateCheckout: () => false,
            getExpectedCheckoutTime: () => '14:00',
            escapeHtml: (s) => String(s || '')
          }
        },
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} },
        addEventListener: () => {},
        setTimeout: (fn) => fn(),
        setInterval: () => {}
      };

      const code = fs.readFileSync(path.resolve(__dirname, '../command-palette.js'), 'utf8');
      vm.runInNewContext(code, {
        window: windowMock,
        document: documentMock,
        localStorage: windowMock.localStorage,
        console,
        setTimeout: (fn) => fn(),
        clearTimeout: () => {}
      });

      const App = windowMock.DashboardApp;
      App.CommandPalette.open();
      assert.equal(mockModal.style.display, 'flex');

      const event = {
        key: 'Escape',
        preventDefault: () => { defaultPrevented = true; }
      };

      App.CommandPalette.handlePaletteKeydown(event);
      assert.equal(mockModal.style.display, 'none');
      assert.equal(defaultPrevented, true);
    });

    await t2.test('hotkeys.js Escape dismisses visible modal even when command-palette-results role=listbox is present', () => {
      let modalClosed = false;
      const fakeCloseBtn = {
        disabled: false,
        click: () => { modalClosed = true; }
      };

      const mockModal = {
        hidden: false,
        getAttribute: (attr) => attr === 'aria-hidden' ? 'false' : null,
        classList: { contains: () => false },
        matches: () => false,
        querySelectorAll: (selector) => {
          if (selector.includes('input')) return [];
          if (selector.includes('button')) return [fakeCloseBtn];
          return [];
        },
        querySelector: (selector) => {
          if (selector.includes('[data-modal-close]') || selector.includes('button')) {
            return fakeCloseBtn;
          }
          return null;
        },
        getClientRects: () => [{ width: 100, height: 100 }]
      };

      const mockPaletteResults = {
        id: 'command-palette-results',
        getAttribute: (attr) => attr === 'role' ? 'listbox' : null,
        hidden: false
      };

      const listeners = [];
      const windowMock = {
        __rayhanaFrontDeskHotkeysRegistered: false,
        __rayhanaFrontDeskHotkeysInitialized: false,
        getComputedStyle: () => ({ display: 'block', visibility: 'visible', zIndex: '100' }),
        confirm: () => true,
        localStorage: { getItem: () => null },
        setTimeout: (fn) => fn()
      };

      const documentMock = {
        readyState: 'complete',
        addEventListener: (event, handler) => {
          if (event === 'keydown') listeners.push(handler);
        },
        querySelector: (sel) => {
          // If query excludes #command-palette-results, it should NOT find mockPaletteResults
          if (sel.includes(':not(#command-palette-results)')) {
            return null;
          }
          if (sel.includes('role="listbox"')) {
            return mockPaletteResults;
          }
          return null;
        },
        querySelectorAll: (sel) => {
          if (sel.includes('.modal-backdrop')) {
            return [mockModal];
          }
          return [];
        },
        getElementById: () => null,
        body: { appendChild: () => {} }
      };

      class MockMutationObserver {
        observe() {}
        disconnect() {}
      }

      const hotkeysCode = fs.readFileSync(path.resolve(__dirname, '../hotkeys.js'), 'utf8');
      vm.runInNewContext(hotkeysCode, {
        window: windowMock,
        document: documentMock,
        MutationObserver: MockMutationObserver,
        console
      });

      assert.equal(listeners.length, 1);
      const keydownHandler = listeners[0];

      const escEvent = {
        key: 'Escape',
        code: 'Escape',
        target: mockModal,
        preventDefault: () => {},
        stopImmediatePropagation: () => {}
      };

      keydownHandler(escEvent);
      assert.equal(modalClosed, true, 'Modal close button should have been clicked on Escape');
    });
  });
});

