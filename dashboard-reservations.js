(function(App) {
  'use strict';

  const reservationForm = document.getElementById('reservation-form');
  const guestNameInput = document.getElementById('guest-name');
  const guestPhoneInput = document.getElementById('guest-phone');
  const guestPhoneError = document.getElementById('guest-phone-error');
  const guestIdNumberInput = document.getElementById('guest-id-number');
  const guestIdError = document.getElementById('guest-id-error');
  const roomSelect = document.getElementById('room-select');
  const bookingTypeSelect = document.getElementById('booking-type');
  const checkInInput = document.getElementById('check-in-date');
  const checkOutInput = document.getElementById('check-out-date');
  const nightlyRateInput = document.getElementById('nightly-rate-input');
  const discountAmountInput = document.getElementById('discount-amount-input');
  const discountReasonInput = document.getElementById('discount-reason-input');
  const earlyCheckinContainer = document.getElementById('early-checkin-container');
  const isEarlyCheckinCheckbox = document.getElementById('is-early-checkin-checkbox');
  const roomDefaultRateBadge = document.getElementById('room-default-rate-badge');
  const priceCalculationBreakdown = document.getElementById('price-calculation-breakdown');
  const totalPriceInput = document.getElementById('total-price');
  const paymentMethodSelect = document.getElementById('payment-method');
  const paidAmountInput = document.getElementById('paid-amount');
  const depositAmountInput = document.getElementById('deposit-amount');
  const remainingBalanceVal = document.getElementById('remaining-balance-val');
  const btnClearForm = document.getElementById('btn-clear-form');
  const autofillGuestStatus = document.getElementById('autofill-guest-status');
  const autofillGuestMsg = document.getElementById('autofill-guest-msg');
  const bannedGuestWarning = document.getElementById('banned-guest-warning');
  const bannedGuestMsg = document.getElementById('banned-guest-msg');
  const newReservationModal = document.getElementById('new-reservation-modal');
  const btnOpenNewReservationModal = document.getElementById('btn-open-new-reservation-modal');
  const btnCloseNewReservation = document.getElementById('btn-close-new-reservation');
  const btnResNewBooking = document.getElementById('btn-res-new-booking');
  const btnBackupDb = document.getElementById('btn-backup-db');
  const btnRestoreDb = document.getElementById('btn-restore-db');
  const extendStayModal = document.getElementById('extend-stay-modal');
  const btnCloseExtendStay = document.getElementById('btn-close-extend-stay');
  const btnCancelExtendStay = document.getElementById('btn-cancel-extend-stay');
  const extendStayForm = document.getElementById('extend-stay-form');
  const extendResId = document.getElementById('extend-res-id');
  const extendGuestNamePreview = document.getElementById('extend-guest-name-preview');
  const extendRoomPreview = document.getElementById('extend-room-preview');
  const extendCurrentCheckoutPreview = document.getElementById('extend-current-checkout-preview');
  const extendNightlyRatePreview = document.getElementById('extend-nightly-rate-preview');
  const extendNewCheckoutDate = document.getElementById('extend-new-checkout-date');
  const extendExtraNightsPreview = document.getElementById('extend-extra-nights-preview');
  const extendAdditionalCostPreview = document.getElementById('extend-additional-cost-preview');
  const extendNewTotalPreview = document.getElementById('extend-new-total-preview');
  const extendCollectNowToggle = document.getElementById('extend-collect-now-toggle');
  const extendPaymentFields = document.getElementById('extend-payment-fields');
  const extendSettleAmount = document.getElementById('extend-settle-amount');
  const extendPaymentMethod = document.getElementById('extend-payment-method');
  const extendNightlyRateInput = document.getElementById('extend-nightly-rate-input');
  const extendDiscountInput = document.getElementById('extend-discount-input');
  const extendCalcRatePreview = document.getElementById('extend-calc-rate-preview');
  const extendDiscountBadge = document.getElementById('extend-discount-badge');
  const allReservationsTableBody = document.getElementById('all-reservations-table-body');
  const allReservationsEmpty = document.getElementById('all-reservations-empty');
  const reservationsPaymentTypeFilter = document.getElementById('reservations-payment-type-filter');
  const reservationsPagination = document.getElementById('reservations-pagination');
  const reservationsPaginationSummary = document.getElementById('reservations-pagination-summary');
  const reservationsPaginationPage = document.getElementById('reservations-pagination-page');
  const btnReservationsPrevPage = document.getElementById('btn-reservations-prev-page');
  const btnReservationsNextPage = document.getElementById('btn-reservations-next-page');
  const searchAllReservations = document.getElementById('search-all-reservations');
  const btnExportReservationsExcel = document.getElementById('btn-export-reservations-excel');
  const inputImportReservationsExcel = document.getElementById('input-import-reservations-excel');
  const btnToggleAddCustomer = document.getElementById('btn-toggle-add-customer');
  const addCustomerPanel = document.getElementById('add-customer-panel');
  const addCustomerForm = document.getElementById('add-customer-form');
  const btnCancelAddCustomer = document.getElementById('btn-cancel-add-customer');
  const newCustomerName = document.getElementById('new-customer-name');
  const newCustomerPhone = document.getElementById('new-customer-phone');
  const newCustomerId = document.getElementById('new-customer-id');
  const checkOutStar = document.getElementById('check-out-required-star');
  const checkOutHint = document.getElementById('check-out-open-hint');
  const checkOutMinimumHint = document.getElementById('check-out-minimum-hint');
  const checkOutDayUseHint = document.getElementById('check-out-day-use-hint');
  const priceHint = document.getElementById('total-price-open-hint');
  const bookingRateLabel = document.getElementById('booking-rate-label');
  const addPaymentModal = document.getElementById('add-payment-modal');
  const addPaymentForm = document.getElementById('add-payment-form');
  const paymentReservationId = document.getElementById('payment-reservation-id');
  const paymentModalGuestName = document.getElementById('payment-modal-guest-name');
  const paymentModalRoomInfo = document.getElementById('payment-modal-room-info');
  const paymentModalTotalPrice = document.getElementById('payment-modal-total-price');
  const paymentModalPaidAmount = document.getElementById('payment-modal-paid-amount');
  const paymentModalRemainingBalance = document.getElementById('payment-modal-remaining-balance');
  const paymentNewAmount = document.getElementById('payment-new-amount');
  const paymentMethodSelectModal = document.getElementById('payment-method-select-modal');
  const btnClosePaymentModal = document.getElementById('btn-close-payment-modal');
  const btnCancelPaymentModal = document.getElementById('btn-cancel-payment-modal');
  const btnPayFullRemaining = document.getElementById('btn-pay-full-remaining');
  const inputResId = document.getElementById('payment-reservation-id');
  const nameEl = document.getElementById('payment-modal-guest-name');
  const roomEl = document.getElementById('payment-modal-room-info');
  const totalEl = document.getElementById('payment-modal-total-price');
  const paidEl = document.getElementById('payment-modal-paid-amount');
  const remEl = document.getElementById('payment-modal-remaining-balance');
  const inputAmount = document.getElementById('payment-new-amount');
  const openContractSettleModalEl = document.getElementById('open-contract-settle-modal');
  const openContractSettleForm = document.getElementById('open-contract-settle-form');
  const settleReservationId = document.getElementById('settle-reservation-id');
  const settlePricePerNightInput = document.getElementById('settle-price-per-night');
  const settleGuestName = document.getElementById('settle-guest-name');
  const settleRoomInfo = document.getElementById('settle-room-info');
  const settleCheckinDate = document.getElementById('settle-checkin-date');
  const settleCheckoutDate = document.getElementById('settle-checkout-date');
  const settleNightsCount = document.getElementById('settle-nights-count');
  const settleNightsLabel = document.getElementById('settle-nights-label');
  const settleRateCalculationHint = document.getElementById('settle-rate-calculation-hint');
  const settleTotalPriceDisplay = document.getElementById('settle-total-price-display');
  const settlePaidAmountDisplay = document.getElementById('settle-paid-amount-display');
  const settleBalanceBox = document.getElementById('settle-balance-box');
  const settleBalanceLabel = document.getElementById('settle-balance-label');
  const settleBalanceValue = document.getElementById('settle-balance-value');
  const settleBalanceSub = document.getElementById('settle-balance-sub');
  const settleDiscountSection = document.getElementById('settle-discount-section');
  const settleDiscountInput = document.getElementById('settle-discount-input');
  const settleDiscountReasonInput = document.getElementById('settle-discount-reason-input');
  const settlePolicySection = document.getElementById('settle-policy-section');
  const settlePolicySummary = document.getElementById('settle-policy-summary');
  const settlePolicyContract = document.getElementById('settle-policy-contract');
  const settlePolicyActual = document.getElementById('settle-policy-actual');
  const settlePolicyReasonWrap = document.getElementById('settle-policy-reason-wrap');
  const settlePolicyReasonInput = document.getElementById('settle-policy-reason-input');
  const settleBreakdownHint = document.getElementById('settle-breakdown-hint');
  const settleFinalTotalInput = document.getElementById('settle-final-total-input');
  const settleLateCheckoutSection = document.getElementById('settle-late-checkout-section');
  const settleLateCheckoutFeeInput = document.getElementById('settle-late-checkout-fee');
  const settlePaymentSection = document.getElementById('settle-payment-section');
  const settlePayNowInput = document.getElementById('settle-pay-now-input');
  const settlePaymentMethodSelect = document.getElementById('settle-payment-method-select');
  const settleRefundBanner = document.getElementById('settle-refund-banner');
  const settleRefundAmount = document.getElementById('settle-refund-amount');
  const settleRefundAmountInput = document.getElementById('settle-refund-amount-input');
  const settleRefundMethodSelect = document.getElementById('settle-refund-method-select');
  const settleDepositSection = document.getElementById('settle-deposit-section');
  const settleDepositHeld = document.getElementById('settle-deposit-held');
  const settleDepositDisposition = document.getElementById('settle-deposit-disposition');
  const settleDepositRetainFields = document.getElementById('settle-deposit-retain-fields');
  const settleDepositRetainAmount = document.getElementById('settle-deposit-retain-amount');
  const settleDepositRetainReason = document.getElementById('settle-deposit-retain-reason');
  const settleDepositLegacyWarning = document.getElementById('settle-deposit-legacy-warning');
  const btnReconcileLegacyDeposit = document.getElementById('btn-reconcile-legacy-deposit');
  const btnCloseSettleModal = document.getElementById('btn-close-settle-modal');
  const btnCancelSettle = document.getElementById('btn-cancel-settle');
  const btnCheckoutWithoutSettle = document.getElementById('btn-checkout-without-settle');
  const btnConfirmSettleCheckout = document.getElementById('btn-confirm-settle-checkout');
  const btnSubmit = document.getElementById('btn-confirm-extend-stay');
  const resFilterTabs = document.querySelectorAll('#res-filter-tabs .res-tab-item, #res-filter-tabs .filter-tab-btn');
  const ARABIC_MONTHS = App.Helpers.ARABIC_MONTHS;
  function roundMoney(val) { return App.Helpers.roundMoney(val); }
  function getLocalDateString(d) { return App.Helpers.getLocalDateString(d); }

  /**
   * Calendar month package: the checkout date that ends one full calendar month.
   *
   * 2026-07-03 -> 2026-08-03, 2026-01-15 -> 2026-02-15.
   * When the target month is shorter than the check-in day, clamp to that month's
   * last day: 2026-01-31 -> 2026-02-28, 2028-01-31 -> 2028-02-29 (leap year).
   *
   * This replaces the old "check-in + 30 days" rule, which drifted from the calendar
   * month (2026-07-03 + 30 = 2026-08-02, one day short of the month it was meant to
   * book) and could never represent a 31-day span at all.
   */
  function getCalendarMonthCheckOut(checkInDateStr) {
    if (!checkInDateStr) return '';
    const parts = String(checkInDateStr).split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return '';
    const [y, m, d] = parts;

    // m is the 1-based check-in month, so the next month is 0-based index m.
  // new Date(y, m + 1, 0) is day 0 of the month AFTER that -> its .getDate() is the
  // next month's last day, which is what we clamp against.
  const lastDayOfNextMonth = new Date(y, m + 1, 0).getDate();
  const clampedDay = Math.min(d, lastDayOfNextMonth);
  // Let Date normalise month index 12 back into January of the following year.
  const nextMonthStart = new Date(y, m, 1);
  const nextY = nextMonthStart.getFullYear();
  const nextM = nextMonthStart.getMonth() + 1;
  return `${nextY}-${String(nextM).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
  }

  // Kept for legacy invoice display; newly created monthly bookings use a flat
  // room-specific monthly amount saved on the reservation.
  const MONTHLY_PACKAGE_NIGHTS = 30;
  function getMonthlyPackageTotal(effectiveRate, discount) {
    return Math.max(0, roundMoney(effectiveRate - (discount || 0)));
  }
  function getOperationalBusinessDate() {
    return App.State.businessDate || '';
  }
  function addIsoCalendarDay(value) {
    const [year, month, day] = String(value).split('-').map(Number);
    const next = new Date(year, month - 1, day, 12);
    next.setDate(next.getDate() + 1);
    return getLocalDateString(next);
  }
  function getDefaultBookingDates(businessDate = getOperationalBusinessDate()) {
    const checkIn = businessDate;
    return { checkIn, checkOut: addIsoCalendarDay(checkIn) };
  }
  function isReservationOverdue(res) { return App.Helpers.isReservationOverdue(res); }
  function renderOverdueBadge(isOverdue) { return App.Helpers.renderOverdueBadge(isOverdue); }
  function showToast(message, type = "info") { return App.Helpers.showToast(message, type); }
  function formatArabicDateRange(startDateStr, endDateStr) { return App.Helpers.formatArabicDateRange(startDateStr, endDateStr); }
  function formatArabicDateTime(dateString, includeTime = true) { return App.Helpers.formatArabicDateTime(dateString, includeTime); }
  function getActualCheckinCalendarDate(reservation) {
    const timestamp = reservation.actual_check_in_at || reservation.created_at;
    const fallbackDate = reservation.check_in_date || '-';
    if (!timestamp) return fallbackDate;
    const parsed = App.Helpers.parseStoredTimestamp(timestamp);
    if (!parsed || Number.isNaN(parsed.getTime())) return fallbackDate;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: App.Helpers.getHotelTimezone(),
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(parsed);
    const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
  function escapeHtml(str) { return App.Helpers.escapeHtml(str); }
  function showConfirmDialog(opts) { return App.Helpers.showConfirmDialog(opts); }
  function showPromptDialog(opts) { return App.Helpers.showPromptDialog(opts); }
  function openInvoiceModal(id) { return window.openInvoiceModal(id); }
  function openShiftAuditModal() { return window.openShiftAuditModal(); }
  function openDailyBackupModal() { return window.openDailyBackupModal(); }
  function sendReservationWhatsApp(id) { return window.sendReservationWhatsApp(id); }

  let currentReservationFilter = 'all';
  let currentSortBy = 'id_desc';
  let reservationsTableRows = [];
  let reservationsTableTotal = 0;
  let reservationsTablePage = 1;
  let reservationsTablePageSize = 50;
  let reservationsTableRequestId = 0;
  let reservationsSearchDebounce = null;

  function findLoadedReservation(reservationId) {
    const targetId = Number(reservationId);
    return reservationsTableRows.find(item => Number(item.id) === targetId)
      || window.DashboardApp.State.reservationsCache.find(item => Number(item.id) === targetId)
      || null;
  }

  function showMidStayCancelModal(targetRes) {
    return new Promise((resolve) => {
      let modal = document.getElementById('midstay-cancel-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'midstay-cancel-modal';
        modal.className = 'modal-backdrop';
        modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); z-index: 1000000; align-items: center; justify-content: center; padding: 20px; overflow-y: auto;';
        document.body.appendChild(modal);
      }

      let nightlyRate = Number(targetRes.custom_nightly_price || targetRes.price_per_night || 0);
      if (!nightlyRate && window.DashboardApp.State.roomsCache && window.DashboardApp.State.roomsCache.length > 0) {
        const rm = window.DashboardApp.State.roomsCache.find(r => r.id === targetRes.room_id || r.room_number === targetRes.room_number);
        if (rm && rm.price_per_night) nightlyRate = Number(rm.price_per_night);
      }

      const todayStr = getOperationalBusinessDate() || getLocalDateString();
      const checkInDate = targetRes.check_in_date || todayStr;
      const activeRole = localStorage.getItem('currentUserRole') || (App.State.currentUser ? App.State.currentUser.role : null);
      const isAdmin = activeRole === 'Admin';

      modal.innerHTML = `
        <div class="modal-glass-container" style="background: #ffffff; border-radius: 16px; max-width: 540px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden; margin: auto; border: 1px solid #e2e8f0; direction: rtl; text-align: right;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1a432a 0%, #112d1c 100%); color: white; padding: 16px 22px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(239, 68, 68, 0.2); color: #fca5a5; display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </div>
              <div>
                <h3 style="font-size: 1.1rem; font-weight: 800; margin: 0; color: #ffffff;">إلغاء حجز أثناء الإقامة وتصفية الحساب</h3>
                <p style="font-size: 0.76rem; color: #a7f3c4; margin: 2px 0 0;">الحجز #${targetRes.id} • ${escapeHtml(targetRes.guest_name || 'نزيل')}</p>
              </div>
            </div>
            <button id="btn-midstay-close" type="button" style="background: rgba(255,255,255,0.15); color: white; border: none; font-size: 1.3rem; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer;">&times;</button>
          </div>

          <!-- Body -->
          <div style="padding: 20px; max-height: calc(85vh - 75px); overflow-y: auto;">
            <!-- Info Strip -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.84rem;">
              <div><span style="color: #64748b;">الوحدة:</span> <strong>غرفة ${escapeHtml(targetRes.room_number || '-')}</strong> <span style="font-size: 0.74rem; color: #94a3b8;">(${escapeHtml(targetRes.room_type || '')})</span></div>
              <div><span style="color: #64748b;">تاريخ الوصول:</span> <strong style="font-family: monospace;">${escapeHtml(checkInDate)}</strong></div>
              <div><span style="color: #64748b;">سعر الليلة:</span> <strong>${Number(nightlyRate).toLocaleString()} ريال</strong></div>
              <div><span style="color: #64748b;">المبلغ المدفوع:</span> <strong style="color: #05963d;">${Number(targetRes.paid_amount || 0).toLocaleString()} ريال</strong></div>
            </div>

            <!-- Departure Date Input -->
            <div style="margin-bottom: 16px;">
              <label for="midstay-dep-date" style="display: block; font-weight: 700; font-size: 0.88rem; color: #1e293b; margin-bottom: 6px;">
                تاريخ المغادرة الفعلي:
              </label>
              <input type="date" id="midstay-dep-date" value="${todayStr}" min="${checkInDate}" style="width: 100%; padding: 9px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-weight: 700; font-size: 0.95rem; font-family: monospace; box-sizing: border-box;">
              <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 4px;">افتراضياً تاريخ اليوم. يمكنك تعديل تاريخ المغادرة إذا غادر النزيل في تاريخ سابق.</div>
            </div>

            <!-- Auto Calculation Card -->
            <div style="background: #f0fdf5; border: 1px solid #bbf7d2; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 0.85rem;">
                <span style="color: #166535;">عدد الليالي المحتسبة:</span>
                <strong id="midstay-days-count" style="color: #166535; font-size: 1rem;">-</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                <span style="color: #166535;">قيمة الإقامة المحتسبة تلقائياً:</span>
                <strong id="midstay-auto-charge" style="color: #166535; font-size: 1.05rem; font-family: monospace;">- ريال</strong>
              </div>
            </div>

            ${isAdmin ? `
            <!-- Admin Override Section (Admin Only) -->
            <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <label for="midstay-override-input" style="font-weight: 700; font-size: 0.86rem; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 6px;">
                  <span style="background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800;">مدير النظام فقط</span>
                  تعديل المبلغ المستحق يدوياً (اختياري):
                </label>
              </div>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0 0 8px 0;">يمكنك تجاوز الحساب التلقائي وتحديد مبلغ إجمالي مخصص للإقامة. سيتم توثيق الحساب الأصلي للتدقيق.</p>
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="number" id="midstay-override-input" step="0.01" min="0" placeholder="اتركه فارغاً للاعتماد على الحساب التلقائي" style="flex: 1; padding: 9px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-weight: 700; font-size: 0.95rem; box-sizing: border-box;">
                <span style="font-weight: 700; color: #64748b; font-size: 0.88rem;">ريال</span>
              </div>
            </div>
            ` : ''}

            <!-- Settlement Outcome Preview -->
            <div style="border-top: 1px solid #e2e8f0; padding-top: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.9rem;">
                <span style="font-weight: 700; color: #1e293b;">المبلغ الإجمالي المعتمد للإقامة:</span>
                <strong id="midstay-final-total" style="font-size: 1.1rem; color: #1e293b;">- ريال</strong>
              </div>
              <div id="midstay-outcome-badge" style="padding: 10px 14px; border-radius: 8px; font-weight: 700; font-size: 0.88rem; text-align: center;">
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div style="padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; gap: 10px; justify-content: flex-end;">
            <button id="btn-midstay-cancel" type="button" class="btn btn-secondary" style="flex: 1; padding: 10px; font-weight: 700;">تراجع</button>
            <button id="btn-midstay-confirm" type="button" class="btn btn-danger" style="flex: 1; padding: 10px; font-weight: 800; background: #dc2626; color: white; border: none; border-radius: 8px; cursor: pointer;">تأكيد الإلغاء والتصفية</button>
          </div>
        </div>
      `;

      const depInput = modal.querySelector('#midstay-dep-date');
      const overrideInput = modal.querySelector('#midstay-override-input');
      const daysEl = modal.querySelector('#midstay-days-count');
      const autoChargeEl = modal.querySelector('#midstay-auto-charge');
      const finalTotalEl = modal.querySelector('#midstay-final-total');
      const outcomeEl = modal.querySelector('#midstay-outcome-badge');
      const btnClose = modal.querySelector('#btn-midstay-close');
      const btnCancel = modal.querySelector('#btn-midstay-cancel');
      const btnConfirm = modal.querySelector('#btn-midstay-confirm');

      function updateCalculations() {
        const depVal = (depInput && depInput.value) ? depInput.value : todayStr;
        const d1 = new Date(checkInDate + 'T00:00:00');
        const d2 = new Date(depVal + 'T00:00:00');
        const diffTime = d2.getTime() - d1.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        const days = Math.max(1, diffDays);

        const autoCharge = (depVal === todayStr && targetRes.running_total !== undefined && targetRes.running_total !== null)
          ? roundMoney(targetRes.running_total)
          : roundMoney(days * nightlyRate);
        if (daysEl) daysEl.textContent = `${days} ليلة`;
        if (autoChargeEl) autoChargeEl.textContent = `${autoCharge.toLocaleString()} ريال`;

        let finalCharge = autoCharge;
        if (isAdmin && overrideInput && overrideInput.value.trim() !== '') {
          const num = Number(overrideInput.value);
          if (!isNaN(num)) {
            finalCharge = Math.max(0, roundMoney(num));
          }
        }

        if (finalTotalEl) finalTotalEl.textContent = `${finalCharge.toLocaleString()} ريال`;

        const paid = Number(targetRes.paid_amount || 0);
        const refund = Math.max(0, roundMoney(paid - finalCharge));
        const owed = Math.max(0, roundMoney(finalCharge - paid));

        if (outcomeEl) {
          if (refund > 0) {
            outcomeEl.style.background = '#ecfdf3';
            outcomeEl.style.color = '#065f28';
            outcomeEl.style.border = '1px solid #6ee79d';
            outcomeEl.textContent = `المبلغ المستحق إرجاعه للنزيل (مسترد): ${refund.toLocaleString()} ريال`;
          } else if (owed > 0) {
            outcomeEl.style.background = '#fffbeb';
            outcomeEl.style.color = '#92400e';
            outcomeEl.style.border = '1px solid #fde68a';
            outcomeEl.textContent = `المبلغ المتبقي للتحصيل من النزيل: ${owed.toLocaleString()} ريال`;
          } else {
            outcomeEl.style.background = '#f0f9ff';
            outcomeEl.style.color = '#0369a1';
            outcomeEl.style.border = '1px solid #bae6fd';
            outcomeEl.textContent = `الحساب متوازن بالكامل (المبلغ المدفوع يغطي الإقامة تماماً)`;
          }
        }
      }

      const cleanup = (result) => {
        modal.style.display = 'none';
        if (depInput) depInput.removeEventListener('input', updateCalculations);
        if (overrideInput) overrideInput.removeEventListener('input', updateCalculations);
        if (btnClose) btnClose.removeEventListener('click', onCancel);
        if (btnCancel) btnCancel.removeEventListener('click', onCancel);
        if (btnConfirm) btnConfirm.removeEventListener('click', onConfirm);
        modal.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKeyDown);
        window.focus();
        resolve(result);
      };

      const onConfirm = () => {
        let depVal = (depInput && depInput.value) ? depInput.value : todayStr;
        if (checkInDate && depVal < checkInDate) {
          depVal = checkInDate;
        }

        let overrideVal = undefined;
        if (isAdmin && overrideInput && overrideInput.value.trim() !== '') {
          const num = Number(overrideInput.value);
          if (!isNaN(num)) {
            overrideVal = Math.max(0, roundMoney(num));
          }
        }

        cleanup({
          confirmed: true,
          actualDepartureDate: depVal,
          manualOverrideAmount: overrideVal
        });
      };

      const onCancel = () => cleanup({ confirmed: false });
      const onBackdrop = (e) => {
        if (e.target === modal) cleanup({ confirmed: false });
      };
      const onKeyDown = (e) => {
        if (e.key === 'Escape') cleanup({ confirmed: false });
      };

      if (depInput) depInput.addEventListener('input', updateCalculations);
      if (overrideInput) overrideInput.addEventListener('input', updateCalculations);
      if (btnClose) btnClose.addEventListener('click', onCancel);
      if (btnCancel) btnCancel.addEventListener('click', onCancel);
      if (btnConfirm) btnConfirm.addEventListener('click', onConfirm);
      modal.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKeyDown);

      modal.style.display = 'flex';
      updateCalculations();
    });
  }


  // --- AUTO CALCULATE TOTAL PRICE & REMAINING BALANCE ---
  let isPaidAmountCustomized = false;

  function updateRemainingBalance() {
    if (!totalPriceInput || !paidAmountInput || !remainingBalanceVal) return;
    const total = parseFloat(totalPriceInput.value) || 0;
    const paid = parseFloat(paidAmountInput.value) || 0;
    const bType = bookingTypeSelect ? bookingTypeSelect.value : 'عادي';

    if (bType === 'عقد مفتوح') {
      const remaining = total - paid;
      if (remaining < -0.005) {
        remainingBalanceVal.textContent = `رصيد دائن: ${Math.abs(remaining).toFixed(2)} ر.س`;
        remainingBalanceVal.style.color = '#2563eb';
      } else {
        remainingBalanceVal.textContent = `${Math.max(0, remaining).toFixed(2)} ر.س`;
        remainingBalanceVal.style.color = remaining > 0 ? '#dc2626' : '#05963d';
      }
    } else {
      const remaining = Math.max(0, total - paid);
      remainingBalanceVal.textContent = `${remaining.toFixed(2)} ر.س`;
      remainingBalanceVal.style.color = remaining > 0 ? '#dc2626' : '#05963d';
    }
  }

  function addDaysToLocalDateString(dateValue, days) {
    const [year, month, day] = String(dateValue || '').split('-').map(Number);
    if (!year || !month || !day) return '';
    return getLocalDateString(new Date(year, month - 1, day + days));
  }

  function updateMinimumCheckoutDate() {
    if (!checkInInput || !checkOutInput || !checkInInput.value) return;
    if (bookingTypeSelect && bookingTypeSelect.value === 'عقد مفتوح') {
      checkOutInput.removeAttribute('min');
      return;
    }

    const isDayUse = bookingTypeSelect && bookingTypeSelect.value === 'استخدام يومي';
    const minimumDate = isDayUse ? checkInInput.value : addDaysToLocalDateString(checkInInput.value, 1);
    if (!minimumDate) return;
    checkOutInput.min = minimumDate;
    if (checkOutInput.value && checkOutInput.value < minimumDate) {
      checkOutInput.value = minimumDate;
    }
  }

  function handleBookingTypeChange() {
    const bType = bookingTypeSelect ? bookingTypeSelect.value : 'عادي';
    const checkOutStar = document.getElementById('check-out-required-star');
    const checkOutHint = document.getElementById('check-out-open-hint');
    const checkOutMinimumHint = document.getElementById('check-out-minimum-hint');
    const checkOutDayUseHint = document.getElementById('check-out-day-use-hint');
    const priceHint = document.getElementById('total-price-open-hint');
    const bookingRateLabel = document.getElementById('booking-rate-label');
    const bookingRateHint = document.getElementById('booking-rate-hint');
    const selectedOption = roomSelect ? roomSelect.options[roomSelect.selectedIndex] : null;
    const monthlyRate = selectedOption ? Number(selectedOption.dataset.monthlyPrice || 0) : 0;
    const dailyRate = selectedOption ? Number(selectedOption.dataset.price || 0) : 0;
    const useMonthlyRate = bType === 'حجز شهري';
    if (bookingRateLabel) bookingRateLabel.innerHTML = useMonthlyRate ? 'السعر الشهري (ر.س) <span class="field-required">*</span>' : (bType === 'استخدام يومي' ? 'سعر الاستخدام اليومي (ر.س) <span class="field-required">*</span>' : 'سعر الليلة للحجز (ر.س) <span class="field-required">*</span>');
    if (nightlyRateInput) {
      nightlyRateInput.disabled = useMonthlyRate && !(monthlyRate > 0);
      nightlyRateInput.value = useMonthlyRate ? (monthlyRate > 0 ? monthlyRate : '') : (dailyRate > 0 ? dailyRate : '');
    }
    if (bookingRateHint) {
      bookingRateHint.textContent = useMonthlyRate && !(monthlyRate > 0)
        ? 'يلزم ضبط السعر الشهري لهذه الغرفة من صفحة الغرف قبل حجزها شهرياً.'
        : (useMonthlyRate ? 'يمكن تعديله لسعر شهري خاص بالنزيل' : 'قابل للتعديل لمنح سعر خاص للنزيل');
      bookingRateHint.style.color = useMonthlyRate && !(monthlyRate > 0) ? '#b91c1c' : '#64748b';
    }
    if (checkOutDayUseHint) checkOutDayUseHint.style.display = 'none';

    if (bType === 'عقد مفتوح') {
      if (checkOutInput) {
        checkOutInput.value = '';
        checkOutInput.removeAttribute('required');
        checkOutInput.disabled = true;
      }
      if (checkOutStar) checkOutStar.style.display = 'none';
      if (checkOutHint) checkOutHint.style.display = 'block';
      if (checkOutMinimumHint) checkOutMinimumHint.style.display = 'none';
      if (totalPriceInput) {
        totalPriceInput.removeAttribute('required');
        totalPriceInput.value = '0.00';
      }
      if (priceHint) priceHint.style.display = 'block';
      isPaidAmountCustomized = false;
      updateRemainingBalance();
    } else if (bType === 'حجز شهري') {
      if (checkOutInput) {
        checkOutInput.disabled = false;
        checkOutInput.setAttribute('required', 'required');
      }
      if (checkOutStar) checkOutStar.style.display = 'inline';
      if (checkOutHint) checkOutHint.style.display = 'none';
      if (checkOutMinimumHint) checkOutMinimumHint.style.display = 'block';
      if (totalPriceInput) {
        totalPriceInput.setAttribute('required', 'required');
      }
      if (priceHint) priceHint.style.display = 'none';

      // Calendar month: same day next month, clamped at month end.
      if (checkInInput && checkInInput.value) {
        const calendarOut = getCalendarMonthCheckOut(checkInInput.value);
        if (calendarOut) checkOutInput.value = calendarOut;
      }

      // Use the shared calculator so the current discount and advance payment
      // stay synchronized when switching into monthly booking mode.
      calculatePrice(false);
    } else if (bType === 'استخدام يومي') {
      if (checkOutInput) {
        checkOutInput.disabled = false;
        checkOutInput.setAttribute('required', 'required');
        if (checkInInput && checkInInput.value) checkOutInput.value = checkInInput.value;
      }
      if (checkOutStar) checkOutStar.style.display = 'inline';
      if (checkOutHint) checkOutHint.style.display = 'none';
      if (checkOutMinimumHint) checkOutMinimumHint.style.display = 'none';
      if (checkOutDayUseHint) checkOutDayUseHint.style.display = 'block';
      if (totalPriceInput) totalPriceInput.setAttribute('required', 'required');
      if (priceHint) priceHint.style.display = 'none';
      calculatePrice(false);
    } else {
      // Normal booking ('عادي')
      if (checkOutInput) {
        checkOutInput.disabled = false;
        checkOutInput.setAttribute('required', 'required');
      }
      if (checkOutStar) checkOutStar.style.display = 'inline';
      if (checkOutHint) checkOutHint.style.display = 'none';
      if (checkOutMinimumHint) checkOutMinimumHint.style.display = 'block';
      if (checkOutDayUseHint) checkOutDayUseHint.style.display = 'none';
      if (totalPriceInput) {
        totalPriceInput.setAttribute('required', 'required');
      }
      if (priceHint) priceHint.style.display = 'none';

      // Restore checkout date if empty
      if (checkOutInput && !checkOutInput.value && checkInInput && checkInInput.value) {
        const [y, m, d] = checkInInput.value.split('-').map(Number);
        const outDate = new Date(y, m - 1, d + 1);
        checkOutInput.value = getLocalDateString(outDate);
      }

      calculatePrice(false);
    }
    updateMinimumCheckoutDate();
  }

  if (bookingTypeSelect) {
    bookingTypeSelect.addEventListener('change', handleBookingTypeChange);
  }
  updateMinimumCheckoutDate();

  function calculatePrice(forceSyncPaid = false) {
    const bType = bookingTypeSelect ? bookingTypeSelect.value : 'عادي';

    const selectedOption = roomSelect ? roomSelect.options[roomSelect.selectedIndex] : null;
    const defaultRoomPrice = selectedOption
      ? Number((bType === 'حجز شهري' ? selectedOption.dataset.monthlyPrice : selectedOption.dataset.price) || 0)
      : 0;

    if (roomDefaultRateBadge) {
      if (defaultRoomPrice > 0) {
        roomDefaultRateBadge.textContent = `(الأساسي: ${defaultRoomPrice.toLocaleString()} ${bType === 'حجز شهري' ? 'ر.س/شهر' : 'ر.س/يوم'})`;
      } else {
        roomDefaultRateBadge.textContent = '';
      }
    }

    // Determine the effective daily or monthly room price.
    let effectiveRate = defaultRoomPrice;
    if (nightlyRateInput && nightlyRateInput.value !== '') {
      const parsedRate = parseFloat(nightlyRateInput.value);
      if (!isNaN(parsedRate) && parsedRate >= 0) {
        effectiveRate = parsedRate;
      }
    } else if (nightlyRateInput && defaultRoomPrice > 0) {
      nightlyRateInput.value = defaultRoomPrice;
      effectiveRate = defaultRoomPrice;
    }

    const discount = (discountAmountInput && discountAmountInput.value !== '') ? Math.max(0, parseFloat(discountAmountInput.value) || 0) : 0;

    if (bType === 'عقد مفتوح') {
      if (priceCalculationBreakdown) {
        if (effectiveRate > 0) {
          priceCalculationBreakdown.style.display = 'inline';
          priceCalculationBreakdown.textContent = `سعر الليلة المعتمد: ${effectiveRate} ر.س`;
        } else {
          priceCalculationBreakdown.style.display = 'none';
        }
      }
      updateRemainingBalance();
      return;
    }

    if (bType === 'حجز شهري') {
      if (checkInInput.value) {
        const calendarOut = getCalendarMonthCheckOut(checkInInput.value);
        if (calendarOut) checkOutInput.value = calendarOut;
      }
      const netTotal = getMonthlyPackageTotal(effectiveRate, discount);
      totalPriceInput.value = netTotal.toFixed(2);

      if (priceCalculationBreakdown) {
        if (discount > 0) {
          priceCalculationBreakdown.style.display = 'inline';
          const packageSubtotal = roundMoney(effectiveRate);
          priceCalculationBreakdown.textContent = `(قبل الخصم: ${packageSubtotal.toFixed(2)} - خصم: ${discount.toFixed(2)})`;
        } else {
          priceCalculationBreakdown.style.display = 'none';
        }
      }

      if (paidAmountInput) {
        if (forceSyncPaid || !isPaidAmountCustomized || !paidAmountInput.value || parseFloat(paidAmountInput.value) === 0) {
          paidAmountInput.value = totalPriceInput.value;
        }
      }
      updateRemainingBalance();
      return;
    }

    // Normal booking ('عادي')
    let nights = 1;
    if (checkInInput.value && checkOutInput.value) {
      const [y1, m1, day1] = checkInInput.value.split('-').map(Number);
      const [y2, m2, day2] = checkOutInput.value.split('-').map(Number);
      const diffDays = Math.round((Date.UTC(y2, m2 - 1, day2) - Date.UTC(y1, m1 - 1, day1)) / 86400000);
      nights = diffDays > 0 ? diffDays : 1;
    }

    const subtotal = nights * effectiveRate;
    const netTotal = Math.max(0, subtotal - discount);
    totalPriceInput.value = netTotal.toFixed(2);

    if (priceCalculationBreakdown) {
      if (discount > 0) {
        priceCalculationBreakdown.style.display = 'inline';
        priceCalculationBreakdown.textContent = `(قبل الخصم: ${subtotal.toFixed(2)} - خصم: ${discount.toFixed(2)})`;
      } else {
        priceCalculationBreakdown.style.display = 'none';
      }
    }

    // Always synchronize المبلغ المدفوع مقدماً when changing rooms or if not manually customized
    if (paidAmountInput) {
      if (forceSyncPaid || !isPaidAmountCustomized || !paidAmountInput.value || parseFloat(paidAmountInput.value) === 0) {
        paidAmountInput.value = totalPriceInput.value;
      }
    }
    updateRemainingBalance();
  }

  // When room is changed, always update both total price, nightly rate, and المبلغ المدفوع مقدماً to the new room's price
  roomSelect.addEventListener('change', () => {
    isPaidAmountCustomized = false;
    const selectedOption = roomSelect.options[roomSelect.selectedIndex];
    if (selectedOption && nightlyRateInput) {
      const isMonthly = bookingTypeSelect?.value === 'حجز شهري';
      const selectedRate = Number(isMonthly ? selectedOption.dataset.monthlyPrice : selectedOption.dataset.price) || 0;
      nightlyRateInput.disabled = isMonthly && selectedRate <= 0;
      nightlyRateInput.value = selectedRate > 0 ? selectedRate : '';
      const rateHint = document.getElementById('booking-rate-hint');
      if (rateHint) {
        rateHint.textContent = isMonthly && selectedRate <= 0
          ? 'يلزم ضبط السعر الشهري لهذه الغرفة من صفحة الغرف قبل حجزها شهرياً.'
          : (isMonthly ? 'يمكن تعديله لسعر شهري خاص بالنزيل' : 'قابل للتعديل لمنح سعر خاص للنزيل');
        rateHint.style.color = isMonthly && selectedRate <= 0 ? '#b91c1c' : '#64748b';
      }
    }
    calculatePrice(true);
  });

  if (nightlyRateInput) {
    nightlyRateInput.addEventListener('input', () => {
      calculatePrice(false);
    });
  }

  if (discountAmountInput) {
    discountAmountInput.addEventListener('input', () => {
      calculatePrice(false);
    });
  }

  // When dates change, update paid amount if user hasn't explicitly customized a partial amount
  checkInInput.addEventListener('change', () => {
    if (bookingTypeSelect && bookingTypeSelect.value === 'استخدام يومي') checkOutInput.value = checkInInput.value;
    // A monthly booking is a calendar month, so moving the arrival date must move the
    // departure with it rather than leaving a stale span that no longer equals one month.
    if (bookingTypeSelect && bookingTypeSelect.value === 'حجز شهري' && checkInInput.value) {
      const calendarOut = getCalendarMonthCheckOut(checkInInput.value);
      if (calendarOut) checkOutInput.value = calendarOut;
    }
    updateMinimumCheckoutDate();
    calculatePrice(!isPaidAmountCustomized);
  });
  checkOutInput.addEventListener('change', () => {
    if (bookingTypeSelect && bookingTypeSelect.value === 'استخدام يومي' && checkInInput.value && checkOutInput.value !== checkInInput.value) {
      checkOutInput.value = checkInInput.value;
    }
    calculatePrice(!isPaidAmountCustomized);
  });

  if (totalPriceInput) {
    totalPriceInput.addEventListener('input', () => {
      if (!isPaidAmountCustomized && paidAmountInput) {
        paidAmountInput.value = totalPriceInput.value;
      }
      updateRemainingBalance();
    });
  }

  if (paidAmountInput) {
    paidAmountInput.addEventListener('input', () => {
      const currentTotal = parseFloat(totalPriceInput ? totalPriceInput.value : 0) || 0;
      const currentPaid = parseFloat(paidAmountInput.value) || 0;
      // Mark as customized only if user deliberately entered a partial amount different from total
      if (Math.abs(currentPaid - currentTotal) > 0.01) {
        isPaidAmountCustomized = true;
      } else {
        isPaidAmountCustomized = false;
      }
      updateRemainingBalance();
    });
  }

  // --- STATUS BADGES ---
  function getReservationStatusBadge(status) { return window.DashboardApp.Helpers.getReservationStatusBadge(status); }

  function getPaymentStatusBadge(status) { return window.DashboardApp.Helpers.getPaymentStatusBadge(status); }

  function getBookingTypeBadge(bookingType) { return window.DashboardApp.Helpers.getBookingTypeBadge(bookingType); }

  function getRoomStatusBadge(status) { return window.DashboardApp.Helpers.getRoomStatusBadge(status); }

  function loadOverviewData() { return window.DashboardApp.Helpers.loadOverviewData(); }
  function loadTodayCheckouts() { return window.DashboardApp.Helpers.loadTodayCheckouts(); }

  async function notifyAttentionUpdate(reservationId, type = 'update') {
    if (typeof window.syncAttentionData === 'function') {
      try {
        await window.syncAttentionData({ force: true });
      } catch (e) {}
    } else if (typeof window.updateAttentionInbox === 'function') {
      window.updateAttentionInbox();
    }
    if (typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
      window.dispatchEvent(new window.CustomEvent('reservation:updated', { detail: { reservationId, type } }));
    }
  }
  // =========================================================================
  // RETURNING GUEST AUTO-FILL SYSTEM (البحث التلقائي عن النزلاء السابقين)
  // =========================================================================
  let lastAutoFilledGuestId = null;
  let autofillDebounceTimer = null;

  function resetAutofillBanner() {
    lastAutoFilledGuestId = null;
    if (autofillGuestStatus) {
      autofillGuestStatus.style.display = 'none';
    }
    if (bannedGuestWarning) {
      bannedGuestWarning.style.display = 'none';
    }
  }

  function highlightField(el) {
    if (!el) return;
    el.classList.add('input-autofill-highlight');
    setTimeout(() => el.classList.remove('input-autofill-highlight'), 1600);
  }

  async function handleGuestAutofill(triggeredBy, eventType) {
    const phoneVal = guestPhoneInput ? guestPhoneInput.value.trim() : '';
    const idVal = guestIdNumberInput ? guestIdNumberInput.value.trim() : '';

    const activeVal = triggeredBy === 'phone' ? phoneVal : idVal;

    // Minimum 4 characters to trigger search
    if (!activeVal || activeVal.length < 4) {
      if (!phoneVal && !idVal) {
        resetAutofillBanner();
      }
      return;
    }

    try {
      const res = await window.api.searchGuest({ phone: phoneVal, id_number: idVal });
      if (res && res.success && res.guest) {
        const guest = res.guest;

        // Show or hide banned guest warning banner
        if (bannedGuestWarning) {
          if (Number(guest.is_banned) === 1) {
            if (bannedGuestMsg) {
              const reasonText = guest.ban_reason ? ` (سبب الحظر: ${escapeHtml(guest.ban_reason)})` : '';
              bannedGuestMsg.innerHTML = `<strong>تنبيه (نزيل محظور):</strong> هذا النزيل مدرج في قائمة الحظر${reasonText}.`;
            }
            bannedGuestWarning.style.display = 'flex';
          } else {
            bannedGuestWarning.style.display = 'none';
          }
        }

        // Auto-fill if it's a new match or name is currently empty
        if (guest.id !== lastAutoFilledGuestId || !guestNameInput.value.trim()) {
          lastAutoFilledGuestId = guest.id;

          // 1. Fill Name
          if (guest.name) {
            guestNameInput.value = guest.name;
            highlightField(guestNameInput);
          }

          // 2. Cross-fill Phone / ID Number
          if (triggeredBy === 'phone' && guest.id_number && !guestIdNumberInput.value.trim()) {
            guestIdNumberInput.value = guest.id_number;
            highlightField(guestIdNumberInput);
          } else if (triggeredBy === 'id' && guest.phone && !guestPhoneInput.value.trim()) {
            guestPhoneInput.value = guest.phone;
            highlightField(guestPhoneInput);
          }

          // 3. Update Visual Status Banner
          const stays = parseInt(guest.total_stays, 10) || 0;
          let staysText = '';
          if (stays === 0) {
            staysText = 'بدون إقامات سابقة مكتملة';
          } else if (stays === 1) {
            staysText = 'إقامة سابقة واحدة';
          } else if (stays === 2) {
            staysText = 'إقامتان سابقتان';
          } else if (stays >= 3 && stays <= 10) {
            staysText = `${stays} إقامات سابقة`;
          } else {
            staysText = `${stays} إقامة سابقة`;
          }

          if (autofillGuestStatus && autofillGuestMsg) {
            autofillGuestMsg.innerHTML = stays > 0
              ? `<strong>تم التعرف على النزيل السابق:</strong> ${escapeHtml(guest.name)} (${staysText}) - تم ملء البيانات تلقائياً.`
              : `<strong>نزيل مسجل:</strong> ${escapeHtml(guest.name)} (${staysText}) - تم استرجاع البيانات تلقائياً.`;
            autofillGuestStatus.style.display = 'flex';
          }

          // 4. Alert / Toast in Arabic
          if (stays > 0) {
            showToast(`مرحباً بعودته! تم التعرف على النزيل السابق "${guest.name}" (${staysText}) واسترجاع بياناته تلقائياً.`, 'success');
          } else {
            showToast(`تم استرجاع بيانات النزيل المسجل "${guest.name}".`, 'info');
          }
        }
      } else {
        if (bannedGuestWarning) {
          bannedGuestWarning.style.display = 'none';
        }
      }
    } catch (err) {
      console.error('[Autofill Error]', err);
    }
  }

  // Setup keyup and blur listeners for Phone and ID Number inputs
  if (guestPhoneInput) {
    guestPhoneInput.addEventListener('keyup', () => {
      clearTimeout(autofillDebounceTimer);
      autofillDebounceTimer = setTimeout(() => {
        handleGuestAutofill('phone', 'keyup');
      }, 300);
    });

    guestPhoneInput.addEventListener('blur', () => {
      handleGuestAutofill('phone', 'blur');
    });
  }

  if (guestIdNumberInput) {
    guestIdNumberInput.addEventListener('keyup', () => {
      clearTimeout(autofillDebounceTimer);
      autofillDebounceTimer = setTimeout(() => {
        handleGuestAutofill('id', 'keyup');
      }, 300);
    });

    guestIdNumberInput.addEventListener('blur', () => {
      handleGuestAutofill('id', 'blur');
    });
  }

  // Inline Error UI Helpers
  function setFieldError(inputEl, errorEl, msg) {
    if (!inputEl) return;
    inputEl.classList.add('border-rose-500');
    inputEl.style.borderColor = '#f43f5e';
    inputEl.style.boxShadow = '0 0 0 1.5px #f43f5e';
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
      errorEl.style.display = 'block';
    }
  }

  function clearFieldError(inputEl, errorEl) {
    if (!inputEl) return;
    inputEl.classList.remove('border-rose-500');
    inputEl.style.borderColor = '';
    inputEl.style.boxShadow = '';
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      errorEl.style.display = 'none';
    }
  }

  // Clear inline errors immediately on keystroke
  if (guestPhoneInput) {
    guestPhoneInput.addEventListener('input', () => {
      clearFieldError(guestPhoneInput, guestPhoneError);
    });
  }

  if (guestIdNumberInput) {
    guestIdNumberInput.addEventListener('input', () => {
      clearFieldError(guestIdNumberInput, guestIdError);
    });
  }

  // =========================================================================
  // STRICT FRONTEND DATA VALIDATIONS
  // =========================================================================
  function validateReservationInputs({ guestName, guestPhone, guestIdNumber, roomId, checkInDate, checkOutDate, totalPrice, bookingType = 'عادي' }) {
    clearFieldError(guestPhoneInput, guestPhoneError);
    clearFieldError(guestIdNumberInput, guestIdError);

    // 1. Required Essential Fields
    if (!guestName) {
      if (guestNameInput) { guestNameInput.focus(); highlightField(guestNameInput); }
      return { valid: false, error: 'يرجى إدخال اسم النزيل (حقل إلزامي).' };
    }
    if (!roomId) {
      if (roomSelect) { roomSelect.focus(); highlightField(roomSelect); }
      return { valid: false, error: 'يرجى اختيار رقم الغرفة المراد حجزها.' };
    }

    if (bookingType === 'عقد مفتوح') {
      if (isNaN(totalPrice) || totalPrice < 0) {
        if (totalPriceInput) { totalPriceInput.focus(); highlightField(totalPriceInput); }
        return { valid: false, error: 'السعر الإجمالي يجب أن يكون صفراً أو أكبر.' };
      }
    } else {
      if (isNaN(totalPrice) || totalPrice <= 0) {
        if (totalPriceInput) { totalPriceInput.focus(); highlightField(totalPriceInput); }
        return { valid: false, error: 'السعر الإجمالي مطلوب ويجب أن يكون أكبر من الصفر.' };
      }
    }

    // 2. Phone Number: Must start with 05 and be exactly 10 digits (Inline error)
    if (!guestPhone) {
      setFieldError(guestPhoneInput, guestPhoneError, 'يرجى إدخال رقم جوال النزيل.');
      if (guestPhoneInput) guestPhoneInput.focus();
      return { valid: false, inline: true, error: 'يرجى إدخال رقم جوال النزيل.' };
    }
    if (!/^05\d{8}$/.test(guestPhone)) {
      setFieldError(guestPhoneInput, guestPhoneError, 'رقم الجوال غير صحيح: يجب أن يبدأ بـ 05 ويتكون من 10 أرقام (مثال: 0501234567).');
      if (guestPhoneInput) guestPhoneInput.focus();
      return { valid: false, inline: true, error: 'رقم الجوال غير صحيح: يجب أن يبدأ بـ 05 ويتكون من 10 أرقام.' };
    }

    // 3. National ID (10 digits) OR Passport (6-9 alphanumeric characters) (Inline error)
    if (guestIdNumber && !/^(?:\d{10}|[a-zA-Z0-9]{6,9})$/i.test(guestIdNumber)) {
      setFieldError(guestIdNumberInput, guestIdError, 'رقم الهوية الوطنية أو الإقامة (10 أرقام) أو جواز السفر (6 إلى 9 خانات) غير صحيح.');
      if (guestIdNumberInput) guestIdNumberInput.focus();
      return { valid: false, inline: true, error: 'رقم الهوية أو جواز السفر غير صحيح.' };
    }

    // 4. Dates Logic: check_in_date not in past
    if (!checkInDate) {
      if (checkInInput) { checkInInput.focus(); highlightField(checkInInput); }
      return { valid: false, error: 'يرجى تحديد تاريخ الوصول.' };
    }

    const minAllowedDate = getOperationalBusinessDate();
    if (!minAllowedDate) {
      showToast('تعذر قراءة تاريخ العمل الفندقي. يرجى تحديث الصفحة والمحاولة مجدداً.', 'error');
      return { valid: false, error: 'تعذر قراءة تاريخ العمل الفندقي.' };
    }
    if (checkInDate < minAllowedDate) {
      if (checkInInput) { checkInInput.focus(); highlightField(checkInInput); }
      return { valid: false, error: 'تاريخ الوصول لا يمكن أن يسبق تاريخ العمل الفندقي الحالي.' };
    }

    if (bookingType === 'عقد مفتوح') {
      if (checkOutDate && checkOutDate <= checkInDate) {
        if (checkOutInput) { checkOutInput.focus(); highlightField(checkOutInput); }
        return { valid: false, error: 'يجب أن تكون المغادرة في اليوم التالي للوصول على الأقل (ليلة واحدة).' };
      }
    } else if (bookingType === 'حجز شهري') {
      if (checkOutDate && checkOutDate <= checkInDate) {
        if (checkOutInput) { checkOutInput.focus(); highlightField(checkOutInput); }
        return { valid: false, error: 'يجب أن تكون المغادرة في اليوم التالي للوصول على الأقل (ليلة واحدة).' };
      }
    } else if (bookingType === 'استخدام يومي') {
      if (!checkOutDate || checkOutDate !== checkInDate) {
        if (checkOutInput) { checkOutInput.focus(); highlightField(checkOutInput); }
        return { valid: false, error: 'حجز الاستخدام اليومي يتطلب أن يكون تاريخ المغادرة هو نفس تاريخ الوصول.' };
      }
    } else {
      if (!checkOutDate) {
        if (checkOutInput) { checkOutInput.focus(); highlightField(checkOutInput); }
        return { valid: false, error: 'يرجى تحديد تاريخ المغادرة.' };
      }
      if (checkOutDate <= checkInDate) {
        if (checkOutInput) { checkOutInput.focus(); highlightField(checkOutInput); }
        return { valid: false, error: 'يجب أن تكون المغادرة في اليوم التالي للوصول على الأقل (ليلة واحدة).' };
      }
    }

    return { valid: true };
  }

  function validateGuestInputs({ name, phone, id_number }) {
    if (!name) {
      if (newCustomerName) { newCustomerName.focus(); highlightField(newCustomerName); }
      return { valid: false, error: 'يرجى إدخال اسم العميل / النزيل.' };
    }
    if (phone && !/^05\d{8}$/.test(phone)) {
      if (newCustomerPhone) { newCustomerPhone.focus(); highlightField(newCustomerPhone); }
      return { valid: false, error: 'رقم الجوال غير صحيح: يجب أن يبدأ بـ 05 ويتكون من 10 أرقام بالضبط (مثال: 0501234567).' };
    }
    if (id_number && !/^(?:\d{10}|[a-zA-Z0-9]{6,9})$/i.test(id_number)) {
      if (newCustomerId) { newCustomerId.focus(); highlightField(newCustomerId); }
      return { valid: false, error: 'رقم الهوية الوطنية أو الإقامة (10 أرقام) أو جواز السفر (6 إلى 9 خانات) غير صحيح.' };
    }
    return { valid: true };
  }

  // Quick Reservation Form Submit
  reservationForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const bookingType = bookingTypeSelect ? bookingTypeSelect.value : 'عادي';
    const guestName = guestNameInput.value.trim();
    const guestPhone = guestPhoneInput.value.trim();
    const guestIdNumber = guestIdNumberInput.value.trim();
    const roomId = roomSelect.value;
    const checkInDate = checkInInput.value;
    const checkOutDate = checkOutInput.value;
    const totalPrice = parseFloat(totalPriceInput.value) || 0;
    const paidAmount = parseFloat(paidAmountInput ? paidAmountInput.value : 0) || 0;
    const depositAmount = parseFloat(depositAmountInput ? depositAmountInput.value : 0) || 0;
    const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : 'نقداً';
    const selectedRate = (nightlyRateInput && nightlyRateInput.value !== '') ? parseFloat(nightlyRateInput.value) : null;
    const monthlyPrice = bookingType === 'حجز شهري' ? selectedRate : null;
    const customNightlyPrice = bookingType === 'حجز شهري' ? null : selectedRate;
    const discountAmount = (discountAmountInput && discountAmountInput.value !== '') ? parseFloat(discountAmountInput.value) : 0;
    const discountReason = discountReasonInput ? discountReasonInput.value.trim() : '';

    // Strict Frontend Validation
    const validation = validateReservationInputs({
      guestName,
      guestPhone,
      guestIdNumber,
      roomId,
      checkInDate,
      checkOutDate,
      totalPrice,
      bookingType
    });

    if (!validation.valid) {
      if (!validation.inline) {
        showToast(validation.error, 'error');
      }
      return;
    }

    try {
      let res = await window.api.createReservation({
        guestName,
        guestPhone,
        guestIdNumber,
        roomId,
        checkInDate,
        checkOutDate,
        totalPrice,
        paidAmount,
        depositAmount,
        paymentMethod,
        bookingType,
        monthlyPrice,
        customNightlyPrice,
        discountAmount,
        discountReason,
        isEarlyCheckin: isEarlyCheckinCheckbox ? (isEarlyCheckinCheckbox.checked ? 1 : 0) : null
      });

      // Handle soft ban override confirmation
      if (res && !res.success && res.requiresOverride) {
        const confirmed = await showConfirmDialog({
          title: 'تنبيه: نزيل مدرج في قائمة الحظر',
          message: `${res.error || 'هذا النزيل مدرج في قائمة الحظر.'}\n\nهل ترغب في تجاوز الحظر ومتابعة إتمام الحجز للنزيل؟`,
          confirmText: 'نعم، تجاوز الحظر وتأكيد',
          cancelText: 'إلغاء الحجز',
          isDanger: true
        });

        if (confirmed) {
          res = await window.api.createReservation({
            guestName,
            guestPhone,
            guestIdNumber,
            roomId,
            checkInDate,
            checkOutDate,
            totalPrice,
            paidAmount,
            depositAmount,
            paymentMethod,
            bookingType,
            monthlyPrice,
            customNightlyPrice,
            discountAmount,
            discountReason,
            isEarlyCheckin: isEarlyCheckinCheckbox ? (isEarlyCheckinCheckbox.checked ? 1 : 0) : null,
            overrideBan: true
          });
        } else {
          return;
        }
      }

      if (res && res.success) {
        // 1. Reset form fields and error indicators
        reservationForm.reset();
        if (bookingTypeSelect) {
          bookingTypeSelect.value = 'عادي';
          handleBookingTypeChange();
        }
        guestNameInput.value = '';
        guestPhoneInput.value = '';
        guestIdNumberInput.value = '';
        totalPriceInput.value = '';
        if (paidAmountInput) paidAmountInput.value = '';
        if (depositAmountInput) depositAmountInput.value = '0';
        if (nightlyRateInput) nightlyRateInput.value = '';
        if (discountAmountInput) discountAmountInput.value = '0';
        if (discountReasonInput) discountReasonInput.value = '';
        if (roomDefaultRateBadge) roomDefaultRateBadge.textContent = '';
        if (priceCalculationBreakdown) priceCalculationBreakdown.style.display = 'none';
         clearFieldError(guestPhoneInput, guestPhoneError);
        clearFieldError(guestIdNumberInput, guestIdError);
        updateRemainingBalance();
        resetAutofillBanner();
        // form.reset() clears date inputs to empty (no default HTML value) —
        // always re-fill with today/tomorrow so the modal never opens empty
        // next time.
        const defaultDates = getDefaultBookingDates();
        checkInInput.value = defaultDates.checkIn;
        checkOutInput.value = defaultDates.checkOut;

        // 2. Close booking modal

        // 2. Close booking modal
        closeNewReservationModal();

        // 3. Dynamic UI Update: Refresh rooms grid, overview stats, and reservations table
        await Promise.all([
          loadRoomsData(),
          loadOverviewData(),
          loadReservationsData(true)
        ]);

        // 4. Smooth Visual Feedback: Highlight the updated room card on screen
        const updatedCard = document.querySelector(`.room-card[data-room-id="${roomId}"]`);
        if (updatedCard) {
          updatedCard.style.transition = 'all 0.4s ease';
          updatedCard.style.boxShadow = '0 0 0 3px #10b951, 0 10px 25px -4px rgba(16, 185, 81, 0.35)';
          updatedCard.style.transform = 'translateY(-2px)';
          setTimeout(() => {
            updatedCard.style.boxShadow = '';
            updatedCard.style.transform = '';
          }, 1800);
        }

        showToast(`تم تأكيد الحجز بنجاح للنزيل "${guestName}"!`, 'success');
      } else {
        showToast(res.error || 'فشل في حفظ الحجز.', 'error');
      }
    } catch (err) {
      showToast(`خطأ: ${err.message}`, 'error');
    }
  });

  btnClearForm.addEventListener('click', () => {
    isPaidAmountCustomized = false;
    clearFieldError(guestPhoneInput, guestPhoneError);
    clearFieldError(guestIdNumberInput, guestIdError);
    reservationForm.reset();
    if (bookingTypeSelect) {
      bookingTypeSelect.value = 'عادي';
      handleBookingTypeChange();
    }
    if (nightlyRateInput) nightlyRateInput.value = '';
    if (discountAmountInput) discountAmountInput.value = '0';
    if (discountReasonInput) discountReasonInput.value = '';
    if (roomDefaultRateBadge) roomDefaultRateBadge.textContent = '';
    if (priceCalculationBreakdown) priceCalculationBreakdown.style.display = 'none';
    resetAutofillBanner();
    const defaultDates = getDefaultBookingDates();
    checkInInput.value = defaultDates.checkIn;
    checkOutInput.value = defaultDates.checkOut;
    if (depositAmountInput) depositAmountInput.value = '0';
    calculatePrice(true);
  });

  // --- NEW RESERVATION MODAL & ROOM AUTO-FILL CONTROLS ---
  function unlockRoomSelect() {
    if (!roomSelect) return;
    roomSelect.classList.remove('select-locked');
    roomSelect.style.borderColor = '';
    roomSelect.style.background = '';
    roomSelect.style.color = '';
    roomSelect.style.fontWeight = '';
  }

  function initiateRoomBooking(roomId) {
    const targetId = parseInt(roomId, 10);
    const targetRoom = window.DashboardApp.State.roomsCache.find(r => r.id === targetId);

    // 1. Open the New Reservation Modal
    openNewReservationModal();

    if (!roomSelect) return;

    // 2. Ensure option exists in roomSelect
    let optionExists = false;
    for (let i = 0; i < roomSelect.options.length; i++) {
      if (parseInt(roomSelect.options[i].value, 10) === targetId) {
        optionExists = true;
        break;
      }
    }

    if (!optionExists && targetRoom) {
      const opt = document.createElement('option');
      opt.value = targetRoom.id;
      opt.dataset.price = targetRoom.price_per_night;
      opt.dataset.monthlyPrice = targetRoom.monthly_price || '';
      opt.textContent = `غرفة رقم ${targetRoom.room_number} (${targetRoom.type}) - ${targetRoom.price_per_night} ر.س/يوم · ${targetRoom.monthly_price || 'غير محدد'} ر.س/شهر`;
      roomSelect.appendChild(opt);
    }

    // 3. Pre-fill and calculate price (force update المبلغ المدفوع مقدماً to new room's price)
    roomSelect.value = String(targetId);
    isPaidAmountCustomized = false;
    if (nightlyRateInput && targetRoom) {
      const isMonthly = bookingTypeSelect?.value === 'حجز شهري';
      const selectedRate = Number(isMonthly ? targetRoom.monthly_price : targetRoom.price_per_night) || 0;
      nightlyRateInput.disabled = isMonthly && selectedRate <= 0;
      nightlyRateInput.value = selectedRate > 0 ? selectedRate : '';
    }
    if (roomDefaultRateBadge && targetRoom) {
      const isMonthly = bookingTypeSelect?.value === 'حجز شهري';
      roomDefaultRateBadge.textContent = `(الأساسي: ${isMonthly ? (targetRoom.monthly_price || 'غير محدد') + ' ر.س/شهر' : targetRoom.price_per_night + ' ر.س/يوم'})`;
    }
    if (discountAmountInput) discountAmountInput.value = '0';
    if (discountReasonInput) discountReasonInput.value = '';
    calculatePrice(true);

    // 4. Lock & Clearly indicate the room is pre-selected
    roomSelect.classList.add('select-locked');
    roomSelect.style.borderColor = '#1a432a';
    roomSelect.style.background = '#f0fdf5';
    roomSelect.style.color = '#166535';
    roomSelect.style.fontWeight = '800';

    // 5. Auto-focus next field
    setTimeout(() => {
      if (guestPhoneInput) {
        guestPhoneInput.focus();
        highlightField(guestPhoneInput);
      }
    }, 150);

    if (targetRoom) {
      showToast(`تم اختيار وتثبيت غرفة ${targetRoom.room_number} (${targetRoom.type}) في نموذج الحجز!`, 'success');
    }
  }

 async function openNewReservationModal() {
  if (!newReservationModal) return;
  try {
    const businessState = await window.api.getHotelBusinessState();
    if (businessState?.success && businessState.data?.current_business_date) {
      App.State.businessDate = businessState.data.current_business_date;
    }
  } catch (_) {}
  if (!getOperationalBusinessDate()) {
    showToast('تعذر قراءة تاريخ العمل الفندقي. حدّث الصفحة قبل تسجيل حجز جديد.', 'error');
    return;
  }
  clearFieldError(guestPhoneInput, guestPhoneError);
  clearFieldError(guestIdNumberInput, guestIdError);
  isPaidAmountCustomized = false;

  // Reservation defaults follow the persisted open hotel date, which advances only
  // when the manager completes the Night Audit.
  const defaultDates = getDefaultBookingDates(getOperationalBusinessDate());
  if (checkInInput) {
    checkInInput.min = getOperationalBusinessDate();
    checkInInput.value = defaultDates.checkIn;
  }

  // Early morning check-in detection (00:00 to 06:00 cutoff)
  try {
    const tz = App.Helpers.getHotelTimezone ? App.Helpers.getHotelTimezone() : 'Asia/Riyadh';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
    const currentHour = Number(p.hour);
    const isEarlyMorning = currentHour < 6 || Boolean(window.__SIMULATE_EARLY_CHECKIN__);

    if (earlyCheckinContainer) {
      if (isEarlyMorning) {
        earlyCheckinContainer.style.display = 'block';
        if (isEarlyCheckinCheckbox) isEarlyCheckinCheckbox.checked = true;
      } else {
        earlyCheckinContainer.style.display = 'none';
        if (isEarlyCheckinCheckbox) isEarlyCheckinCheckbox.checked = false;
      }
    }

    if (isEarlyCheckinCheckbox && !isEarlyCheckinCheckbox.dataset.bound) {
      isEarlyCheckinCheckbox.dataset.bound = 'true';
      isEarlyCheckinCheckbox.addEventListener('change', () => {
        const calParts = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(new Date());
        const cp = Object.fromEntries(calParts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
        const calendarToday = `${cp.year}-${cp.month}-${cp.day}`;
        const opDate = getOperationalBusinessDate();

        if (!isEarlyCheckinCheckbox.checked) {
          if (checkInInput) checkInInput.value = calendarToday;
        } else {
          if (checkInInput) checkInInput.value = opDate || calendarToday;
        }
        updateMinimumCheckoutDate();
        calculatePrice(false);
      });
    }
  } catch (_) {}
  if (checkOutInput) {
    const bookingType = bookingTypeSelect?.value || 'عادي';
    if (bookingType === 'عقد مفتوح') {
      checkOutInput.value = '';
    } else if (bookingType === 'استخدام يومي') {
      checkOutInput.value = defaultDates.checkIn;
    } else if (bookingType === 'حجز شهري') {
      checkOutInput.value = getCalendarMonthCheckOut(defaultDates.checkIn) || defaultDates.checkOut;
    } else {
      checkOutInput.value = defaultDates.checkOut;
    }
    updateMinimumCheckoutDate();
  }

  if (roomSelect && roomSelect.value) {
    calculatePrice(true);
  }
  
  newReservationModal.style.display = 'flex';
  setTimeout(() => {
    if (guestPhoneInput) {
      guestPhoneInput.focus();
    }
  }, 100);
}
  function closeNewReservationModal() {
    if (!newReservationModal) return;
    newReservationModal.style.display = 'none';
    clearFieldError(guestPhoneInput, guestPhoneError);
    clearFieldError(guestIdNumberInput, guestIdError);
    isPaidAmountCustomized = false;
    unlockRoomSelect();
  }

  if (btnOpenNewReservationModal) {
    btnOpenNewReservationModal.addEventListener('click', openNewReservationModal);
  }

  if (btnResNewBooking) {
    btnResNewBooking.addEventListener('click', openNewReservationModal);
  }

  if (btnCloseNewReservation) {
    btnCloseNewReservation.addEventListener('click', closeNewReservationModal);
  }

  if (newReservationModal) {
    newReservationModal.addEventListener('click', (e) => {
      if (e.target === newReservationModal) {
        closeNewReservationModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && newReservationModal && newReservationModal.style.display === 'flex') {
      closeNewReservationModal();
    }
  });

  // =========================================================================
  // VIEW 2: ALL RESERVATIONS LOGIC + EXCEL IMPORT / EXPORT
  // =========================================================================
  async function loadReservationsData(resetToFirstPage = false) {
    if (resetToFirstPage) reservationsTablePage = 1;
    const requestId = ++reservationsTableRequestId;
    try {
      const res = await window.api.getReservationsPage({
        page: reservationsTablePage,
        pageSize: reservationsTablePageSize,
        search: searchAllReservations.value || '',
        status: currentReservationFilter,
        paymentType: reservationsPaymentTypeFilter?.value || 'all',
        sortBy: currentSortBy || 'id_desc'
      });
      if (!res || !res.success) {
        console.error('Error loading reservations:', res?.error || 'Unknown error');
        return;
      }

      if (requestId !== reservationsTableRequestId) return;

      const data = res.data || {};
      reservationsTableRows = data.rows || [];
      reservationsTableTotal = Number(data.total) || 0;
      reservationsTablePage = Number(data.page) || 1;
      reservationsTablePageSize = Number(data.pageSize) || reservationsTablePageSize;
      const reservationsScroll = document.querySelector('.reservations-table-scroll');
      if (reservationsScroll) reservationsScroll.scrollTop = 0;

      // Keep current-page entries available to existing reservation actions without
      // replacing the shared full-data cache used by rooms and dashboard widgets.
      const cacheById = new Map((window.DashboardApp.State.reservationsCache || []).map(item => [Number(item.id), item]));
      reservationsTableRows.forEach(item => cacheById.set(Number(item.id), item));
      window.DashboardApp.State.reservationsCache = [...cacheById.values()];

      // Reconcile late checkouts if needed (ensures live calculation matches isLateCheckout helper and supports un-restarted Electron sessions)
      let lateRowsFromToday = [];
      const opDate = getOperationalBusinessDate() || (App.Helpers?.getTodayDateString ? App.Helpers.getTodayDateString() : '') || getLocalDateString();
      if (typeof window.api?.getTodayCheckouts === 'function' && opDate) {
        try {
          const todayRes = await window.api.getTodayCheckouts(opDate);
          if (todayRes && todayRes.success && Array.isArray(todayRes.data)) {
            lateRowsFromToday = todayRes.data.filter(r => {
              if (r.status !== 'مؤكد') return false;
              if (r.booking_type === 'عقد مفتوح') return false;
              const isOverdue = r.check_out_date && r.check_out_date < opDate;
              const isLate = App.Helpers?.isLateCheckout ? App.Helpers.isLateCheckout(r, opDate) : false;
              return isOverdue || isLate;
            });
          }
        } catch (e) {
          console.warn('Could not fetch today checkouts for late reconciliation:', e);
        }
      }

      const effectiveLateCount = Math.max(
        Number(data.summary?.lateCount || 0),
        lateRowsFromToday.length
      );

      if (currentReservationFilter === 'late' && lateRowsFromToday.length > 0) {
        const existingIds = new Set(reservationsTableRows.map(r => Number(r.id)));
        let mergedLateRows = [...reservationsTableRows];
        for (const lr of lateRowsFromToday) {
          if (!existingIds.has(Number(lr.id))) {
            const cached = cacheById.get(Number(lr.id));
            mergedLateRows.push(cached ? { ...cached, ...lr } : lr);
            existingIds.add(Number(lr.id));
          }
        }
        const searchVal = String(searchAllReservations?.value || '').trim().toLowerCase();
        if (searchVal) {
          mergedLateRows = mergedLateRows.filter(r => {
            const idMatch = String(r.id || '').includes(searchVal);
            const nameMatch = String(r.guest_name || '').toLowerCase().includes(searchVal);
            const roomMatch = String(r.room_number || '').includes(searchVal);
            const phoneMatch = String(r.guest_phone || '').includes(searchVal);
            const docMatch = String(r.guest_id_number || '').includes(searchVal);
            return idMatch || nameMatch || roomMatch || phoneMatch || docMatch;
          });
        }
        mergedLateRows.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
        reservationsTableTotal = mergedLateRows.length;
        const startIdx = (reservationsTablePage - 1) * reservationsTablePageSize;
        reservationsTableRows = mergedLateRows.slice(startIdx, startIdx + reservationsTablePageSize);
      }

      // Update Summary Cards & Tabs from data.summary
      if (data.summary) {
        const sum = data.summary;
        const elActive = document.getElementById('res-summary-active');
        const elLate = document.getElementById('res-summary-late');
        const elDue = document.getElementById('res-summary-due');
        const elOcc = document.getElementById('res-summary-occupancy');
        const elRoomsSub = document.getElementById('res-summary-rooms-sub');

        if (elActive) elActive.textContent = Number(sum.activeCount || 0).toLocaleString('en-US');
        if (elLate) elLate.textContent = effectiveLateCount.toLocaleString('en-US');
        if (elDue) elDue.textContent = Number(sum.dueAmount || 0).toLocaleString('en-US');
        if (elOcc) elOcc.textContent = `${Number(sum.occupancyRate || 0)}%`;
        if (elRoomsSub) elRoomsSub.textContent = `من ${sum.totalRooms} غرفة (${sum.occupiedRooms} مشغولة)`;

        const pillAll = document.getElementById('tab-pill-all');
        const pillActive = document.getElementById('tab-pill-active');
        const pillToday = document.getElementById('tab-pill-today');
        const pillLate = document.getElementById('tab-pill-late');
        const pillCompleted = document.getElementById('tab-pill-completed');
        const pillCancelled = document.getElementById('tab-pill-cancelled');

        if (pillAll) pillAll.textContent = Number(sum.total || 0).toLocaleString('en-US');
        if (pillActive) pillActive.textContent = Number(sum.activeCount || 0).toLocaleString('en-US');
        if (pillToday) pillToday.textContent = Number(sum.todayCount || 0).toLocaleString('en-US');
        if (pillLate) pillLate.textContent = effectiveLateCount.toLocaleString('en-US');
        if (pillCompleted) pillCompleted.textContent = Number(sum.completedCount || 0).toLocaleString('en-US');
        if (pillCancelled) pillCancelled.textContent = Number(sum.cancelledCount || 0).toLocaleString('en-US');
      } else {
        const elLate = document.getElementById('res-summary-late');
        const pillLate = document.getElementById('tab-pill-late');
        if (elLate) elLate.textContent = effectiveLateCount.toLocaleString('en-US');
        if (pillLate) pillLate.textContent = effectiveLateCount.toLocaleString('en-US');
      }

      const resTotalPill = document.getElementById('res-total-count-pill');
      if (resTotalPill) {
        resTotalPill.textContent = `${reservationsTableTotal.toLocaleString('en-US')} حجزاً`;
      }

      updateActiveFilterChips();
      renderAllReservationsTable();
    } catch (err) {
      console.error('Error loading reservations:', err);
    }
  }

  function renderAllReservationsTable() {
    closeReservationsOverflowMenu();
    const filtered = reservationsTableRows;
    const totalPages = Math.max(1, Math.ceil(reservationsTableTotal / reservationsTablePageSize));
    const firstRow = reservationsTableTotal ? ((reservationsTablePage - 1) * reservationsTablePageSize) + 1 : 0;
    const lastRow = Math.min(reservationsTablePage * reservationsTablePageSize, reservationsTableTotal);

    if (reservationsPagination) {
      reservationsPagination.style.display = reservationsTableTotal ? 'flex' : 'none';
    }
    if (reservationsPaginationSummary) {
      reservationsPaginationSummary.textContent = `عرض ${firstRow}–${lastRow} من ${reservationsTableTotal} حجز`;
    }
    if (reservationsPaginationPage) {
      reservationsPaginationPage.textContent = `${reservationsTablePage} / ${totalPages}`;
    }
    if (btnReservationsPrevPage) btnReservationsPrevPage.disabled = reservationsTablePage <= 1;
    if (btnReservationsNextPage) btnReservationsNextPage.disabled = reservationsTablePage >= totalPages;

    if (filtered.length === 0) {
      allReservationsTableBody.innerHTML = '';
      allReservationsEmpty.style.display = 'block';
      return;
    }

    allReservationsEmpty.style.display = 'none';

    // PERFORMANCE: Build the full HTML string first (no DOM touches), then set innerHTML
    // once to avoid hundreds of costly individual DOM reflows (layout thrashing).
    const rowsHtml = filtered.map(r => {
      const isConfirmed = r.status === 'مؤكد';
      const isEarlyMorningCheckin = Number(r.is_early_checkin) === 1;
      const arrivalDisplayDate = isEarlyMorningCheckin ? getActualCheckinCalendarDate(r) : (r.check_in_date || '-');
      const arrivalDisplayTime = isEarlyMorningCheckin ? (r.actual_checkin_time || r.booking_time) : r.booking_time;
      const hotelBizDate = getOperationalBusinessDate() || getLocalDateString();
      const isArrivalDate = r.check_in_date ? (r.check_in_date >= hotelBizDate) : false;
      const hasStarted = r.check_in_date ? !isArrivalDate : false;
      const canCheckOut = isConfirmed && (hotelBizDate >= r.check_in_date);
      const canCancel = isConfirmed && !hasStarted;
      const isContract = r.booking_type === 'عقد مفتوح';
      const isLateCheckout = App.Helpers.isLateCheckout(r);
      const total = parseFloat(r.total_price || 0);
      const paid = parseFloat((r.ledger_paid_amount ?? r.paid_amount) || 0);
      const deposit = parseFloat(r.deposit_ledger_balance || 0);
      const legacyDeposit = Number(r.deposit_legacy_unreconciled || 0) === 1 ? parseFloat(r.deposit_amount || 0) : 0;
      const checkOutDisplay = r.check_out_date || (isContract ? 'مفتوح (غير محدد)' : '-');
      const overdueDate = String(r.check_out_date || '').slice(0, 10);
      const businessToday = window.DashboardApp.State.businessDate || getLocalDateString();
      const overdueDays = overdueDate
        ? Math.max(0, Math.floor((Date.parse(`${businessToday}T00:00:00Z`) - Date.parse(`${overdueDate}T00:00:00Z`)) / 86400000))
        : 0;
      const isOverdue = isConfirmed && !isContract && overdueDays > 0;
      const nightlyRate = parseFloat(r.custom_nightly_price || r.price_per_night || 0);

      // Accrued calculation for overdue active stays and open contracts:
      let effectiveTotal = total;
      let elapsedStayNights = 0;
      if (isConfirmed && (isOverdue || isContract) && nightlyRate > 0 && r.check_in_date) {
        const startParts = String(r.check_in_date).slice(0, 10).split('-').map(Number);
        const endParts = businessToday.slice(0, 10).split('-').map(Number);
        elapsedStayNights = Math.max(1, Math.round((Date.UTC(endParts[0], endParts[1] - 1, endParts[2]) - Date.UTC(startParts[0], startParts[1] - 1, startParts[2])) / 86400000));
        const runningTotal = (r.running_total !== undefined && r.running_total !== null)
          ? parseFloat(r.running_total)
          : Math.max(0, Math.round((elapsedStayNights * nightlyRate - parseFloat(r.discount_amount || 0)) * 100) / 100);
        effectiveTotal = Math.max(total, runningTotal);
      }

      const effectiveRawRemaining = effectiveTotal - paid;
      const isCredit = effectiveRawRemaining < -0.005;
      const remaining = Math.max(0, effectiveRawRemaining);
      const fmtTotal = total.toLocaleString('en-US');
      const fmtEffTotal = effectiveTotal.toLocaleString('en-US');
      const fmtPaid = paid.toLocaleString('en-US');
      const fmtRem = remaining.toLocaleString('en-US');

      let paymentStatusForDisplay;
      if (isContract || isOverdue) {
        paymentStatusForDisplay = isCredit ? 'رصيد دائن' : (remaining <= 0.005 ? 'مدفوع بالكامل' : (paid > 0 ? 'مدفوع جزئياً' : 'غير مدفوع'));
      } else {
        paymentStatusForDisplay = isCredit ? 'مدفوع بالكامل' : (r.payment_status || 'غير مدفوع');
      }

      const overdueLabel = overdueDays === 0 ? 'متأخر اليوم'
        : overdueDays === 1 ? 'متأخر يوم'
          : overdueDays === 2 ? 'متأخر يومين'
            : overdueDays <= 10 ? `متأخر ${overdueDays} أيام` : `متأخر ${overdueDays} يوماً`;

      const expectedCheckoutTime = App.Helpers.getExpectedCheckoutTime
        ? App.Helpers.getExpectedCheckoutTime(r)
        : (isConfirmed && !isContract && r.check_out_date && r.check_out_date !== 'مفتوح' ? '14:00' : '');
      const departureTimeText = r.checkout_time || expectedCheckoutTime || '';

      const isRowLate = isLateCheckout || isOverdue;
      const delayHours = (isLateCheckout && App.Helpers.getCheckoutDelayHours) ? App.Helpers.getCheckoutDelayHours(r) : 0;

      return `
        <tr class="${isRowLate ? 'late-checkout-row' : ''}">
          <td style="font-family: monospace; font-weight: 700; color: var(--primary); white-space: nowrap;">#${r.id}</td>
          <td class="res-cell-guest">
            <div class="res-guest-name">${escapeHtml(r.guest_name)}</div>
            <div class="res-guest-meta">
              ${r.guest_id_number ? `<span>هوية: ${escapeHtml(r.guest_id_number)}</span>` : ''}
              ${r.guest_id_number && r.guest_phone ? `<span class="res-meta-dot">•</span>` : ''}
              ${r.guest_phone ? `<span dir="ltr"><bdi>${escapeHtml(r.guest_phone)}</bdi></span>` : ''}
            </div>
          </td>
          <td data-label="رقم الغرفة" style="white-space: nowrap; text-align: center;">
            <button type="button" class="checkout-room-chip clickable-room-chip" data-action="preview-reservation" data-id="${r.id}" title="عرض تفاصيل الغرفة ${escapeHtml(r.room_number)}">
              ${escapeHtml(r.room_number)}
            </button>
          </td>
          <td class="res-cell-dates">
            <div class="res-date-line">
              <span class="res-date-label">${isEarlyMorningCheckin ? 'وصول فعلي:' : 'وصول:'}</span>
              <span class="res-date-val"><bdi dir="ltr">${escapeHtml(arrivalDisplayDate)}</bdi></span>
              ${arrivalDisplayTime ? `<span class="res-time-val">${escapeHtml(arrivalDisplayTime)}</span>` : ''}
            </div>
            <div class="res-date-line">
              <span class="res-date-label">مغادرة:</span>
              <span class="res-date-val"><bdi dir="ltr">${escapeHtml(checkOutDisplay)}</bdi></span>
              ${departureTimeText ? `<span class="res-time-val">${escapeHtml(departureTimeText)}</span>` : ''}
            </div>
            ${(isOverdue || isLateCheckout) && !isContract ? `
              <div class="res-late-departure-tag" title="${escapeHtml(isOverdue ? overdueLabel : 'متأخر اليوم')}${(!isOverdue && delayHours > 0) ? ` (تأخير ${delayHours} ساعة)` : ''}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>${escapeHtml(isOverdue ? overdueLabel : 'متأخر اليوم')}${(!isOverdue && delayHours > 0) ? ` (${delayHours} س)` : ''}</span>
              </div>
            ` : ''}
          </td>
          <td class="res-cell-money">
            <div class="res-money-total">
              ${(isOverdue || isContract) && effectiveTotal > total ? `
                ${fmtEffTotal} ر.س <small class="res-accrued-tag">(مستحق)</small>
              ` : `
                ${fmtTotal} ر.س
              `}
            </div>
            <div class="res-money-sub muted">
              ${isCredit ? `
                <span>مدفوع: ${fmtPaid}</span> • <span class="res-money-sub credit">دائن: ${Math.abs(effectiveRawRemaining).toLocaleString('en-US')} ر.س</span>
              ` : (remaining > 0 ? `
                <span>مدفوع: ${fmtPaid}</span> • <span class="res-money-sub remaining">متبقي: ${fmtRem} ر.س</span>
              ` : `
                <span>مدفوع: ${fmtPaid} ر.س</span>
              `)}
            </div>
          </td>
          <td class="res-cell-payment">
            <div class="res-payment-badge-wrap">${getPaymentStatusBadge(paymentStatusForDisplay)}</div>
            <div class="res-payment-method-sub">${escapeHtml(r.payment_method || 'نقداً')}</div>
          </td>
          <td class="res-cell-status">
            <div class="res-status-badge-wrap">
              ${isRowLate
                ? `<span class="badge badge-unified badge-danger badge-res-late">${escapeHtml(isOverdue ? overdueLabel : 'متأخر اليوم')}</span>`
                : getReservationStatusBadge(r.status)}
            </div>
            <div class="res-booking-type-sub">
              ${escapeHtml(r.booking_type || 'يومي')}${(!isOverdue && delayHours > 0) ? ` • <span style="color: #b91c1c; font-weight: 700;">${delayHours} س تأخير</span>` : ''}
            </div>
          </td>
          <td style="text-align: center;">
            <div class="res-actions-pair">
              ${isConfirmed && canCheckOut ? `
                <button type="button" class="btn-res-action-primary action-checkout" data-action="checkout" data-id="${r.id}" title="تسجيل مغادرة وتسليم الغرفة" aria-label="تسجيل مغادرة وتسليم الغرفة">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                </button>
              ` : `
                <button type="button" class="btn-res-action-primary action-preview" data-action="preview-reservation" data-id="${r.id}" title="معاينة تفاصيل الحجز" aria-label="معاينة تفاصيل الحجز">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
              `}
              <button type="button" class="btn-res-action-overflow" data-action="overflow" data-id="${r.id}" title="خيارات إضافية" aria-label="خيارات إضافية">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Single DOM write (1 reflow vs N reflows for N rows) — critical for 100+ records
    allReservationsTableBody.innerHTML = rowsHtml;
  }

  // Overflow Actions Dropdown
  function openReservationsOverflowMenu(triggerBtn, reservationId) {
    const dropdown = document.getElementById('res-overflow-dropdown');
    if (!dropdown) return;

    if (dropdown.dataset.activeId === String(reservationId) && dropdown.style.display === 'flex') {
      closeReservationsOverflowMenu();
      return;
    }

    const r = findLoadedReservation(reservationId);
    if (!r) return;

    const isConfirmed = r.status === 'مؤكد';
    const hotelBizDate = getOperationalBusinessDate() || getLocalDateString();
    const isArrivalDate = r.check_in_date ? (r.check_in_date >= hotelBizDate) : false;
    const hasStarted = r.check_in_date ? !isArrivalDate : false;
    const canCheckOut = isConfirmed && (hotelBizDate >= r.check_in_date);
    const canCancel = isConfirmed && !hasStarted;
    const isContract = r.booking_type === 'عقد مفتوح';
    const total = parseFloat(r.total_price || 0);
    const paid = parseFloat((r.ledger_paid_amount ?? r.paid_amount) || 0);
    const remaining = Math.max(0, total - paid);
    const canCollectBalance = isConfirmed || r.status === 'ملغي جزئي' || (r.status === 'مكتمل' && remaining > 0.005);

    const items = [];

    // Preview
    items.push(`
      <button type="button" class="res-overflow-item" data-action="preview-reservation" data-id="${r.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        <span>معاينة تفاصيل الحجز</span>
      </button>
    `);

    // Edit guest
    items.push(`
      <button type="button" class="res-overflow-item" data-action="edit-guest" data-id="${r.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
        <span>تعديل بيانات النزيل</span>
      </button>
    `);

    // Extend stay
    if (isConfirmed && r.check_out_date && r.check_out_date !== 'مفتوح') {
      items.push(`
        <button type="button" class="res-overflow-item" data-action="extend" data-id="${r.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
          <span>تمديد فترة الإقامة</span>
        </button>
      `);
    }

    // Transfer room (Phase 1)
    if (isConfirmed && r.booking_type !== 'استخدام يومي') {
      items.push(`
        <button type="button" class="res-overflow-item" data-action="transfer" data-id="${r.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"></path><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><path d="M7 23l-4-4 4-4"></path><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
          <span>نقل الغرفة (Room Transfer)</span>
        </button>
      `);
    }

    // Add payment
    if (canCollectBalance && (remaining > 0 || (isConfirmed && isContract))) {
      items.push(`
        <button type="button" class="res-overflow-item" data-action="add-payment" data-id="${r.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
          <span>تسجيل دفعة سداد جديدة</span>
        </button>
      `);
    }

    // Checkout
    if (isConfirmed && canCheckOut) {
      items.push(`
        <button type="button" class="res-overflow-item" data-action="checkout" data-id="${r.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          <span>تسجيل خروج وتسليم الغرفة</span>
        </button>
      `);
    }

    // Invoice
    items.push(`
      <button type="button" class="res-overflow-item" data-action="invoice" data-id="${r.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h9l4 4v14H6z"></path><path d="M14 3v5h5M9 13h7M9 17h7"></path></svg>
        <span>طباعة الفاتورة / سند الإقامة</span>
      </button>
    `);

    // WhatsApp
    if (isConfirmed) {
      items.push(`
        <button type="button" class="res-overflow-item" data-action="whatsapp" data-id="${r.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          <span>مراسلة النزيل عبر واتساب</span>
        </button>
      `);
    }

    // Cancel / Void
    if (isConfirmed && canCancel) {
      const isSameDay = r.check_in_date === hotelBizDate;
      items.push(`
        <button type="button" class="res-overflow-item item-danger" data-action="cancel" data-id="${r.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="m5.6 5.6 12.8 12.8"></path></svg>
          <span>${isSameDay ? 'إبطال / إلغاء الحجز المباشر' : 'إلغاء الحجز'}</span>
        </button>
      `);
    }

    dropdown.innerHTML = items.join('');
    dropdown.dataset.activeId = String(reservationId);
    dropdown.style.display = 'flex';

    // Position dropdown near the button
    const btnRect = triggerBtn.getBoundingClientRect();
    const dWidth = dropdown.offsetWidth || 210;
    const dHeight = dropdown.offsetHeight || 220;

    let left = btnRect.right - dWidth;
    if (left < 10) left = btnRect.left;
    if (left + dWidth > window.innerWidth - 10) left = window.innerWidth - dWidth - 10;
    if (left < 10) left = 10;

    let top = btnRect.bottom + 4;
    if (top + dHeight > window.innerHeight - 10) {
      top = Math.max(10, btnRect.top - dHeight - 4);
    }

    dropdown.style.left = `${left}px`;
    dropdown.style.top = `${top}px`;
  }

  function closeReservationsOverflowMenu() {
    const dropdown = document.getElementById('res-overflow-dropdown');
    if (dropdown) {
      dropdown.style.display = 'none';
      dropdown.dataset.activeId = '';
    }
  }

  function setReservationFilterTab(filterValue) {
    currentReservationFilter = filterValue;
    const tabs = document.querySelectorAll('#res-filter-tabs .res-tab-item, #res-filter-tabs .filter-tab-btn');
    tabs.forEach(btn => {
      if (btn.dataset.filter === filterValue) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function updateActiveFilterChips() {
    const container = document.getElementById('res-active-chips-bar');
    const list = document.getElementById('res-active-chips-list');
    const badge = document.getElementById('res-filter-badge');
    if (!container || !list) return;

    const chips = [];
    let filterCount = 0;

    if (currentReservationFilter && currentReservationFilter !== 'all') {
      const statusLabels = {
        'مؤكد': 'الحالة: نشطة',
        'today': 'الحالة: اليوم',
        'late': 'الحالة: متأخرة',
        'مكتمل': 'الحالة: مكتملة',
        'ملغي': 'الحالة: ملغاة'
      };
      chips.push(`<span class="res-active-chip"><span>${statusLabels[currentReservationFilter] || currentReservationFilter}</span><button type="button" class="res-chip-close" data-chip-clear="status" title="إزالة الفلتر" aria-label="إزالة فلتر الحالة">&times;</button></span>`);
    }

    const payVal = reservationsPaymentTypeFilter?.value || 'all';
    if (payVal !== 'all') {
      filterCount++;
      const payLabels = {
        'unpaid': 'الدفع: غير مسدد (متبقي)',
        'paid': 'الدفع: مسدد بالكامل',
        'cash': 'طريقة الدفع: نقداً',
        'transfer': 'طريقة الدفع: تحويل بنكي',
        'card': 'طريقة الدفع: مدى / شبكة'
      };
      chips.push(`<span class="res-active-chip"><span>${payLabels[payVal] || payVal}</span><button type="button" class="res-chip-close" data-chip-clear="payment" title="إزالة الفلتر" aria-label="إزالة فلتر الدفع">&times;</button></span>`);
    }

    if (currentSortBy && currentSortBy !== 'id_desc') {
      filterCount++;
      const sortLabels = {
        'checkout_asc': 'الترتيب: موعد المغادرة',
        'checkin_desc': 'الترتيب: موعد الوصول',
        'total_desc': 'الترتيب: المبلغ الأعلى',
        'room_asc': 'الترتيب: رقم الغرفة'
      };
      chips.push(`<span class="res-active-chip"><span>${sortLabels[currentSortBy] || currentSortBy}</span><button type="button" class="res-chip-close" data-chip-clear="sort" title="إزالة الفلتر" aria-label="إزالة فلتر الترتيب">&times;</button></span>`);
    }

    const searchVal = String(searchAllReservations?.value || '').trim();
    if (searchVal) {
      chips.push(`<span class="res-active-chip"><span>بحث: "${escapeHtml(searchVal)}"</span><button type="button" class="res-chip-close" data-chip-clear="search" title="إزالة البحث" aria-label="إزالة البحث">&times;</button></span>`);
    }

    if (badge) {
      badge.textContent = filterCount;
      badge.style.display = filterCount > 0 ? 'inline-flex' : 'none';
    }

    if (chips.length > 0) {
      list.innerHTML = chips.join('');
      container.style.display = 'flex';
    } else {
      list.innerHTML = '';
      container.style.display = 'none';
    }
  }

  // Filter tabs for reservations
  resFilterTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      setReservationFilterTab(btn.dataset.filter || 'all');
      reservationsTablePage = 1;
      loadReservationsData();
    });
  });

  searchAllReservations.addEventListener('input', () => {
    clearTimeout(reservationsSearchDebounce);
    reservationsSearchDebounce = setTimeout(() => {
      reservationsTablePage = 1;
      loadReservationsData();
    }, 250);
  });

  if (reservationsPaymentTypeFilter) {
    reservationsPaymentTypeFilter.addEventListener('change', () => {
      reservationsTablePage = 1;
      loadReservationsData();
    });
  }

  // Popover & Filter UI
  const btnResFilters = document.getElementById('btn-res-filters');
  const resFiltersPopover = document.getElementById('res-filters-popover');
  const btnCloseResFilters = document.getElementById('btn-close-res-filters');
  const btnApplyResFilters = document.getElementById('btn-apply-res-filters');
  const btnResetResFilters = document.getElementById('btn-reset-res-filters');
  const resSortBySelect = document.getElementById('res-sort-by-select');
  const resActiveChipsBar = document.getElementById('res-active-chips-bar');
  const btnClearResFilters = document.getElementById('btn-clear-res-filters');

  if (btnResFilters && resFiltersPopover) {
    btnResFilters.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = resFiltersPopover.style.display === 'block';
      resFiltersPopover.style.display = isVisible ? 'none' : 'block';
    });

    if (btnCloseResFilters) {
      btnCloseResFilters.addEventListener('click', () => {
        resFiltersPopover.style.display = 'none';
      });
    }

    if (btnApplyResFilters) {
      btnApplyResFilters.addEventListener('click', () => {
        if (resSortBySelect) currentSortBy = resSortBySelect.value || 'id_desc';
        resFiltersPopover.style.display = 'none';
        loadReservationsData(true);
      });
    }

    if (btnResetResFilters) {
      btnResetResFilters.addEventListener('click', () => {
        if (resSortBySelect) resSortBySelect.value = 'id_desc';
        if (reservationsPaymentTypeFilter) reservationsPaymentTypeFilter.value = 'all';
        currentSortBy = 'id_desc';
        resFiltersPopover.style.display = 'none';
        loadReservationsData(true);
      });
    }

    document.addEventListener('click', (e) => {
      if (resFiltersPopover.style.display === 'block') {
        if (!resFiltersPopover.contains(e.target) && !btnResFilters.contains(e.target)) {
          resFiltersPopover.style.display = 'none';
        }
      }
    });
  }

  // Active Chips Clear & Clear All
  if (resActiveChipsBar) {
    resActiveChipsBar.addEventListener('click', (e) => {
      const clearBtn = e.target.closest('[data-chip-clear]');
      if (!clearBtn) return;
      const chipType = clearBtn.dataset.chipClear;
      if (chipType === 'status') {
        setReservationFilterTab('all');
      } else if (chipType === 'payment') {
        if (reservationsPaymentTypeFilter) reservationsPaymentTypeFilter.value = 'all';
      } else if (chipType === 'sort') {
        currentSortBy = 'id_desc';
        if (resSortBySelect) resSortBySelect.value = 'id_desc';
      } else if (chipType === 'search') {
        if (searchAllReservations) searchAllReservations.value = '';
      }
      loadReservationsData(true);
    });
  }

  if (btnClearResFilters) {
    btnClearResFilters.addEventListener('click', () => {
      setReservationFilterTab('all');
      if (reservationsPaymentTypeFilter) reservationsPaymentTypeFilter.value = 'all';
      currentSortBy = 'id_desc';
      if (resSortBySelect) resSortBySelect.value = 'id_desc';
      if (searchAllReservations) searchAllReservations.value = '';
      loadReservationsData(true);
    });
  }

  // Summary Cards Clicks
  const resSummaryCards = document.querySelectorAll('.res-summary-card');
  resSummaryCards.forEach(card => {
    card.addEventListener('click', () => {
      const target = card.dataset.summaryTarget;
      if (!target) return;
      if (target === 'rooms') {
        const roomsNavLink = document.querySelector('.nav-link[data-section="rooms"]');
        if (roomsNavLink) roomsNavLink.click();
        return;
      }
      if (target === 'unpaid') {
        if (reservationsPaymentTypeFilter) {
          reservationsPaymentTypeFilter.value = 'unpaid';
        }
        loadReservationsData(true);
        return;
      }
      if (target === 'مؤكد' || target === 'late') {
        setReservationFilterTab(target);
        loadReservationsData(true);
        return;
      }
    });
  });

  // Close overflow on resize or scroll
  window.addEventListener('resize', closeReservationsOverflowMenu);
  window.addEventListener('scroll', closeReservationsOverflowMenu, true);

  if (btnReservationsPrevPage) {
    btnReservationsPrevPage.addEventListener('click', () => {
      if (reservationsTablePage <= 1) return;
      reservationsTablePage -= 1;
      loadReservationsData();
    });
  }

  if (btnReservationsNextPage) {
    btnReservationsNextPage.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(reservationsTableTotal / reservationsTablePageSize));
      if (reservationsTablePage >= totalPages) return;
      reservationsTablePage += 1;
      loadReservationsData();
    });
  }

  // 2. SheetJS Export Reservations to Excel
  btnExportReservationsExcel.addEventListener('click', async () => {
    if (typeof XLSX === 'undefined') {
      showToast('مكتبة SheetJS غير متوفرة.', 'error');
      return;
    }

    try {
      btnExportReservationsExcel.disabled = true;
      const response = await window.api.getReservationsPage({
        page: 1,
        pageSize: reservationsTablePageSize,
        search: searchAllReservations.value || '',
        status: currentReservationFilter,
        paymentType: reservationsPaymentTypeFilter?.value || 'all',
        exportAll: true
      });
      if (!response || !response.success) {
        showToast(response?.error || 'تعذر تحميل الحجوزات للتصدير.', 'error');
        return;
      }
      const rows = response.data?.rows || [];
      if (rows.length === 0) {
        showToast('لا توجد حجوزات مطابقة للتصدير.', 'info');
        return;
      }

      const exportRows = rows.map(r => ({
        'رقم الحجز': r.id,
        'اسم النزيل': r.guest_name,
        'رقم الجوال': r.guest_phone || '',
        'رقم الهوية': r.guest_id_number || '',
        'رقم الغرفة': r.room_number,
        'نوع الغرفة': r.room_type,
        'تاريخ الوصول': r.check_in_date,
        'تاريخ المغادرة': r.check_out_date,
        'المبلغ الإجمالي': r.total_price,
        'حالة الحجز': r.status,
        'تاريخ الإنشاء': r.created_at
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportRows);

      ws['!cols'] = [
        { wch: 12 }, { wch: 26 }, { wch: 16 }, { wch: 18 },
        { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 14 },
        { wch: 16 }, { wch: 14 }, { wch: 20 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'الحجوزات');
      const filename = `hotel_reservations_${getLocalDateString()}.xlsx`;
      XLSX.writeFile(wb, filename);

      showToast(`تم تصدير ${exportRows.length} حجز إلى "${filename}" بنجاح!`, 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast(`فشل تصدير Excel: ${err.message}`, 'error');
    } finally {
      btnExportReservationsExcel.disabled = false;
    }
  });

  // 2. SheetJS Import Reservations from Excel
  inputImportReservationsExcel.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (!rows || rows.length === 0) {
          showToast('ملف Excel فارغ أو لا يحتوي على صفوف بيانات.', 'error');
          return;
        }

        const res = await window.api.bulkImportReservations(rows);
        if (res.success && res.data) {
          showToast(`تم استيراد ${res.data.inserted} حجز بنجاح! (تم تخطي ${res.data.skipped})`, 'success');
          await loadReservationsData(true);
          await loadOverviewData();
        } else {
          showToast(res.error || 'فشل استيراد الحجوزات.', 'error');
        }
      } catch (err) {
        console.error('Import error:', err);
        showToast(`خطأ في قراءة ملف Excel: ${err.message}`, 'error');
      } finally {
        inputImportReservationsExcel.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  });

  function loadRoomsData() { return window.DashboardApp.Helpers.loadRoomsData(); }


  function loadGuestsData(page) { return window.DashboardApp.Helpers.loadGuestsData(page); }

  // =========================================================================
  // SUBSEQUENT PAYMENT MODAL (تسجيل سداد دفعة جديدة للحجز)
  // =========================================================================

  let currentPayingReservation = null;
  const getReservationPaidForPayments = (reservation) => {
    const useLedgerBalance = reservation?.status === 'ملغي جزئي' && reservation?.payment_status === 'مدفوع جزئياً';
    const amount = useLedgerBalance ? reservation.ledger_paid_amount : reservation?.paid_amount;
    return roundMoney(amount || 0);
  };

  window.openAddPaymentModal = async function openAddPaymentModal(reservationId) {
    const modal = document.getElementById('add-payment-modal');
    if (!modal) {
      console.error('Modal #add-payment-modal not found in DOM');
      return;
    }

    const targetId = parseInt(reservationId, 10);
    if (!targetId || isNaN(targetId)) {
      showToast('رقم الحجز غير صالح.', 'error');
      return;
    }

    // Find in cache or fetch
    let res = findLoadedReservation(targetId);
    if (!res) {
      try {
        const allRes = await window.api.getAllReservations();
        if (allRes && allRes.success && allRes.data) {
          window.DashboardApp.State.reservationsCache = allRes.data;
          res = window.DashboardApp.State.reservationsCache.find(r => parseInt(r.id, 10) === targetId);
        }
      } catch (err) {
        console.error('Error fetching reservation for payment:', err);
      }
    }

    if (!res) {
      showToast('تعذر العثور على بيانات الحجز المطلوب.', 'error');
      return;
    }

    currentPayingReservation = res;
    const isContract = res.booking_type === 'عقد مفتوح';
    const businessToday = window.DashboardApp.State.businessDate || getLocalDateString();
    const checkOutDateStr = String(res.check_out_date || '').slice(0, 10);
    const isOverdue = res.status === 'مؤكد' && !isContract && checkOutDateStr && checkOutDateStr < businessToday;
    const total = roundMoney(res.total_price || 0);
    let effectiveTotal = total;
    let elapsedContractNights = 0;
    if (res.check_in_date && (isOverdue || (isContract && res.status === 'مؤكد'))) {
      const nightlyRate = Number(res.custom_nightly_price || res.price_per_night || 0);
      if (nightlyRate > 0) {
        const startParts = String(res.check_in_date).slice(0, 10).split('-').map(Number);
        const endParts = businessToday.slice(0, 10).split('-').map(Number);
        const elapsedNights = Math.max(1, Math.round((Date.UTC(endParts[0], endParts[1] - 1, endParts[2]) - Date.UTC(startParts[0], startParts[1] - 1, startParts[2])) / 86400000));
        elapsedContractNights = elapsedNights;
        const runningTotal = (res.running_total !== undefined && res.running_total !== null)
          ? Number(res.running_total)
          : Math.max(0, Math.round((elapsedNights * nightlyRate - Number(res.discount_amount || 0)) * 100) / 100);
        effectiveTotal = Math.max(total, runningTotal);
      }
    }
    const paid = getReservationPaidForPayments(res);
    const effectiveRawRemaining = roundMoney(effectiveTotal - paid);
    const isCredit = effectiveRawRemaining < -0.005;
    const remaining = Math.max(0, effectiveRawRemaining);

    const inputResId = document.getElementById('payment-reservation-id');
    const nameEl = document.getElementById('payment-modal-guest-name');
    const roomEl = document.getElementById('payment-modal-room-info');
    const totalEl = document.getElementById('payment-modal-total-price');
    const paidEl = document.getElementById('payment-modal-paid-amount');
    const remEl = document.getElementById('payment-modal-remaining-balance');
    const inputAmount = document.getElementById('payment-new-amount');

    if (inputResId) inputResId.value = res.id;
    if (nameEl) nameEl.textContent = res.guest_name || 'نزيل';
    if (roomEl) roomEl.textContent = `حجز #${res.id} - غرفة ${res.room_number || '-'}${isContract ? ' (عقد مفتوح)' : ''}${isOverdue ? ' (متأخر عن المغادرة)' : ''}`;
    if (totalEl) {
      if ((isOverdue || isContract) && effectiveTotal > total) {
        totalEl.innerHTML = `${effectiveTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال <small style="color: #b91c1c; font-size: 0.75rem; font-weight: 700;">(${isContract ? `المستحق حتى اليوم (${elapsedContractNights} ليالٍ)` : 'المستحق حتى اليوم مع التأخير'})</small>`;
      } else {
        totalEl.textContent = `${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال`;
      }
    }
    if (paidEl) paidEl.textContent = `${paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال`;
    if (remEl) {
      if (isCredit) {
        remEl.textContent = `رصيد دائن: ${Math.abs(effectiveRawRemaining).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال`;
        remEl.style.color = '#2563eb';
      } else {
        remEl.textContent = `${remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال`;
        remEl.style.color = remaining > 0 ? '#dc2626' : '#05963d';
      }
    }

    if (inputAmount) {
      if (isContract || isOverdue) {
        inputAmount.value = remaining > 0 ? remaining.toFixed(2) : '';
        inputAmount.removeAttribute('max');
      } else {
        inputAmount.value = remaining > 0 ? remaining.toFixed(2) : '';
        inputAmount.max = remaining > 0 ? remaining.toFixed(2) : '';
      }
    }

    modal.style.display = 'flex';
    setTimeout(() => {
      if (inputAmount) {
        inputAmount.focus();
        inputAmount.select();
      }
    }, 50);
  };

  function closeAddPaymentModal() {
    if (addPaymentModal) {
      addPaymentModal.style.display = 'none';
    }
    if (addPaymentForm) {
      addPaymentForm.reset();
    }
    currentPayingReservation = null;
  }

  if (btnClosePaymentModal) {
    btnClosePaymentModal.addEventListener('click', closeAddPaymentModal);
  }

  if (btnCancelPaymentModal) {
    btnCancelPaymentModal.addEventListener('click', closeAddPaymentModal);
  }

  if (addPaymentModal) {
    addPaymentModal.addEventListener('click', (e) => {
      if (e.target === addPaymentModal) closeAddPaymentModal();
    });
  }

  if (btnPayFullRemaining) {
    btnPayFullRemaining.addEventListener('click', () => {
      if (!currentPayingReservation) return;
      const total = roundMoney(currentPayingReservation.total_price || 0);
      const paid = getReservationPaidForPayments(currentPayingReservation);
      const isContract = currentPayingReservation.booking_type === 'عقد مفتوح';
      const rawRemaining = roundMoney(total - paid);
      const remaining = isContract ? Math.max(0, rawRemaining) : Math.max(0, rawRemaining);
      if (paymentNewAmount && remaining > 0) {
        paymentNewAmount.value = remaining.toFixed(2);
        paymentNewAmount.focus();
      }
    });
  }

  if (addPaymentForm) {
    addPaymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const resId = parseInt(paymentReservationId.value, 10);
      const newAmount = roundMoney(paymentNewAmount.value);
      const method = paymentMethodSelectModal ? paymentMethodSelectModal.value : 'نقداً';

      if (!resId || isNaN(resId)) {
        showToast('معرف الحجز غير صالح.', 'error');
        return;
      }
      if (!Number.isFinite(newAmount) || newAmount <= 0) {
        showToast('يرجى إدخال مبلغ سداد صحيح وموجب أكبر من الصفر.', 'error');
        return;
      }

      if (currentPayingReservation && currentPayingReservation.booking_type !== 'عقد مفتوح') {
        const total = roundMoney(currentPayingReservation.total_price || 0);
        const paid = getReservationPaidForPayments(currentPayingReservation);
        const remaining = Math.max(0, roundMoney(total - paid));
        if (newAmount - remaining > 0.005) {
          showToast(`المبلغ المدخل (${newAmount.toLocaleString()} ريال) يتجاوز الرصيد المتبقي المستحق (${remaining.toLocaleString()} ريال).`, 'error');
          return;
        }
      }

      const activeUserId = localStorage.getItem('currentUserId') || (App.State.currentUser ? App.State.currentUser.id : null);

      try {
        const btnSave = document.getElementById('btn-save-payment');
        if (btnSave) {
          btnSave.disabled = true;
          btnSave.textContent = 'جاري الحفظ...';
        }

        const res = await window.api.addPayment({
          reservationId: resId,
          newAmount: newAmount,
          paymentMethod: method,
          userId: activeUserId ? parseInt(activeUserId, 10) : null
        });

        if (res.success) {
          const statusText = res.isFullyPaid || res.paymentStatus === 'مدفوع بالكامل' ? 'مدفوع بالكامل ✓' : 'مدفوع جزئياً';
          const receiptMsg = res.receiptNumber ? ` (رقم السند: ${res.receiptNumber})` : '';
          showToast(`تم تسجيل سداد مبلغ ${newAmount.toLocaleString()} ريال بنجاح!${receiptMsg} - [${statusText}]`, 'success');
          closeAddPaymentModal();

          // Refresh reservations, overview, and rooms data
          await Promise.all([
            loadReservationsData(),
            loadOverviewData(),
            loadRoomsData()
          ]);
        } else {
          showToast(res.error || 'فشل تسجيل الدفعة.', 'error');
        }
      } catch (err) {
        console.error('Payment submit error:', err);
        showToast(`خطأ أثناء تسجيل الدفعة: ${err.message}`, 'error');
      } finally {
        const btnSave = document.getElementById('btn-save-payment');
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.innerHTML = '<span>حفظ وتأكيد السداد ✓</span>';
        }
      }
    });
  }

  // =========================================================================
  // OPEN CONTRACT SETTLEMENT & CHECKOUT MODAL
  // =========================================================================

  let currentSettlingReservation = null;
  // Last settlement preview fetched from the backend (non-contract bookings only)
  let currentSettlementPreview = null;
  let currentDepositAvailable = 0;
  let currentDepositLegacyUnreconciled = false;
  // Monthly early-checkout policy state, driven entirely by the backend preview.
  // canChoosePolicy comes from the main process (session role); it is never
  // inferred from anything the renderer itself knows.
  let settlePolicyState = { applicable: false, canChoose: false, mismatch: false, bookedNights: null, contractValue: null, actualValue: null, bookedCheckOutDate: null };

  /** The policy currently selected in the modal, validated against what is allowed. */
  function getSelectedCheckoutPolicy() {
    if (!settlePolicyState.applicable) return undefined;
    if (!settlePolicyState.canChoose) return undefined;
    const picked = settlePolicyActual && settlePolicyActual.checked ? 'actual' : 'contract';
    // A non-Admin can never select 'actual', whatever the radio state says.
    return picked === 'actual' ? 'actual' : 'contract';
  }

  function getSelectedCheckoutPolicyReason() {
    if (getSelectedCheckoutPolicy() !== 'actual') return undefined;
    return settlePolicyReasonInput ? settlePolicyReasonInput.value.trim() : '';
  }

  /**
   * The policy fields to send with a checkout. Only ever populated when the backend
   * preview said the case applies AND this session may choose, so a renderer cannot
   * request the Admin exception by itself. Both are stripped again in the main process.
   */
  function getCheckoutPolicyPayload() {
    const policy = getSelectedCheckoutPolicy();
    if (!policy) return {};
    return { checkoutPolicy: policy, checkoutPolicyReason: getSelectedCheckoutPolicyReason() };
  }

  /** Reset the modal's policy controls whenever a new settlement preview loads. */
  function resetCheckoutPolicyControls() {
    if (settlePolicyContract) settlePolicyContract.checked = true;
    if (settlePolicyActual) settlePolicyActual.checked = false;
    if (settlePolicyReasonInput) settlePolicyReasonInput.value = '';
    if (settlePolicyReasonWrap) settlePolicyReasonWrap.style.display = 'none';
    if (settlePolicySection) settlePolicySection.style.display = 'none';
  }

  /**
   * The value the modal must charge. A monthly early checkout defaults to the
   * contract value; the Admin may switch to actual-nights, which re-fetches the
   * preview so every figure comes from the backend rather than being recomputed here.
   */
  function getSettlementChargeTotal() {
    const isContract = currentSettlingReservation && currentSettlingReservation.booking_type === 'عقد مفتوح';
    if (!isContract && currentSettlementPreview) {
      const useActual = getSelectedCheckoutPolicy() === 'actual';
      const value = useActual ? currentSettlementPreview.actualValue : (settlePolicyState.applicable ? settlePolicyState.contractValue : null);
      const total = value !== null && value !== undefined ? value : currentSettlementPreview.netCharge;
      return roundMoney(total);
    }
    return roundMoney(settleFinalTotalInput ? settleFinalTotalInput.value : 0);
  }

  /** Draw the Admin-only monthly early-checkout policy block. */
  function renderCheckoutPolicySection() {
    if (!settlePolicySection) return;
    if (!settlePolicyState.applicable) {
      settlePolicySection.style.display = 'none';
      return;
    }
    settlePolicySection.style.display = 'block';

    const contract = Number(settlePolicyState.contractValue || 0).toFixed(2);
    const actual = Number(settlePolicyState.actualValue || 0).toFixed(2);
    const nightsWord = settlePolicyState.bookedNights === 1 ? 'ليلة' : 'ليالٍ';

    const lines = [
      `تاريخ المغادرة الأصلي المحجوز: ${settlePolicyState.bookedCheckOutDate || '-'}`,
      `قيمة العقد (${settlePolicyState.bookedNights} ${nightsWord} محجوزة): ${contract} ريال`,
      `قيمة الليالي الفعلية: ${actual} ريال`
    ];
    if (settlePolicyState.mismatch) {
      if (settlePolicyState.canChoose) {
        lines.push('⚠ تنبيه: قيمة العقد لا تطابق الإجمالي المخزن للحجز. للمتابعة، يجب اختيار "الليالي الفعلية" وإدخال سبب الاستثناء.');
      } else {
        lines.push('⛔ تنبيه: قيمة العقد لا تطابق الإجمالي المخزن للحجز. لا يمكن للموظف إتمام تسجيل المغادرة، ويتطلب الحجز تدخل مدير النظام لاعتماد الليالي الفعلية.');
      }
    } else if (!settlePolicyState.canChoose) {
      lines.push('يُحتسب تلقائياً بقيمة العقد.');
    }
    if (settlePolicyContract) settlePolicyContract.disabled = !settlePolicyState.canChoose;
    if (settlePolicyActual) settlePolicyActual.disabled = !settlePolicyState.canChoose;
    if (settlePolicySummary) {
      settlePolicySummary.innerHTML = lines
        .map((line, index) => {
          const safe = escapeHtml(line);
          const style = (index === 0 || (settlePolicyState.mismatch && index === 3))
            ? ' style="color:#b91c1c; font-weight:700;"' : '';
          return `<div${style}>${safe}</div>`;
        })
        .join('');
    }
  }

  function getDepositCheckoutPayload() {
    const disposition = settleDepositDisposition ? settleDepositDisposition.value : 'refund';
    return {
      depositDisposition: disposition,
      depositRetainAmount: disposition === 'retain' ? (parseFloat(settleDepositRetainAmount?.value || 0) || 0) : 0,
      depositRetainReason: disposition === 'retain' ? (settleDepositRetainReason?.value || '').trim() : '',
      depositRefundMethod: settleRefundMethodSelect ? settleRefundMethodSelect.value : 'نقداً'
    };
  }

  // -------------------------------------------------------------------------
  // updateSettleCalculations: render the modal's balance section from the
  // backend preview (currentSettlementPreview for non-contract) or from the
  // live fields for open-contract.
  // -------------------------------------------------------------------------
  
  function updateDiscountSectionVisibility() {
    const settleDiscountSection = document.getElementById('settle-discount-section');
    if (!settleDiscountSection) return;
    const activeRole = localStorage.getItem('currentUserRole') || (App.State.currentUser ? App.State.currentUser.role : null);
    const isAdmin = activeRole === 'Admin';
    if (!isAdmin) {
      settleDiscountSection.style.display = 'none';
      return;
    }
    
    const settlePolicyContract = document.getElementById('settle-policy-contract');
    if (settlePolicyState && settlePolicyState.applicable && settlePolicyContract && settlePolicyContract.checked) {
      // Hide for "Contract Value" because the contract is fixed and ignores checkout discounts
      settleDiscountSection.style.display = 'none';
    } else {
      settleDiscountSection.style.display = 'block';
    }
  }

  function updateSettleCalculations() {
    if (!currentSettlingReservation) return;

    const isContract = currentSettlingReservation.booking_type === 'عقد مفتوح';

    let finalTotal, paidSoFar;
    if (!isContract && currentSettlementPreview) {
      // Non-contract: use authoritative backend values. For a monthly early checkout
      // this is the CONTRACT value unless an Admin selected the actual-nights
      // exception — netCharge alone is the actual-nights figure and would offer a
      // large bogus refund on a fully-paid monthly booking.
      finalTotal = getSettlementChargeTotal();
      if (settleFinalTotalInput) settleFinalTotalInput.value = finalTotal.toFixed(2);
      paidSoFar  = currentSettlementPreview.paidAmount;
    } else {
      // Open-contract (or fallback before preview arrives): use live field
      finalTotal = roundMoney(settleFinalTotalInput ? settleFinalTotalInput.value : 0);
      paidSoFar  = roundMoney(currentSettlingReservation.paid_amount || 0);
    }

    const beforeDepositBalance = roundMoney(finalTotal - paidSoFar);
    const requestedDepositApply = settleDepositDisposition?.value === 'apply'
      ? Math.max(0, Math.min(currentDepositAvailable, beforeDepositBalance)) : 0;
    const netBalance = roundMoney(beforeDepositBalance - requestedDepositApply);

    // Discount hint (for open-contract only; non-contract discount is in the preview)
    if (isContract) {
      const discountVal = parseFloat(settleDiscountInput ? settleDiscountInput.value : 0) || 0;
      if (settleBreakdownHint) {
        if (discountVal > 0) {
          settleBreakdownHint.textContent = `(الخصم المطبق: ${discountVal.toFixed(2)} ريال)`;
          settleBreakdownHint.style.color = '#b91c1c';
        } else {
          settleBreakdownHint.textContent = '(الأساس - الخصم)';
          settleBreakdownHint.style.color = '#64748b';
        }
      }
    } else if (currentSettlementPreview) {
      const disc = currentSettlementPreview.discountApplied || 0;
      if (settleBreakdownHint) {
        if (disc > 0) {
          settleBreakdownHint.textContent = `(الخصم المطبق: ${disc.toFixed(2)} ريال)`;
          settleBreakdownHint.style.color = '#b91c1c';
        } else {
          settleBreakdownHint.textContent = '(الأساس - الخصم)';
          settleBreakdownHint.style.color = '#64748b';
        }
      }
    }

    const isPolicyMismatchBlocked = Boolean(
      settlePolicyState.applicable &&
      settlePolicyState.mismatch &&
      (!settlePolicyState.canChoose || (settlePolicyContract && settlePolicyContract.checked))
    );

    if (isPolicyMismatchBlocked) {
      if (settleBalanceBox) {
        settleBalanceBox.style.background = '#fff1f2';
        settleBalanceBox.style.borderColor = '#fecaca';
      }
      if (settleBalanceLabel) {
        settleBalanceLabel.textContent = 'حالة الحساب';
        settleBalanceLabel.style.color = '#991b1b';
      }
      if (settleBalanceValue) {
        settleBalanceValue.textContent = 'تعارض في بيانات العقد';
        settleBalanceValue.style.color = '#b91c1c';
        settleBalanceValue.style.fontSize = '1.05rem';
      }
      if (settleBalanceSub) {
        settleBalanceSub.textContent = settlePolicyState.canChoose
          ? '(يرجى اختيار "الليالي الفعلية" للمتابعة)'
          : '(يتطلب تدخل واعتماد مدير النظام)';
        settleBalanceSub.style.color = '#b91c1c';
      }
      if (settlePaymentSection) settlePaymentSection.style.display = 'none';
      if (settleRefundBanner) settleRefundBanner.style.display = 'none';
      if (settlePayNowInput) settlePayNowInput.value = '0.00';
      if (settleRefundAmountInput) settleRefundAmountInput.value = '0.00';
      if (btnConfirmSettleCheckout) {
        btnConfirmSettleCheckout.disabled = true;
        btnConfirmSettleCheckout.style.opacity = '0.65';
        btnConfirmSettleCheckout.style.cursor = 'not-allowed';
        btnConfirmSettleCheckout.textContent = settlePolicyState.canChoose
          ? 'اختر الليالي الفعلية للمتابعة ⚠'
          : 'يتطلب اعتماد مدير النظام ⚠';
      }
      return;
    }

    if (btnConfirmSettleCheckout) {
      btnConfirmSettleCheckout.disabled = false;
      btnConfirmSettleCheckout.style.opacity = '1';
      btnConfirmSettleCheckout.style.cursor = 'pointer';
    }

    if (netBalance > 0.005) {
      // Guest owes money
      if (settleBalanceBox) { settleBalanceBox.style.background = '#fef2f2'; settleBalanceBox.style.borderColor = '#fca5a5'; }
      if (settleBalanceLabel) { settleBalanceLabel.textContent = 'المتبقي للتحصيل'; settleBalanceLabel.style.color = '#991b1b'; }
      if (settleBalanceValue) { settleBalanceValue.textContent = `${netBalance.toFixed(2)} ر.س`; settleBalanceValue.style.color = '#dc2626'; }
      if (settleBalanceSub) { settleBalanceSub.textContent = '(مستحق على النزيل)'; settleBalanceSub.style.color = '#dc2626'; }
      if (settlePaymentSection) settlePaymentSection.style.display = 'block';
      if (settlePayNowInput) settlePayNowInput.value = netBalance.toFixed(2);
      if (settleRefundBanner) settleRefundBanner.style.display = 'none';
      if (btnConfirmSettleCheckout) btnConfirmSettleCheckout.textContent = 'تأكيد السداد وتسجيل المغادرة ✓';
    } else if (netBalance < -0.005) {
      // Guest overpaid — refund due
      const absCredit = Math.abs(netBalance);
      if (settleBalanceBox) { settleBalanceBox.style.background = '#eff6ff'; settleBalanceBox.style.borderColor = '#93c5fd'; }
      if (settleBalanceLabel) { settleBalanceLabel.textContent = 'استرداد للنزيل'; settleBalanceLabel.style.color = '#1e40af'; }
      if (settleBalanceValue) { settleBalanceValue.textContent = `${absCredit.toFixed(2)} ر.س`; settleBalanceValue.style.color = '#2563eb'; }
      if (settleBalanceSub) { settleBalanceSub.textContent = '(مبلغ مسترد للنزيل)'; settleBalanceSub.style.color = '#2563eb'; }
      if (settlePaymentSection) settlePaymentSection.style.display = 'none';
      if (settlePayNowInput) settlePayNowInput.value = '0.00';
      if (settleRefundBanner) settleRefundBanner.style.display = 'block';
      if (settleRefundAmount) settleRefundAmount.textContent = `${absCredit.toFixed(2)} ر.س`;
      if (settleRefundAmountInput) settleRefundAmountInput.value = absCredit.toFixed(2);
      if (btnConfirmSettleCheckout) btnConfirmSettleCheckout.textContent = 'تأكيد الاسترداد وتسجيل المغادرة ✓';
    } else {
      // Perfectly balanced
      if (settleBalanceBox) { settleBalanceBox.style.background = '#f0fdf5'; settleBalanceBox.style.borderColor = '#86efaf'; }
      if (settleBalanceLabel) { settleBalanceLabel.textContent = 'صافي الحساب'; settleBalanceLabel.style.color = '#166535'; }
      if (settleBalanceValue) { settleBalanceValue.textContent = '0.00 ر.س'; settleBalanceValue.style.color = '#05963d'; }
      if (settleBalanceSub) { settleBalanceSub.textContent = '(الحساب خالص بالكامل)'; settleBalanceSub.style.color = '#05963d'; }
      if (settlePaymentSection) settlePaymentSection.style.display = 'none';
      if (settlePayNowInput) settlePayNowInput.value = '0.00';
      if (settleRefundBanner) settleRefundBanner.style.display = 'none';
      if (btnConfirmSettleCheckout) btnConfirmSettleCheckout.textContent = 'تأكيد تسجيل المغادرة ✓';
    }
  }

  // -------------------------------------------------------------------------
  // openContractSettleModal: fetch backend preview first for non-contract;
  // populate all fields from authoritative data.
  // -------------------------------------------------------------------------
  async function openContractSettleModal(res) {
    if (!res) return;
    currentSettlingReservation = res;
    currentSettlementPreview = null;

    const todayStr = getOperationalBusinessDate() || getLocalDateString();
    const isContract = res.booking_type === 'عقد مفتوح';
    const paidSoFar = roundMoney(res.paid_amount || 0);
    currentDepositAvailable = Math.max(0, parseFloat(res.deposit_ledger_balance || 0) || 0);
    currentDepositLegacyUnreconciled = Number(res.deposit_legacy_unreconciled || 0) === 1;

    updateDiscountSectionVisibility();

    if (settleReservationId) settleReservationId.value = res.id;
    if (settleLateCheckoutSection) settleLateCheckoutSection.style.display = !isContract && isReservationOverdue(res) ? 'block' : 'none';
    if (settleLateCheckoutFeeInput) settleLateCheckoutFeeInput.value = '0';
    if (settleNightsLabel) settleNightsLabel.textContent = res.booking_type === 'استخدام يومي' ? 'وحدات الاستخدام:' : 'عدد الليالي المقضاة:';
    if (settleRateCalculationHint) settleRateCalculationHint.textContent = res.booking_type === 'استخدام يومي' ? '(أيام الاستخدام × سعر اليوم)' : '(الليالي × سعر الليلة)';
    if (settleGuestName) settleGuestName.textContent = res.guest_name || 'نزيل';
    const contractTypeLabel = isContract ? `عقد #${res.id}` : `حجز #${res.id}`;
    if (settleRoomInfo) settleRoomInfo.textContent = `غرفة ${res.room_number || '-'} (${contractTypeLabel})`;
    if (settleCheckinDate) settleCheckinDate.textContent = res.check_in_date || todayStr;
    if (settleCheckoutDate) settleCheckoutDate.textContent = todayStr;
    if (settlePaidAmountDisplay) settlePaidAmountDisplay.textContent = `${paidSoFar.toFixed(2)} ر.س`;

    if (!isContract) {
      // Non-contract: fetch authoritative settlement from backend
      try {
        const previewRes = await window.api.checkoutPreview(res.id, {});
        if (previewRes && previewRes.success && previewRes.data) {
          currentSettlementPreview = previewRes.data;
          const s = currentSettlementPreview;
          currentDepositAvailable = Math.max(0, Number(s.depositAvailable || 0));
          currentDepositLegacyUnreconciled = Boolean(s.depositLegacyUnreconciled);

          // Monthly early-checkout policy. Everything here comes from the backend
          // preview; canChoosePolicy is decided in the main process from the session.
          settlePolicyState = {
            applicable: Boolean(s.isMonthlyEarlyCheckout),
            canChoose: Boolean(s.canChoosePolicy),
            mismatch: Boolean(s.contractValueMismatch),
            bookedNights: s.bookedNights ?? null,
            contractValue: s.contractValue ?? null,
            actualValue: s.actualValue ?? null,
            bookedCheckOutDate: s.bookedCheckOutDate ?? null
          };
          resetCheckoutPolicyControls();
          renderCheckoutPolicySection();
          updateDiscountSectionVisibility();

          const isDayUse = res.booking_type === 'استخدام يومي';
          const nightsLabel = isDayUse ? 'يوم استخدام' : (s.actualNights === 1 ? 'ليلة' : 'ليالٍ');
          const rateUnit = isDayUse ? 'ر.س/يوم' : 'ر.س/ليلة';
          const rateNote = res.booking_type === 'حجز شهري' ? ' - سعر الشهر المعتمد' : (res.custom_nightly_price ? ' - سعر خاص' : '');
          if (settleNightsCount) {
            if (settlePolicyState.applicable) {
              // Show the contract basis, not just the elapsed nights, so the
              // receptionist can see WHY the full value is being charged.
              const nightsWord = settlePolicyState.bookedNights === 1 ? 'ليلة' : 'ليالٍ';
              settleNightsCount.textContent =
                `${s.actualNights} ${nightsLabel} فعلية من ${settlePolicyState.bookedNights} ${nightsWord} محجوزة ` +
                (res.booking_type === 'حجز شهري'
                  ? `(قيمة الشهر ${Number(settlePolicyState.contractValue || 0).toLocaleString()} ر.س)`
                  : `(بسعر ${s.effectiveNightlyRate.toLocaleString()} ${rateUnit}${rateNote})`);
            } else {
              settleNightsCount.textContent = res.booking_type === 'حجز شهري'
                ? `${s.actualNights} ${nightsLabel} (قيمة الشهر ${Number(s.baseCharge || 0).toLocaleString()} ر.س)`
                : `${s.actualNights} ${nightsLabel} (بسعر ${s.effectiveNightlyRate.toLocaleString()} ${rateUnit}${rateNote})`;
            }
          }
          if (settleTotalPriceDisplay) {
            // Under the contract policy the chargeable base is the full booked value.
            const baseShown = settlePolicyState.applicable ? settlePolicyState.contractValue : s.baseCharge;
            settleTotalPriceDisplay.textContent = `${Number(baseShown).toFixed(2)} ر.س`;
          }
          if (settleFinalTotalInput) settleFinalTotalInput.value = s.netCharge.toFixed(2);
          // Pre-fill the discount with the amount STORED on the reservation, not
          // s.discountApplied. That field is the PRORATED discount for the actual-nights
          // path (500 over 30 nights -> 16.67), so prefilling it made an untouched
          // checkout submit a number far from the stored one, which the DB reads as "a
          // new discount was added at checkout" and then demands a reason for - even
          // though the receptionist changed nothing and the booking's discount reason
          // is optional. The stored amount is what will be compared on submit.
          if (settleDiscountInput) {
            const storedDiscount = Number(res.discount_amount || 0);
            settleDiscountInput.value = storedDiscount > 0 ? storedDiscount.toFixed(2) : '0';
          }
          if (settleDiscountReasonInput) settleDiscountReasonInput.value = res.discount_reason || '';
        } else {
          // Fallback: compute from cache. No authoritative preview, so the policy
          // state stays inert and the modal behaves exactly as it did before.
          settlePolicyState = { applicable: false, canChoose: false, mismatch: false, bookedNights: null, contractValue: null, actualValue: null, bookedCheckOutDate: null };
          resetCheckoutPolicyControls();
          const room = window.DashboardApp.State.roomsCache.find(rm => rm.id === res.room_id);
          const pricePerNight = parseFloat(res.custom_nightly_price || res.price_per_night || (room ? room.price_per_night : 0)) || 0;
          const [y1, m1, d1] = (res.check_in_date || todayStr).split('-').map(Number);
          const [y2, m2, d2] = todayStr.split('-').map(Number);
          const nights = Math.max(1, Math.round((Date.UTC(y2, m2-1, d2) - Date.UTC(y1, m1-1, d1)) / 86400000));
          const base = res.booking_type === 'حجز شهري'
            ? roundMoney((Number(res.monthly_rate_snapshot) || (pricePerNight * MONTHLY_PACKAGE_NIGHTS)) + Number(res.monthly_extension_amount || 0))
            : roundMoney(nights * pricePerNight);
          const existDisc = roundMoney(res.discount_amount || 0);
          const [bookedYear, bookedMonth, bookedDay] = (res.check_out_date || '').split('-').map(Number);
          const bookedEndUtc = Date.UTC(bookedYear, bookedMonth - 1, bookedDay);
          const checkInUtc = Date.UTC(y1, m1 - 1, d1);
          const bookedNights = Number.isFinite(bookedEndUtc) && bookedEndUtc > checkInUtc
            ? Math.max(1, Math.round((bookedEndUtc - checkInUtc) / 86400000))
            : nights;
          const appliedDiscount = nights < bookedNights ? 0 : Math.min(base, existDisc);
          const net = Math.max(0, roundMoney(base - appliedDiscount));
          if (settleNightsCount) settleNightsCount.textContent = `${nights} ${nights === 1 ? 'ليلة' : 'ليالٍ'} (بسعر ${pricePerNight.toLocaleString()} ر.س/ليلة)`;
          if (settleTotalPriceDisplay) settleTotalPriceDisplay.textContent = `${base.toFixed(2)} ر.س`;
          if (settleFinalTotalInput) settleFinalTotalInput.value = net.toFixed(2);
          if (settleDiscountInput) settleDiscountInput.value = appliedDiscount > 0 ? appliedDiscount.toFixed(2) : '0';
          if (settleDiscountReasonInput) settleDiscountReasonInput.value = res.discount_reason || '';
        }
      } catch (e) {
        showToast('تعذر تحميل بيانات التسوية. يرجى المحاولة مجدداً.', 'error');
      }
    } else {
      // Open contract: compute locally (unchanged behaviour)
      const room = window.DashboardApp.State.roomsCache.find(rm => rm.id === res.room_id);
      const pricePerNight = parseFloat(res.custom_nightly_price || res.price_per_night || (room ? room.price_per_night : 0)) || 0;
      if (settlePricePerNightInput) settlePricePerNightInput.value = pricePerNight;
      const [y1, m1, d1] = (res.check_in_date || todayStr).split('-').map(Number);
      const [y2, m2, d2] = todayStr.split('-').map(Number);
      const nights = Math.max(1, Math.round((Date.UTC(y2, m2-1, d2) - Date.UTC(y1, m1-1, d1)) / 86400000));
      const calculatedBase = roundMoney(nights * pricePerNight);
      const existingDiscount = roundMoney(res.discount_amount || 0);
      const rateNote = res.custom_nightly_price ? ' - سعر خاص' : '';
      if (settleNightsCount) settleNightsCount.textContent = `${nights} ${nights === 1 ? 'ليلة' : 'ليالٍ'} (بسعر ${pricePerNight.toLocaleString()} ر.س/ليلة${rateNote})`;
      if (settleTotalPriceDisplay) settleTotalPriceDisplay.textContent = `${calculatedBase.toFixed(2)} ر.س`;
      if (settleDiscountInput) settleDiscountInput.value = existingDiscount > 0 ? existingDiscount.toFixed(2) : '0';
      if (settleDiscountReasonInput) settleDiscountReasonInput.value = res.discount_reason || '';
      const initialNet = Math.max(0, calculatedBase - existingDiscount);
      if (settleFinalTotalInput) settleFinalTotalInput.value = initialNet.toFixed(2);
    }

    // Only Admin may edit the open-contract final total; other totals are server-calculated.
    if (settleFinalTotalInput) {
      const isAdmin = App.State.currentUser && App.State.currentUser.role === 'Admin';
      if (isContract && isAdmin) {
        settleFinalTotalInput.removeAttribute('readonly');
        settleFinalTotalInput.style.background = '#f8fafc';
        settleFinalTotalInput.style.cursor = '';
      } else {
        settleFinalTotalInput.setAttribute('readonly', 'readonly');
        settleFinalTotalInput.style.background = '#f1f5f9';
        settleFinalTotalInput.style.cursor = 'default';
      }
    }

    if (settleDepositSection) {
      const showDeposit = currentDepositAvailable > 0 || currentDepositLegacyUnreconciled;
      settleDepositSection.style.display = showDeposit ? 'block' : 'none';
      if (settleDepositHeld) settleDepositHeld.textContent = `${currentDepositAvailable.toFixed(2)} ر.س`;
      if (settleDepositDisposition) settleDepositDisposition.disabled = currentDepositAvailable <= 0;
      if (settleDepositLegacyWarning) {
        settleDepositLegacyWarning.style.display = currentDepositLegacyUnreconciled ? 'block' : 'none';
        if (currentDepositLegacyUnreconciled) {
          const oldAmount = Number(res.deposit_amount || 0).toLocaleString();
          settleDepositLegacyWarning.textContent = `يوجد رصيد قديم بقيمة ${oldAmount} ر.س بلا سند حركة؛ لن يرده النظام تلقائياً قبل مراجعته.`;
        }
      }
      if (btnReconcileLegacyDeposit) {
        const activeRole = localStorage.getItem('currentUserRole') || (App.State.currentUser ? App.State.currentUser.role : null);
        btnReconcileLegacyDeposit.style.display = currentDepositLegacyUnreconciled && activeRole === 'Admin' ? 'inline-block' : 'none';
      }
      if (settleDepositDisposition) settleDepositDisposition.value = 'refund';
      if (settleDepositRetainFields) settleDepositRetainFields.style.display = 'none';
      if (settleDepositRetainAmount) settleDepositRetainAmount.value = '';
      if (settleDepositRetainReason) settleDepositRetainReason.value = '';
    }

    updateSettleCalculations();

    if (openContractSettleModalEl) {
      openContractSettleModalEl.style.display = 'flex';
      setTimeout(() => {
        if (settlePayNowInput && settlePaymentSection && settlePaymentSection.style.display !== 'none') {
          settlePayNowInput.focus();
          settlePayNowInput.select();
        }
      }, 50);
    }
  }

  function closeContractSettleModal() {
    if (openContractSettleModalEl) openContractSettleModalEl.style.display = 'none';
    if (openContractSettleForm) openContractSettleForm.reset();
    if (settleDiscountInput) settleDiscountInput.value = '0';
    if (settleDiscountReasonInput) settleDiscountReasonInput.value = '';
    if (settleLateCheckoutFeeInput) settleLateCheckoutFeeInput.value = '0';
    currentSettlingReservation = null;
    currentSettlementPreview = null;
  }

  if (btnCloseSettleModal) btnCloseSettleModal.addEventListener('click', closeContractSettleModal);
  if (btnCancelSettle) btnCancelSettle.addEventListener('click', closeContractSettleModal);
  if (openContractSettleModalEl) {
    openContractSettleModalEl.addEventListener('click', (e) => {
      if (e.target === openContractSettleModalEl) closeContractSettleModal();
    });
  }

  if (settleDepositDisposition) {
    settleDepositDisposition.addEventListener('change', () => {
      const retaining = settleDepositDisposition.value === 'retain';
      if (settleDepositRetainFields) settleDepositRetainFields.style.display = retaining ? 'grid' : 'none';
      updateSettleCalculations();
    });
  }
  if (settleLateCheckoutFeeInput) {
    settleLateCheckoutFeeInput.addEventListener('input', async () => {
      if (!currentSettlingReservation || currentSettlingReservation.booking_type === 'عقد مفتوح') return;
      const fee = Math.max(0, parseFloat(settleLateCheckoutFeeInput.value) || 0);
      const disc = Math.max(0, parseFloat(settleDiscountInput?.value || 0) || 0);
      const reason = settleDiscountReasonInput?.value.trim() || '';
      const result = await window.api.checkoutPreview(currentSettlingReservation.id, {
        discountAmount: disc,
        discountReason: reason,
        lateCheckoutFee: fee
      });
      if (result?.success && result.data) {
        currentSettlementPreview = result.data;
        if (settleFinalTotalInput) settleFinalTotalInput.value = result.data.netCharge.toFixed(2);
      }
      updateSettleCalculations();
    });
  }
  if (btnReconcileLegacyDeposit) {
    btnReconcileLegacyDeposit.addEventListener('click', async () => {
      if (!currentSettlingReservation || !currentDepositLegacyUnreconciled) return;
      const amount = roundMoney(currentSettlingReservation.deposit_amount || 0);
      const confirmed = await showConfirmDialog({
        title: 'مطابقة تأمين تاريخي',
        message: `هل راجعت سجل الحجز وتؤكد أن مبلغ ${amount.toLocaleString()} ريال تم استلامه وما زال محفوظاً كتأمين؟ ستُسجل المطابقة باسمك ولا تعني تحصيل مبلغ جديد.`,
        confirmText: 'نعم، تم التحقق',
        cancelText: 'تراجع',
        isDanger: true
      });
      if (!confirmed) return;
      const result = await window.api.reconcileLegacyDeposit({
        reservationId: currentSettlingReservation.id,
        amount,
        paymentMethod: currentSettlingReservation.payment_method || 'نقداً'
      });
      if (!result || !result.success) {
        showToast(result?.error || 'تعذرت مطابقة التأمين التاريخي.', 'error');
        return;
      }
      closeContractSettleModal();
      showToast('تمت مطابقة التأمين التاريخي. أعد فتح تسجيل المغادرة لإتمام التسوية.', 'success');
      await Promise.all([loadReservationsData(), loadOverviewData()]);
    });
  }

  // Admin-only monthly early-checkout policy. Changing it re-fetches the preview so
  // the charged total always comes from the backend, never from local arithmetic.
  function refreshSettlementPreview() {
    if (!currentSettlingReservation) return;
    const discVal = Math.max(0, parseFloat(settleDiscountInput ? settleDiscountInput.value : 0) || 0);
    const discReason = settleDiscountReasonInput ? settleDiscountReasonInput.value.trim() : '';
    return window.api.checkoutPreview(currentSettlingReservation.id, {
      discountAmount: discVal,
      discountReason: discReason,
      lateCheckoutFee: Math.max(0, parseFloat(settleLateCheckoutFeeInput?.value || 0) || 0),
      checkoutPolicy: getSelectedCheckoutPolicy(),
      checkoutPolicyReason: getSelectedCheckoutPolicyReason()
    }).then(previewRes => {
      if (previewRes && previewRes.success && previewRes.data) {
        currentSettlementPreview = previewRes.data;
        settlePolicyState = {
          applicable: Boolean(previewRes.data.isMonthlyEarlyCheckout),
          canChoose: Boolean(previewRes.data.canChoosePolicy),
          mismatch: Boolean(previewRes.data.contractValueMismatch),
          bookedNights: previewRes.data.bookedNights ?? null,
          contractValue: previewRes.data.contractValue ?? null,
          actualValue: previewRes.data.actualValue ?? null,
          bookedCheckOutDate: previewRes.data.bookedCheckOutDate ?? null
        };
        renderCheckoutPolicySection();
      }
    }).catch(() => { /* silent — updateSettleCalculations will use the stale preview */ });
  }

  function onCheckoutPolicyChanged() {
    if (!settlePolicyState.applicable || !settlePolicyState.canChoose) return;
        if (settlePolicyReasonWrap) {
      settlePolicyReasonWrap.style.display = settlePolicyActual && settlePolicyActual.checked ? 'block' : 'none';
    }
    
    // If the admin switched to Actual Nights, zero out the discount box so it doesn't confusingly display the original contract discount that is being canceled.
    if (settlePolicyActual && settlePolicyActual.checked && settleDiscountInput) {
      settleDiscountInput.value = '0';
      if (settleDiscountReasonInput) settleDiscountReasonInput.value = '';
    }
    updateDiscountSectionVisibility();
    if (currentSettlingReservation && currentSettlingReservation.booking_type === 'عقد مفتوح') return;
    refreshSettlementPreview().then(() => updateSettleCalculations());
  }
  if (settlePolicyContract) settlePolicyContract.addEventListener('change', onCheckoutPolicyChanged);
  if (settlePolicyActual) settlePolicyActual.addEventListener('change', onCheckoutPolicyChanged);

  // Admin-only: when discount changes, re-fetch preview so the net total updates
  if (settleDiscountInput) {
    settleDiscountInput.addEventListener('input', async () => {
      if (!currentSettlingReservation) return;
      const isContract = currentSettlingReservation.booking_type === 'عقد مفتوح';
      if (!isContract) {
        // Re-fetch preview with updated discount. refreshSettlementPreview also carries
        // the selected policy, so a monthly early checkout keeps charging its
        // contract value while the discount is edited.
        await refreshSettlementPreview();
        if (settleFinalTotalInput && currentSettlementPreview) {
          settleFinalTotalInput.value = currentSettlementPreview.netCharge.toFixed(2);
        }
        if (settleTotalPriceDisplay) {
          const baseShown = settlePolicyState.applicable ? settlePolicyState.contractValue : currentSettlementPreview.baseCharge;
          settleTotalPriceDisplay.textContent = `${Number(baseShown).toFixed(2)} ر.س`;
        }
        updateSettleCalculations();
      } else {
        // Open-contract: compute locally
        const baseTotal = parseFloat(settleTotalPriceDisplay ? settleTotalPriceDisplay.textContent : 0) || 0;
        const disc = Math.max(0, parseFloat(settleDiscountInput.value) || 0);
        const net = Math.max(0, baseTotal - disc);
        if (settleFinalTotalInput) settleFinalTotalInput.value = net.toFixed(2);
        updateSettleCalculations();
      }
    });
  }

  // Only Admin may edit an open-contract final total.
  if (settleFinalTotalInput) {
    settleFinalTotalInput.addEventListener('input', () => {
      if (!currentSettlingReservation) return;
      const isContract = currentSettlingReservation.booking_type === 'عقد مفتوح';
      if (!isContract) return; // read-only for non-contract: ignore manual input
      // Open-contract only: back-calculate discount from entered total
      if (settleTotalPriceDisplay && settleDiscountInput) {
        const baseTotal = parseFloat(settleTotalPriceDisplay.textContent) || 0;
        const enteredTotal = parseFloat(settleFinalTotalInput.value) || 0;
        settleDiscountInput.value = baseTotal > enteredTotal ? (baseTotal - enteredTotal).toFixed(2) : '0';
      }
      updateSettleCalculations();
    });
  }

  // آجل button: defer collection, no payment row
  if (btnCheckoutWithoutSettle) {
    btnCheckoutWithoutSettle.addEventListener('click', async () => {
      if (!currentSettlingReservation) return;
      const resId = currentSettlingReservation.id;
      const isContract = currentSettlingReservation.booking_type === 'عقد مفتوح';
      const finalTotal = parseFloat(settleFinalTotalInput ? settleFinalTotalInput.value : 0) || 0;
      const discAmount = settleDiscountInput ? parseFloat(settleDiscountInput.value) || 0 : 0;
      const discReason = settleDiscountReasonInput ? settleDiscountReasonInput.value.trim() : '';

      const confirmed = await showConfirmDialog({
        title: 'تسجيل مغادرة بدون تحصيل (آجل)',
        message: `هل أنت متأكد من تسجيل مغادرة النزيل مع اعتماد إجمالي ${finalTotal.toFixed(2)} ر.س وترحيل باقي المبلغ كدين آجل؟\nسيتم إكمال الحجز وتحويل الغرفة إلى "تنظيف".`,
        confirmText: 'نعم، مغادرة (آجل)',
        cancelText: 'تراجع',
        isDanger: true
      });
      if (!confirmed) return;

      try {
        const payload = isContract
          ? { finalTotalPrice: finalTotal, settleAmount: 0, discountAmount: discAmount, discountReason: discReason, notes: 'تسجيل مغادرة بدون تحصيل (آجل)' }
          : { settleMode: 'defer', discountAmount: discAmount, discountReason: discReason, lateCheckoutFee: Math.max(0, parseFloat(settleLateCheckoutFeeInput?.value || 0) || 0), ...getCheckoutPolicyPayload(), ...getDepositCheckoutPayload() };
        if (isContract) Object.assign(payload, getDepositCheckoutPayload());
        const res = await window.api.checkoutReservation(resId, payload);
        if (res.success) {
          const numResId = Number(resId);
          if (Array.isArray(window.DashboardApp?.State?.reservationsCache)) {
            const cached = window.DashboardApp.State.reservationsCache.find(r => Number(r.id) === numResId);
            if (cached) cached.status = 'مكتمل';
          }
          if (Array.isArray(window.DashboardApp?.State?.todayCheckoutsRows)) {
            window.DashboardApp.State.todayCheckoutsRows = window.DashboardApp.State.todayCheckoutsRows.filter(r => Number(r.reservation_id ?? r.id) !== numResId);
          }
          showToast(`تم تسجيل مغادرة الحجز #${resId} بنجاح وترحيل الحساب.`, 'success');
          closeContractSettleModal();
          await Promise.all([loadOverviewData(), loadReservationsData(), loadRoomsData(), loadTodayCheckouts()]);
          await notifyAttentionUpdate(resId, 'checkout');
        } else {
          showToast(res.error || 'فشل تسجيل المغادرة.', 'error');
        }
      } catch (err) {
        showToast(`خطأ: ${err.message}`, 'error');
      }
    });
  }

  // Main form submit: collect now OR refund
  if (openContractSettleForm) {
    openContractSettleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentSettlingReservation) return;
      const resId = currentSettlingReservation.id;
      const isContract = currentSettlingReservation.booking_type === 'عقد مفتوح';
      // For a monthly early checkout the chargeable total follows the selected policy,
      // NOT settleFinalTotalInput (which mirrors the actual-nights preview figure).
      const finalTotal = isContract
        ? (parseFloat(settleFinalTotalInput ? settleFinalTotalInput.value : 0) || 0)
        : getSettlementChargeTotal();
      const discAmount = settleDiscountInput ? parseFloat(settleDiscountInput.value) || 0 : 0;
      const discReason = settleDiscountReasonInput ? settleDiscountReasonInput.value.trim() : '';

      const depositPayload = getDepositCheckoutPayload();
      if (depositPayload.depositDisposition === 'retain' && depositPayload.depositRetainAmount > 0 && !depositPayload.depositRetainReason) {
        showToast('يرجى كتابة سبب الاحتفاظ بالتأمين.', 'error');
        if (settleDepositRetainReason) settleDepositRetainReason.focus();
        return;
      }

      // Discount reason: required only for a discount introduced HERE. A discount
      // already stored on the reservation was accepted at booking time without one,
      // and the modal pre-fills that amount, so demanding a reason for it would block
      // a checkout the receptionist never changed. Mirrors the backend rule.
      const storedDiscount = roundMoney(currentSettlingReservation?.discount_amount || 0);
      const isNewCheckoutDiscount = !isContract && discAmount > 0
        && Math.abs(discAmount - storedDiscount) > 0.005;
      if (isNewCheckoutDiscount && !discReason) {
        showToast('يرجى إدخال سبب الخصم عند تطبيق خصم على المغادرة.', 'error');
        if (settleDiscountReasonInput) settleDiscountReasonInput.focus();
        return;
      }

      // Monthly early checkout: an Admin 'actual' selection requires a reason.
      const policyPayload = getCheckoutPolicyPayload();
      if (policyPayload.checkoutPolicy === 'actual' && !policyPayload.checkoutPolicyReason) {
        showToast('يرجى إدخال سبب اختيار احتساب الليالي الفعلية بدل قيمة العقد.', 'error');
        if (settlePolicyReasonInput) settlePolicyReasonInput.focus();
        return;
      }

      if (settlePolicyState.applicable && settlePolicyState.mismatch && policyPayload.checkoutPolicy !== 'actual') {
        showToast(
          settlePolicyState.canChoose
            ? 'لا يمكن إتمام المغادرة بقيمة العقد لوجود تعارض في البيانات. يرجى اختيار احتساب الليالي الفعلية وتسجيل السبب.'
            : 'لا يمكن إتمام المغادرة لوجود تعارض في بيانات العقد. يتطلب الإجراء تدخل مدير النظام لاعتماد الليالي الفعلية.',
          'error'
        );
        return;
      }

      // Determine whether this is a collection or refund based on balance state
      const paidSoFar = parseFloat(currentSettlingReservation.paid_amount || 0);
      const requestedDepositApply = depositPayload.depositDisposition === 'apply'
        ? Math.max(0, Math.min(currentDepositAvailable, finalTotal - paidSoFar)) : 0;
      const netBalance = finalTotal - paidSoFar - requestedDepositApply;
      const isRefund = netBalance < -0.005;

      let payload;
      if (isRefund) {
        const rawRefund = parseFloat(settleRefundAmountInput ? settleRefundAmountInput.value : 0) || 0;
        const refundMethod = settleRefundMethodSelect ? settleRefundMethodSelect.value : 'نقداً';
        if (rawRefund <= 0) {
          showToast('يرجى إدخال مبلغ الاسترداد.', 'error');
          return;
        }
        payload = { settleMode: 'refund', refundAmount: rawRefund, paymentMethod: refundMethod, discountAmount: discAmount, discountReason: discReason, lateCheckoutFee: Math.max(0, parseFloat(settleLateCheckoutFeeInput?.value || 0) || 0), ...policyPayload, ...depositPayload };
        if (isContract) payload.finalTotalPrice = finalTotal;
      } else {
        const payNow = parseFloat(settlePayNowInput ? settlePayNowInput.value : 0) || 0;
        const method = settlePaymentMethodSelect ? settlePaymentMethodSelect.value : 'نقداً';

        // Warning prompt if checking out with an outstanding balance
        const unpaidDue = Math.max(0, netBalance - payNow);
        if (unpaidDue > 0.005) {
          const confirmed = await showConfirmDialog({
            title: 'تنبيه مالي: مستحقات غير مسددة',
            message: `يوجد مبلغ متبقٍ لم يُسدد قدره (${unpaidDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س).\nهل أنت متأكد من ترحيل هذا المبلغ كدين آجل وإتمام مغادرة النزيل؟`,
            confirmText: 'نعم، ترحيل كدين آجل وإتمام المغادرة',
            cancelText: 'تراجع للتحصيل',
            isDanger: true
          });
          if (!confirmed) return;
        }

        // Warning prompt if there is an unreconciled legacy deposit
        if (currentDepositLegacyUnreconciled) {
          const oldDepAmount = Number(currentSettlingReservation.deposit_amount || 0).toLocaleString();
          const confirmedDep = await showConfirmDialog({
            title: 'تنبيه: تأمين تاريخي معلق',
            message: `يوجد رصيد تأمين قديم مسجل على الحجز بقيمة (${oldDepAmount} ر.س) بلا سند حركة ولم تتم مطابقته.\nلن يتم رد هذا التأمين تلقائياً في السجلات.\nهل ترغب في الاستمرار في تسجيل المغادرة؟`,
            confirmText: 'الاستمرار في المغادرة',
            cancelText: 'تراجع للمراجعة',
            isDanger: true
          });
          if (!confirmedDep) return;
        }

        payload = { settleMode: payNow > 0 ? 'collect' : 'defer', collectAmount: payNow, paymentMethod: method, discountAmount: discAmount, discountReason: discReason, lateCheckoutFee: Math.max(0, parseFloat(settleLateCheckoutFeeInput?.value || 0) || 0), ...policyPayload, ...depositPayload };
        if (isContract) payload.finalTotalPrice = finalTotal;
      }

      try {
        if (btnConfirmSettleCheckout) { btnConfirmSettleCheckout.disabled = true; btnConfirmSettleCheckout.textContent = 'جاري التصفية...'; }
        const res = await window.api.checkoutReservation(resId, payload);
        if (res.success) {
          const numResId = Number(resId);
          if (Array.isArray(window.DashboardApp?.State?.reservationsCache)) {
            const cached = window.DashboardApp.State.reservationsCache.find(r => Number(r.id) === numResId);
            if (cached) cached.status = 'مكتمل';
          }
          if (Array.isArray(window.DashboardApp?.State?.todayCheckoutsRows)) {
            window.DashboardApp.State.todayCheckoutsRows = window.DashboardApp.State.todayCheckoutsRows.filter(r => Number(r.reservation_id ?? r.id) !== numResId);
          }
          showToast(`تمت تصفية حساب الحجز #${resId} وتسجيل المغادرة بنجاح!`, 'success');
          closeContractSettleModal();
          await Promise.all([loadOverviewData(), loadReservationsData(), loadRoomsData(), loadTodayCheckouts()]);
          await notifyAttentionUpdate(resId, 'checkout');
          setTimeout(() => { if (typeof openInvoiceModal === 'function') openInvoiceModal(resId); }, 350);
        } else {
          showToast(res.error || 'فشل تسجيل المغادرة وتصفية الحساب.', 'error');
        }
      } catch (err) {
        showToast(`خطأ: ${err.message}`, 'error');
      } finally {
        if (btnConfirmSettleCheckout) { btnConfirmSettleCheckout.disabled = false; btnConfirmSettleCheckout.textContent = 'تأكيد السداد وتسجيل المغادرة ✓'; }
      }
    });
  }

  // =========================================================================
  // EXTEND STAY MODAL (تمديد فترة الإقامة)
  // =========================================================================
  let currentExtendingReservation = null;
  let currentCalcExtraNights = 0;
  let currentCalcAdditionalCost = 0;
  let currentCalcNewTotal = 0;
  let halfDayPresetActive = false;

  function updateExtendStayCalculations() {
    if (!currentExtendingReservation || !extendNewCheckoutDate) return;

    const oldDateStr = currentExtendingReservation.check_out_date;
    const newDateStr = extendNewCheckoutDate.value;

    let nightlyRate = parseFloat(extendNightlyRateInput ? extendNightlyRateInput.value : NaN);
    const isMonthlyReservation = currentExtendingReservation.booking_type === 'حجز شهري';
    if (isNaN(nightlyRate) || nightlyRate < 0) {
      nightlyRate = !isMonthlyReservation && currentExtendingReservation.custom_nightly_price != null && !isNaN(Number(currentExtendingReservation.custom_nightly_price))
        ? parseFloat(currentExtendingReservation.custom_nightly_price)
        : parseFloat(currentExtendingReservation.price_per_night || 0);
    }

    const discountAmount = Math.max(0, parseFloat(extendDiscountInput ? extendDiscountInput.value : 0) || 0);
    const currentTotal = roundMoney(currentExtendingReservation.total_price || 0);

    if (!newDateStr || newDateStr <= oldDateStr) {
      currentCalcExtraNights = 0;
      currentCalcAdditionalCost = 0;
      currentCalcNewTotal = currentTotal;

      if (extendExtraNightsPreview) extendExtraNightsPreview.textContent = '0';
      if (extendCalcRatePreview) extendCalcRatePreview.textContent = `${nightlyRate.toLocaleString()} ر.س`;
      if (extendAdditionalCostPreview) extendAdditionalCostPreview.textContent = '0 ر.س';
      if (extendDiscountBadge) extendDiscountBadge.style.display = 'none';
      if (extendNewTotalPreview) extendNewTotalPreview.textContent = `${currentTotal.toLocaleString()} ر.س`;
      if (extendSettleAmount && extendCollectNowToggle && extendCollectNowToggle.checked) {
        extendSettleAmount.value = '0.00';
      }
      return;
    }

    const dOld = new Date(oldDateStr + 'T00:00:00');
    const dNew = new Date(newDateStr + 'T00:00:00');
    const diffTime = dNew.getTime() - dOld.getTime();
    currentCalcExtraNights = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
    const monthlyRate = Number(currentExtendingReservation.monthly_rate_snapshot) > 0
      ? Number(currentExtendingReservation.monthly_rate_snapshot)
      : (Number(currentExtendingReservation.monthly_price) > 0
        ? Number(currentExtendingReservation.monthly_price)
        : roundMoney((currentExtendingReservation.price_per_night || 0) * 30));

    let baseCost;
    if (isMonthlyReservation && monthlyRate > 0 && typeof getCalendarMonthCheckOut === 'function' && newDateStr === getCalendarMonthCheckOut(oldDateStr)) {
      baseCost = monthlyRate;
      if (extendCalcRatePreview) extendCalcRatePreview.textContent = `${monthlyRate.toLocaleString()} ر.س (شهر تقويمي)`;
    } else {
      baseCost = roundMoney(currentCalcExtraNights * nightlyRate);
      if (extendCalcRatePreview) extendCalcRatePreview.textContent = `${nightlyRate.toLocaleString()} ر.س`;
    }

    currentCalcAdditionalCost = Math.max(0, roundMoney(baseCost - discountAmount));
    currentCalcNewTotal = roundMoney(currentTotal + currentCalcAdditionalCost);

    const nightsLabel = currentCalcExtraNights === 1 ? 'ليلة واحدة' : (currentCalcExtraNights === 2 ? 'ليلتين' : `${currentCalcExtraNights} ليالٍ`);
    if (extendExtraNightsPreview) extendExtraNightsPreview.textContent = nightsLabel;
    if (extendAdditionalCostPreview) extendAdditionalCostPreview.textContent = `+${currentCalcAdditionalCost.toLocaleString()} ر.س`;
    
    if (extendDiscountBadge) {
      if (discountAmount > 0) {
        extendDiscountBadge.textContent = `(خصم: -${discountAmount.toLocaleString()} ر.س)`;
        extendDiscountBadge.style.display = 'block';
      } else {
        extendDiscountBadge.style.display = 'none';
      }
    }

    if (extendNewTotalPreview) extendNewTotalPreview.textContent = `${currentCalcNewTotal.toLocaleString()} ر.س`;

    if (extendSettleAmount && extendCollectNowToggle && extendCollectNowToggle.checked) {
      // Auto-fill settle amount with additional cost
      extendSettleAmount.value = currentCalcAdditionalCost > 0 ? currentCalcAdditionalCost.toFixed(2) : '0.00';
    }
  }

  window.openExtendStayModal = async function openExtendStayModal(reservationId) {
    const modal = document.getElementById('extend-stay-modal');
    if (!modal) {
      console.error('Modal #extend-stay-modal not found in DOM');
      return;
    }

    const targetId = parseInt(reservationId, 10);
    if (!targetId || isNaN(targetId)) {
      showToast('رقم الحجز غير صالح.', 'error');
      return;
    }

    // Find reservation in cache or fetch
    let res = findLoadedReservation(targetId);
    if (!res) {
      try {
        const allRes = await window.api.getAllReservations();
        if (allRes && allRes.success && allRes.data) {
          window.DashboardApp.State.reservationsCache = allRes.data;
          res = window.DashboardApp.State.reservationsCache.find(r => parseInt(r.id, 10) === targetId);
        }
      } catch (err) {
        console.error('Error fetching reservation for extension:', err);
      }
    }

    if (!res) {
      showToast('تعذر العثور على بيانات الحجز المطلوب.', 'error');
      return;
    }

    if (res.status !== 'مؤكد') {
      showToast('لا يمكن تمديد هذا الحجز، متاح فقط للحجوزات المؤكدة والنشطة حالياً.', 'warning');
      return;
    }

    if (res.check_out_date === 'مفتوح' || !res.check_out_date) {
      showToast('حجوزات العقود المفتوحة ليس لها تاريخ مغادرة محدد ليتم تمديدها.', 'warning');
      return;
    }

    currentExtendingReservation = res;

    // Populate Info Previews
    if (extendResId) extendResId.value = res.id;
    if (extendGuestNamePreview) extendGuestNamePreview.textContent = res.guest_name || 'نزيل';
    if (extendRoomPreview) extendRoomPreview.textContent = `غرفة ${res.room_number || '-'} (${res.room_type || ''})`;
    if (extendCurrentCheckoutPreview) extendCurrentCheckoutPreview.textContent = res.check_out_date;

    const isMonthlyReservation = res.booking_type === 'حجز شهري';
    const effectiveNightlyRate = (!isMonthlyReservation && res.custom_nightly_price != null && !isNaN(Number(res.custom_nightly_price)))
      ? parseFloat(res.custom_nightly_price)
      : parseFloat(res.price_per_night || 0);

    if (extendNightlyRatePreview) {
      const customBadge = (res.custom_nightly_price != null && !isNaN(Number(res.custom_nightly_price))) ? ' (سعر خاص)' : '';
      extendNightlyRatePreview.textContent = `${effectiveNightlyRate.toLocaleString()} ريال / ليلة${customBadge}`;
    }

    if (extendNightlyRateInput) {
      extendNightlyRateInput.value = effectiveNightlyRate > 0 ? effectiveNightlyRate.toFixed(2) : '0.00';
      extendNightlyRateInput.readOnly = isMonthlyReservation;
    }
    if (extendDiscountInput) {
      extendDiscountInput.value = '0.00';
    }
    halfDayPresetActive = false;

    // Set min checkout date = current checkout + 1 day
    const oldDate = new Date(res.check_out_date + 'T00:00:00');
    const minDate = new Date(oldDate);
    minDate.setDate(minDate.getDate() + 1);
    const minDateStr = (typeof getLocalDateString === 'function') ? getLocalDateString(minDate) : minDate.toISOString().split('T')[0];

    if (extendNewCheckoutDate) {
      extendNewCheckoutDate.min = minDateStr;
      extendNewCheckoutDate.value = minDateStr; // Default to +1 night
    }

    // Reset toggle & payment fields
    if (extendCollectNowToggle) {
      extendCollectNowToggle.checked = true;
    }
    if (extendPaymentFields) {
      extendPaymentFields.style.display = 'grid';
    }
    if (extendPaymentMethod) {
      extendPaymentMethod.value = 'نقداً';
    }

    updateExtendStayCalculations();

    modal.style.display = 'flex';
  };

  function closeExtendStayModal() {
    if (extendStayModal) {
      extendStayModal.style.display = 'none';
    }
    if (extendStayForm) {
      extendStayForm.reset();
    }
    currentExtendingReservation = null;
    currentCalcExtraNights = 0;
    currentCalcAdditionalCost = 0;
    currentCalcNewTotal = 0;
    halfDayPresetActive = false;
  }

  if (btnCloseExtendStay) btnCloseExtendStay.addEventListener('click', closeExtendStayModal);
  if (btnCancelExtendStay) btnCancelExtendStay.addEventListener('click', closeExtendStayModal);
  if (extendStayModal) {
    extendStayModal.addEventListener('click', (e) => {
      if (e.target === extendStayModal) closeExtendStayModal();
    });
  }

  // Quick Extend Buttons (+1, +2, +3, +7, +30 / شهر)
  const quickExtendButtons = document.querySelectorAll('.btn-quick-extend');
  quickExtendButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!currentExtendingReservation || !currentExtendingReservation.check_out_date) return;
      const days = parseInt(btn.dataset.days, 10);
      if (!days || isNaN(days)) return;
      const isHalfDay = btn.dataset.halfDay === 'true';
      if (isHalfDay) {
        const rate = parseFloat(extendNightlyRateInput?.value)
          || Number(currentExtendingReservation.booking_type === 'حجز شهري'
            ? currentExtendingReservation.price_per_night
            : (currentExtendingReservation.custom_nightly_price ?? currentExtendingReservation.price_per_night ?? 0));
        if (extendDiscountInput) extendDiscountInput.value = String(Math.round(Math.max(0, rate) * 0.5));
        halfDayPresetActive = true;
      } else if (halfDayPresetActive) {
        if (extendDiscountInput) extendDiscountInput.value = '0.00';
        halfDayPresetActive = false;
      }

      let newDateStr;
      if (days === 30 && currentExtendingReservation.booking_type === 'حجز شهري' && typeof getCalendarMonthCheckOut === 'function') {
        newDateStr = getCalendarMonthCheckOut(currentExtendingReservation.check_out_date);
      }
      if (!newDateStr) {
        const d = new Date(currentExtendingReservation.check_out_date + 'T00:00:00');
        d.setDate(d.getDate() + days);
        newDateStr = (typeof getLocalDateString === 'function') ? getLocalDateString(d) : d.toISOString().split('T')[0];
      }

      if (extendNewCheckoutDate) {
        extendNewCheckoutDate.value = newDateStr;
        updateExtendStayCalculations();
      }
    });
  });

  if (extendNewCheckoutDate) {
    extendNewCheckoutDate.addEventListener('input', updateExtendStayCalculations);
    extendNewCheckoutDate.addEventListener('change', updateExtendStayCalculations);
  }

  if (extendNightlyRateInput) {
    extendNightlyRateInput.addEventListener('input', updateExtendStayCalculations);
    extendNightlyRateInput.addEventListener('change', updateExtendStayCalculations);
  }

  if (extendDiscountInput) {
    const handleDiscountChange = () => {
      halfDayPresetActive = false;
      updateExtendStayCalculations();
    };
    extendDiscountInput.addEventListener('input', handleDiscountChange);
    extendDiscountInput.addEventListener('change', handleDiscountChange);
  }

  if (extendCollectNowToggle) {
    extendCollectNowToggle.addEventListener('change', () => {
      if (extendPaymentFields) {
        extendPaymentFields.style.display = extendCollectNowToggle.checked ? 'grid' : 'none';
      }
      if (!extendCollectNowToggle.checked) {
        if (extendSettleAmount) extendSettleAmount.value = '0.00';
      } else {
        if (extendSettleAmount) extendSettleAmount.value = currentCalcAdditionalCost > 0 ? currentCalcAdditionalCost.toFixed(2) : '0.00';
      }
    });
  }

  if (extendStayForm) {
    extendStayForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentExtendingReservation) return;

      const newDate = extendNewCheckoutDate ? extendNewCheckoutDate.value.trim() : '';
      if (!newDate) {
        showToast('يرجى تحديد تاريخ المغادرة الجديد.', 'error');
        return;
      }
      if (newDate <= currentExtendingReservation.check_out_date) {
        showToast(`تاريخ المغادرة الجديد (${newDate}) يجب أن يكون بعد تاريخ المغادرة الحالي (${currentExtendingReservation.check_out_date}).`, 'error');
        return;
      }

      const settle = (extendCollectNowToggle && extendCollectNowToggle.checked)
        ? Math.max(0, parseFloat(extendSettleAmount ? extendSettleAmount.value : 0) || 0)
        : 0;

      const payMethod = extendPaymentMethod ? extendPaymentMethod.value : 'نقداً';

      const btnSubmit = document.getElementById('btn-confirm-extend-stay');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'جاري تمديد الإقامة...';
      }

      try {
        const activeUserId = localStorage.getItem('currentUserId') || (App.State.currentUser ? App.State.currentUser.id : null);
        const nightlyRate = parseFloat(extendNightlyRateInput ? extendNightlyRateInput.value : NaN);
        const discount = Math.max(0, parseFloat(extendDiscountInput ? extendDiscountInput.value : 0) || 0);

        const res = await window.api.extendReservation({
          reservationId: currentExtendingReservation.id,
          newCheckOutDate: newDate,
          // Treat a blank/zero rate box as "use the stored rate" rather than
          // submitting 0, which the backend rejects as a missing value.
          customNightlyPrice: !isNaN(nightlyRate) && nightlyRate > 0 ? nightlyRate : undefined,
          discountAmount: discount,
          additionalCost: currentCalcAdditionalCost,
          settleAmount: settle,
          paymentMethod: payMethod,
          userId: activeUserId ? parseInt(activeUserId, 10) : null,
          notes: `تمديد فترة الإقامة (${currentCalcExtraNights} ليالٍ إضافية حتى ${newDate})${discount > 0 ? ` [خصم تمديد: ${discount} ر.س]` : ''}`
        });

        if (res && res.success) {
          const numResId = Number(currentExtendingReservation.id);
          if (Array.isArray(window.DashboardApp?.State?.reservationsCache)) {
            const cached = window.DashboardApp.State.reservationsCache.find(r => Number(r.id) === numResId);
            if (cached) {
              cached.check_out_date = newDate;
              if (res.reservation?.total_price != null) cached.total_price = res.reservation.total_price;
              if (res.reservation?.paid_amount != null) cached.paid_amount = res.reservation.paid_amount;
            }
          }
          if (Array.isArray(window.DashboardApp?.State?.todayCheckoutsRows)) {
            window.DashboardApp.State.todayCheckoutsRows = window.DashboardApp.State.todayCheckoutsRows.filter(r => Number(r.reservation_id ?? r.id) !== numResId);
          }
          const receiptInfo = res.receiptNumber ? ` (سند قبض رقم: ${res.receiptNumber})` : '';
          const settleInfo = settle > 0 ? ` وتم تحصيل ${settle.toLocaleString()} ريال` : ' (مسجلة ذمة مستحقة)';
          const discountInfo = discount > 0 ? ` [خصم: ${discount.toLocaleString()} ريال]` : '';
          showToast(`تم تمديد إقامة النزيل (${res.reservation?.guest_name || currentExtendingReservation.guest_name}) بنجاح حتى ${newDate}${discountInfo}${settleInfo}${receiptInfo} ✓`, 'success');
          closeExtendStayModal();

          await Promise.all([
            loadReservationsData(),
            loadRoomsData(),
            loadOverviewData(),
            typeof loadTodayCheckouts === 'function' ? loadTodayCheckouts() : Promise.resolve()
          ]);
          await notifyAttentionUpdate(numResId, 'extend');
        } else {
          showToast(res?.error || 'فشل تمديد الحجز.', 'error');
        }
      } catch (err) {
        console.error('Extend stay submit error:', err);
        showToast(`خطأ: ${err.message}`, 'error');
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'تأكيد تمديد الحجز ✓';
        }
      }
    });
  }

  // =========================================================================
  // Room Transfer Modal & Handler (Phase 1: Rate-Preserving Transfer)
  // =========================================================================
  let currentTransferringReservation = null;

  async function openTransferRoomModal(reservationId) {
    const modal = document.getElementById('transfer-room-modal');
    if (!modal) {
      console.error('Modal #transfer-room-modal not found in DOM');
      return;
    }

    const targetId = parseInt(reservationId, 10);
    if (!targetId || isNaN(targetId)) {
      showToast('رقم الحجز غير صالح.', 'error');
      return;
    }

    const transferResId = document.getElementById('transfer-res-id');
    const transferGuestNamePreview = document.getElementById('transfer-guest-name-preview');
    const transferCurrentRoomPreview = document.getElementById('transfer-current-room-preview');
    const transferDatesPreview = document.getElementById('transfer-dates-preview');
    const transferPinnedRatePreview = document.getElementById('transfer-pinned-rate-preview');
    const transferTargetRoomSelect = document.getElementById('transfer-target-room-select');
    const transferModeSelect = document.getElementById('transfer-mode-select');
    const transferModeHint = document.getElementById('transfer-mode-hint');
    const transferCustomRateGroup = document.getElementById('transfer-custom-rate-group');
    const transferCustomRateInput = document.getElementById('transfer-custom-rate');
    const transferPreviewCard = document.getElementById('transfer-preview-card');
    const transferPreviewBadge = document.getElementById('transfer-preview-badge');
    const transferPreviewNewRate = document.getElementById('transfer-preview-new-rate');
    const transferPreviewRateDelta = document.getElementById('transfer-preview-rate-delta');
    const transferPreviewRemainingNights = document.getElementById('transfer-preview-remaining-nights');
    const transferPreviewTotalDelta = document.getElementById('transfer-preview-total-delta');
    const transferPreviewNewTotal = document.getElementById('transfer-preview-new-total');
    const btnSubmit = document.getElementById('btn-confirm-transfer-room');

    if (transferTargetRoomSelect) {
      transferTargetRoomSelect.innerHTML = '<option value="">-- جارٍ فحص الغرف المتاحة... --</option>';
      transferTargetRoomSelect.disabled = true;
    }
    if (transferPreviewCard) transferPreviewCard.style.display = 'none';
    if (transferCustomRateGroup) transferCustomRateGroup.style.display = 'none';
    if (transferCustomRateInput) transferCustomRateInput.value = '';
    if (transferModeHint) transferModeHint.textContent = '';
    if (btnSubmit) btnSubmit.disabled = false;

    modal.style.display = 'flex';

    try {
      const res = await window.api.getTransferEligibleRooms(targetId);
      if (!res || !res.success || !res.data) {
        showToast(res?.error || 'تعذر جلب بيانات نقل الغرفة.', 'error');
        modal.style.display = 'none';
        return;
      }

      const { reservation, eligibleRooms } = res.data;
      currentTransferringReservation = reservation;

      if (transferResId) transferResId.value = reservation.id;
      if (transferGuestNamePreview) transferGuestNamePreview.textContent = reservation.guest_name || 'نزيل';
      if (transferCurrentRoomPreview) transferCurrentRoomPreview.textContent = `غرفة ${reservation.current_room_number || '-'} (${reservation.current_room_type || ''})`;
      const outText = reservation.isContract ? 'عقد مفتوح' : (reservation.check_out_date || 'غير محدد');
      if (transferDatesPreview) transferDatesPreview.textContent = `${reservation.check_in_date} إلى ${outText}`;
      if (reservation.isMonthly) {
        const mRate = reservation.currentMonthlyRate || reservation.pinnedRate;
        if (transferPinnedRatePreview) transferPinnedRatePreview.textContent = `${mRate.toLocaleString()} ريال / شهر`;
      } else {
        if (transferPinnedRatePreview) transferPinnedRatePreview.textContent = `${reservation.pinnedRate.toLocaleString()} ريال / ليلة`;
      }

      const currentUserRole = localStorage.getItem('currentUserRole') || (window.currentUser ? window.currentUser.role : 'Staff');
      const isAdmin = currentUserRole === 'Admin';

      // Mode select restrictions & hints
      if (transferModeSelect) {
        transferModeSelect.disabled = false;
        const optCustom = transferModeSelect.querySelector('option[value="custom_rate"]');
        if (optCustom) {
          optCustom.disabled = !isAdmin;
          optCustom.textContent = isAdmin ? 'سعر مخصص (Custom Rate) - متاح للإدارة' : 'سعر مخصص (Custom Rate) - للإدارة فقط 🔒';
        }
        if (reservation.isContract) {
          if (transferModeHint) transferModeHint.textContent = 'عقد مفتوح: يتم تطبيق السعر الجديد على الليالي القادمة وتُحسب القيمة عند المغادرة.';
        } else if (reservation.isMonthly) {
          if (transferModeHint) transferModeHint.textContent = 'حجز شهري: يتم احتساب فرق السعر لليالي المتبقية وتحديث قيمة العقد تلقائياً.';
        } else {
          if (transferModeHint) transferModeHint.textContent = '';
        }
      }

      if (transferTargetRoomSelect) {
        transferTargetRoomSelect.innerHTML = '<option value="">-- اختر الغرفة البديلة --</option>';
        if (eligibleRooms.length === 0) {
          transferTargetRoomSelect.innerHTML = '<option value="">(لا توجد غرف شاغرة غير متعارضة حالياً)</option>';
        } else {
          for (const rm of eligibleRooms) {
            const opt = document.createElement('option');
            opt.value = rm.id;
            let badge = '';
            const priceLabel = reservation.isMonthly
              ? `${(rm.monthly_price || rm.displayPrice).toLocaleString()} ر.س/شهر`
              : `${(rm.price_per_night || rm.displayPrice).toLocaleString()} ر.س/يوم`;

            if (rm.isEqualPrice) {
              badge = ' (مطابق للسعر)';
            } else if (rm.isUpgrade) {
              badge = ` (ترقية: ${priceLabel})`;
            } else if (rm.isDowngrade) {
              badge = ` (سعر أقل: ${priceLabel} - غير مدعوم حالياً)`;
              opt.disabled = true;
            }
            opt.textContent = `غرفة ${rm.room_number} (${rm.type}) - ${rm.status}${badge}`;
            opt.dataset.isUpgrade = rm.isUpgrade ? '1' : '0';
            opt.dataset.isEqualPrice = rm.isEqualPrice ? '1' : '0';
            opt.dataset.price = rm.price_per_night;
            opt.dataset.monthlyPrice = rm.monthly_price;
            transferTargetRoomSelect.appendChild(opt);
          }
        }
        transferTargetRoomSelect.disabled = false;
      }
    } catch (err) {
      console.error('Error opening transfer modal:', err);
      showToast(`خطأ: ${err.message}`, 'error');
      modal.style.display = 'none';
    }
  }
  window.openTransferRoomModal = openTransferRoomModal;

  // Live preview updater for transfer modal
  async function updateLiveTransferPreview() {
    if (!currentTransferringReservation) return;
    const transferTargetRoomSelect = document.getElementById('transfer-target-room-select');
    const transferModeSelect = document.getElementById('transfer-mode-select');
    const transferModeHint = document.getElementById('transfer-mode-hint');
    const transferCustomRateGroup = document.getElementById('transfer-custom-rate-group');
    const transferCustomRateInput = document.getElementById('transfer-custom-rate');
    const transferPreviewCard = document.getElementById('transfer-preview-card');
    const transferPreviewBadge = document.getElementById('transfer-preview-badge');
    const transferPreviewNewRate = document.getElementById('transfer-preview-new-rate');
    const transferPreviewRateDelta = document.getElementById('transfer-preview-rate-delta');
    const transferPreviewRemainingNights = document.getElementById('transfer-preview-remaining-nights');
    const transferPreviewTotalDelta = document.getElementById('transfer-preview-total-delta');
    const transferPreviewNewTotal = document.getElementById('transfer-preview-new-total');
    const btnSubmit = document.getElementById('btn-confirm-transfer-room');

    const targetRoomId = parseInt(transferTargetRoomSelect?.value, 10);
    if (!targetRoomId) {
      if (transferPreviewCard) transferPreviewCard.style.display = 'none';
      return;
    }

    const currentUserRole = localStorage.getItem('currentUserRole') || (window.currentUser ? window.currentUser.role : 'Staff');
    const isAdmin = currentUserRole === 'Admin';
    const selectedOpt = transferTargetRoomSelect?.selectedOptions?.[0];
    const isUpgrade = selectedOpt?.dataset?.isUpgrade === '1';
    let mode = transferModeSelect?.value || 'keep_rate';
    const customRateVal = transferCustomRateInput ? parseFloat(transferCustomRateInput.value) : null;

    // Staff cannot perform keep_rate on upgrade (free upgrade is Admin-only)
    if (isUpgrade && !isAdmin && mode === 'keep_rate') {
      if (transferModeSelect) transferModeSelect.value = 'upgrade_pay_difference';
      mode = 'upgrade_pay_difference';
      if (transferModeHint) transferModeHint.textContent = 'تم اختيار ترقية مع دفع الفارق تلقائياً (الترقية المجانية تتطلب إدارة).';
    }

    if (mode === 'custom_rate') {
      if (transferCustomRateGroup) transferCustomRateGroup.style.display = 'block';
    } else {
      if (transferCustomRateGroup) transferCustomRateGroup.style.display = 'none';
    }

    try {
      const previewRes = await window.api.previewRoomTransfer({
        reservationId: currentTransferringReservation.id,
        targetRoomId,
        mode,
        customRate: (mode === 'custom_rate' && !isNaN(customRateVal)) ? customRateVal : null
      });

      if (!previewRes || !previewRes.success || !previewRes.data) {
        if (transferPreviewCard) {
          transferPreviewCard.style.display = 'block';
          if (transferPreviewBadge) {
            transferPreviewBadge.textContent = 'تنبيه';
            transferPreviewBadge.style.background = '#fef2f2';
            transferPreviewBadge.style.color = '#dc2626';
          }
          if (transferPreviewNewRate) transferPreviewNewRate.textContent = previewRes?.error || 'تعذر حساب المعاينة';
          if (transferPreviewRateDelta) transferPreviewRateDelta.textContent = '-';
          if (transferPreviewRemainingNights) transferPreviewRemainingNights.textContent = '-';
          if (transferPreviewTotalDelta) transferPreviewTotalDelta.textContent = '-';
          if (transferPreviewNewTotal) transferPreviewNewTotal.textContent = '-';
        }
        if (btnSubmit) btnSubmit.disabled = true;
        return;
      }

      const data = previewRes.data;
      if (btnSubmit) btnSubmit.disabled = false;
      if (transferPreviewCard) {
        transferPreviewCard.style.display = 'block';
        if (transferPreviewBadge) {
          if (data.mode === 'upgrade_pay_difference') {
            transferPreviewBadge.textContent = 'ترقية بدفع الفارق';
            transferPreviewBadge.style.background = '#e0f2fe';
            transferPreviewBadge.style.color = '#0369a1';
          } else if (data.mode === 'custom_rate') {
            transferPreviewBadge.textContent = 'سعر مخصص';
            transferPreviewBadge.style.background = '#fef3c7';
            transferPreviewBadge.style.color = '#b45309';
          } else {
            transferPreviewBadge.textContent = 'تثبيت السعر';
            transferPreviewBadge.style.background = '#ecfdf5';
            transferPreviewBadge.style.color = '#047831';
          }
        }

        if (transferPreviewNewRate) {
          if (data.isMonthly && data.targetRoomMonthlyPrice) {
            transferPreviewNewRate.textContent = `${data.targetRoomMonthlyPrice.toLocaleString()} ر.س / شهر (ما يعادل ${data.newRate.toLocaleString()} ر.س/ليلة)`;
          } else {
            transferPreviewNewRate.textContent = `${data.newRate.toLocaleString()} ر.س / ليلة`;
          }
        }
        if (transferPreviewRateDelta) {
          if (data.isMonthly && data.monthlyDelta > 0) {
            transferPreviewRateDelta.textContent = `+${data.monthlyDelta.toLocaleString()} ر.س/شهر (+${data.rateDelta} ر.س/ليلة)`;
            transferPreviewRateDelta.style.color = '#0284c7';
          } else {
            const sign = data.rateDelta > 0 ? '+' : '';
            transferPreviewRateDelta.textContent = `${sign}${data.rateDelta.toLocaleString()} ر.س`;
            transferPreviewRateDelta.style.color = data.rateDelta > 0 ? '#0284c7' : '#05963d';
          }
        }
        if (transferPreviewRemainingNights) {
          transferPreviewRemainingNights.textContent = data.isContract
            ? 'عقد مفتوح (حتى المغادرة)'
            : (data.isMonthly ? `${data.remainingNights} ليلة متبقية بالشهر` : `${data.remainingNights} ليالٍ`);
        }
        if (transferPreviewTotalDelta) {
          if (data.isContract) {
            transferPreviewTotalDelta.textContent = 'يُحتسب عند المغادرة';
            transferPreviewTotalDelta.style.color = '#0284c7';
          } else {
            const sign = data.totalDelta > 0 ? '+' : '';
            transferPreviewTotalDelta.textContent = `${sign}${data.totalDelta.toLocaleString()} ر.س`;
            transferPreviewTotalDelta.style.color = data.totalDelta > 0 ? '#b45309' : '#0f172a';
          }
        }
        if (transferPreviewNewTotal) {
          if (data.isContract) {
            transferPreviewNewTotal.textContent = `${data.newTotalPrice.toLocaleString()} ر.س (تحديث عند المغادرة)`;
          } else if (data.isMonthly) {
            transferPreviewNewTotal.textContent = `${data.newTotalPrice.toLocaleString()} ر.س (إجمالي العقد المحدّث)`;
          } else {
            transferPreviewNewTotal.textContent = `${data.newTotalPrice.toLocaleString()} ر.س`;
          }
        }
      }
    } catch (err) {
      console.warn('Preview error:', err);
    }
  }

  const transferTargetRoomSelectEl = document.getElementById('transfer-target-room-select');
  const transferModeSelectEl = document.getElementById('transfer-mode-select');
  const transferCustomRateInputEl = document.getElementById('transfer-custom-rate');
  if (transferTargetRoomSelectEl) transferTargetRoomSelectEl.addEventListener('change', updateLiveTransferPreview);
  if (transferModeSelectEl) transferModeSelectEl.addEventListener('change', updateLiveTransferPreview);
  if (transferCustomRateInputEl) transferCustomRateInputEl.addEventListener('input', updateLiveTransferPreview);

  const transferRoomModal = document.getElementById('transfer-room-modal');
  const transferRoomForm = document.getElementById('transfer-room-form');
  const btnCloseTransferRoom = document.getElementById('btn-close-transfer-room');
  const btnCancelTransferRoom = document.getElementById('btn-cancel-transfer-room');

  function closeTransferRoomModal() {
    if (transferRoomModal) transferRoomModal.style.display = 'none';
    if (transferRoomForm) transferRoomForm.reset();
    const transferPreviewCard = document.getElementById('transfer-preview-card');
    const transferCustomRateGroup = document.getElementById('transfer-custom-rate-group');
    if (transferPreviewCard) transferPreviewCard.style.display = 'none';
    if (transferCustomRateGroup) transferCustomRateGroup.style.display = 'none';
    currentTransferringReservation = null;
  }

  if (btnCloseTransferRoom) btnCloseTransferRoom.addEventListener('click', closeTransferRoomModal);
  if (btnCancelTransferRoom) btnCancelTransferRoom.addEventListener('click', closeTransferRoomModal);
  if (transferRoomModal) {
    transferRoomModal.addEventListener('click', (e) => {
      if (e.target === transferRoomModal) closeTransferRoomModal();
    });
  }

  if (transferRoomForm) {
    transferRoomForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const resId = parseInt(document.getElementById('transfer-res-id')?.value, 10);
      const targetRoomId = parseInt(document.getElementById('transfer-target-room-select')?.value, 10);
      const mode = document.getElementById('transfer-mode-select')?.value || 'keep_rate';
      const customRateInput = document.getElementById('transfer-custom-rate');
      const customRate = (mode === 'custom_rate' && customRateInput) ? parseFloat(customRateInput.value) : null;
      const reasonCategory = document.getElementById('transfer-reason-category')?.value || 'other';
      const reasonDetails = document.getElementById('transfer-reason-details')?.value || '';

      if (!resId || !targetRoomId) {
        showToast('يرجى اختيار الغرفة البديلة أولاً.', 'warning');
        return;
      }

      if (mode === 'custom_rate' && (!customRate || isNaN(customRate) || customRate <= 0)) {
        showToast('يرجى إدخال سعر يومي مخصص صالح أكبر من صفر.', 'warning');
        return;
      }

      const btnSubmit = document.getElementById('btn-confirm-transfer-room');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'جارٍ نقل الغرفة...';
      }

      try {
        const res = await window.api.transferRoom({
          reservationId: resId,
          targetRoomId,
          mode,
          customRate,
          reasonCategory,
          reasonDetails
        });

        if (res && res.success) {
          const modeLabels = {
            keep_rate: 'تثبيت السعر',
            upgrade_pay_difference: 'ترقية مع دفع الفارق',
            custom_rate: 'سعر مخصص'
          };
          const label = modeLabels[res.mode] || 'تثبيت السعر';
          showToast(`تم نقل النزيل بنجاح إلى غرفة ${res.toRoomNumber} بنمط (${label}) ✓`, 'success');
          closeTransferRoomModal();
          await Promise.all([
            loadReservationsData(),
            loadRoomsData(),
            loadOverviewData(),
            typeof loadTodayCheckouts === 'function' ? loadTodayCheckouts() : Promise.resolve()
          ]);
        } else {
          showToast(res?.error || 'فشل نقل الغرفة.', 'error');
        }
      } catch (err) {
        console.error('Transfer room submit error:', err);
        showToast(`خطأ: ${err.message}`, 'error');
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'تأكيد نقل الغرفة ✓';
        }
      }
    });
  }

  // Toggle & Submit Add Customer Form (Available to both Admin and User roles)
  if (btnToggleAddCustomer && addCustomerPanel) {
    btnToggleAddCustomer.addEventListener('click', () => {
      const isHidden = addCustomerPanel.style.display === 'none' || !addCustomerPanel.style.display;
      addCustomerPanel.style.display = isHidden ? 'block' : 'none';
      if (isHidden && newCustomerName) newCustomerName.focus();
    });
  }

  if (btnCancelAddCustomer && addCustomerPanel) {
    btnCancelAddCustomer.addEventListener('click', () => {
      addCustomerPanel.style.display = 'none';
      if (addCustomerForm) addCustomerForm.reset();
    });
  }

  if (addCustomerForm) {
    addCustomerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = newCustomerName ? newCustomerName.value.trim() : '';
      const phone = newCustomerPhone ? newCustomerPhone.value.trim() : '';
      const id_number = newCustomerId ? newCustomerId.value.trim() : '';

      // Strict Guest Data Validation
      const validation = validateGuestInputs({ name, phone, id_number });
      if (!validation.valid) {
        showToast(validation.error, 'error');
        return;
      }

      const activeRole = localStorage.getItem('currentUserRole') || (App.State.currentUser ? App.State.currentUser.role : 'User');

      try {
        const res = await window.api.addCustomer({ name, phone, id_number }, activeRole);
        if (res.success) {
          showToast(`تم تسجيل بيانات النزيل "${name}" بنجاح!`, 'success');
          addCustomerForm.reset();
          addCustomerPanel.style.display = 'none';
          await loadGuestsData();
        } else {
          showToast(res.error || 'فشل حفظ بيانات النزيل.', 'error');
        }
      } catch (err) {
        console.error('Add customer error:', err);
        showToast(`خطأ أثناء الحفظ: ${err.message}`, 'error');
      }
    });
  }

  function loadAdminData() { return window.DashboardApp.Helpers.loadAdminData(); }

  // =========================================================================

  // =========================================================================
  // GLOBAL ACTIONS: CHECKOUT, CANCEL, INVOICE, QUICK-BOOK & QUICK-READY
  // =========================================================================
  document.addEventListener('click', async (e) => {
    // If clicking outside overflow menu, close it
    const overflowDropdown = document.getElementById('res-overflow-dropdown');
    if (overflowDropdown && overflowDropdown.style.display !== 'none') {
      if (!e.target.closest('#res-overflow-dropdown') && !e.target.closest('button[data-action="overflow"]')) {
        closeReservationsOverflowMenu();
      }
    }

    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = parseInt(btn.dataset.id || btn.getAttribute('data-id'), 10);

    if (action === 'overflow') {
      e.stopPropagation();
      openReservationsOverflowMenu(btn, id);
      return;
    }

    if (btn.closest('#res-overflow-dropdown')) {
      closeReservationsOverflowMenu();
    }

    if (btn.closest('#reservation-preview-modal') && ['invoice', 'whatsapp', 'extend', 'checkout'].includes(action)) {
      const previewModal = document.getElementById('reservation-preview-modal');
      if (previewModal) previewModal.style.display = 'none';
    }

    // Shift Audit Open
    if (action === 'open-shift-audit') {
      openShiftAuditModal();
      return;
    }

    // Daily Automated Backup Open
    if (action === 'open-daily-backup') {
      openDailyBackupModal();
      return;
    }

    // DB Backup & Restore
    if (action === 'backup-db') {
      if (btnBackupDb) btnBackupDb.click();
      return;
    }
    if (action === 'restore-db') {
      if (btnRestoreDb) btnRestoreDb.click();
      return;
    }

    // Invoice View & Print
    if (action === 'invoice') {
      openInvoiceModal(id);
      return;
    }

    if (action === 'preview-reservation') {
      await window.DashboardApp.Helpers.openReservationPreview(id);
      return;
    }

    // Send via WhatsApp
    if (action === 'whatsapp') {
      sendReservationWhatsApp(id);
      return;
    }

    // Edit Room Modal Open
    if (action === 'edit-room') {
      const roomId = btn.dataset.roomId || btn.dataset.id;
      window.DashboardApp.Helpers.openEditRoomModal(roomId);
      return;
    }

    // Edit Guest Modal Open
    if (action === 'edit-guest') {
      window.DashboardApp.Helpers.openEditGuestModal(id);
      return;
    }

    // Room Revenue Report Modal Open
    if (action === 'room-revenue') {
      const roomId = btn.dataset.roomId || btn.dataset.id;
      window.DashboardApp.Helpers.openRoomRevenueModal(roomId);
      return;
    }

    // Quick Book from Room Card
    if (action === 'quick-book') {
      const roomId = btn.dataset.roomId;
      initiateRoomBooking(roomId);
      return;
    }

    // Quick Cleaned (1-click ready)
    if (action === 'quick-ready') {
      const roomId = btn.dataset.roomId;
      try {
        const res = await window.api.updateRoomStatus(roomId, 'متاحة');
        if (res.success) {
          showToast('تم تحديث حالة الغرفة إلى "متاحة" وجاهزة للتسكين بنجاح! ✓', 'success');
          await loadRoomsData();
          await loadOverviewData();
        } else {
          showToast('فشل تحديث حالة الغرفة.', 'error');
        }
      } catch (err) {
        showToast(`خطأ: ${err.message}`, 'error');
      }
      return;
    }

    // Add Subsequent Payment Modal Open
    if (action === 'add-payment') {
      openAddPaymentModal(id);
      return;
    }

    // Extend Stay Modal Open
    if (action === 'extend') {
      openExtendStayModal(id);
      return;
    }

    // Transfer Room Modal Open
    if (action === 'transfer') {
      openTransferRoomModal(id);
      return;
    }

    if (action === 'checkout') {
      let resData = findLoadedReservation(id);
      if (!resData) {
        try {
          const invRes = await window.api.getInvoiceData(id);
          if (invRes && invRes.success && invRes.data) resData = invRes.data;
        } catch (e) {}
      }

      // Open contracts always go through the settle modal (unchanged)
      if (resData && resData.booking_type === 'عقد مفتوح') {
        openContractSettleModal(resData);
        return;
      }

      // Non-contract: fetch the authoritative settlement preview from the backend
      // to decide whether the simple confirm or the settle modal is appropriate.
      try {
        const previewRes = await window.api.checkoutPreview(id, {});
        if (!previewRes || !previewRes.success) {
          showToast(previewRes?.error || 'تعذر تحميل بيانات التسوية.', 'error');
          return;
        }
        const preview = previewRes.data;

        // A settled room charge can still have a deposit to disposition. Show
        // the settlement modal whenever a recorded or legacy deposit exists.
        const hasDepositToSettle = Number(preview.depositAvailable || 0) > 0.005
          || Boolean(preview.depositLegacyUnreconciled);
        if (preview.isSettled && !hasDepositToSettle) {
          const confirmed = await showConfirmDialog({
            title: 'تسجيل خروج النزيل',
            message: `هل أنت متأكد من تسجيل خروج النزيل للحجز #${id}؟\nالمبلغ مسدد بالكامل (${preview.netCharge.toLocaleString()} ريال).\nسيتم إكمال الحجز وتحويل الغرفة تلقائياً لوضع "تنظيف".`,
            confirmText: 'تسجيل الخروج',
            cancelText: 'إلغاء',
            isDanger: false
          });
          if (confirmed) {
            try {
              const res = await window.api.checkoutReservation(id, { settleMode: 'defer' });
              if (res.success) {
                const numResId = Number(id);
                if (Array.isArray(window.DashboardApp?.State?.reservationsCache)) {
                  const cached = window.DashboardApp.State.reservationsCache.find(r => Number(r.id) === numResId);
                  if (cached) cached.status = 'مكتمل';
                }
                if (Array.isArray(window.DashboardApp?.State?.todayCheckoutsRows)) {
                  window.DashboardApp.State.todayCheckoutsRows = window.DashboardApp.State.todayCheckoutsRows.filter(r => Number(r.reservation_id ?? r.id) !== numResId);
                }
                showToast(`تم تسجيل خروج الحجز #${id} بنجاح.`, 'success');
                await Promise.all([loadOverviewData(), loadReservationsData(), loadRoomsData(), loadTodayCheckouts()]);
                await notifyAttentionUpdate(id, 'checkout');
                setTimeout(() => { if (typeof openInvoiceModal === 'function') openInvoiceModal(id); }, 350);
              } else {
                showToast(res.error || 'فشل تسجيل الخروج.', 'error');
              }
            } catch (err) {
              showToast(`خطأ: ${err.message}`, 'error');
            }
          }
        } else {
          // Amount due, refund due, or a deposit to settle — open the settle modal
          openContractSettleModal(resData || { id, booking_type: 'عادي', check_in_date: preview.checkInDate, paid_amount: preview.paidAmount });
        }
      } catch (err) {
        showToast(`خطأ في تحميل بيانات التسوية: ${err.message}`, 'error');
      }
    } else if (action === 'cancel') {
      let targetRes = findLoadedReservation(id);
      if (!targetRes) {
        try {
          const allRes = await window.api.getAllReservations();
          if (allRes && allRes.data) {
            window.DashboardApp.State.reservationsCache = allRes.data;
            targetRes = window.DashboardApp.State.reservationsCache.find(r => r.id === id);
          }
        } catch (e) {}
      }

      const hotelBizDate = getOperationalBusinessDate() || getLocalDateString();
      const isArrivalDate = targetRes && targetRes.check_in_date ? (targetRes.check_in_date >= hotelBizDate) : false;
      const hasStarted = targetRes && targetRes.check_in_date ? !isArrivalDate : false;
      if (hasStarted) {
        showToast('الإقامة بدأت بالفعل في تاريخ سابق. استخدم تسجيل الخروج لتصفية الحساب.', 'error');
        return;
      }

      let cancelPayload = { reservationId: id };

      const isSameDay = targetRes && (targetRes.check_in_date === hotelBizDate);
      const dialogTitle = isSameDay ? 'إبطال / إلغاء حجز اليوم' : 'إلغاء حجز قبل الوصول';
      const dialogMessage = isSameDay
        ? `هل أنت متأكد من إلغاء / إبطال الحجز المباشر #${id} للنزيل (${targetRes?.guest_name || 'نزيل'})؟\n(سيتم إلغاء الحجز فوراً، وإعادة أي مبالغ مدفوعة للنزيل، وإعادة الغرفة لحالة "متاحة").`
        : `هل أنت متأكد من إلغاء الحجز #${id} للنزيل (${targetRes?.guest_name || 'نزيل'})؟\n(الحجز لم يبدأ بعد - سيتم إلغاء الحجز بالكامل وإعادة أي مبالغ مدفوعة مسبقاً للنزيل).`;

      const confirmed = await showConfirmDialog({
        title: dialogTitle,
        message: dialogMessage,
        confirmText: isSameDay ? 'نعم، إبطال الحجز' : 'نعم، إلغاء الحجز',
        cancelText: 'تراجع',
        isDanger: true
      });
      if (!confirmed) return;

      try {
        const res = await window.api.cancelReservation(cancelPayload);
        if (res && res.success) {
          const numResId = Number(id);
          if (Array.isArray(window.DashboardApp?.State?.reservationsCache)) {
            const cached = window.DashboardApp.State.reservationsCache.find(r => Number(r.id) === numResId);
            if (cached) cached.status = 'ملغي';
          }
          if (Array.isArray(window.DashboardApp?.State?.todayCheckoutsRows)) {
            window.DashboardApp.State.todayCheckoutsRows = window.DashboardApp.State.todayCheckoutsRows.filter(r => Number(r.reservation_id ?? r.id) !== numResId);
          }
          await loadOverviewData();
          await loadReservationsData();
          await loadRoomsData();
          await notifyAttentionUpdate(id, 'cancel');

          let summaryMsg = '';
          if (res.proRatedCharge > 0 || res.hasStarted) {
            summaryMsg = `تم إلغاء الحجز #${id} جزئياً (أثناء الإقامة):\n` +
              `• مدة الإقامة المحتسبة: ${res.daysStayed || 1} ليلة\n` +
              `• قيمة الإقامة المستحقة: ${Number(res.proRatedCharge).toLocaleString()} ريال\n`;
            if (res.isOverridden) {
              summaryMsg += `  (مبلغ معدل يدوياً بواسطة الإدارة - التكلفة المحتسبة تلقائياً كانت: ${Number(res.originalCalculatedCharge).toLocaleString()} ريال)\n`;
            }
            if (res.refundDue > 0) {
              summaryMsg += `• المبلغ المستحق إرجاعه للنزيل (مسترد): ${Number(res.refundDue).toLocaleString()} ريال\n(يرجى تسليم المبلغ نقداً للنزيل)`;
            } else if (res.stillOwed > 0) {
              summaryMsg += `• المبلغ المتبقي للتحصيل من النزيل: ${Number(res.stillOwed).toLocaleString()} ريال\n(يرجى تحصيل المبلغ المتبقي)`;
            } else {
              summaryMsg += `• الحساب متوازن بالكامل (المبلغ المدفوع يغطي الإقامة تماماً).`;
            }
          } else {
            summaryMsg = `تم إلغاء الحجز #${id} بالكامل قبل موعد الوصول:\n`;
            if (res.refundDue > 0) {
              summaryMsg += `• المبلغ المستحق إرجاعه للنزيل (عربون كامل): ${Number(res.refundDue).toLocaleString()} ريال\n(يرجى إعادة المبلغ للنزيل)`;
            } else {
              summaryMsg += `• تم الإلغاء بنجاح (لا توجد مبالغ مستحقة أو مدفوعة مسبقاً).`;
            }
          }

          await showConfirmDialog({
            title: (res.proRatedCharge > 0 || res.hasStarted) ? 'تصفية الإلغاء الجزئي للحجز' : 'تم إلغاء الحجز بنجاح',
            message: summaryMsg,
            confirmText: 'حسناً (تم الاطلاع)',
            cancelText: 'إغلاق',
            isDanger: false
          });

          showToast((res.proRatedCharge > 0 || res.hasStarted) ? `تم الإلغاء الجزئي للحجز #${id}.` : `تم إلغاء الحجز #${id}.`, 'info');
        } else {
          showToast(res?.error || 'فشل إلغاء الحجز.', 'error');
        }
      } catch (err) {
        showToast(`خطأ: ${err.message}`, 'error');
      }
    }
  });
  App.Helpers.openNewReservationModal = openNewReservationModal;
  App.Helpers.closeNewReservationModal = closeNewReservationModal;
  App.Helpers.initiateRoomBooking = initiateRoomBooking;
  App.Helpers.showMidStayCancelModal = showMidStayCancelModal;
  App.Helpers.loadReservationsData = loadReservationsData;
  App.Helpers.openContractSettleModal = openContractSettleModal;
  App.Helpers.findLoadedReservation = findLoadedReservation;
  App.Helpers.updateMinimumCheckoutDate = updateMinimumCheckoutDate;
  App.Helpers.handleBookingTypeChange = handleBookingTypeChange;
  App.Helpers.openTransferRoomModal = openTransferRoomModal;

  window.simulateEarlyCheckin = function(enable = true, roomId = null) {
    window.__SIMULATE_EARLY_CHECKIN__ = Boolean(enable);
    openNewReservationModal(roomId);
  };
})(window.DashboardApp);
