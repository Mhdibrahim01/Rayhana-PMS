window.DashboardApp = {
  State: {
    testVar: 0,
    currentUser: null,
    businessDate: null,
    hotelTimezone: 'Asia/Riyadh',
    roomsCache: [],
    guestsCache: [],
    usersCache: [],
    logsCache: [],
    monthlyRevenueChart: null,
    roomStatusChart: null,
    reservationsCache: [],
    todayCheckoutsRows: [],
    todayCheckoutsActiveFilter: "all",
    branding: null,
    brands: {},
    activeBrandId: 'hotel_1'
  },
  DOM: {},
  Helpers: {}
};

(function(App) {
  "use strict";

  const ARABIC_MONTHS = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  App.Helpers.ARABIC_MONTHS = ARABIC_MONTHS;

  function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getHotelBusinessDate(d = new Date(), cutoffHour = 6) {
    const date = new Date(d);
    if (date.getHours() < cutoffHour) {
      date.setDate(date.getDate() - 1);
    }
    return getLocalDateString(date);
  }

  function getHotelTimezone() {
    return App.State.hotelTimezone || 'Asia/Riyadh';
  }

  function formatHotelDateTime(dateOrString) {
    if (!dateOrString) return '-';
    const tz = getHotelTimezone();
    const d = typeof dateOrString === 'string' ? parseStoredTimestamp(dateOrString) : dateOrString;
    if (!d || Number.isNaN(d.getTime())) return '-';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(d);
    const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
  }

  function isLateCheckout(reservation, operationalDate) {
    if (!reservation || reservation.status !== 'مؤكد') return false;
    const checkOutDate = String(reservation.check_out_date || '').slice(0, 10);
    if (!checkOutDate || checkOutDate === 'مفتوح' || reservation.booking_type === 'عقد مفتوح') return false;

    const businessToday = String(operationalDate || App.State?.businessDate || '');
    if (businessToday && checkOutDate < businessToday) return true;

    // Use the configured hotel timezone cutoff (default 14:00, or 18:00 for day use / late checkout)
    const expectedTime = getExpectedCheckoutTime(reservation);
    const [cutoffHour, cutoffMinute] = (expectedTime || '14:00').split(':').map(Number);

    let currentCalendarDate;
    let currentHour;
    let currentMinute;
    try {
      const tz = getHotelTimezone();
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
      currentCalendarDate = `${p.year}-${p.month}-${p.day}`;
      currentHour = Number(p.hour || 0);
      currentMinute = Number(p.minute || 0);
    } catch (_) {
      const now = new Date();
      currentCalendarDate = getLocalDateString(now);
      currentHour = now.getHours();
      currentMinute = now.getMinutes();
    }

    if (currentCalendarDate > checkOutDate) return true;
    if (currentCalendarDate < checkOutDate) return false;

    return currentHour > cutoffHour || (currentHour === cutoffHour && currentMinute >= (cutoffMinute || 0));
  }

  function getCheckoutDelayHours(reservation, operationalDate) {
    if (!reservation || !isLateCheckout(reservation, operationalDate)) return 0;
    const checkOutDate = String(reservation.check_out_date || '').slice(0, 10);
    if (!checkOutDate || checkOutDate === 'مفتوح' || reservation.booking_type === 'عقد مفتوح') return 0;

    const expectedTime = getExpectedCheckoutTime(reservation);
    const [cutoffHour, cutoffMinute] = (expectedTime || '14:00').split(':').map(Number);

    const tz = getHotelTimezone();
    let currY, currM, currD, currHour, currMinute;
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
      currY = Number(p.year);
      currM = Number(p.month);
      currD = Number(p.day);
      currHour = Number(p.hour || 0);
      currMinute = Number(p.minute || 0);
    } catch (_) {
      const now = new Date();
      currY = now.getFullYear();
      currM = now.getMonth() + 1;
      currD = now.getDate();
      currHour = now.getHours();
      currMinute = now.getMinutes();
    }

    const [outY, outM, outD] = checkOutDate.split('-').map(Number);
    const deadlineMs = Date.UTC(outY, outM - 1, outD, cutoffHour || 14, cutoffMinute || 0, 0);
    const currentMs = Date.UTC(currY, currM - 1, currD, currHour, currMinute, 0);

    return Math.max(0, Math.floor((currentMs - deadlineMs) / 3600000));
  }

  function getExpectedCheckoutTime(reservation) {
    if (!reservation) return '';
    const isConfirmed = reservation.status === 'مؤكد';
    if (!isConfirmed) return '';

    const checkOutDate = String(reservation.check_out_date || '').slice(0, 10);
    const isContract = reservation.booking_type === 'عقد مفتوح' || !checkOutDate || checkOutDate === 'مفتوح';
    if (isContract) return '';

    if (reservation.booking_type === 'استخدام يومي') {
      return '18:00';
    }

    if (Number(reservation.late_checkout_fee || 0) > 0) {
      return '18:00';
    }

    return '14:00';
  }

  function isReservationOverdue(reservation) {
    return isLateCheckout(reservation);
  }

  function getReservationFinancials(reservation, operationalDate) {
    if (!reservation) {
      return {
        total: 0,
        effectiveTotal: 0,
        paid: 0,
        deposit: 0,
        legacyDeposit: 0,
        rawRemaining: 0,
        remaining: 0,
        isCredit: false,
        hasUnpaidBalance: false,
        paymentStatus: 'غير مدفوع',
        isOverdue: false,
        overdueDays: 0,
        elapsedStayNights: 0
      };
    }

    const isConfirmed = reservation.status === 'مؤكد';
    const isContract = reservation.booking_type === 'عقد مفتوح';
    const total = parseFloat(reservation.total_price || 0);
    const paid = parseFloat((reservation.ledger_paid_amount ?? reservation.paid_amount) || 0);
    const deposit = parseFloat(reservation.deposit_ledger_balance || 0);
    const legacyDeposit = Number(reservation.deposit_legacy_unreconciled || 0) === 1 ? parseFloat(reservation.deposit_amount || 0) : 0;

    const businessToday = operationalDate || window?.DashboardApp?.State?.businessDate || getLocalDateString();
    const overdueDate = String(reservation.check_out_date || '').slice(0, 10);
    const overdueDays = overdueDate
      ? Math.max(0, Math.floor((Date.parse(`${businessToday}T00:00:00Z`) - Date.parse(`${overdueDate}T00:00:00Z`)) / 86400000))
      : 0;
    const isOverdue = isConfirmed && !isContract && overdueDays > 0;
    const nightlyRate = parseFloat(reservation.custom_nightly_price || reservation.price_per_night || 0);

    let effectiveTotal = total;
    let elapsedStayNights = 0;
    if (isConfirmed && (isOverdue || isContract) && reservation.check_in_date) {
      if (reservation.running_total !== undefined && reservation.running_total !== null) {
        effectiveTotal = Math.max(total, parseFloat(reservation.running_total || 0));
      } else if (nightlyRate > 0) {
        const startParts = String(reservation.check_in_date).slice(0, 10).split('-').map(Number);
        const endParts = businessToday.slice(0, 10).split('-').map(Number);
        elapsedStayNights = Math.max(1, Math.round((Date.UTC(endParts[0], endParts[1] - 1, endParts[2]) - Date.UTC(startParts[0], startParts[1] - 1, startParts[2])) / 86400000));
        const runningTotal = Math.max(0, Math.round((elapsedStayNights * nightlyRate - parseFloat(reservation.discount_amount || 0)) * 100) / 100);
        effectiveTotal = Math.max(total, runningTotal);
      }
    }

    const effectiveRawRemaining = Math.round((effectiveTotal - paid) * 100) / 100;
    const isCredit = effectiveRawRemaining < -0.005;
    const remaining = Math.max(0, effectiveRawRemaining);
    const hasUnpaidBalance = remaining > 0.005;

    let paymentStatusForDisplay;
    if (isContract || isOverdue) {
      paymentStatusForDisplay = isCredit ? 'رصيد دائن' : (remaining <= 0.005 ? 'مدفوع بالكامل' : (paid > 0 ? 'مدفوع جزئياً' : 'غير مدفوع'));
    } else {
      paymentStatusForDisplay = isCredit ? 'مدفوع بالكامل' : (reservation.payment_status || 'غير مدفوع');
    }

    return {
      total,
      effectiveTotal,
      paid,
      deposit,
      legacyDeposit,
      rawRemaining: effectiveRawRemaining,
      remaining,
      isCredit,
      hasUnpaidBalance,
      paymentStatus: paymentStatusForDisplay,
      isOverdue,
      overdueDays,
      elapsedStayNights
    };
  }

  function renderOverdueBadge(reservation, label = 'متأخر عن المغادرة') {
    return isLateCheckout(reservation)
      ? `<span class="late-checkout-badge"><span aria-hidden="true">⚠️</span>${escapeHtml(label)}</span>`
      : '';
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconMap = {
      success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
      error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
      info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    toast.innerHTML = `
      ${iconMap[type] || iconMap.info}
      <span style="flex: 1;">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function getReservationStatusBadge(status) {
    if (status === 'مؤكد') {
      return `<span class="badge badge-unified badge-confirmed badge-res-confirmed">حجز مؤكد</span>`;
    } else if (status === 'مكتمل') {
      return `<span class="badge badge-unified badge-completed badge-res-completed">مكتمل</span>`;
    } else if (status === 'ملغي') {
      return `<span class="badge badge-unified badge-cancelled badge-res-cancelled">ملغي</span>`;
    } else if (status === 'ملغي جزئي') {
      return `<span class="badge badge-unified badge-res-partial-cancelled">ملغي جزئياً</span>`;
    }
    return `<span class="badge badge-unified">${escapeHtml(status)}</span>`;
  }

  function getPaymentStatusBadge(status) {
    if (status === 'مدفوع بالكامل' || status === 'مكتمل') {
      return `<span class="badge badge-unified badge-paid-full badge-pay-paid">مدفوع بالكامل ✓</span>`;
    } else if (status === 'رصيد دائن') {
      return `<span class="badge badge-unified badge-fin-credit">رصيد دائن 💳</span>`;
    } else if (status === 'مدفوع جزئياً') {
      return `<span class="badge badge-unified badge-paid-partial badge-pay-partial">مدفوع جزئياً</span>`;
    } else {
      return `<span class="badge badge-unified badge-unpaid badge-pay-unpaid">غير مدفوع</span>`;
    }
  }

  function getBookingTypeBadge(type) {
    if (type === 'عقد مفتوح') {
      return `<span class="badge badge-unified" style="background: rgba(14, 165, 233, 0.12); color: #0284c7; border: 1px solid rgba(14, 165, 233, 0.3); font-size: 0.72rem; font-weight: 800; padding: 2px 7px;">عقد مفتوح 📋</span>`;
    } else if (type === 'حجز شهري') {
      return `<span class="badge badge-unified" style="background: rgba(168, 85, 247, 0.12); color: #9333ea; border: 1px solid rgba(168, 85, 247, 0.3); font-size: 0.72rem; font-weight: 800; padding: 2px 7px;">حجز شهري 📅</span>`;
    } else if (type === 'استخدام يومي') {
      return `<span class="badge badge-unified" style="background: rgba(16, 185, 81, 0.12); color: #047831; border: 1px solid rgba(16, 185, 81, 0.3); font-size: 0.72rem; font-weight: 800; padding: 2px 7px;">استخدام يومي ☀️</span>`;
    }
    return '';
  }

  function getRoomStatusBadge(status) {
    if (status === 'متاحة') {
      return `<span class="badge badge-unified badge-available badge-room-available">متاحة (جاهزة)</span>`;
    } else if (status === 'مشغولة') {
      return `<span class="badge badge-unified badge-occupied badge-room-occupied">مشغولة</span>`;
    } else if (status === 'تنظيف') {
      return `<span class="badge badge-unified badge-cleaning badge-room-cleaning">قيد التنظيف</span>`;
    } else if (status === 'محجوزة') {
      return `<span class="badge badge-unified badge-reserved badge-room-reserved">محجوزة (قادمة)</span>`;
    }
    return `<span class="badge badge-unified">${escapeHtml(status)}</span>`;
  }

  function formatArabicDateRange(startStr, endStr) {
    if (!startStr) return '';
    if (!endStr || startStr === endStr) {
      const parts = startStr.split('-').map(Number);
      if (parts.length !== 3 || isNaN(parts[0])) return startStr;
      const [y, m, d] = parts;
      return `${d} ${ARABIC_MONTHS[m - 1] || ''} ${y}`;
    }
    const [y1, m1, d1] = startStr.split('-').map(Number);
    const [y2, m2, d2] = endStr.split('-').map(Number);
    if (y1 === y2) {
      if (m1 === m2) {
        return `${d1} - ${d2} ${ARABIC_MONTHS[m1 - 1] || ''} ${y1}`;
      }
      return `${d1} ${ARABIC_MONTHS[m1 - 1] || ''} - ${d2} ${ARABIC_MONTHS[m2 - 1] || ''} ${y1}`;
    }
    return `${d1} ${ARABIC_MONTHS[m1 - 1] || ''} ${y1} - ${d2} ${ARABIC_MONTHS[m2 - 1] || ''} ${y2}`;
  }

  function parseStoredTimestamp(timestamp) {
    if (!timestamp) return null;
    const raw = String(timestamp).trim();
    if (!raw) return null;

    // SQLite CURRENT_TIMESTAMP values are UTC but omit a timezone marker.
    // Parsing "YYYY-MM-DD HH:mm:ss" directly makes JavaScript treat it as
    // local time, which shifts the displayed date for post-midnight bookings.
    let normalized = raw.replace(' ', 'T');
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
    if (!hasTimezone && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized)) {
      normalized += 'Z';
    }

    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatArabicDateTime(isoString) {
    if (!isoString) return '-';
    try {
      const d = parseStoredTimestamp(isoString);
      if (!d) return isoString;
      const tz = getHotelTimezone();
      return d.toLocaleDateString('ar-EG', {
        timeZone: tz,
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) + ' ' + d.toLocaleTimeString('ar-EG', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function roundMoney(val) {
    const num = Number(val);
    if (!Number.isFinite(num)) return 0.0;
    const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
    return rounded === 0 ? 0 : rounded;
  }

  App.Helpers.roundMoney = roundMoney;
  window.roundMoney = roundMoney;
  App.Helpers.getLocalDateString = getLocalDateString;
  App.Helpers.getHotelBusinessDate = getHotelBusinessDate;
  window.getHotelBusinessDate = getHotelBusinessDate;
  App.Helpers.getHotelTimezone = getHotelTimezone;
  App.Helpers.formatHotelDateTime = formatHotelDateTime;
  App.Helpers.isLateCheckout = isLateCheckout;
  App.Helpers.getCheckoutDelayHours = getCheckoutDelayHours;
  App.Helpers.getExpectedCheckoutTime = getExpectedCheckoutTime;
  App.Helpers.isReservationOverdue = isReservationOverdue;
  App.Helpers.renderOverdueBadge = renderOverdueBadge;
  App.Helpers.showToast = showToast;
  App.Helpers.getReservationStatusBadge = getReservationStatusBadge;
  App.Helpers.getPaymentStatusBadge = getPaymentStatusBadge;
  App.Helpers.getBookingTypeBadge = getBookingTypeBadge;
  App.Helpers.getRoomStatusBadge = getRoomStatusBadge;
  App.Helpers.formatArabicDateRange = formatArabicDateRange;
  App.Helpers.formatArabicDateTime = formatArabicDateTime;
  App.Helpers.parseStoredTimestamp = parseStoredTimestamp;
  App.Helpers.getReservationFinancials = getReservationFinancials;
  function getActiveBrand() {
    return App.State.branding || {
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
      logo: 'assets/brands/hotel_1/logo.png',
      seal: 'assets/brands/hotel_1/seal.svg',
      signature: 'assets/brands/hotel_1/signature.svg',
      showSeal: true,
      showSignature: true
    };
  }

  function applyBranding(brand) {
    if (!brand) return;
    App.State.branding = brand;
    const logoEl = document.getElementById('sidebar-brand-logo');
    const titleEl = document.getElementById('sidebar-brand-title');
    const subEl = document.getElementById('sidebar-brand-subtitle');
    const topHeadingEl = document.getElementById('topbar-heading');
    const topSubheadingEl = document.getElementById('topbar-subheading');

    if (logoEl && brand.logo) logoEl.src = brand.logo;
    if (titleEl && brand.nameAr) titleEl.textContent = brand.nameAr;
    if (subEl && brand.nameEn) subEl.textContent = brand.nameEn;
    if (topHeadingEl && brand.nameAr) topHeadingEl.textContent = brand.nameAr;
    if (topSubheadingEl && brand.nameEn) topSubheadingEl.textContent = `${brand.nameEn} • لوحة التحكم وإدارة العمليات`;
    document.title = `لوحة التحكم | ${brand.nameAr} - ${brand.nameEn || ''}`;
  }

  const COMMON_NATIONALITIES = [
    'سعودي', 'إماراتي', 'كويتي', 'بحريني', 'عماني', 'قطري',
    'مصري', 'يمني', 'سوداني', 'سوري', 'أردني', 'لبناني',
    'فلسطيني', 'عراقي', 'مغربي', 'جزائري', 'تونسي',
    'هندي', 'باكستاني', 'بنجلاديشي', 'فلبيني', 'إندونيسي',
    'تركي', 'بريطاني', 'أمريكي', 'كندي', 'أوروبي'
  ];

  function setSelectNationality(selectEl, value) {
    if (!selectEl) return;
    const targetVal = (value || 'سعودي').trim();
    let found = false;
    for (let i = 0; i < selectEl.options.length; i++) {
      if (selectEl.options[i].value === targetVal) {
        selectEl.selectedIndex = i;
        found = true;
        break;
      }
    }
    if (!found && targetVal) {
      const opt = document.createElement('option');
      opt.value = targetVal;
      opt.textContent = targetVal;
      if (selectEl.lastElementChild) {
        selectEl.insertBefore(opt, selectEl.lastElementChild);
      } else {
        selectEl.appendChild(opt);
      }
      selectEl.value = targetVal;
    }
  }

  // Delegated handler for custom ("أخرى") nationality or relationship choice
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('change', (e) => {
      if (!e.target || !e.target.classList) return;
      if (e.target.classList.contains('nationality-select') && e.target.value === 'أخرى') {
        const custom = (typeof window !== 'undefined' && window.prompt) ? window.prompt('يرجى إدخال اسم الجنسية:') : null;
        if (custom && custom.trim()) {
          const val = custom.trim();
          let opt = Array.from(e.target.options).find(o => o.value === val);
          if (!opt) {
            opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            e.target.insertBefore(opt, e.target.lastElementChild);
          }
          e.target.value = val;
        } else {
          e.target.value = 'سعودي';
        }
      } else if (e.target.classList.contains('relationship-select') && e.target.value === 'أخرى') {
        const custom = (typeof window !== 'undefined' && window.prompt) ? window.prompt('يرجى تحديد صلة القرابة:') : null;
        if (custom && custom.trim()) {
          const val = custom.trim();
          let opt = Array.from(e.target.options).find(o => o.value === val);
          if (!opt) {
            opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            e.target.insertBefore(opt, e.target.lastElementChild);
          }
          e.target.value = val;
        } else {
          e.target.value = 'مرافق';
        }
      }
    });
  }

  const COMMON_RELATIONSHIPS = [
    'زوجة', 'زوج', 'ابن', 'ابنة', 'والد', 'والدة', 'أخ', 'أخت',
    'سائق', 'خادمة', 'مرافق شخصي', 'صديق', 'زميل عمل'
  ];

  function setSelectRelationship(selectEl, value) {
    if (!selectEl) return;
    const targetVal = (value || 'زوجة').trim();
    let found = false;
    for (let i = 0; i < selectEl.options.length; i++) {
      if (selectEl.options[i].value === targetVal) {
        selectEl.selectedIndex = i;
        found = true;
        break;
      }
    }
    if (!found && targetVal) {
      const opt = document.createElement('option');
      opt.value = targetVal;
      opt.textContent = targetVal;
      if (selectEl.lastElementChild) {
        selectEl.insertBefore(opt, selectEl.lastElementChild);
      } else {
        selectEl.appendChild(opt);
      }
      selectEl.value = targetVal;
    }
  }

  App.Helpers.COMMON_NATIONALITIES = COMMON_NATIONALITIES;
  App.Helpers.COMMON_RELATIONSHIPS = COMMON_RELATIONSHIPS;
  App.Helpers.setSelectNationality = setSelectNationality;
  App.Helpers.setSelectRelationship = setSelectRelationship;
  App.Helpers.getActiveBrand = getActiveBrand;
  App.Helpers.applyBranding = applyBranding;
  App.Helpers.escapeHtml = escapeHtml;
  window.setSelectNationality = setSelectNationality;
  window.setSelectRelationship = setSelectRelationship;

})(window.DashboardApp);
