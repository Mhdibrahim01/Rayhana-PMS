/**
 * نظام أحمد لإدارة الفنادق (Ahmed Hotel ERP)
 * Complete Interactive Multi-View Dashboard Script (dashboard.js)
 * Includes: RBAC, Chart.js Analytics, SheetJS Excel Import/Export
 */

(function () {
  'use strict';

  // State Caches
  let currentUser = null;
        

  // Chart Instances

  // Navigation Links & Views
  const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
  const navAdmin = document.getElementById('nav-admin');
  const navLogs = document.getElementById('nav-logs');
  const viewSections = {
    overview: document.getElementById('view-overview'),
    reservations: document.getElementById('view-reservations'),
    rooms: document.getElementById('view-rooms'),
    guests: document.getElementById('view-guests'),
    admin: document.getElementById('view-admin'),
    logs: document.getElementById('view-logs')
  };
  const topbarHeading = document.getElementById('topbar-heading');
  const topbarSubheading = document.getElementById('topbar-subheading');
  const currentSystemTimeDisplay = document.getElementById('current-system-time');
  const activeBusinessDateDisplay = document.getElementById('active-business-date');

  const btnOpenFactoryReset = document.getElementById('btn-open-factory-reset');
  const factoryResetModal = document.getElementById('factory-reset-modal');
  const btnCloseFactoryReset = document.getElementById('btn-close-factory-reset');
  const btnCancelFactoryReset = document.getElementById('btn-cancel-factory-reset');
  const factoryResetForm = document.getElementById('factory-reset-form');
  const factoryResetPasswordInput = document.getElementById('factory-reset-password');
  const factoryResetErrorMsg = document.getElementById('factory-reset-error-msg');
  const btnSubmitFactoryReset = document.getElementById('btn-submit-factory-reset');
  // Header Elements
  const userDisplayName = document.getElementById('user-display-name');
  const userDisplayRole = document.getElementById('user-display-role');
  const btnLogout = document.getElementById('btn-logout');
  const btnOpenDb = document.getElementById('btn-open-db');
  const dbFileName = document.getElementById('db-file-name');

  // Overview Elements
  const statAvailableRooms = document.getElementById('stat-available-rooms');
  const statOccupiedRooms = document.getElementById('stat-occupied-rooms');
  const statCleaningRooms = document.getElementById('stat-cleaning-rooms');
  const statTotalReservations = document.getElementById('stat-total-reservations');

  // Today's Checkouts Widget Elements
  const todayCheckoutsTableBody = document.getElementById('today-checkouts-table-body');
  const todayCheckoutsEmpty = document.getElementById('today-checkouts-empty');
  const todayCheckoutsCountBadge = document.getElementById('today-checkouts-count-badge');
  const todayDateBadge = document.getElementById('today-date-badge');
  const btnRefreshCheckouts = document.getElementById('btn-refresh-checkouts');
  const todayCheckoutsSearch = document.getElementById('today-checkouts-search');
  const todayCheckoutsFilters = document.getElementById('today-checkouts-filters');

  // Reservation Form Elements
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
  const autofillGuestBadge = document.getElementById('autofill-guest-badge');
  const bannedGuestWarning = document.getElementById('banned-guest-warning');
  const bannedGuestMsg = document.getElementById('banned-guest-msg');
  const overviewTableBody = document.getElementById('overview-table-body');
  const overviewEmpty = document.getElementById('overview-empty');
  const overviewRecentTabCount = document.getElementById('overview-recent-tab-count');

  // New Reservation Modal Elements
  const newReservationModal = document.getElementById('new-reservation-modal');
  const btnOpenNewReservationModal = document.getElementById('btn-open-new-reservation-modal');
  const btnCloseNewReservation = document.getElementById('btn-close-new-reservation');
  const btnResNewBooking = document.getElementById('btn-res-new-booking');

  // User Manual Modal Elements
  const btnOpenUserManual = document.getElementById('btn-open-user-manual');
  const navUserManual = document.getElementById('nav-user-manual');
  const userManualModal = document.getElementById('user-manual-modal');
  const btnCloseUserManual = document.getElementById('btn-close-user-manual');
  const btnCloseUserManualFooter = document.getElementById('btn-close-user-manual-footer');
  const btnPrintUserManual = document.getElementById('btn-print-user-manual');
  const manualSearchInput = document.getElementById('manual-search-input');
  const manualContentContainer = document.getElementById('manual-content-container');

  // Topbar Actions (Backup, Restore, Shift Audit)
  const btnOpenShiftAudit = document.getElementById('btn-open-shift-audit');
  const btnRunNightAudit = document.getElementById('btn-run-night-audit');
  const btnBackupDb = document.getElementById('btn-backup-db');
  const btnRestoreDb = document.getElementById('btn-restore-db');

  // Daily Automated Backup (12:00 AM) Modal Elements
  const btnDailyBackupModal = document.getElementById('btn-daily-backup-modal');
  const dailyBackupModal = document.getElementById('daily-backup-modal');
  const btnCloseDailyBackup = document.getElementById('btn-close-daily-backup');
  const btnOpenDailyBackupsFolder = document.getElementById('btn-open-daily-backups-folder');
  const btnChangeDailyBackupFolder = document.getElementById('btn-change-daily-backup-folder');
  const btnResetDailyBackupFolder = document.getElementById('btn-reset-daily-backup-folder');
  const dailyBackupFolderTypeBadge = document.getElementById('daily-backup-folder-type-badge');
  const dailyBackupTableCountBadge = document.getElementById('daily-backup-table-count-badge');
  const btnTriggerDailyBackupNow = document.getElementById('btn-trigger-daily-backup-now');
  const btnRefreshDailyBackups = document.getElementById('btn-refresh-daily-backups');
  const dailyBackupStatusBadge = document.getElementById('daily-backup-status-badge');
  const dailyBackupNextRun = document.getElementById('daily-backup-next-run');
  const dailyBackupLastTime = document.getElementById('daily-backup-last-time');
  const dailyBackupLastFile = document.getElementById('daily-backup-last-file');
  const dailyBackupTotalCount = document.getElementById('daily-backup-total-count');
  const dailyBackupFolderPathDisplay = document.getElementById('daily-backup-folder-path-display');
  const dailyBackupsTableBody = document.getElementById('daily-backups-table-body');
  const dailyBackupsEmpty = document.getElementById('daily-backups-empty');

  // Invoice Modal
  let currentInvoiceReservationId = null;
  let currentInvoiceData = null;
  const invoiceModal = document.getElementById('invoice-modal');
  const btnCloseInvoiceModal = document.getElementById('btn-close-invoice-modal');
  const btnTriggerPrintInvoice = document.getElementById('btn-trigger-print-invoice');
  const btnExportPdfInvoice = document.getElementById('btn-export-pdf-invoice');
  const btnPreviewWindowInvoice = document.getElementById('btn-preview-window-invoice');
  const btnEditInvoice = document.getElementById('btn-edit-invoice');
  const invoicePrintableArea = document.getElementById('invoice-printable-area');

  // Room Revenue Modal
  const roomRevenueModal = document.getElementById('room-revenue-modal');
  const btnCloseRoomRevenueModal = document.getElementById('btn-close-room-revenue-modal');
  const roomRevenueContent = document.getElementById('room-revenue-content');
  const roomRevenueModalTitle = document.getElementById('room-revenue-modal-title');

  // Edit Invoice Modal Elements
  const editInvoiceModal = document.getElementById('edit-invoice-modal');
  const btnCloseEditInvoice = document.getElementById('btn-close-edit-invoice');
  const btnCancelEditInv = document.getElementById('btn-cancel-edit-inv');
  const editInvoiceForm = document.getElementById('edit-invoice-form');
  const editInvResId = document.getElementById('edit-inv-res-id');
  const editInvGuestName = document.getElementById('edit-inv-guest-name');
  const editInvGuestPhone = document.getElementById('edit-inv-guest-phone');
  const editInvGuestId = document.getElementById('edit-inv-guest-id');
  const editInvTotalPrice = document.getElementById('edit-inv-total-price');
  const editInvPaidAmount = document.getElementById('edit-inv-paid-amount');
  const editInvDepositAmount = document.getElementById('edit-inv-deposit-amount');
  const editInvPaymentMethod = document.getElementById('edit-inv-payment-method');
  const editInvRemainingPreview = document.getElementById('edit-inv-remaining-preview');

  // Edit Guest Modal Elements
  const editGuestModal = document.getElementById('edit-guest-modal');
  const btnCloseEditGuest = document.getElementById('btn-close-edit-guest');
  const btnCancelEditGuest = document.getElementById('btn-cancel-edit-guest');
  const editGuestForm = document.getElementById('edit-guest-form');
  const editGuestId = document.getElementById('edit-guest-id');
  const editGuestName = document.getElementById('edit-guest-name');
  const editGuestPhone = document.getElementById('edit-guest-phone');
  const editGuestIdNumber = document.getElementById('edit-guest-id-number');
  const btnSaveEditGuest = document.getElementById('btn-save-edit-guest');

  // Shift Audit Modal
  const shiftAuditModal = document.getElementById('shift-audit-modal');
  const btnCloseShiftAudit = document.getElementById('btn-close-shift-audit');
  const btnPrintShiftAudit = document.getElementById('btn-print-shift-audit');
  const btnExportPdfShiftAudit = document.getElementById('btn-export-pdf-shift-audit');
  const btnPreviewWindowShiftAudit = document.getElementById('btn-preview-window-shift-audit');
  const shiftAuditContent = document.getElementById('shift-audit-content');

  // Extend Stay Modal Elements
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
  const btnConfirmExtendStay = document.getElementById('btn-confirm-extend-stay');
  const extendNightlyRateInput = document.getElementById('extend-nightly-rate-input');
  const extendDiscountInput = document.getElementById('extend-discount-input');
  const extendCalcRatePreview = document.getElementById('extend-calc-rate-preview');
  const extendDiscountBadge = document.getElementById('extend-discount-badge');

  // All Reservations Elements
  const allReservationsTableBody = document.getElementById('all-reservations-table-body');
  const allReservationsEmpty = document.getElementById('all-reservations-empty');
  const reservationsPagination = document.getElementById('reservations-pagination');
  const reservationsPaginationSummary = document.getElementById('reservations-pagination-summary');
  const reservationsPaginationPage = document.getElementById('reservations-pagination-page');
  const btnReservationsPrevPage = document.getElementById('btn-reservations-prev-page');
  const btnReservationsNextPage = document.getElementById('btn-reservations-next-page');
  const searchAllReservations = document.getElementById('search-all-reservations');
  const resFilterTabs = document.querySelectorAll('#res-filter-tabs .filter-tab-btn');
  const btnExportReservationsExcel = document.getElementById('btn-export-reservations-excel');
  const inputImportReservationsExcel = document.getElementById('input-import-reservations-excel');

  // Rooms Elements
  const roomsGridContainer = document.getElementById('rooms-grid-container');
  const roomsFilterTabs = document.querySelectorAll('#rooms-filter-tabs .filter-tab-btn');
  const searchRoomsInput = document.getElementById('search-rooms');
  const roomsBookingTypeTabs = document.querySelectorAll('#rooms-booking-type-tabs .filter-tab-btn');
  const roomsPaymentFilterTabs = document.querySelectorAll('#rooms-payment-filter-tabs .filter-tab-btn');
  const roomsPaymentFilterContainer = document.getElementById('rooms-payment-filter-container');
  const roomsFilterResult = document.getElementById('rooms-filter-result');
  const roomsClearFiltersButton = document.getElementById('rooms-clear-filters');
  const roomsActiveFilterCount = document.getElementById('rooms-active-filter-count');
  const btnToggleAddRoom = document.getElementById('btn-toggle-add-room');
  const addRoomPanel = document.getElementById('add-room-panel');
  const addRoomForm = document.getElementById('add-room-form');
  const btnCancelAddRoom = document.getElementById('btn-cancel-add-room');
  const newRoomNumber = document.getElementById('new-room-number');
  const newRoomType = document.getElementById('new-room-type');
  const newRoomPrice = document.getElementById('new-room-price');
  const newRoomMonthlyPrice = document.getElementById('new-room-monthly-price');
  const newRoomStatus = document.getElementById('new-room-status');

  // Edit Room Modal Elements
  const editRoomModal = document.getElementById('edit-room-modal');
  const editRoomForm = document.getElementById('edit-room-form');
  const editRoomId = document.getElementById('edit-room-id');
  const editRoomNumber = document.getElementById('edit-room-number');
  const editRoomType = document.getElementById('edit-room-type');
  const editRoomPrice = document.getElementById('edit-room-price');
  const editRoomMonthlyPrice = document.getElementById('edit-room-monthly-price');
  const editRoomStatus = document.getElementById('edit-room-status');
  const editRoomStatusLockedHint = document.getElementById('edit-room-status-locked-hint');
  const btnCloseEditRoomModal = document.getElementById('btn-close-edit-room-modal');
  const btnCancelEditRoom = document.getElementById('btn-cancel-edit-room');
  const btnDeleteRoom = document.getElementById('btn-delete-room');

  // Guests Elements
  const importResultModal = document.getElementById('import-result-modal');
  const btnCloseImportResultModal = document.getElementById('btn-close-import-result-modal');
  const btnConfirmImportResult = document.getElementById('btn-confirm-import-result');
  const btnToggleUpdatedGuestsList = document.getElementById('btn-toggle-updated-guests-list');
  const importModalUpdatedContainer = document.getElementById('import-modal-updated-container');
  const importModalToggleArrow = document.getElementById('import-modal-toggle-arrow');
  const guestsTableBody = document.getElementById('guests-table-body');
  const guestsEmpty = document.getElementById('guests-empty');
  const searchGuests = document.getElementById('search-guests');
  const guestsBanFilterTabs = document.querySelectorAll('#guests-ban-filter-tabs .filter-tab-btn');
  const guestsCountBadge = document.getElementById('guests-count-badge');
  const btnExportGuestsExcel = document.getElementById('btn-export-guests-excel');
  const inputImportGuestsExcel = document.getElementById('input-import-guests-excel');
  const btnGuestsPrevPage = document.getElementById('btn-guests-prev-page');
  const btnGuestsNextPage = document.getElementById('btn-guests-next-page');
  const guestsCurrentPageEl = document.getElementById('guests-current-page');
  const guestsTotalPagesEl = document.getElementById('guests-total-pages');
  const guestsPageRangeEl = document.getElementById('guests-page-range');
  const guestsTotalCountEl = document.getElementById('guests-total-count');
  const btnToggleAddCustomer = document.getElementById('btn-toggle-add-customer');
  const addCustomerPanel = document.getElementById('add-customer-panel');
  const addCustomerForm = document.getElementById('add-customer-form');
  const btnCancelAddCustomer = document.getElementById('btn-cancel-add-customer');
  const newCustomerName = document.getElementById('new-customer-name');
  const newCustomerPhone = document.getElementById('new-customer-phone');
  const newCustomerId = document.getElementById('new-customer-id');

  // Admin Panel Elements
  const addUserForm = document.getElementById('add-user-form');
  const newUsernameInput = document.getElementById('new-username');
  const newUserPasswordInput = document.getElementById('new-user-password');
  const newUserRoleSelect = document.getElementById('new-user-role');
  const updatePasswordForm = document.getElementById('update-password-form');
  const currentAdminNewPasswordInput = document.getElementById('current-admin-new-password');
  const usersTableBody = document.getElementById('users-table-body');
  const btnRefreshUsers = document.getElementById('btn-refresh-users');

  // Employee Logs Elements
  const logsTableBody = document.getElementById('logs-table-body');
  const logsEmpty = document.getElementById('logs-empty');
  const searchLogs = document.getElementById('search-logs');
  const logsCountBadge = document.getElementById('logs-count-badge');
  const btnRefreshLogs = document.getElementById('btn-refresh-logs');

  /**
   * Format local date as YYYY-MM-DD (immune to UTC timezone offsets)
   */
  function getLocalDateString(date) { return window.DashboardApp.Helpers.getLocalDateString(date); }

  function updateSystemClock() {
    if (!currentSystemTimeDisplay) return;
    currentSystemTimeDisplay.textContent = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  async function refreshHotelBusinessState() {
    if (!window.api || typeof window.api.getHotelBusinessState !== 'function') return null;
    const result = await window.api.getHotelBusinessState();
    if (!result || !result.success || !result.data) return null;
    const state = result.data;
    window.DashboardApp.State.businessDate = state.current_business_date;
    if (activeBusinessDateDisplay) {
      activeBusinessDateDisplay.textContent = state.current_business_date;
      
      // Calculate next rollover time and show in title
      const settings = await window.api.getBusinessDaySettings();
      if (settings?.data?.hotel_timezone) {
        window.DashboardApp.State.hotelTimezone = settings.data.hotel_timezone;
      }
      const cutoffTime = settings?.data?.business_day_cutoff_time || '06:00';
      const autoRollover = settings?.data?.auto_rollover_enabled !== false;
      
      let titleText = state.last_audit_at ? `آخر إقفال: ${state.last_audit_at}` : 'لم يتم تنفيذ إقفال فندقي بعد';
      
      if (autoRollover) {
        titleText += `\n⏰ الإقفال التلقائي: كل يوم الساعة ${cutoffTime}`;
      }
      
      activeBusinessDateDisplay.title = titleText;
    }
    return state;
  }

  function isReservationOverdue(res) { return window.DashboardApp.Helpers.isReservationOverdue(res); }

  function renderOverdueBadge(isOverdue) { return window.DashboardApp.Helpers.renderOverdueBadge(isOverdue); }

  function roundMoney(val) { return window.DashboardApp.Helpers.roundMoney(val); }

  // Set default dates
  const currentBizDate = window.DashboardApp?.State?.businessDate;
  if (currentBizDate) {
    checkInInput.value = currentBizDate;
    const [by, bm, bd] = currentBizDate.split('-').map(Number);
    const nextBizDate = new Date(by, bm - 1, bd + 1);
    checkOutInput.value = getLocalDateString(nextBizDate);
  } else {
    const today = new Date();
    const tomorrow = new Date(Date.now() + 86400000);
    checkInInput.value = getLocalDateString(today);
    checkOutInput.value = getLocalDateString(tomorrow);
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = "info") { return window.DashboardApp.Helpers.showToast(message, type); }

  // --- UNIVERSAL IN-APP CONFIRMATION MODAL (Zero Native Freeze) ---
  function showConfirmDialog({
    title = 'تأكيد الإجراء',
    message = 'هل أنت متأكد من رغبتك في المتابعة؟',
    confirmText = 'نعم، تأكيد',
    cancelText = 'إلغاء',
    isDanger = true
  } = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById('app-confirm-modal');
      const titleEl = document.getElementById('confirm-modal-title');
      const msgEl = document.getElementById('confirm-modal-message');
      const btnConfirm = document.getElementById('btn-modal-confirm');
      const btnCancel = document.getElementById('btn-modal-cancel');
      const iconContainer = document.getElementById('confirm-modal-icon-container');

      if (!modal || !btnConfirm || !btnCancel) {
        resolve(window.confirm ? window.confirm(message) : true);
        return;
      }

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      if (btnCancel) btnCancel.textContent = cancelText;

      if (btnConfirm) {
        btnConfirm.textContent = confirmText;
        if (isDanger) {
          btnConfirm.className = 'btn btn-danger';
          btnConfirm.style.background = '#dc2626';
          btnConfirm.style.color = '#ffffff';
          btnConfirm.style.border = 'none';
          if (iconContainer) {
            iconContainer.style.background = 'rgba(239, 68, 68, 0.12)';
            iconContainer.style.color = '#dc2626';
            iconContainer.style.borderColor = 'rgba(239, 68, 68, 0.25)';
          }
        } else {
          btnConfirm.className = 'btn btn-primary';
          btnConfirm.style.background = 'var(--primary-accent, #1a432a)';
          btnConfirm.style.color = '#ffffff';
          btnConfirm.style.border = 'none';
          if (iconContainer) {
            iconContainer.style.background = 'rgba(26, 67, 42, 0.12)';
            iconContainer.style.color = 'var(--primary-accent, #1a432a)';
            iconContainer.style.borderColor = 'rgba(26, 67, 42, 0.25)';
          }
        }
      }

      const cleanup = (result) => {
        modal.style.display = 'none';
        btnConfirm.removeEventListener('click', onConfirm);
        btnCancel.removeEventListener('click', onCancel);
        modal.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKeyDown);
        // Force window to restore active focus state
        window.focus();
        resolve(result);
      };

      const onConfirm = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onBackdrop = (e) => {
        if (e.target === modal) cleanup(false);
      };
      const onKeyDown = (e) => {
        if (e.key === 'Escape') cleanup(false);
      };

      btnConfirm.addEventListener('click', onConfirm);
      btnCancel.addEventListener('click', onCancel);
      modal.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKeyDown);

      modal.style.display = 'flex';
      setTimeout(() => {
        btnConfirm.focus();
      }, 50);
    });
  }

  // --- UNIVERSAL IN-APP PROMPT MODAL (Zero Native Freeze) ---
  function showPromptDialog({
    title = 'إدخال بيانات',
    message = 'يرجى إدخال القيمة المطلوبة:',
    defaultValue = '',
    placeholder = '',
    confirmText = 'تأكيد',
    cancelText = 'إلغاء'
  } = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById('app-prompt-modal');
      const titleEl = document.getElementById('prompt-modal-title');
      const msgEl = document.getElementById('prompt-modal-message');
      const inputEl = document.getElementById('prompt-modal-input');
      const btnConfirm = document.getElementById('btn-prompt-confirm');
      const btnCancel = document.getElementById('btn-prompt-cancel');

      if (!modal || !btnConfirm || !btnCancel || !inputEl) {
        const val = window.prompt ? window.prompt(message, defaultValue) : defaultValue;
        resolve(val !== null ? val.trim() : null);
        return;
      }

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      if (btnConfirm) btnConfirm.textContent = confirmText;
      if (btnCancel) btnCancel.textContent = cancelText;
      inputEl.value = defaultValue;
      if (placeholder) inputEl.placeholder = placeholder;

      const cleanup = (result) => {
        modal.style.display = 'none';
        btnConfirm.removeEventListener('click', onConfirm);
        btnCancel.removeEventListener('click', onCancel);
        modal.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKeyDown);
        window.focus();
        resolve(result);
      };

      const onConfirm = () => cleanup(inputEl.value.trim());
      const onCancel = () => cleanup(null);
      const onBackdrop = (e) => {
        if (e.target === modal) cleanup(null);
      };
      const onKeyDown = (e) => {
        if (e.key === 'Escape') cleanup(null);
        if (e.key === 'Enter') cleanup(inputEl.value.trim());
      };

      btnConfirm.addEventListener('click', onConfirm);
      btnCancel.addEventListener('click', onCancel);
      modal.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKeyDown);

      modal.style.display = 'flex';
      setTimeout(() => {
        inputEl.focus();
        inputEl.select();
      }, 50);
    });
  }

  // --- MID-STAY PRO-RATED CANCELLATION MODAL WITH DEPARTURE DATE & ADMIN OVERRIDE ---

  // --- TAB / VIEW NAVIGATION SYSTEM ---
  // PERFORMANCE: Section visibility is switched INSTANTLY (synchronous DOM update).
  // Heavy data-loading calls are then deferred via requestAnimationFrame so the
  // browser paints the new empty view first, then fills it — zero navigation freeze.
  window.switchView = function (targetView) {
    const activeRole = localStorage.getItem('currentUserRole') || (currentUser ? currentUser.role : null);
    // RBAC Security Guard: Protect admin and logs views
    if ((targetView === 'admin' || targetView === 'logs') && activeRole !== 'Admin') {
      showToast('Access Denied: Admin privileges required. (عذراً: هذا القسم مخصص لمدير النظام فقط)', 'error');
      targetView = 'overview';
    }
    window.DashboardApp.State.activeView = targetView;

    // 1. INSTANT: Update navigation links active state (pure CSS class toggle — zero reflow)
    navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.section === targetView);
    });

    // 2. INSTANT: Hide all sections, show target (simple display toggle — no layout calc)
    Object.keys(viewSections).forEach(key => {
      const section = viewSections[key];
      if (section) {
        section.style.display = key === targetView ? (key === 'overview' ? 'flex' : 'block') : 'none';
      }
    });

    // 3. INSTANT: Update topbar text (text swap — negligible cost)
    const titleMap = {
      overview: ['ريحانة للوحدات السكنية', 'Rayhana Suites • لوحة التحكم وإدارة العمليات'],
      reservations: ['سجل وإدارة الحجوزات', 'عرض وتتبع جميع الحجوزات المؤكدة والمكتملة والملغاة'],
      rooms: ['إدارة الغرف الفندقية', 'متابعة حالات الإشغال والغرف المتاحة ودورة النظافة'],
      guests: ['دليل وسجل النزلاء', 'Guest Directory • بيانات النزلاء وسجل الإقامات السابقة'],
      admin: ['لوحة الإدارة والمستخدمين', 'Admin Panel • إضافة وتعديل المستخدمين وتعيين الصلاحيات'],
      logs: ['سجل نشاط وحضور الموظفين', 'Employee Logs • متابعة أوقات تسجيل الدخول والخروج لكافة الموظفين']
    };
    if (titleMap[targetView]) {
      topbarHeading.textContent = titleMap[targetView][0];
      topbarSubheading.textContent = titleMap[targetView][1];
    }

    // 4. DEFERRED: Load data AFTER browser has painted the new blank section.
    // requestAnimationFrame ensures the paint happens before heavy JS executes.
    requestAnimationFrame(() => {
      switch (targetView) {
        case 'overview':     window.DashboardApp.Helpers.loadOverviewData();     break;
        case 'reservations': window.DashboardApp.Helpers.loadReservationsData(); break;
        case 'rooms':        window.DashboardApp.Helpers.loadRoomsData();        break;
        case 'guests':       window.DashboardApp.Helpers.loadGuestsData();       break;
        case 'admin':        window.DashboardApp.Helpers.loadAdminData();        break;
        case 'logs':         loadLogsData();         break;
      }
    });
  };

  // Attach click listeners to sidebar links
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.dataset.section;
      if (target) {
        window.switchView(target);
      }
    });
  });
  // OFFICIAL HOTEL TAX INVOICE & RECEIPT (FEATURE 1)
  // =========================================================================
  function fitReceiptToA4Page(receipt, { applyZoom = true } = {}) {
    if (!receipt) return null;
    const printableHeight = (297 - 20) * 96 / 25.4;
    receipt.classList.add('receipt-print-mode');
    receipt.style.zoom = '1';
    let contentHeight = Math.max(receipt.scrollHeight, receipt.getBoundingClientRect().height);
    if (contentHeight > printableHeight) {
      receipt.classList.add('receipt-print-policy-compact');
      contentHeight = Math.max(receipt.scrollHeight, receipt.getBoundingClientRect().height);
    }
    // Leave a little headroom because Chromium's print media rules are slightly
    // taller than the screen measurement (notably on monthly receipts).
    let scale = Math.max(0.88, Math.min(1, printableHeight * 0.94 / Math.max(1, contentHeight)));
    if (applyZoom) receipt.style.zoom = String(scale);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const renderedHeight = Math.max(receipt.scrollHeight * scale, receipt.getBoundingClientRect().height);
      if (renderedHeight <= printableHeight) break;
      scale = Math.max(0.88, scale * printableHeight / renderedHeight * 0.995);
      if (applyZoom) receipt.style.zoom = String(scale);
    }
    return { scale, contentHeight, printableHeight };
  }

  function fitInvoicePreviewToViewport() {
    if (!invoicePrintableArea || !invoiceModal || invoiceModal.style.display === 'none') return;
    const invoiceCard = invoicePrintableArea.querySelector('.receipt-document');
    if (!invoiceCard) return;

    // The preview pane may scroll; keep receipt text at its intended readable size.
    invoiceCard.style.zoom = '1';
  }

  window.addEventListener('resize', fitInvoicePreviewToViewport);

  async function openInvoiceModal(reservationId) {
    const targetId = parseInt(reservationId, 10);
    if (!targetId || isNaN(targetId)) {
      showToast('يرجى تحديد حجز صالح لعرض الفاتورة.', 'error');
      return;
    }

    currentInvoiceReservationId = targetId;

    try {
      const res = await window.api.getInvoiceData(targetId);
      if (!res || !res.success || !res.data) {
        showToast(res?.error || 'تعذر تحميل بيانات الفاتورة.', 'error');
        return;
      }

      const inv = res.data;
      currentInvoiceData = inv;
      const isContract = inv.booking_type === 'عقد مفتوح';
      // Monthly bookings print under the institution's own letterhead. New rows use
      // the saved flat-rate snapshot; legacy rows retain their 30 x daily fallback.
      const isMonthly = inv.booking_type === 'حجز شهري';
      const isCancelled = inv.status === 'ملغي';
      const isConfirmed = inv.status === 'مؤكد';
      const businessToday = window.DashboardApp?.State?.businessDate || window.DashboardApp?.Helpers?.getLocalDateString?.() || new Date().toISOString().slice(0, 10);
      const overdueDate = String(inv.check_out_date || '').slice(0, 10);
      const overdueDays = (isConfirmed && !isContract && overdueDate && overdueDate < businessToday)
        ? Math.max(0, Math.floor((Date.parse(`${businessToday}T00:00:00Z`) - Date.parse(`${overdueDate}T00:00:00Z`)) / 86400000))
        : 0;
      const isOverdue = overdueDays > 0;
      const effectiveNightlyRate = parseFloat(inv.custom_nightly_price || inv.price_per_night || 0);

      let elapsedContractNights = 0;
      if (isConfirmed && isContract && inv.check_in_date) {
        const startParts = String(inv.check_in_date).slice(0, 10).split('-').map(Number);
        const endParts = businessToday.slice(0, 10).split('-').map(Number);
        elapsedContractNights = Math.max(1, Math.round((Date.UTC(endParts[0], endParts[1] - 1, endParts[2]) - Date.UTC(startParts[0], startParts[1] - 1, startParts[2])) / 86400000));
      }

      const storedTotal = isCancelled ? 0.0 : parseFloat(inv.total_price || 0);
      const rawDiscount = parseFloat(inv.discount_amount || 0);
      let overdueAdditionalAmount = 0;
      let effectiveTotal = storedTotal;
      if (isOverdue && effectiveNightlyRate > 0) {
        overdueAdditionalAmount = roundMoney(overdueDays * effectiveNightlyRate);
        effectiveTotal = roundMoney(storedTotal + overdueAdditionalAmount);
      } else if (isConfirmed && isContract) {
        effectiveTotal = (inv.running_total !== undefined && inv.running_total !== null)
          ? Math.max(storedTotal, parseFloat(inv.running_total))
          : Math.max(storedTotal, roundMoney(elapsedContractNights * effectiveNightlyRate - rawDiscount));
      }

      const total = effectiveTotal;
      const paid = parseFloat((inv.ledger_paid_amount ?? inv.paid_amount) || 0);
      const deposit = parseFloat(inv.deposit_ledger_balance ?? inv.deposit_amount ?? 0);
      const legacyDeposit = Number(inv.deposit_legacy_unreconciled || 0) === 1;
      let invoiceDepositMovements = [];
      try {
        const depositRes = await window.api.getReservationDepositMovements(targetId);
        if (depositRes?.success && Array.isArray(depositRes.data)) invoiceDepositMovements = depositRes.data;
      } catch (_) { /* invoice can still render if the optional history query fails */ }
      const rawRemaining = roundMoney(total - paid);
      const isCredit = rawRemaining < -0.005;
      const remaining = Math.max(0, rawRemaining);

      let invoicePaymentStatusBadge = inv.payment_status;
      if (isCancelled) {
        invoicePaymentStatusBadge = 'ملغي';
      } else if (isOverdue || isContract) {
        invoicePaymentStatusBadge = isCredit ? 'رصيد دائن' : (remaining <= 0.005 ? 'مدفوع بالكامل' : (paid > 0 ? 'مدفوع جزئياً' : 'غير مدفوع'));
      }

      // Compute total collected and total refunded from the payments ledger.
      let originalCollected = 0;
      let refundedTotal = 0;
      try {
        const paymentsRes = await window.api.getReservationPayments(targetId);
        if (paymentsRes && paymentsRes.success && Array.isArray(paymentsRes.data)) {
          for (const p of paymentsRes.data) {
            const amt = parseFloat(p.amount) || 0;
            if (amt > 0) {
              originalCollected += amt;
            } else if (amt < 0) {
              refundedTotal += Math.abs(amt);
            }
          }
        }
      } catch (_) { /* non-critical — invoice still renders without it */ }
      originalCollected = roundMoney(originalCollected);
      refundedTotal = roundMoney(refundedTotal);

      const d1 = inv.check_in_date ? new Date(inv.check_in_date) : null;
      const d2 = inv.check_out_date ? new Date(inv.check_out_date) : null;
      const isSameDay = Boolean(inv.check_in_date && inv.check_out_date && inv.check_in_date === inv.check_out_date);
      const nights = (d1 && d2 && d2 > d1) ? Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24))) : (isContract ? '-' : 1);
      const stayDurationText = isCancelled
        ? 'حجز ملغي (0 ليلة)'
        : (isContract
          ? (isConfirmed ? `عقد مفتوح (${elapsedContractNights} ليالٍ حتى اليوم)` : 'عقد مفتوح (غير محدد)')
          : (inv.booking_type === 'استخدام يومي'
            ? 'يوم استخدام'
            : (isSameDay ? 'مغادرة في نفس اليوم (1 ليلة)' : `${nights} ${nights === 1 ? 'ليلة' : 'ليالٍ'}${isOverdue ? ` + ${overdueDays} متأخرة` : ''}`)));

      // Monthly early checkout recorded under the contract policy: the invoice must
      // show the BOOKED nights and departure date, not the elapsed ones, and note
      // the early departure. Legacy rows have no checkout_policy and render as before.
      const isContractPolicy = inv.checkout_policy === 'contract';
      const isActualPolicy = inv.checkout_policy === 'actual';
      let bookedNights = null;
      if (isContractPolicy && inv.booked_check_out_date) {
        const b1 = inv.check_in_date ? new Date(inv.check_in_date) : null;
        const b2 = new Date(inv.booked_check_out_date);
        if (b1 && b2 > b1) bookedNights = Math.max(1, Math.round((b2 - b1) / (1000 * 60 * 60 * 24)));
      }

      const receiptDigits = value => String(value ?? '').replace(/[٠-٩۰-۹]/g, digit => {
        const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
        const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
        const arabicIndex = arabicDigits.indexOf(digit);
        return String(arabicIndex >= 0 ? arabicIndex : persianDigits.indexOf(digit));
      });
      const policyNote = isContractPolicy
        ? 'تم الاحتساب بقيمة العقد الكاملة (لا يشمل استرداد الليالي غير المستخدمة).'
        : (isActualPolicy
          ? `تم الاحتساب بالليالي الفعلية بناء على استثناء معتمد: ${escapeHtml(receiptDigits(inv.checkout_policy_reason || 'بدون سبب مذكور'))}`
          : '');

      const monthlyRate = Number(inv.monthly_rate_snapshot) > 0
        ? Number(inv.monthly_rate_snapshot)
        : (Number(inv.monthly_price) > 0 ? Number(inv.monthly_price) : roundMoney(effectiveNightlyRate * 30));
      const monthlyExtensionAmount = Math.max(0, roundMoney(inv.monthly_extension_amount || 0));
      const rawDiscountReason = String(inv.discount_reason || '').trim();
      const normalizedDiscountReason = rawDiscountReason.replace(/[إأآ]/g, 'ا').replace(/[()]/g, '').replace(/[\s-]+/g, ' ').trim();
      const displayDiscountReason = /^اقامة طويلة شهري$/.test(normalizedDiscountReason)
        ? 'إقامة طويلة - شهري'
        : receiptDigits(rawDiscountReason);
      const discountReasonText = displayDiscountReason ? ` (${escapeHtml(displayDiscountReason)})` : '';
      const lateFee = parseFloat(inv.late_checkout_fee || 0);

      // "تعديل السند" rewrites the reservation total and paid amount. The main process
      // already refuses a non-Admin at the IPC boundary (ipc/reservations.js), and that
      // remains the real security boundary — this only avoids showing a button whose
      // action is guaranteed to fail.
      const activeInvoiceRole = localStorage.getItem('currentUserRole') || (currentUser ? currentUser.role : null);
      if (btnEditInvoice) btnEditInvoice.style.display = activeInvoiceRole === 'Admin' ? '' : 'none';
      const hasCancellationAdjustment = (inv.status === 'ملغي جزئي' || inv.status === 'ملغي جزئياً') && inv.original_calculated_charge != null;
      // Under the contract policy the invoice bills the BOOKED nights, so the
      // subtotal must use those. Otherwise it would show 1 night x rate and
      // contradict the stored contract total.
      const invoiceNights = (isContractPolicy && bookedNights) ? bookedNights : nights;
      const invoiceDurationText = (isContractPolicy && bookedNights)
        ? `${bookedNights} ${bookedNights === 1 ? 'ليلة' : 'ليالٍ'} (قيمة العقد)`
        : stayDurationText;
      const monthlyPackageSubtotal = roundMoney(monthlyRate + monthlyExtensionAmount);
      const discount = (isMonthly && !isActualPolicy)
        ? Math.max(0, roundMoney(monthlyPackageSubtotal - storedTotal))
        : rawDiscount;
      const baseSubtotal = (typeof invoiceNights === 'number' && invoiceNights > 0)
        ? (invoiceNights * effectiveNightlyRate)
        : (total + discount);
      const shownSubtotal = isMonthly ? (isActualPolicy ? baseSubtotal : monthlyPackageSubtotal) : baseSubtotal;
      const shownRate = isMonthly && !isActualPolicy ? monthlyRate : effectiveNightlyRate;

      const reservationCreatedAt = window.DashboardApp.Helpers.parseStoredTimestamp(inv.created_at);
      const invoiceYear = (reservationCreatedAt || new Date()).getFullYear() || new Date().getFullYear();
      const invoiceNum = `SND-${invoiceYear}-${String(inv.id).padStart(5, '0')}`;
      const issuedAt = new Date();
      const formatReceiptDate = value => {
        const match = receiptDigits(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
        return match ? `${match[1]}-${match[2]}-${match[3]}` : '-';
      };
      const formatReceiptTime = value => {
        const match = receiptDigits(value).match(/(?:^|\s)(\d{1,2}):(\d{2})/);
        return match ? `${String(match[1]).padStart(2, '0')}:${match[2]}` : '-';
      };
      const formatReceiptMoney = value => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
      const formatReceiptDateTime = value => {
        const normalizedValue = receiptDigits(value).trim();
        if (!normalizedValue) return '-';
        const parsed = window.DashboardApp?.Helpers?.parseStoredTimestamp
          ? window.DashboardApp.Helpers.parseStoredTimestamp(normalizedValue)
          : null;
        if (parsed && !Number.isNaN(parsed.getTime())) {
          if (window.DashboardApp?.Helpers?.formatHotelDateTime) {
            const formatted = window.DashboardApp.Helpers.formatHotelDateTime(parsed);
            if (formatted && formatted !== '-') return formatted.slice(0, 16);
          }
          const tz = window.DashboardApp?.Helpers?.getHotelTimezone ? window.DashboardApp.Helpers.getHotelTimezone() : 'Asia/Riyadh';
          const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
            hourCycle: 'h23'
          }).formatToParts(parsed);
          const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
          return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
        }
        const raw = String(normalizedValue || '');
        const date = formatReceiptDate(raw);
        const time = formatReceiptTime(raw.replace('T', ' '));
        return time === '-' ? date : `${date} ${time}`;
      };
      const tz = window.DashboardApp?.Helpers?.getHotelTimezone ? window.DashboardApp.Helpers.getHotelTimezone() : 'Asia/Riyadh';
      const printParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(issuedAt);
      const pp = Object.fromEntries(printParts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
      const printDate = `${pp.year}-${pp.month}-${pp.day}`;
      const printTime = `${pp.hour}:${pp.minute}`;
      const checkInReceiptDate = formatReceiptDate(inv.check_in_date);
      const receiptScheduledCheckoutDate = isContractPolicy && inv.booked_check_out_date
        ? inv.booked_check_out_date
        : (inv.check_out_date || inv.booked_check_out_date);
      const checkOutReceiptDate = receiptScheduledCheckoutDate
        ? formatReceiptDate(receiptScheduledCheckoutDate)
        : 'غير محدد';
      const registrationDate = formatReceiptDateTime(inv.created_at);
      const showRegistrationDate = registrationDate !== '-' && registrationDate.slice(0, 10) !== checkInReceiptDate;

      const format12HourTime = dateObj => {
        if (!dateObj || Number.isNaN(dateObj.getTime())) return '';
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: '2-digit', minute: '2-digit',
          hour12: true
        }).formatToParts(dateObj);
        const h = parts.find(p => p.type === 'hour')?.value || '00';
        const m = parts.find(p => p.type === 'minute')?.value || '00';
        const dp = (parts.find(p => p.type === 'dayPeriod')?.value || 'AM').toUpperCase();
        const period = dp === 'PM' ? 'م' : 'ص';
        return `${h}:${m} ${period}`;
      };

      const checkinRawTs = inv.actual_check_in_at || inv.created_at;
      const parsedCheckinTs = checkinRawTs
        ? (window.DashboardApp?.Helpers?.parseStoredTimestamp ? window.DashboardApp.Helpers.parseStoredTimestamp(checkinRawTs) : new Date(checkinRawTs))
        : null;

      let actualArrivalCalendarDate = checkInReceiptDate;
      let actualArrivalTimeStr = '';
      if (parsedCheckinTs && !Number.isNaN(parsedCheckinTs.getTime())) {
        const arrParts = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(parsedCheckinTs);
        const ap = Object.fromEntries(arrParts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
        actualArrivalCalendarDate = `${ap.year}-${ap.month}-${ap.day}`;
        actualArrivalTimeStr = format12HourTime(parsedCheckinTs);
      }

      let isEarlyMorningCheckin = Number(inv.is_early_checkin) === 1;
      if (!isEarlyMorningCheckin && inv.is_early_checkin !== 0 && parsedCheckinTs && !Number.isNaN(parsedCheckinTs.getTime())) {
        const cParts = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          hour: '2-digit', hourCycle: 'h23'
        }).formatToParts(parsedCheckinTs);
        const checkinH = Number(cParts.find(p => p.type === 'hour')?.value || 12);
        if (checkinH < 6 && inv.check_in_date && actualArrivalCalendarDate > inv.check_in_date) {
          isEarlyMorningCheckin = true;
        }
      }

      let actualDepartureCalendarDate = checkOutReceiptDate;
      let actualDepartureTimeStr = '';
      const checkoutRawTs = inv.checked_out_at;
      const parsedCheckoutTs = checkoutRawTs
        ? (window.DashboardApp?.Helpers?.parseStoredTimestamp ? window.DashboardApp.Helpers.parseStoredTimestamp(checkoutRawTs) : new Date(checkoutRawTs))
        : null;

      if (parsedCheckoutTs && !Number.isNaN(parsedCheckoutTs.getTime())) {
        const depParts = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(parsedCheckoutTs);
        const dp = Object.fromEntries(depParts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
        actualDepartureCalendarDate = `${dp.year}-${dp.month}-${dp.day}`;
        actualDepartureTimeStr = format12HourTime(parsedCheckoutTs);
      } else if (inv.checkout_time) {
        const [ch, cm] = String(inv.checkout_time).split(':').map(Number);
        if (Number.isFinite(ch) && Number.isFinite(cm)) {
          const period = ch >= 12 ? 'م' : 'ص';
          const h12 = ch % 12 || 12;
          actualDepartureTimeStr = `${String(h12).padStart(2, '0')}:${String(cm).padStart(2, '0')} ${period}`;
        }
      }

      const earlyMorningStayNote = ' (تشمل مبيت الليلة السابقة - دخول فجر مبكر)';
      const invoiceDisplayDuration = isEarlyMorningCheckin
        ? `${invoiceNights} ${invoiceNights === 1 ? 'ليلة' : 'ليالٍ'}${earlyMorningStayNote}`
        : invoiceDurationText;
      let receiptPolicies = [];
      try {
        const policiesResult = await window.api.getReceiptStayPolicies();
        if (policiesResult?.success && Array.isArray(policiesResult.data)) receiptPolicies = policiesResult.data;
      } catch (_) { /* the receipt can render without policy settings */ }
      const displayedPolicies = receiptPolicies
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .filter((_, index) => isMonthly || index !== 2)
        .slice(0, 7);
      const receiptDocumentStyles = `
        <style>
          .receipt-document{box-sizing:border-box;width:100%;max-width:100%;min-height:0;padding:16px;border:1px solid #dbe3ec;border-radius:12px;background:#fff;color:#0f172a;display:flex;flex-direction:column;gap:12px;font:13px/1.45 "Segoe UI",Tahoma,"Cairo",Arial,sans-serif;direction:rtl;text-align:right;overflow-wrap:anywhere}
          .receipt-document.receipt-print-mode{width:190mm!important;max-width:190mm!important;min-height:0!important;height:auto!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;gap:6px!important;font-size:10pt!important;line-height:1.35!important;overflow:visible!important}
          .receipt-print-mode .receipt-header{padding-bottom:6px!important;margin:0!important}
          .receipt-print-mode .receipt-details-grid{gap:8px!important;padding-bottom:6px!important;margin:0!important}
          .receipt-print-mode .receipt-items-wrap{margin:0!important}
          .receipt-print-mode .receipt-items-table th,.receipt-print-mode .receipt-items-table td{padding:6px!important}
          .receipt-print-mode .receipt-policy-card,.receipt-print-mode .receipt-totals-card{padding:8px!important}
          .receipt-print-mode .receipt-signature-row{gap:8px!important}
          .receipt-print-mode .receipt-seal{width:160px!important;height:100px!important}
          .receipt-print-mode .receipt-signature-line{height:50px!important}
          .receipt-print-mode .receipt-payment-notice{padding:0!important;border:0!important;line-height:1.35!important}
          .receipt-print-mode.receipt-print-policy-compact .receipt-policy-card ol{line-height:1.1!important}
          .receipt-print-mode.receipt-print-policy-compact .receipt-policy-card li{padding-bottom:0!important}
          .receipt-document *{box-sizing:border-box}
          .receipt-header{padding:0 0 12px!important;margin:0!important;border-bottom:1px solid #e2e8f0!important;gap:16px}
          .receipt-header h2{font-size:18px!important;margin-bottom:4px!important}
          .receipt-header>div:first-child>div{font-size:12px!important;line-height:1.45!important}
          .receipt-header>div:last-child{min-width:190px!important;padding:10px 12px!important}
          .receipt-header>div:last-child>div{font-size:12px!important;line-height:1.45!important}
          .receipt-details-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:16px!important;padding-bottom:12px!important;margin:0!important}
          .receipt-details-grid h3{font-size:13px!important;margin-bottom:6px!important;padding-bottom:5px!important}
          .receipt-details-grid>div>div{font-size:12px!important;line-height:1.55!important}
          .receipt-details-grid strong{color:#64748b!important}
          .receipt-details-grid>div>div{color:#334155!important}
          .receipt-items-wrap{margin:0!important;overflow:visible!important}
          .receipt-items-table{font-size:12px!important}
          .receipt-items-table th,.receipt-items-table td{padding:7px 8px!important}
          .receipt-items-table td>div{font-size:12px!important}
          .receipt-summary-row{display:flex;align-items:stretch;gap:12px;break-inside:avoid;page-break-inside:avoid}
          .receipt-policy-card{flex:0 0 60%;min-width:0;border:1px solid #dbe3ec;border-radius:9px;background:#f8fafc;padding:10px 12px}
          .receipt-policy-card h3{margin:0 0 6px;padding-bottom:5px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px;font-weight:800}
          .receipt-policy-card ol{margin:0;padding:0;color:#475569;font-size:10px;line-height:1.45;list-style:none}
          .receipt-policy-card li{display:flex;gap:5px;padding:0 0 2px}
          .receipt-policy-number{flex:0 0 15px;color:#64748b;font-weight:700;text-align:left}
          .receipt-totals-card{flex:1;min-width:0;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc;padding:10px 12px;font-size:12px;break-inside:avoid;page-break-inside:avoid}
          .receipt-total-line{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0 0 5px;color:#475569}
          .receipt-total-line>span:last-child{color:#1e293b;font-weight:700;white-space:nowrap}
          .receipt-total-discount{padding:3px 5px;border-radius:5px;background:#f1f5f9;color:#334155}
          .receipt-total-net{padding-top:5px;border-top:1px solid #e2e8f0;color:#0f172a;font-weight:800}
          .receipt-total-paid{color:#047831;font-weight:700}
          .receipt-total-remaining{padding:6px 5px 0;border-top:1px dashed #cbd5e1;font-weight:800}
          .receipt-signature-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;text-align:center;break-inside:avoid;page-break-inside:avoid}
          .receipt-signature-monthly{grid-template-columns:repeat(3,minmax(0,1fr))}
          .receipt-signature-cell{min-width:0;display:flex;flex-direction:column;align-items:center;gap:5px;color:#334155;font-size:12px}
          .receipt-signature-cell strong{font-size:12px}
          .receipt-signature-line{width:70%;height:38px;border-bottom:1px dashed #94a3b8}
          .receipt-staff-signature-line img{max-width:100%;max-height:100%;object-fit:contain}
          .receipt-seal{display:block;width:175px;height:110px;object-fit:contain}
          .receipt-receiver-signature small{max-width:100%;color:#64748b;font-size:12px;line-height:1.35}
          .receipt-payment-notice{display:flex;justify-content:space-between;gap:12px;padding-top:8px;border-top:1px solid #e2e8f0;color:#475569;font-size:12px}
          .receipt-deposit-movements{margin-top:0;padding-top:8px;border-top:1px solid #ddd6fe;break-inside:avoid;page-break-inside:avoid}
          .receipt-deposit-movements h4{margin:0 0 5px!important;font-size:12px!important}
          .receipt-deposit-movements table{font-size:12px!important}
          .receipt-deposit-movements th,.receipt-deposit-movements td{padding:4px!important}
          .receipt-transfers-card{margin-top:-16px;margin-bottom:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;break-inside:avoid;page-break-inside:avoid}
          .receipt-transfers-card table{font-size:11px!important}
          .receipt-transfers-card th,.receipt-transfers-card td{padding:4px 6px!important}
          @media(max-width:760px){.receipt-details-grid{grid-template-columns:1fr!important}.receipt-summary-row{flex-direction:column}.receipt-policy-card{flex-basis:auto}.receipt-header{flex-direction:column}.receipt-header>div:last-child{width:100%}}
          @page{size:A4;margin:10mm}
          @media print{
            html,body{width:100%;height:auto;margin:0!important;padding:0!important;overflow:visible!important}
            *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
            .receipt-document{width:100%;max-width:100%;min-height:0;height:auto;padding:0;border:0;border-radius:0;box-shadow:none;gap:6px;font-size:10pt;line-height:1.35;overflow:visible}
            .receipt-header{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;justify-content:space-between!important;align-items:flex-start!important;gap:10px!important;padding-bottom:6px!important;margin:0 0 6px!important}
            .receipt-header>div:first-child{flex:1 1 auto!important;min-width:0!important}
            .receipt-header>div:last-child{flex:0 0 55mm!important;width:55mm!important;min-width:55mm!important;padding:8px!important}
            .receipt-header h2{font-size:14pt!important}
            .receipt-header>div:first-child>div,.receipt-header>div:last-child>div{font-size:10pt!important}
            .receipt-details-grid{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:8px!important;padding-bottom:6px!important;margin:0 0 6px!important}
            .receipt-details-grid>div{min-width:0!important}
            .receipt-details-grid h3{font-size:10pt!important;margin:0 0 2px!important;padding:0 0 2px!important;border-bottom:0!important}
            .receipt-details-grid>div>div{font-size:10pt!important;line-height:1.3!important}
            .receipt-details-grid>div>div:not(h3){display:flex!important;flex-direction:column!important;gap:2px!important}
            .receipt-items-table{font-size:10pt!important}
            .receipt-items-table th,.receipt-items-table td{padding:6px!important}
            .receipt-items-table td>div{font-size:10pt!important}
            .receipt-summary-row{display:grid!important;grid-template-columns:minmax(0,3fr) minmax(0,2fr)!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:stretch!important;gap:8px!important;margin:0!important;break-inside:avoid!important;page-break-inside:avoid!important}
            .receipt-policy-card,.receipt-totals-card{min-width:0!important;width:auto!important;break-inside:avoid!important;page-break-inside:avoid!important}
            .receipt-policy-card{padding:8px!important}
            .receipt-policy-card h3{font-size:10pt}
            .receipt-policy-card ol{font-size:9pt!important;line-height:1.25!important}
            .receipt-totals-card{padding:8px!important;font-size:10pt!important}
            .receipt-total-line{margin-bottom:3px}
            .receipt-payment-notice{margin:0 0 4px!important;padding:0!important;border:0!important;font-size:10pt!important}
            .receipt-signature-row{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;margin:0!important;break-inside:avoid!important;page-break-inside:avoid!important}
            .receipt-signature-row:not(.receipt-signature-monthly){grid-template-columns:repeat(2,minmax(0,1fr))!important}
            .receipt-signature-line{height:50px!important}
            .receipt-signature-cell,.receipt-signature-cell strong{font-size:10pt}
            .receipt-seal{width:160px!important;height:100px!important;object-fit:contain!important}
            .receipt-receiver-signature small{font-size:9pt}
            .receipt-deposit-movements table{font-size:9pt!important}
            .receipt-deposit-movements th,.receipt-deposit-movements td{padding:3px!important}
            .receipt-transfers-card{padding:5px 8px!important;margin-bottom:8px!important;margin-top:-6px!important}
            .receipt-transfers-card table{font-size:8.5pt!important}
            .receipt-transfers-card th,.receipt-transfers-card td{padding:2px 4px!important}
          }
        </style>`;
      const receiptPrintFitScript = `<script>(function(){window.prepareReceiptForPrint=function(){const receipt=document.querySelector('.receipt-document');return receipt?(${fitReceiptToA4Page.toString()})(receipt):null;};window.addEventListener('beforeprint',window.prepareReceiptForPrint);})();</script>`;

      const activeBrand = (window.DashboardApp && window.DashboardApp.Helpers && window.DashboardApp.Helpers.getActiveBrand) ? window.DashboardApp.Helpers.getActiveBrand() : {
        companyAr: 'مؤسسة مكتب شمس المنازل للخدمات العقارية',
        nameAr: 'ريحانة للوحدات السكنية',
        crNumber: '7038955915',
        address: 'الخبر - الثقبة',
        postalCode: '34625',
        phone: '0560631783',
        seal: 'assets/seal.svg',
        signature: 'assets/signature.svg'
      };

      invoicePrintableArea.innerHTML = `
        ${receiptDocumentStyles}
        ${receiptPrintFitScript}
        <div class="receipt-document" dir="rtl">
          <!-- Title Section for Monthly -->
       ${isMonthly ? `
  <div style="text-align: center; margin-bottom: 32px; margin-top: 10px; display: flex; flex-direction: column; align-items: center;">
    <h1 style="font-family: 'Cairo', 'Tajawal', sans-serif; font-size: 1.8rem; font-weight: 700; color: #1e293b; margin: 0 0 10px 0; letter-spacing: normal; font-synthesis: none; text-rendering: optimizeLegibility;">عقد إيجار</h1>
    <div style="height: 3px; width: 110px; background-color: #94a3b8; border-radius: 2px;"></div>
  </div>
` : ''}
          <!-- Top Section: Company & Receipt Info -->
          <div class="receipt-header" style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 28px;">
            <!-- Company Info (Right) -->
            <div style="display: flex; gap: 16px; align-items: flex-start;">
              ${activeBrand.logo ? `<img src="${activeBrand.logo}" alt="شعار الفندق" style="width: 52px; height: 52px; border-radius: 8px; object-fit: contain; border: 1px solid #e2e8f0; background: #fff; padding: 2px;">` : ''}
              <div>
                <h2 style="font-size: 1.25rem; font-weight: 800; color: #1e293b; margin: 0 0 8px 0;">${isMonthly ? (activeBrand.companyAr || 'مؤسسة مكتب شمس المنازل للخدمات العقارية') : (activeBrand.nameAr || 'ريحانة للوحدات السكنية')}</h2>
                <div style="font-size: 0.85rem; color: #64748b; line-height: 1.6;">
                  <div>العنوان: ${escapeHtml(activeBrand.address || 'الخبر - الثقبة')} </div>
                  <div>الرمز البريدي: ${escapeHtml(activeBrand.postalCode || '34625')}</div>
                  <div>هاتف الاستقبال: ${escapeHtml(activeBrand.phone || '0560631783')}</div>
                  ${isMonthly ? (activeBrand.crNumber && activeBrand.crNumber !== '7038955915' ? `<div>الرقم الموحد: ${escapeHtml(activeBrand.crNumber)}</div>` : '<div>الرقم الموحد: 7038955915</div>') : ''}
                </div>
              </div>
            </div>

            <!-- Receipt Info (Left) -->
            <div style="background: #eff6ff; border: 1px solid #dbeafe; border-radius: 10px; padding: 14px 18px; text-align: right; min-width: 220px;">
              <div style="display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 6px; font-size: 0.85rem; font-weight: 800; margin-bottom: 10px;">
                ${isCancelled ? 'سند حجز ملغي' : 'سند'}
              </div>
              <div style="font-size: 0.85rem; color: #475569; line-height: 1.7;">
                <div><span style="font-weight: 700; color: #1e293b;">رقم السند:</span> <span style="font-family: monospace; color: #4338ca; font-weight: 700;">${invoiceNum}</span></div>
                <div>تاريخ الإصدار: <bdi dir="ltr" style="white-space: nowrap;">${printDate}</bdi></div>
                <div>الوقت: <bdi dir="ltr" style="white-space: nowrap;">${escapeHtml(printTime)}</bdi></div>
              </div>
              <div style="margin-top: 10px;">
                ${isCancelled
                  ? '<span class="badge badge-cancelled" style="font-size: 0.8rem; padding: 4px 10px;">حجز ملغي</span>'
                  : window.DashboardApp.Helpers.getPaymentStatusBadge(invoicePaymentStatusBadge)}
              </div>
            </div>
          </div>

          <!-- Details Section -->
          <div class="receipt-details-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 28px; border-bottom: 2px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 28px;">
            <!-- Guest Details -->
            <div>
              <h3 style="font-size: 0.95rem; font-weight: 800; color: #1e293b; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">بيانات النزيل (Guest Details)</h3>
                <div style="font-size: 0.85rem; line-height: 1.8; color: #475569;">
                <div><strong style="color: #1e293b;">اسم النزيل:</strong> ${escapeHtml(receiptDigits(inv.guest_name))}</div>
                <div><strong style="color: #1e293b;">رقم الجوال:</strong> ${escapeHtml(receiptDigits(inv.guest_phone || '-'))}</div>
                <div><strong style="color: #1e293b;">رقم الهوية / الإقامة:</strong> ${escapeHtml(receiptDigits(inv.guest_id_number || 'غير مسجل'))}</div>
              </div>
            </div>

            <!-- Stay Details -->
            <div>
              <h3 style="font-size: 0.95rem; font-weight: 800; color: #1e293b; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">بيانات الإقامة والوحدة (Stay Details)</h3>
              <div style="font-size: 0.85rem; line-height: 1.8; color: #475569;">
                <div><strong style="color: #1e293b;">رقم الوحدة:</strong> ${escapeHtml(receiptDigits(inv.room_number))} (${escapeHtml(receiptDigits(inv.room_type || ''))}) ${(inv.transfers && inv.transfers.length > 0) ? `<span style="display: inline-block; background: #e0e7ff; color: #3730a3; padding: 1px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; margin-right: 4px;">(تم النقل)</span>` : ''}</div>
                <div><strong style="color: #1e293b;">${isEarlyMorningCheckin ? 'تاريخ الوصول الفعلي:' : 'تاريخ الوصول:'}</strong> <bdi dir="ltr">${isEarlyMorningCheckin ? `${actualArrivalCalendarDate}${actualArrivalTimeStr ? ` (${actualArrivalTimeStr})` : ''}` : checkInReceiptDate}</bdi></div>
                <div><strong style="color: #1e293b;">${isEarlyMorningCheckin || inv.status === 'مكتمل' ? 'تاريخ المغادرة الفعلي' : 'تاريخ المغادرة'}${isMonthly ? '' : ` (${escapeHtml(invoiceDisplayDuration)})`}:</strong> <bdi dir="ltr">${isEarlyMorningCheckin || inv.status === 'مكتمل' ? `${actualDepartureCalendarDate}${actualDepartureTimeStr ? ` (${actualDepartureTimeStr})` : ''}` : checkOutReceiptDate}</bdi> ${isOverdue ? `<span style="color: #b91c1c; font-weight: 700; font-size: 0.8rem; margin-right: 4px;">(متأخر ${overdueDays} ${overdueDays === 1 ? 'يوم' : 'أيام'})</span>` : ''}</div>
                ${showRegistrationDate && !isEarlyMorningCheckin ? `<div><strong style="color: #1e293b;">تاريخ التسجيل:</strong> <bdi dir="ltr">${registrationDate}</bdi></div>` : ''}
                ${inv.checkout_time && !isEarlyMorningCheckin && formatReceiptDate(inv.check_out_date) === checkOutReceiptDate ? `<div><strong style="color: #1e293b;">وقت المغادرة:</strong> <bdi dir="ltr">${formatReceiptTime(inv.checkout_time)}</bdi></div>` : ''}
                ${policyNote ? `<div style="margin-top: 8px; padding: 6px 10px; border-radius: 6px; background: #eef2ff; color: #3730a3; font-size: 0.8rem; font-weight: 700;">${policyNote}</div>` : ''}
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <div class="receipt-items-wrap" style="margin-bottom: 28px; overflow-x: auto;">
            <table class="receipt-items-table" style="width: 100%; border-collapse: collapse; font-size: 0.88rem; table-layout: fixed; word-break: break-word;">
              <colgroup>
                <col style="width: 48%;">
                <col style="width: 18%;">
                <col style="width: 14%;">
                <col style="width: 20%;">
              </colgroup>
              <thead>
                <tr style="background: #1e1b4b; color: white;">
                  <th style="padding: 12px 14px; text-align: right; border-radius: 0 8px 0 0; font-weight: 700;">الوصف والخدمة</th>
                  <th style="padding: 12px 14px; text-align: center; font-weight: 700;">${isMonthly && !isActualPolicy ? 'سعر الشهر' : 'سعر الليلة / اليوم'}</th>
                  <th style="padding: 12px 14px; text-align: center; font-weight: 700;">المدة</th>
                  <th style="padding: 12px 14px; text-align: left; border-radius: 8px 0 0 0; font-weight: 700;">المجموع</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #e2e8f0; ${isCancelled ? 'background: #fff8f8;' : ''}">
                  <td style="padding: 14px;">
                    <div style="font-weight: 700; color: #1e293b;">إقامة سكنية - وحدة ${escapeHtml(receiptDigits(inv.room_number))} ${isContract ? '(عقد مفتوح)' : ''}${isEarlyMorningCheckin ? ' (تشمل مبيت الليلة السابقة - دخول فجر مبكر)' : ''}</div>
                    <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">
                      ${isCancelled
                        ? '<span style="color: #dc2626; font-weight: 700;">(تم إبطال / إلغاء هذا الحجز بالكامل ولا توجد رسوم إقامة مستحقة)</span>'
                        : `نوع الوحدة: ${escapeHtml(receiptDigits(inv.room_type || 'عادية'))} ${
                          (inv.transfers && inv.transfers.length > 0)
                            ? `<span style="color: #1d4ed8; font-weight: 700;">(ترقية من وحدة ${escapeHtml(receiptDigits(inv.transfers[inv.transfers.length - 1].from_room_number))})</span>`
                            : (inv.custom_nightly_price ? '<span style="color: #05963d; font-weight: 700;">(سعر خاص معتمد)</span>' : '')
                        }`}
                    </div>
                    ${(isMonthly && !isActualPolicy && inv.transfers && inv.transfers.length > 0) ? (() => {
                      const totalStayNights = (typeof invoiceNights === 'number' && invoiceNights > 0) ? invoiceNights : 30;
                      let earlierSum = 0;
                      let pastNightsTotal = 0;
                      const lastTr = inv.transfers[inv.transfers.length - 1];
                      const transferDateStr = formatReceiptDate(lastTr.transfer_business_date || lastTr.transfer_timestamp);

                      const pastLines = inv.transfers.map(tr => {
                        const pNights = tr.segment_nights || 0;
                        pastNightsTotal += pNights;
                        const pRate = Number(tr.from_monthly_price || tr.from_room_monthly_price || 0);
                        const pAmount = roundMoney((pRate * pNights) / totalStayNights);
                        earlierSum = roundMoney(earlierSum + pAmount);
                        return `<div style="color: #334155;">• وحدة <strong>${escapeHtml(receiptDigits(tr.from_room_number || '-'))}</strong> (<bdi dir="ltr">${formatReceiptDate(tr.segment_start_date)}</bdi> إلى <bdi dir="ltr">${formatReceiptDate(tr.segment_end_date)}</bdi> - ${escapeHtml(receiptDigits(pNights))} ${pNights === 1 ? 'ليلة' : 'ليالٍ'}) بسعر شهر ${formatReceiptMoney(pRate)} ر.س = <strong>${formatReceiptMoney(pAmount)} ر.س</strong></div>`;
                      });

                      const curNights = Math.max(0, totalStayNights - pastNightsTotal);
                      const curStartDate = lastTr.segment_end_date || lastTr.transfer_business_date;
                      const curEndDate = receiptScheduledCheckoutDate;
                      const curRate = Number(lastTr.to_monthly_price || inv.monthly_price || 0);
                      const curAmount = roundMoney(shownRate - earlierSum);

                      const curLine = `<div style="color: #334155;">• وحدة <strong>${escapeHtml(receiptDigits(inv.room_number))}</strong> (<bdi dir="ltr">${formatReceiptDate(curStartDate)}</bdi> إلى <bdi dir="ltr">${formatReceiptDate(curEndDate)}</bdi> - ${escapeHtml(receiptDigits(curNights))} ${curNights === 1 ? 'ليلة' : 'ليالٍ'}) بسعر شهر ${formatReceiptMoney(curRate)} ر.س = <strong>${formatReceiptMoney(curAmount)} ر.س</strong></div>`;

                      return `
                        <div style="margin-top: 8px; padding: 8px 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 0.78rem; line-height: 1.6; color: #1e293b;">
                          <div style="font-weight: 800; color: #166534; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
                            <span>طريقة احتساب قيمة الشهر بعد الترقية:</span>
                            <span style="font-size: 0.72rem; color: #475569;">(${escapeHtml(receiptDigits(totalStayNights))} ليلة | تاريخ النقل: <bdi dir="ltr">${transferDateStr}</bdi>)</span>
                          </div>
                          ${pastLines.join('')}
                          ${curLine}
                          <div style="border-top: 1px dashed #86efac; margin-top: 5px; padding-top: 4px; font-weight: 800; color: #166534;">
                            &larr; المعادلة: ${inv.transfers.map(tr => formatReceiptMoney(roundMoney(((Number(tr.from_monthly_price || tr.from_room_monthly_price || 0)) * (tr.segment_nights || 0)) / totalStayNights))).join(' + ')} + ${formatReceiptMoney(curAmount)} = <strong>${formatReceiptMoney(shownRate)} ر.س</strong> (قبل الخصم)
                          </div>
                        </div>
                      `;
                    })() : ''}
                  </td>
                  <td style="padding: 14px; text-align: center; color: #475569;">
                    ${isCancelled ? '0.00 ر.س' : (
                      (isMonthly && !isActualPolicy && inv.transfers && inv.transfers.length > 0)
                        ? `
                          <div style="font-weight: 700; color: #1e1b4b; font-size: 0.95rem;">${formatReceiptMoney(inv.transfers[inv.transfers.length - 1].to_monthly_price || inv.monthly_price || shownRate)} ر.س</div>
                          <div style="font-size: 0.72rem; color: #64748b; margin-top: 1px;">سعر شهر الوحدة</div>
                          <div style="font-size: 0.75rem; color: #1d4ed8; font-weight: 700; margin-top: 3px; border-top: 1px dashed #cbd5e1; padding-top: 2px;">
                            سعر الشهر بعد الترقية: ${formatReceiptMoney(shownRate)} ر.س
                          </div>
                        `
                        : `${formatReceiptMoney(shownRate)} ر.س`
                    )}
                  </td>
                  <td style="padding: 14px; text-align: center; font-weight: 700; color: #475569;">${isMonthly && !isActualPolicy ? 'شهر' : (isContract && isConfirmed ? `${elapsedContractNights} ليالٍ` : (isEarlyMorningCheckin ? `${invoiceNights} ${invoiceNights === 1 ? 'ليلة' : 'ليالٍ'}` : invoiceDurationText))}</td>
                  <td style="padding: 14px; text-align: left; font-weight: 800; color: #1e1b4b;">${formatReceiptMoney(isCancelled ? 0 : (isContract && isConfirmed ? ((inv.running_total !== undefined && inv.running_total !== null) ? Number(inv.running_total) : (elapsedContractNights * effectiveNightlyRate)) : shownSubtotal))} ر.س</td>
                </tr>
                ${isOverdue && overdueAdditionalAmount > 0 && !isCancelled ? `
                  <tr style="background: #fff7ed; border-bottom: 1px solid #ffedd5;">
                    <td style="padding: 12px 14px;">
                      <div style="font-weight: 700; color: #c2410c;">ليالٍ إضافية لتأخير المغادرة (${overdueDays} ${overdueDays === 1 ? 'ليلة متأخرة' : 'ليالٍ متأخرة'})</div>
                      <div style="font-size: 0.75rem; color: #ea580c; margin-top: 2px;">استمرار الإقامة بعد موعد المغادرة المحدد حتى تاريخ اليوم (<bdi dir="ltr">${businessToday}</bdi>)</div>
                    </td>
                    <td style="padding: 12px 14px; text-align: center; color: #ea580c;">${formatReceiptMoney(effectiveNightlyRate)} ر.س</td>
                    <td style="padding: 12px 14px; text-align: center; font-weight: 700; color: #ea580c;">${overdueDays} ${overdueDays === 1 ? 'ليلة' : 'ليالٍ'}</td>
                    <td style="padding: 12px 14px; text-align: left; font-weight: 800; color: #c2410c;">+ ${formatReceiptMoney(overdueAdditionalAmount)} ر.س</td>
                  </tr>
                ` : ''}
                ${isMonthly && monthlyExtensionAmount > 0 && !isCancelled ? `
                  <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 12px 14px;"><div style="font-weight: 700; color: #334155;">رسوم التمديد بالسعر اليومي</div></td>
                    <td style="padding: 12px 14px; text-align: center; color: #475569;">${formatReceiptMoney(effectiveNightlyRate)} ر.س/يوم</td>
                    <td style="padding: 12px 14px; text-align: center; color: #475569;">-</td>
                    <td style="padding: 12px 14px; text-align: left; font-weight: 800; color: #334155;">+ ${formatReceiptMoney(monthlyExtensionAmount)} ر.س</td>
                  </tr>
                ` : ''}
                ${discount > 0 && !isCancelled ? `
                  <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 12px 14px;">
                      <div style="font-weight: 700; color: #334155;">خصم وتخفيض معتمد${discountReasonText}</div>
                      <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">تخفيض ممنوح على إجمالي قيمة الإقامة</div>
                    </td>
                    <td style="padding: 12px 14px; text-align: center; color: #475569;">-</td>
                    <td style="padding: 12px 14px; text-align: center; color: #475569;">-</td>
                    <td style="padding: 12px 14px; text-align: left; font-weight: 800; color: #334155;" dir="ltr">- ${formatReceiptMoney(discount)} ر.س</td>
                  </tr>
                ` : ''}
                ${lateFee > 0 && !isCancelled ? `
                  <tr style="background: #fff7ed; border-bottom: 1px solid #ffedd5;">
                    <td style="padding: 12px 14px;">
                      <div style="font-weight: 700; color: #c2410c;">مبلغ إضافي لتأخير المغادرة</div>
                      <div style="font-size: 0.75rem; color: #ea580c; margin-top: 2px;">تم اعتماده يدويًا عند التسوية</div>
                    </td>
                    <td style="padding: 12px 14px; text-align: center; color: #ea580c;">-</td>
                    <td style="padding: 12px 14px; text-align: center; color: #ea580c;">-</td>
                    <td style="padding: 12px 14px; text-align: left; font-weight: 800; color: #c2410c; white-space: nowrap;">+ ${formatReceiptMoney(lateFee)} ر.س</td>
                  </tr>
                ` : ''}
                ${hasCancellationAdjustment ? `
                  <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 12px 14px;">
                      <div style="font-weight: 700; color: #4338ca;">تعديل إداري معتمد لمبلغ الإلغاء</div>
                      <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">الحساب التلقائي الأصلي قبل التعديل: ${formatReceiptMoney(inv.original_calculated_charge)} ر.س</div>
                    </td>
                    <td style="padding: 12px 14px; text-align: center;">-</td>
                    <td style="padding: 12px 14px; text-align: center;">-</td>
                    <td style="padding: 12px 14px; text-align: left; font-weight: 800; color: #4338ca;">${formatReceiptMoney(inv.total_price || 0)} ر.س</td>
                  </tr>
                ` : ''}
                ${deposit > 0 ? `
                  <tr style="background: #fdf4ff; border-bottom: 1px solid #fae8ff;">
                    <td style="padding: 12px 14px;">
                      <div style="font-weight: 700; color: #701a75;">رصيد التأمين المسجل (Deposit Balance)</div>
                      <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">${legacyDeposit ? 'قيمة تاريخية بلا سند حركة، وتحتاج مراجعة قبل ردها' : 'مبلغ محفوظ للتأمين ويتطلب تسوية عند المغادرة'}</div>
                    </td>
                    <td style="padding: 12px 14px; text-align: center;">-</td>
                    <td style="padding: 12px 14px; text-align: center;">-</td>
                    <td style="padding: 12px 14px; text-align: left; font-weight: 700; color: #701a75;">${formatReceiptMoney(deposit)} ر.س</td>
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>

          ${(inv.transfers && inv.transfers.length > 0) ? `
            <div class="receipt-transfers-card">
              <div style="font-weight: 800; color: #1e1b4b; font-size: 0.85rem; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                <span>سجل حركات نقل وترقية الغرف خلال الإقامة:</span>
                <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">(إجمالي حركات النقل: ${inv.transfers.length})</span>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; table-layout: fixed; word-break: break-word;">
                <colgroup>
                  <col style="width: 14%;">
                  <col style="width: 20%;">
                  <col style="width: 15%;">
                  <col style="width: 20%;">
                  <col style="width: 16%;">
                  <col style="width: 15%;">
                </colgroup>
                <thead>
                  <tr style="border-bottom: 1px solid #cbd5e1; color: #475569; background: #f1f5f9;">
                    <th style="padding: 5px 8px; text-align: right;">تاريخ العملية</th>
                    <th style="padding: 5px 8px; text-align: right;">مسار النقل</th>
                    <th style="padding: 5px 8px; text-align: center;">نوع العملية</th>
                    <th style="padding: 5px 8px; text-align: right;">فترة الغرفة السابقة</th>
                    <th style="padding: 5px 8px; text-align: left;">${isMonthly ? 'سعر الشهر السابق' : 'سعر الليلة السابق'}</th>
                    <th style="padding: 5px 8px; text-align: right;">السبب / الملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  ${inv.transfers.map(tr => {
                    const modeText = tr.transfer_mode === 'upgrade_pay_difference'
                      ? '<span style="color: #1d4ed8; font-weight: 700;">ترقية بفارق سعر</span>'
                      : (tr.transfer_mode === 'upgrade_free'
                        ? '<span style="color: #15803d; font-weight: 700;">ترقية مجانية</span>'
                        : '<span style="color: #475569;">بنفس السعر</span>');
                    const fromRateHtml = isMonthly
                      ? `<div>${formatReceiptMoney(tr.from_room_monthly_price || 2400)} ر.س / شهر</div>`
                      : `<div>${formatReceiptMoney(tr.from_rate || tr.pinned_rate || tr.from_room_price_per_night || 0)} ر.س / ليلة</div>`;
                    return `
                      <tr style="border-bottom: 1px dashed #e2e8f0; color: #334155;">
                        <td style="padding: 5px 8px;"><bdi dir="ltr">${escapeHtml(formatReceiptDate(tr.transfer_business_date || tr.transfer_timestamp))}</bdi></td>
                        <td style="padding: 5px 8px; font-weight: 700;">من وحدة ${escapeHtml(receiptDigits(tr.from_room_number || '-'))} إلى وحدة ${escapeHtml(receiptDigits(tr.to_room_number || '-'))}</td>
                        <td style="padding: 5px 8px; text-align: center;">${modeText}</td>
                        <td style="padding: 5px 8px;"><bdi dir="ltr">${escapeHtml(formatReceiptDate(tr.segment_start_date))} إلى ${escapeHtml(formatReceiptDate(tr.segment_end_date))}</bdi> (${escapeHtml(receiptDigits(tr.segment_nights || 0))} ليالٍ)</td>
                        <td style="padding: 5px 8px; text-align: left; font-weight: 700;">${fromRateHtml}</td>
                        <td style="padding: 5px 8px; color: #64748b;">${escapeHtml(receiptDigits(tr.reason_details || (tr.reason_category === 'maintenance' ? 'صيانة الغرفة' : (tr.reason_category === 'guest_request' ? 'طلب النزيل' : 'نقل إداري'))))}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <div class="receipt-payment-notice">
            <div>
              <span style="font-weight: 700; color: #1e293b;">طريقة السداد:</span>
              <span style="color: #475569; margin-right: 4px;">${escapeHtml(receiptDigits(inv.payment_method || 'نقداً'))}</span>
            </div>
            <div>
              هذا المستند سند استلام رسمي ومعتمد
            </div>
          </div>

          <!-- Policies and totals stay together below the items table. -->
          <div class="receipt-summary-row" dir="rtl">
            <section class="receipt-policy-card" aria-label="سياسة الإقامة والشروط">
              <h3>سياسة الإقامة والشروط</h3>
              <ol>${displayedPolicies.map((policy, index) => `<li><span class="receipt-policy-number" dir="ltr">${index + 1}.</span><span>${escapeHtml(receiptDigits(policy))}</span></li>`).join('')}</ol>
            </section>
            <div class="receipt-totals-card">
              ${discount > 0 && !isCancelled ? `
                <div class="receipt-total-line">
                  <span>المجموع قبل الخصم:</span>
                  <span dir="ltr">${formatReceiptMoney(total + discount)} ر.س</span>
                </div>
                <div class="receipt-total-line receipt-total-discount">
                  <span>الخصم المعتمد:</span>
                  <span dir="ltr">- ${formatReceiptMoney(discount)} ر.س</span>
                </div>
              ` : ''}
              <div class="receipt-total-line receipt-total-net">
                <span>الإجمالي الصافي:</span>
                <span dir="ltr">${formatReceiptMoney(total)} ر.س ${(isOverdue || (isContract && isConfirmed)) ? '<small style="color: #b91c1c; font-size: 0.72rem; font-weight: 700;">(المستحق حتى اليوم)</small>' : ''}</span>
              </div>
              ${(originalCollected > paid && refundedTotal > 0) ? `
                <div class="receipt-total-line">
                  <span>المبلغ المسدد مسبقا:</span>
                  <span dir="ltr">${formatReceiptMoney(originalCollected)} ر.س</span>
                </div>
                <div class="receipt-total-line">
                  <span>المبلغ المسترد:</span>
                  <span dir="ltr">- ${formatReceiptMoney(refundedTotal)} ر.س</span>
                </div>
              ` : (refundedTotal > 0 ? `
                <div class="receipt-total-line">
                  <span>المبلغ المسترد:</span>
                  <span dir="ltr">- ${formatReceiptMoney(refundedTotal)} ر.س</span>
                </div>
              ` : '')}
              <div class="receipt-total-line receipt-total-paid">
                <span>${refundedTotal > 0 ? 'صافي المدفوع:' : 'المبلغ المدفوع:'}</span>
                <span dir="ltr">${formatReceiptMoney(paid)} ر.س</span>
              </div>
              <div class="receipt-total-line receipt-total-remaining" style="${isCredit ? 'background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 4px 8px; ' : ''}color: ${isCancelled ? '#05963d' : (isCredit ? '#1d4ed8' : (remaining > 0 ? '#dc2626' : '#05963d'))};">
                <span>${isCancelled ? 'المبلغ المتبقي:' : (isCredit ? 'رصيد دائن للنزيل (مستحق له):' : 'المبلغ المتبقي:')}</span>
                <span dir="ltr">${formatReceiptMoney(isCancelled ? 0 : (isCredit ? Math.abs(rawRemaining) : remaining))} ر.س</span>
              </div>
            </div>
          </div>

          <div class="receipt-signature-row ${isMonthly ? 'receipt-signature-monthly' : ''}" dir="rtl">
            ${isMonthly ? `<div class="receipt-signature-cell"><strong>ختم المؤسسة</strong><img class="receipt-seal" src="${activeBrand.seal || 'assets/seal.svg'}" alt="الختم" onerror="this.style.display='none'"></div>` : ''}
            <div class="receipt-signature-cell"><strong>توقيع الموظف</strong><div class="receipt-signature-line receipt-staff-signature-line">${isMonthly ? `<img src="${activeBrand.signature || 'assets/signature.svg'}" alt="التوقيع" onerror="this.style.display='none'">` : ''}</div></div>
            <div class="receipt-signature-cell receipt-receiver-signature"><strong>${isMonthly ? 'توقيع المستأجر' : 'توقيع المستلم'}</strong><div class="receipt-signature-line"></div><small>بتوقيعي أقر بالاطلاع على الشروط أعلاه والموافقة عليها.</small></div>
          </div>

          ${invoiceDepositMovements.length ? `
            <div class="receipt-deposit-movements">
              <h4 style="font-size: 0.9rem; font-weight: 800; color: #5b21b6; margin-bottom: 8px;">سجل حركات التأمين</h4>
              <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem;">
                <thead><tr style="background: #f5f3ff;"><th style="padding: 6px; text-align: right;">التاريخ</th><th style="padding: 6px; text-align: center;">الحركة</th><th style="padding: 6px; text-align: center;">المبلغ</th><th style="padding: 6px; text-align: center;">الطريقة</th><th style="padding: 6px; text-align: right;">السبب / الموظف</th></tr></thead>
                <tbody>${invoiceDepositMovements.map(m => {
                  const labels = { collected: 'استلام', reconciled: 'مطابقة رصيد قديم', refunded: 'رد', applied: 'تسوية على الإقامة', retained: 'احتفاظ' };
                  return `<tr style="border-bottom: 1px solid #ede9fe;"><td style="padding: 6px;"><bdi dir="ltr">${formatReceiptDateTime(m.movement_date)}</bdi></td><td style="padding: 6px; text-align: center;">${labels[m.movement_type] || escapeHtml(receiptDigits(m.movement_type))}</td><td style="padding: 6px; text-align: center;">${formatReceiptMoney(m.amount)} ر.س</td><td style="padding: 6px; text-align: center;">${escapeHtml(receiptDigits(m.payment_method || 'نقداً'))}</td><td style="padding: 6px;">${escapeHtml(receiptDigits(m.reason || ''))}${m.staff_username ? ` - ${escapeHtml(receiptDigits(m.staff_username))}` : ''}</td></tr>`;
                }).join('')}</tbody>
              </table>
            </div>
          ` : ''}
        </div>
      `;

      if (invoiceModal) {
        invoiceModal.style.display = 'flex';
        requestAnimationFrame(fitInvoicePreviewToViewport);
      }
    } catch (err) {
      console.error('Invoice error:', err);
      showToast(`خطأ في عرض الفاتورة: ${err.message}`, 'error');
    }
  }

  // =========================================================================
  // SHIFT AUDIT & NIGHT CLOSING (FEATURE 5 - DATE RANGES & PRESETS)
  // =========================================================================
  let currentShiftAuditPreset = 'today';
  let currentShiftAuditStartDate = null;
  let currentShiftAuditEndDate = null;

  const ARABIC_MONTHS = window.DashboardApp.Helpers.ARABIC_MONTHS;

  function formatArabicDateRange(startDateStr, endDateStr) { return window.DashboardApp.Helpers.formatArabicDateRange(startDateStr, endDateStr); }

  function getShiftAuditPresetDates(preset) {
    const todayStr = window.DashboardApp.State.businessDate || getLocalDateString(new Date());
    const todayObj = new Date(`${todayStr}T12:00:00`);

    switch (preset) {
      case 'today':
        return { startDate: todayStr, endDate: todayStr };

      case 'week': {
        // Current week starting Saturday (Saudi Arabia standard)
        const day = todayObj.getDay(); // 0: Sun, 1: Mon, ..., 5: Fri, 6: Sat
        const diffToSat = (day + 1) % 7;
        const startOfWeek = new Date(todayObj);
        startOfWeek.setDate(todayObj.getDate() - diffToSat);
        return { startDate: getLocalDateString(startOfWeek), endDate: todayStr };
      }

      case 'month': {
        // First day of current month to today
        const startOfMonth = new Date(todayObj.getFullYear(), todayObj.getMonth(), 1);
        return { startDate: getLocalDateString(startOfMonth), endDate: todayStr };
      }

      case 'quarter': {
        // First day of current 3-month quarter to today
        const currentMonth = todayObj.getMonth();
        const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
        const startOfQuarter = new Date(todayObj.getFullYear(), quarterStartMonth, 1);
        return { startDate: getLocalDateString(startOfQuarter), endDate: todayStr };
      }

      default:
        return { startDate: todayStr, endDate: todayStr };
    }
  }

  function ensureShiftAuditFilterBar() {
    let filterBar = document.getElementById('shift-audit-filter-bar');
    if (!filterBar && shiftAuditContent && shiftAuditContent.parentNode) {
      filterBar = document.createElement('div');
      filterBar.id = 'shift-audit-filter-bar';
      filterBar.className = 'no-print';
      filterBar.style.cssText = 'background: #1e293b; color: white; padding: 12px 24px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; direction: rtl;';
      filterBar.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="font-weight: 700; font-size: 0.85rem; color: #94a3b8;">فترة التقرير:</span>
          <div class="audit-preset-pills" style="display: inline-flex; gap: 4px; background: rgba(0,0,0,0.3); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
            <button type="button" class="btn-audit-preset" data-preset="today" style="border: none; background: #1a432a; color: #a7f3c4; padding: 6px 14px; border-radius: 6px; font-weight: 800; font-size: 0.82rem; cursor: pointer; transition: all 0.15s;">اليوم</button>
            <button type="button" class="btn-audit-preset" data-preset="week" style="border: none; background: transparent; color: #cbd5e1; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; transition: all 0.15s;">هذا الأسبوع</button>
            <button type="button" class="btn-audit-preset" data-preset="month" style="border: none; background: transparent; color: #cbd5e1; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; transition: all 0.15s;">هذا الشهر</button>
            <button type="button" class="btn-audit-preset" data-preset="quarter" style="border: none; background: transparent; color: #cbd5e1; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; transition: all 0.15s;">هذا الربع</button>
            <button type="button" class="btn-audit-preset" data-preset="custom" style="border: none; background: transparent; color: #cbd5e1; padding: 6px 14px; border-radius: 6px; font-weight: 600; font-size: 0.82rem; cursor: pointer; transition: all 0.15s;">فترة مخصصة</button>
          </div>
        </div>
        <div id="shift-audit-custom-dates" style="display: none; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="font-size: 0.8rem; color: #cbd5e1;">من:</span>
          <input type="date" id="shift-audit-custom-start" style="padding: 5px 8px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: white; font-size: 0.82rem; font-family: monospace;">
          <span style="font-size: 0.8rem; color: #cbd5e1;">إلى:</span>
          <input type="date" id="shift-audit-custom-end" style="padding: 5px 8px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: white; font-size: 0.82rem; font-family: monospace;">
          <button type="button" id="btn-apply-audit-custom" class="btn btn-sm" style="background: #1a432a; color: #a7f3c4; border: 1px solid #34d372; font-weight: 800; padding: 5px 12px; border-radius: 6px; cursor: pointer;">تطبيق</button>
        </div>
      `;

      shiftAuditContent.parentNode.insertBefore(filterBar, shiftAuditContent);

      const presetButtons = filterBar.querySelectorAll('.btn-audit-preset');
      const customDatesBox = filterBar.querySelector('#shift-audit-custom-dates');
      const customStartInput = filterBar.querySelector('#shift-audit-custom-start');
      const customEndInput = filterBar.querySelector('#shift-audit-custom-end');
      const btnApplyCustom = filterBar.querySelector('#btn-apply-audit-custom');

      presetButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
          const preset = btn.dataset.preset;
          currentShiftAuditPreset = preset;

          presetButtons.forEach(b => {
            const isActive = b === btn;
            b.style.background = isActive ? '#1a432a' : 'transparent';
            b.style.color = isActive ? '#a7f3c4' : '#cbd5e1';
            b.style.fontWeight = isActive ? '800' : '600';
          });

          if (preset === 'custom') {
            if (customDatesBox) customDatesBox.style.display = 'flex';
            if (customStartInput && !customStartInput.value) {
              customStartInput.value = currentShiftAuditStartDate || window.DashboardApp.State.businessDate || getLocalDateString();
            }
            if (customEndInput && !customEndInput.value) {
              customEndInput.value = currentShiftAuditEndDate || window.DashboardApp.State.businessDate || getLocalDateString();
            }
          } else {
            if (customDatesBox) customDatesBox.style.display = 'none';
            const dates = getShiftAuditPresetDates(preset);
            currentShiftAuditStartDate = dates.startDate;
            currentShiftAuditEndDate = dates.endDate;
            await renderShiftAuditData(dates.startDate, dates.endDate);
          }
        });
      });

      if (btnApplyCustom) {
        btnApplyCustom.addEventListener('click', async () => {
          const s = customStartInput ? customStartInput.value : '';
          const e = customEndInput ? customEndInput.value : '';
          if (!s || !e) {
            showToast('يرجى تحديد تاريخ البداية والنهاية للفترة المخصصة.', 'warning');
            return;
          }
          currentShiftAuditStartDate = s;
          currentShiftAuditEndDate = e;
          await renderShiftAuditData(s, e);
        });
      }
    }
  }

  async function renderShiftAuditData(startDate, endDate) {
    try {
      const start = startDate || window.DashboardApp.State.businessDate || getLocalDateString();
      const end = endDate || start;
      const res = await window.api.getShiftAuditReport({ startDate: start, endDate: end });
      if (!res || !res.success || !res.data) {
        showToast(res?.error || 'تعذر استخراج تقرير إقفال الوردية.', 'error');
        return;
      }

      const rep = res.data;
      const fin = rep.financials || {};
      const mov = rep.movements || {};
      const rm = rep.rooms || {};
      const payments = rep.payments || [];
      const txs = rep.transactions || [];
      const depositTxs = rep.depositMovements || [];
      const transfers = rep.transfers || [];
      const printTime = new Date().toLocaleTimeString('ar-EG-u-nu-latn', {
        timeZone: window.DashboardApp?.Helpers?.getHotelTimezone ? window.DashboardApp.Helpers.getHotelTimezone() : 'Asia/Riyadh',
        hour: '2-digit',
        minute: '2-digit'
      });
      const formatActualCheckinDateTime = timestamp => {
        const parsed = window.DashboardApp?.Helpers?.parseStoredTimestamp?.(timestamp);
        if (!parsed || Number.isNaN(parsed.getTime())) return '';
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: window.DashboardApp?.Helpers?.getHotelTimezone ? window.DashboardApp.Helpers.getHotelTimezone() : 'Asia/Riyadh',
          year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(parsed);
        const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
        return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
      };
      const isMultiDay = Boolean(rep.isRange || (rep.startDate && rep.endDate && rep.startDate !== rep.endDate));
      const periodLabel = formatArabicDateRange(rep.startDate, rep.endDate);

      shiftAuditContent.innerHTML = `
        <div style="border: 2px solid #e2e8f0; border-radius: 12px; padding: 26px; background: white;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 18px; margin-bottom: 20px;">
            <div>
              <h2 style="font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0;">
                ${isMultiDay ? 'تقرير إقفال الفترة والموازنة المالية التراكمية' : 'تقرير الإقفال اليومي للوردية والموازنة المالية'}
              </h2>
              <p style="font-size: 0.85rem; color: #64748b; margin: 4px 0 0 0;">
                ${isMultiDay ? 'Period Shift Audit & Financial Closing Reconciliation' : 'Daily Shift Audit & Financial Closing Reconciliation'}
              </p>
            </div>
            <div style="text-align: left; font-size: 0.82rem; color: #334155;">
              ${isMultiDay ? `
                <div>فترة التقرير: <strong>${escapeHtml(periodLabel)}</strong></div>
                <div style="font-size: 0.76rem; color: #64748b; font-family: monospace;">(${rep.startDate} إلى ${rep.endDate})</div>
              ` : `
                <div>التاريخ المستهدف: <strong dir="ltr" style="unicode-bidi: isolate;">${escapeHtml(rep.date)}</strong></div>
              `}
              <div>وقت الاستخراج: <span>${printTime}</span></div>
              <div>المشرف المنفذ: <strong>${escapeHtml(currentUser?.username || 'الإدارة')}</strong></div>
            </div>
          </div>

          <!-- Financial KPIs Grid -->
          <h4 style="font-size: 0.95rem; font-weight: 800; color: #1e1b4b; margin-bottom: 12px;">1. ملخص الإيرادات والمقبوضات المالية حسب وسيلة الدفع</h4>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
            <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 0.78rem; color: #4338ca; font-weight: 700;">إجمالي المقبوضات</div>
              <div style="font-size: 1.25rem; font-weight: 900; color: #1e1b4b; margin-top: 4px;">${parseFloat(fin.totalRevenue || 0).toLocaleString()} <span style="font-size: 0.75rem;">ر.س</span></div>
            </div>
            <div style="background: #ecfdf3; border: 1px solid #a7f3c4; border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 0.78rem; color: #047831; font-weight: 700;">مقبوضات نقداً (كاش)</div>
              <div style="font-size: 1.25rem; font-weight: 900; color: #065f28; margin-top: 4px;">${parseFloat(fin.cashTotal || 0).toLocaleString()} <span style="font-size: 0.75rem;">ر.س</span></div>
              <div style="font-size: 0.68rem; color: #64748b; margin-top: 3px;">${parseFloat(fin.cashCollected || 0).toLocaleString()} مستلم - ${parseFloat(fin.cashRefunded || 0).toLocaleString()} مردود</div>
            </div>
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 0.78rem; color: #1d4ed8; font-weight: 700;">مقبوضات مدى / شبكة</div>
              <div style="font-size: 1.25rem; font-weight: 900; color: #1e40af; margin-top: 4px;">${parseFloat(fin.cardTotal || 0).toLocaleString()} <span style="font-size: 0.75rem;">ر.س</span></div>
            </div>
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 0.78rem; color: #b45309; font-weight: 700;">مبالغ لم تحصّل بعد</div>
              <div style="font-size: 1.25rem; font-weight: 900; color: #92400e; margin-top: 4px;">${parseFloat(fin.outstandingTotal || 0).toLocaleString()} <span style="font-size: 0.75rem;">ر.س</span></div>
            </div>
          </div>

          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin: -10px 0 24px; font-size: 0.84rem; color: #334155;">
            <div style="display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
              <span>صافي كاش التأمين: <strong style="color: ${Number(fin.netCashDeposit || 0) < 0 ? '#dc2626' : '#047831'};">${Number(fin.netCashDeposit || 0) > 0 ? '+' : ''}${parseFloat(fin.netCashDeposit || 0).toLocaleString()} ر.س</strong></span>
              <span style="color: #64748b;">(${parseFloat(fin.depositCashCollected || 0).toLocaleString()} مستلم - ${parseFloat(fin.depositCashRefunded || 0).toLocaleString()} مردود${Number(fin.depositCashRetained || 0) ? ` - ${parseFloat(fin.depositCashRetained).toLocaleString()} محتفَظ به ومدرج ضمن المقبوضات` : ''})</span>
              <span>إجمالي النقد المتوقع بالخزينة: <strong style="color: #0f172a;">${parseFloat(fin.expectedCashInDrawer || 0).toLocaleString()} ر.س</strong> <span style="color: #64748b;">(كاش المقبوضات + صافي كاش التأمين)</span></span>
              <span>رسوم التأخير المسددة كسند مستقل: <strong>${parseFloat(fin.lateCheckoutFeesCollected || 0).toLocaleString()} ر.س</strong></span>
            </div>
          </div>

          <!-- Occupancy & Movements -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
              <h4 style="font-size: 0.88rem; font-weight: 800; color: #334155; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
                <span>2. ${isMultiDay ? 'الحالة الحالية للغرف (لحظية الآن)' : 'حالة ونسبة إشغال الفندق (Occupancy Rate)'}</span>
                ${isMultiDay ? '<span style="font-size: 0.72rem; color: #4338ca; background: #e0e7ff; padding: 2px 7px; border-radius: 5px; font-weight: 700;">حالة حية وليست تراكمية</span>' : ''}
              </h4>
              <div style="font-size: 0.84rem; line-height: 1.8; color: #1e293b;">
                <div style="display: flex; justify-content: space-between;"><span>إجمالي غرف الفندق:</span> <strong>${rm.totalRooms || 0} غرف</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>الغرف المشغولة حالياً:</span> <strong style="color: #dc2626;">${rm.occupiedCount || 0}</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>الغرف المتاحة حالياً:</span> <strong style="color: #05963d;">${rm.availableCount || 0}</strong></div>
                <div style="display: flex; justify-content: space-between;"><span>الغرف قيد التنظيف:</span> <strong style="color: #d97706;">${rm.cleaningCount || 0}</strong></div>
                <div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 4px; font-weight: 800; color: #4338ca;">
                  <span>نسبة الإشغال اللحظية:</span>
                  <span>${rm.occupancyRate || 0}%</span>
                </div>
              </div>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
              <h4 style="font-size: 0.88rem; font-weight: 800; color: #334155; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
                ${isMultiDay ? '3. حركة النزلاء خلال الفترة (Movements in Period)' : '3. حركة النزلاء خلال اليوم (Daily Movements)'}
              </h4>
              <div style="font-size: 0.84rem; line-height: 1.8; color: #1e293b;">
                <div style="display: flex; justify-content: space-between;">
                  <span>${isMultiDay ? 'إجمالي تسجيلات الدخول في الفترة (Check-ins):' : 'عمليات تسجيل الدخول اليوم (Check-ins):'}</span>
                  <strong style="color: #05963d;">${mov.checkinsToday || 0}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>${isMultiDay ? 'إجمالي تسجيلات المغادرة في الفترة (Check-outs):' : 'عمليات تسجيل الخروج اليوم (Check-outs):'}</span>
                  <strong style="color: #d97706;">${mov.checkoutsToday || 0}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>${isMultiDay ? 'إجمالي الحجوزات النشطة في الفترة:' : 'إجمالي الحجوزات المنفذة اليوم:'}</span>
                  <strong>${mov.totalReservationsToday || 0}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>${isMultiDay ? 'إجمالي حركات نقل وترقية الغرف:' : 'حركات نقل وترقية الغرف اليوم:'}</span>
                  <strong style="color: #4338ca;">${mov.totalTransfersToday || 0}</strong>
                </div>
              </div>
            </div>
          </div>

          ${(isMultiDay && rep.dailyBreakdown && rep.dailyBreakdown.length > 1) ? `
            <!-- Daily Breakdown Trend (Range Mode) -->
            <h4 style="font-size: 0.95rem; font-weight: 800; color: #1e1b4b; margin-bottom: 10px;">4. الحركة اليومية وتوزيع الإيرادات عبر أيام الفترة</h4>
            <div style="max-height: 240px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
                <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 1;">
                  <tr style="border-bottom: 2px solid #cbd5e1;">
                    <th style="padding: 8px 12px; text-align: right;">التاريخ</th>
                    <th style="padding: 8px 12px; text-align: center;">تسجيلات دخول</th>
                    <th style="padding: 8px 12px; text-align: center;">تسجيلات خروج</th>
                    <th style="padding: 8px 12px; text-align: left;">المتحصلات اليومية</th>
                  </tr>
                </thead>
                <tbody>
                  ${rep.dailyBreakdown.map(day => `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 7px 12px; font-family: monospace; font-weight: 700; color: #334155;">${day.date}</td>
                      <td style="padding: 7px 12px; text-align: center; color: #05963d; font-weight: 700;">${day.check_ins_count}</td>
                      <td style="padding: 7px 12px; text-align: center; color: #d97706; font-weight: 700;">${day.check_outs_count}</td>
                      <td style="padding: 7px 12px; text-align: left; font-weight: 800; color: #1e1b4b;">${Number(day.revenue).toLocaleString()} ر.س</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- Payments & Receipts Breakdown (Ledger) -->
          <h4 style="font-size: 0.95rem; font-weight: 800; color: #1e1b4b; margin-bottom: 10px;">
            ${isMultiDay ? '4. سجل سندات التحصيل والمردودات المالية في الفترة (حركة الخزينة والمدفوعات)' : '4. سجل سندات التحصيل والمردودات المالية في هذا اليوم (حركة الخزينة والمدفوعات)'}
          </h4>
          ${payments.length === 0 ? `
            <div style="padding: 16px; text-align: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; color: #64748b; font-size: 0.85rem; margin-bottom: 24px;">
              لا توجد سندات قبض أو استرداد مسجلة في هذه الفترة.
            </div>
          ` : `
            <div class="audit-table-wrap">
              <table class="audit-table">
                <thead>
                  <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                    <th style="padding: 8px 10px; text-align: right;">وقت العملية / تاريخ العمل</th>
                    <th style="padding: 8px 10px; text-align: right;">رقم السند</th>
                    <th style="padding: 8px 10px; text-align: right;">الحجز / النزيل</th>
                    <th style="padding: 8px 10px; text-align: right;">الغرفة</th>
                    <th style="padding: 8px 10px; text-align: center;">نوع السند</th>
                    <th style="padding: 8px 10px; text-align: center;">تصنيف الدفعة</th>
                    <th style="padding: 8px 10px; text-align: center;">طريقة الدفع</th>
                    <th style="padding: 8px 10px; text-align: center;">المبلغ</th>
                    <th style="padding: 8px 10px; text-align: right;">البيان / الموظف</th>
                  </tr>
                </thead>
                <tbody>
                  ${payments.map(p => {
                    const amt = roundMoney(p.amount || 0);
                    const isRefund = amt < -0.005;
                    const amtColor = isRefund ? '#dc2626' : '#05963d';
                    const formattedAmt = isRefund ? `- ${Math.abs(amt).toLocaleString()} ر.س` : `+ ${amt.toLocaleString()} ر.س`;
                    const paymentPurpose = ({
                      advance_payment: 'دفعة مقدمة',
                      balance_payment: 'سداد رصيد',
                      extension_payment: 'تمديد إقامة',
                      late_checkout_fee: 'رسوم تأخير مغادرة',
                      checkout_settlement: 'تسوية مغادرة',
                      refund: 'استرداد',
                      deposit_applied: 'تطبيق تأمين',
                      legacy_unclassified: 'قديم / غير مصنف'
                    })[p.payment_type] || 'قديم / غير مصنف';
                    const typeBadge = isRefund
                      ? '<span style="background: #fef2f2; color: #b91c1c; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 0.78rem;">استرداد / صرف</span>'
                      : '<span style="background: #ecfdf3; color: #047831; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 0.78rem;">تحصيل / قبض</span>';
                    return `
                      <tr style="border-bottom: 1px solid #e2e8f0; ${isRefund ? 'background: #fffafa;' : ''}">
                        <td style="padding: 8px 10px; color: #64748b;"><div style="font-family: monospace;">${escapeHtml(String(p.payment_date || p.created_at || '').slice(0, 16))}</div><small style="display:block; margin-top:3px; color:#1a432a;">تاريخ العمل: ${escapeHtml(p.business_date || '-')}</small></td>
                        <td style="padding: 8px 10px; font-family: monospace; font-weight: 700; color: #4338ca;">${escapeHtml(p.receipt_number || ('#' + p.id))}</td>
                        <td style="padding: 8px 10px; font-weight: 700;">#${p.reservation_id} - ${escapeHtml(p.guest_name || 'نزيل')}</td>
                        <td style="padding: 8px 10px;">غرفة ${escapeHtml(p.room_number || '-')}</td>
                        <td style="padding: 8px 10px; text-align: center;">${typeBadge}</td>
                        <td style="padding: 8px 10px; text-align: center;">${escapeHtml(paymentPurpose)}</td>
                        <td style="padding: 8px 10px; text-align: center;">${escapeHtml(p.payment_method || 'نقداً')}</td>
                        <td style="padding: 8px 10px; text-align: center; font-weight: 800; color: ${amtColor}; font-size: 0.88rem;">${formattedAmt}</td>
                        <td style="padding: 8px 10px; font-size: 0.78rem; color: #475569;">${escapeHtml(p.notes || '-')}${p.staff_username ? ` <span style="color:#94a3b8;">(${escapeHtml(p.staff_username)})</span>` : ''}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}

          <!-- Reservations Breakdown -->
          <h4 style="font-size: 0.95rem; font-weight: 800; color: #1e1b4b; margin-bottom: 10px;">
            ${isMultiDay ? '5. سجل حركة الحجوزات والإقامة في الفترة' : '5. سجل حركة الحجوزات والإقامة في هذا اليوم'}
          </h4>
          ${txs.length === 0 ? `
            <div style="padding: 16px; text-align: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; color: #64748b; font-size: 0.85rem; margin-bottom: 24px;">
              لا توجد حجوزات مسجلة في هذه الفترة.
            </div>
          ` : `
            <div class="audit-table-wrap">
              <table class="audit-table">
                <thead>
                  <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                    <th style="padding: 8px 10px; text-align: right;">الحجز</th>
                    <th style="padding: 8px 10px; text-align: right;">النزيل</th>
                    <th style="padding: 8px 10px; text-align: right;">الغرفة</th>
                    <th style="padding: 8px 10px; text-align: center;">فترة الإقامة</th>
                    <th style="padding: 8px 10px; text-align: center;">طريقة الدفع</th>
                    <th style="padding: 8px 10px; text-align: center;">المدفوع</th>
                    <th style="padding: 8px 10px; text-align: center;">رصيد التأمين</th>
                    <th style="padding: 8px 10px; text-align: center;">حالة الحجز</th>
                    <th style="padding: 8px 10px; text-align: center;">حالة السداد</th>
                  </tr>
                </thead>
                <tbody>
                  ${txs.map(t => {
                    const checkIn = t.check_in_date || '-';
                    const checkOut = t.check_out_date || '-';
                    const isSameDayStay = checkIn !== '-' && checkIn === checkOut;
                    const stayText = isSameDayStay ? `${escapeHtml(checkIn)} (نفس اليوم)` : `${escapeHtml(checkIn)} &rarr; ${escapeHtml(checkOut)}`;
                    const actualCheckinDateTime = Number(t.is_early_checkin) === 1
                      ? formatActualCheckinDateTime(t.actual_check_in_at || t.created_at)
                      : '';
                    const isCancelledRow = t.status === 'ملغي';
                    return `
                    <tr style="border-bottom: 1px solid #e2e8f0; ${isCancelledRow ? 'background: #fff5f5; opacity: 0.88;' : ''}">
                      <td style="padding: 8px 10px; font-family: monospace; font-weight: 700;">#${t.id}</td>
                      <td style="padding: 8px 10px; font-weight: 700;">${escapeHtml(t.guest_name)}</td>
                      <td style="padding: 8px 10px;">غرفة ${escapeHtml(t.room_number)}</td>
                      <td style="padding: 8px 10px; text-align: center; font-size: 0.78rem; direction: ltr;">${stayText}${actualCheckinDateTime ? `<small style="display:block; margin-top:4px; color:#047831; direction:rtl;">الوصول الفعلي: <bdi dir="ltr">${escapeHtml(actualCheckinDateTime)}</bdi></small>` : ''}</td>
                      <td style="padding: 8px 10px; text-align: center;">${escapeHtml(t.payment_method || 'نقداً')}</td>
                      <td style="padding: 8px 10px; text-align: center; font-weight: 700; color: #05963d;">${parseFloat(t.paid_amount || 0).toLocaleString()} ر.س</td>
                      <td style="padding: 8px 10px; text-align: center; color: #701a75;">${parseFloat(t.deposit_ledger_balance || 0).toLocaleString()} ر.س</td>
                      <td style="padding: 8px 10px; text-align: center;">${window.DashboardApp.Helpers.getReservationStatusBadge(t.status)}</td>
                      <td style="padding: 8px 10px; text-align: center;">${window.DashboardApp.Helpers.getPaymentStatusBadge(t.payment_status)}</td>
                    </tr>
                  `;}).join('')}
                </tbody>
              </table>
            </div>
          `}

          <!-- Room Transfers Breakdown -->
          <h4 style="font-size: 0.95rem; font-weight: 800; color: #1e1b4b; margin: 18px 0 10px;">
            ${isMultiDay ? '6. سجل حركات نقل وترقية الغرف في الفترة' : '6. سجل حركات نقل وترقية الغرف في هذا اليوم'}
          </h4>
          ${transfers.length === 0 ? `
            <div style="padding: 14px; text-align: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; color: #64748b; font-size: 0.85rem; margin-bottom: 24px;">
              لا توجد عمليات نقل أو ترقية غرف مسجلة في هذه الفترة.
            </div>
          ` : `
            <div class="audit-table-wrap" style="margin-bottom: 24px;">
              <table class="audit-table">
                <thead>
                  <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                    <th style="padding: 8px 10px; text-align: right;">وقت العملية / تاريخ العمل</th>
                    <th style="padding: 8px 10px; text-align: right;">الحجز / النزيل</th>
                    <th style="padding: 8px 10px; text-align: center;">مسار النقل</th>
                    <th style="padding: 8px 10px; text-align: center;">نوع العملية</th>
                    <th style="padding: 8px 10px; text-align: center;">فترة الغرفة السابقة</th>
                    <th style="padding: 8px 10px; text-align: center;">سعر الإقامة السابقة</th>
                    <th style="padding: 8px 10px; text-align: center;">فترة الغرفة الحالية</th>
                    <th style="padding: 8px 10px; text-align: center;">سعر الإقامة الجديد</th>
                    <th style="padding: 8px 10px; text-align: right;">سبب النقل / الملاحظات</th>
                    <th style="padding: 8px 10px; text-align: center;">الموظف المنفذ</th>
                  </tr>
                </thead>
                <tbody>
                  ${transfers.map(t => {
                    const modeLabels = {
                      upgrade_pay_difference: '<span style="background: #eff6ff; color: #1d4ed8; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 0.78rem;">ترقية مع فارق سعر</span>',
                      keep_rate: '<span style="background: #f1f5f9; color: #475569; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 0.78rem;">نقل بنفس السعر</span>',
                      custom_rate: '<span style="background: #ecfdf5; color: #047857; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 0.78rem;">سعر مخصص</span>'
                    };
                    const modeBadge = modeLabels[t.transfer_mode] || `<span style="background: #f1f5f9; color: #475569; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 0.78rem;">${escapeHtml(t.transfer_mode || 'نقل')}</span>`;

                    const reasonCategoryLabels = {
                      guest_request: 'طلب النزيل',
                      maintenance: 'صيانة بالغرفة',
                      noise_complaint: 'شكوى إزعاج',
                      administrative: 'إداري',
                      other: 'أخرى'
                    };
                    const reasonLabel = reasonCategoryLabels[t.reason_category] || (t.reason_category || 'أخرى');

                    const fromRoomInfo = `غرفة ${escapeHtml(t.from_room_number || '-')}`;
                    const toRoomInfo = `غرفة ${escapeHtml(t.to_room_number || '-')}`;
                    const nightsCount = t.segment_nights || 0;
                    const nightsText = `${nightsCount} ${nightsCount === 1 ? 'ليلة' : 'ليالٍ'}`;
                    const segmentRate = Number(t.from_rate != null ? t.from_rate : t.pinned_rate || 0);

                    // Compute current stay segment
                    const relatedRes = txs.find(x => x.id === t.reservation_id) || {};
                    const curStartDate = t.segment_end_date || t.transfer_business_date;
                    const curEndDate = t.check_out_date || relatedRes.check_out_date || '';
                    const isCurContract = t.booking_type === 'عقد مفتوح';
                    const isCurMonthly = t.booking_type === 'حجز شهري';

                    let curNights = 0;
                    let curNightsText = '';
                    let curDatesText = '';

                    if (isCurContract) {
                      curNightsText = 'مستمرة (عقد مفتوح)';
                      curDatesText = `(من ${escapeHtml(curStartDate)} حتى الآن)`;
                    } else if (curEndDate && curEndDate > curStartDate) {
                      const d1 = new Date(curStartDate + 'T00:00:00');
                      const d2 = new Date(curEndDate + 'T00:00:00');
                      curNights = Math.max(1, Math.round((d2 - d1) / 86400000));
                      curNightsText = `${curNights} ${curNights === 1 ? 'ليلة' : 'ليالٍ'}`;
                      curDatesText = `(${escapeHtml(curStartDate)} &rarr; ${escapeHtml(curEndDate)})`;
                    } else if (isCurMonthly) {
                      curNights = 30;
                      curNightsText = 'شهر إقامة';
                      curDatesText = curEndDate ? `(${escapeHtml(curStartDate)} &rarr; ${escapeHtml(curEndDate)})` : `(من ${escapeHtml(curStartDate)})`;
                    } else {
                      curNights = 1;
                      curNightsText = 'مغادرة في نفس اليوم';
                      curDatesText = `(${escapeHtml(curStartDate)})`;
                    }

                    let newRateHtml = '';
                    if (isCurMonthly) {
                      const mRate = Number(
                        t.monthly_rate_snapshot ||
                        relatedRes.monthly_rate_snapshot ||
                        t.to_room_monthly_price ||
                        (isCurMonthly ? relatedRes.total_price : 0) ||
                        0
                      );
                      const nRate = Number(
                        t.custom_nightly_price != null ? t.custom_nightly_price :
                        relatedRes.custom_nightly_price != null ? relatedRes.custom_nightly_price :
                        (mRate > 0 ? Math.round(mRate / 30) : (t.to_room_price_per_night || 0))
                      );
                      newRateHtml = `
                        <div style="font-weight: 700; color: #1e1b4b;">${mRate.toLocaleString()} ر.س / شهر</div>
                      `;
                    } else {
                      const nRate = Number(
                        t.custom_nightly_price != null ? t.custom_nightly_price :
                        relatedRes.custom_nightly_price != null ? relatedRes.custom_nightly_price :
                        (t.to_room_price_per_night || 0)
                      );
                      const curSubtotal = curNights > 0 ? roundMoney(curNights * nRate) : 0;
                      newRateHtml = `
                        <div style="font-weight: 700; color: #1e1b4b;">${nRate.toLocaleString()} ر.س / ليلة</div>
                        ${curSubtotal > 0 && !isCurContract ? `<small style="color: #64748b;">متبقي: ${curSubtotal.toLocaleString()} ر.س</small>` : ''}
                      `;
                    }

                    return `
                      <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 8px 10px; color: #64748b;">
                          <div style="font-family: monospace;">${escapeHtml(String(t.transfer_timestamp || '').slice(0, 16))}</div>
                          <small style="display: block; margin-top: 3px; color: #1a432a;">تاريخ العمل: ${escapeHtml(t.transfer_business_date || '-')}</small>
                        </td>
                        <td style="padding: 8px 10px;">
                          <div style="font-weight: 700;">#${t.reservation_id} - ${escapeHtml(t.guest_name || 'نزيل')}</div>
                          <small style="color: #64748b;">${escapeHtml(t.booking_type || '')}</small>
                        </td>
                        <td style="padding: 8px 10px; text-align: center; direction: ltr;">
                          <span style="font-weight: 700; color: #dc2626;">${fromRoomInfo}</span> &rarr; <span style="font-weight: 700; color: #047857;">${toRoomInfo}</span>
                        </td>
                        <td style="padding: 8px 10px; text-align: center;">${modeBadge}</td>
                        <td style="padding: 8px 10px; text-align: center; font-weight: 700; color: #334155;">
                          <div>${nightsText}</div>
                          <small style="color: #64748b; font-family: monospace;">(${escapeHtml(t.segment_start_date || '')} &rarr; ${escapeHtml(t.segment_end_date || '')})</small>
                        </td>
                        <td style="padding: 8px 10px; text-align: center; font-weight: 700; color: #1e1b4b;">
                          ${isCurMonthly ? `
                            <div>${Number(t.from_room_monthly_price || 2400).toLocaleString()} ر.س / شهر</div>
                          ` : `
                            <div>${segmentRate.toLocaleString()} ر.س / ليلة</div>
                            <small style="color: #64748b;">إجمالي: ${Number(t.segment_revenue || 0).toLocaleString()} ر.س</small>
                          `}
                        </td>
                        <td style="padding: 8px 10px; text-align: center; font-weight: 700; color: #047857;">
                          <div>${curNightsText}</div>
                          <small style="color: #64748b; font-family: monospace;">${curDatesText}</small>
                        </td>
                        <td style="padding: 8px 10px; text-align: center;">
                          ${newRateHtml}
                        </td>
                        <td style="padding: 8px 10px; font-size: 0.82rem; color: #334155;">
                          <div><span style="font-weight: 700; color: #4338ca;">[${escapeHtml(reasonLabel)}]</span> ${escapeHtml(t.reason_details || '')}</div>
                        </td>
                        <td style="padding: 8px 10px; text-align: center; font-size: 0.82rem; color: #475569;">
                          ${escapeHtml(t.staff_username || '-')}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}

          <h4 style="font-size: 0.95rem; font-weight: 800; color: #5b21b6; margin: 8px 0 10px;">
            ${isMultiDay ? '7. حركات التأمين المسجلة خلال الفترة (لا تدخل ضمن المقبوضات)' : '7. حركات التأمين المسجلة خلال الفترة (لا تدخل ضمن المقبوضات)'}
          </h4>
          ${depositTxs.length === 0 ? `
            <div style="padding: 12px; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; color: #6b7280; font-size: .82rem; margin-bottom: 22px;">لا توجد حركات تأمين مسجلة خلال هذه الفترة.</div>
          ` : `
            <div class="audit-table-wrap">
              <table class="audit-table">
                <thead><tr style="background:#f5f3ff; border-bottom:2px solid #ddd6fe;">
                  <th style="padding:7px; text-align:right;">وقت الحركة / تاريخ العمل</th><th style="padding:7px; text-align:right;">الحجز / النزيل</th><th style="padding:7px; text-align:center;">الحركة</th><th style="padding:7px; text-align:center;">المبلغ</th><th style="padding:7px; text-align:center;">الطريقة</th><th style="padding:7px; text-align:right;">السبب / الموظف</th>
                </tr></thead><tbody>
                  ${depositTxs.map(d => {
                    const labels = { collected: 'استلام', reconciled: 'مطابقة رصيد قديم', refunded: 'رد', applied: 'تسوية على الإقامة', retained: 'احتفاظ' };
                    return `<tr style="border-bottom:1px solid #ede9fe;"><td style="padding:7px; color:#64748b;"><div style="font-family:monospace;">${escapeHtml(String(d.movement_date || d.created_at || '').slice(0, 16))}</div><small style="display:block; margin-top:3px; color:#1a432a;">تاريخ العمل: ${escapeHtml(d.business_date || '-')}</small></td><td style="padding:7px;">#${d.reservation_id} - ${escapeHtml(d.guest_name)} / غرفة ${escapeHtml(d.room_number)}</td><td style="padding:7px; text-align:center;">${labels[d.movement_type] || escapeHtml(d.movement_type)}</td><td style="padding:7px; text-align:center; font-weight:800;">${Number(d.amount || 0).toLocaleString()} ر.س</td><td style="padding:7px; text-align:center;">${escapeHtml(d.payment_method || 'نقداً')}</td><td style="padding:7px;">${escapeHtml(d.reason || '')}${d.staff_username ? ` - ${escapeHtml(d.staff_username)}` : ''}</td></tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}

          <!-- Sign-off & Audit Closure Signatures -->
          <div style="display: flex; justify-content: space-between; padding-top: 20px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 0.85rem; color: #475569;">
            <div style="width: 220px;">
              <div>إعداد موظف الاستقبال / أمين الصندوق</div>
              <div style="margin-top: 36px; border-bottom: 1px solid #94a3b8;"></div>
            </div>
            <div style="width: 220px;">
              <div>المطابقة والمراجعة المحاسبية</div>
              <div style="margin-top: 36px; border-bottom: 1px solid #94a3b8;"></div>
            </div>
            <div style="width: 220px;">
              <div>اعتماد المدير العام</div>
              <div style="margin-top: 36px; border-bottom: 1px solid #94a3b8;"></div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error('Shift audit error:', err);
      showToast(`خطأ في تقرير الإقفال: ${err.message}`, 'error');
    }
  }

  async function openShiftAuditModal(targetDateOrOptions) {
    try {
      await refreshHotelBusinessState();
      ensureShiftAuditFilterBar();

      let startDate = null;
      let endDate = null;

      if (targetDateOrOptions && typeof targetDateOrOptions === 'object') {
        startDate = targetDateOrOptions.startDate || targetDateOrOptions.date;
        endDate = targetDateOrOptions.endDate || startDate;
        currentShiftAuditPreset = targetDateOrOptions.preset || (startDate === endDate ? 'today' : 'custom');
      } else if (typeof targetDateOrOptions === 'string' && targetDateOrOptions.trim() !== '') {
        startDate = targetDateOrOptions.trim();
        endDate = startDate;
        currentShiftAuditPreset = (startDate === (window.DashboardApp.State.businessDate || getLocalDateString())) ? 'today' : 'custom';
      } else {
        currentShiftAuditPreset = 'today';
        const dates = getShiftAuditPresetDates('today');
        startDate = dates.startDate;
        endDate = dates.endDate;
      }

      currentShiftAuditStartDate = startDate;
      currentShiftAuditEndDate = endDate;

      const filterBar = document.getElementById('shift-audit-filter-bar');
      if (filterBar) {
        const presetButtons = filterBar.querySelectorAll('.btn-audit-preset');
        presetButtons.forEach(b => {
          const isActive = b.dataset.preset === currentShiftAuditPreset;
          b.style.background = isActive ? '#1a432a' : 'transparent';
          b.style.color = isActive ? '#a7f3c4' : '#cbd5e1';
          b.style.fontWeight = isActive ? '800' : '600';
        });
        const customDatesBox = filterBar.querySelector('#shift-audit-custom-dates');
        const customStartInput = filterBar.querySelector('#shift-audit-custom-start');
        const customEndInput = filterBar.querySelector('#shift-audit-custom-end');
        if (customDatesBox) {
          customDatesBox.style.display = currentShiftAuditPreset === 'custom' ? 'flex' : 'none';
        }
        if (customStartInput) customStartInput.value = startDate;
        if (customEndInput) customEndInput.value = endDate;
      }

      await renderShiftAuditData(startDate, endDate);

      if (btnRunNightAudit && window.DashboardApp.State.businessDate) {
        btnRunNightAudit.title = `إقفال تاريخ العمل ${window.DashboardApp.State.businessDate} والانتقال إلى اليوم التالي`;
      }

      if (shiftAuditModal) {
        shiftAuditModal.style.display = 'flex';
      }
    } catch (err) {
      console.error('Shift audit error:', err);
      showToast(`خطأ في تقرير الإقفال: ${err.message}`, 'error');
    }
  }

  // =========================================================================
  // Isolated Element Printing Engine (Prevents any UI leakage)
  // =========================================================================
  function printIsolatedElement(contentHtml, documentTitle, isInvoice = true) {
    if (!contentHtml || !contentHtml.trim()) {
      showToast('لا يوجد محتوى متاح للطباعة.', 'error');
      return;
    }

    // Set scoped class on document body
    document.body.classList.remove('printing-invoice', 'printing-shift-audit');
    document.body.classList.add(isInvoice ? 'printing-invoice' : 'printing-shift-audit');

    let printFrame = document.getElementById('app-print-frame');
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'app-print-frame';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      printFrame.style.visibility = 'hidden';
      document.body.appendChild(printFrame);
    }
    // Match the CSS viewport used by A4 portrait printing before print media activates.
    printFrame.style.width = isInvoice ? '794px' : '0';
    printFrame.style.height = isInvoice ? '1123px' : '0';

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>${documentTitle}</title>
        <style>
          ${isInvoice ? '' : '@page { size: A4; margin: 10mm; }'}
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: "Segoe UI", Tahoma, "Cairo", Arial, sans-serif;
            direction: rtl;
            text-align: right;
            background: white !important;
            color: #0f172a !important;
            padding: 0;
            margin: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>
        <div style="padding: ${isInvoice ? '0' : '10px'}; width: 100%;">${contentHtml}</div>
      </body>
      </html>
    `);
    doc.close();
    if (isInvoice && typeof printFrame.contentWindow.prepareReceiptForPrint === 'function') {
      printFrame.contentWindow.prepareReceiptForPrint();
    }

    setTimeout(() => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch (e) {
        console.error('Iframe print error, falling back to window.print():', e);
        if (isInvoice && invoicePrintableArea) {
          fitReceiptToA4Page(invoicePrintableArea.querySelector('.receipt-document'));
        }
        window.print();
      } finally {
        setTimeout(() => {
          document.body.classList.remove('printing-invoice', 'printing-shift-audit');
        }, 1500);
      }
    }, 300);
  }

  // Close & Print Handlers for Invoice Modal
  if (btnCloseInvoiceModal) {
    btnCloseInvoiceModal.addEventListener('click', () => {
      if (invoiceModal) invoiceModal.style.display = 'none';
      document.body.classList.remove('printing-invoice', 'printing-shift-audit');
    });
  }
  if (invoiceModal) {
    invoiceModal.addEventListener('click', (e) => {
      if (e.target === invoiceModal) {
        invoiceModal.style.display = 'none';
        document.body.classList.remove('printing-invoice', 'printing-shift-audit');
      }
    });
  }

  // Close Handlers for Room Revenue Modal
  if (btnCloseRoomRevenueModal) {
    btnCloseRoomRevenueModal.addEventListener('click', () => {
      if (roomRevenueModal) roomRevenueModal.style.display = 'none';
    });
  }
  if (roomRevenueModal) {
    roomRevenueModal.addEventListener('click', (e) => {
      if (e.target === roomRevenueModal) {
        roomRevenueModal.style.display = 'none';
      }
    });
  }
  if (btnTriggerPrintInvoice) {
    btnTriggerPrintInvoice.addEventListener('click', () => {
      printIsolatedElement(invoicePrintableArea ? invoicePrintableArea.innerHTML : '', 'سند استلام', true);
    });
  }
  if (btnExportPdfInvoice) {
    btnExportPdfInvoice.addEventListener('click', async () => {
      try {
        if (!invoicePrintableArea || !invoicePrintableArea.innerHTML.trim()) {
          showToast('لا توجد بيانات سند لتصديره.', 'error');
          return;
        }
        showToast('جاري إنشاء وحفظ ملف السند بصيغة PDF...', 'info');
        const res = await window.api.printToPdf({
          html: invoicePrintableArea.innerHTML,
          title: 'سند استلام',
          defaultFilename: `receipt_${currentInvoiceReservationId || 'reservation'}.pdf`
        });
        if (res && res.canceled) return;
        if (res && res.success) {
          showToast(`تم تصدير وحفظ السند بنجاح في: ${res.filePath}`, 'success');
        } else {
          showToast(res?.error || 'فشل تصدير ملف PDF.', 'error');
        }
      } catch (err) {
        showToast(`خطأ أثناء تصدير PDF: ${err.message}`, 'error');
      }
    });
  }
  if (btnPreviewWindowInvoice) {
    btnPreviewWindowInvoice.addEventListener('click', async () => {
      try {
        if (!invoicePrintableArea || !invoicePrintableArea.innerHTML.trim()) {
          showToast('لا توجد بيانات سند للمعاينة.', 'error');
          return;
        }
        await window.api.openPrintPreviewWindow({
          html: invoicePrintableArea.innerHTML,
          title: 'معاينة سند الاستلام'
        });
      } catch (err) {
        showToast(`تعذر فتح نافذة المعاينة: ${err.message}`, 'error');
      }
    });
  }

  // Edit Receipt / Invoice Handlers
  function updateEditInvoiceRemaining() {
    const total = parseFloat(editInvTotalPrice ? editInvTotalPrice.value : 0) || 0;
    const paid = parseFloat(editInvPaidAmount ? editInvPaidAmount.value : 0) || 0;
    const isOpenContract = currentInvoiceData && currentInvoiceData.booking_type === 'عقد مفتوح';
    const remaining = total - paid;
    if (editInvRemainingPreview) {
      if (remaining < -0.005) {
        editInvRemainingPreview.textContent = `رصيد دائن للنزيل (مستحق له): ${Math.abs(remaining).toFixed(2)} ر.س`;
        editInvRemainingPreview.style.color = '#2563eb';
      } else {
        const displayRemaining = Math.max(0, remaining);
        editInvRemainingPreview.textContent = `${displayRemaining.toFixed(2)} ر.س`;
        editInvRemainingPreview.style.color = displayRemaining > 0 ? '#dc2626' : '#05963d';
      }
    }
  }

  if (editInvTotalPrice) editInvTotalPrice.addEventListener('input', updateEditInvoiceRemaining);
  if (editInvPaidAmount) editInvPaidAmount.addEventListener('input', updateEditInvoiceRemaining);

  if (btnEditInvoice) {
    btnEditInvoice.addEventListener('click', () => {
      if (!currentInvoiceData) {
        showToast('يرجى فتح سند أولاً لتعديله.', 'error');
        return;
      }
      if (editInvResId) editInvResId.value = currentInvoiceData.id;
      if (editInvGuestName) editInvGuestName.value = currentInvoiceData.guest_name || '';
      if (editInvGuestPhone) editInvGuestPhone.value = currentInvoiceData.guest_phone || '';
      if (editInvGuestId) editInvGuestId.value = currentInvoiceData.guest_id_number || '';
      if (editInvTotalPrice) editInvTotalPrice.value = currentInvoiceData.total_price || 0;
      if (editInvPaidAmount) editInvPaidAmount.value = currentInvoiceData.paid_amount || 0;
      if (editInvDepositAmount) editInvDepositAmount.value = currentInvoiceData.deposit_amount || 0;
      if (editInvPaymentMethod) editInvPaymentMethod.value = currentInvoiceData.payment_method || 'نقداً';

      updateEditInvoiceRemaining();
      if (editInvoiceModal) editInvoiceModal.style.display = 'flex';
    });
  }

  function closeEditInvoiceModal() {
    if (editInvoiceModal) editInvoiceModal.style.display = 'none';
  }

  if (btnCloseEditInvoice) btnCloseEditInvoice.addEventListener('click', closeEditInvoiceModal);
  if (btnCancelEditInv) btnCancelEditInv.addEventListener('click', closeEditInvoiceModal);
  if (editInvoiceModal) {
    editInvoiceModal.addEventListener('click', (e) => {
      if (e.target === editInvoiceModal) closeEditInvoiceModal();
    });
  }

  if (editInvoiceForm) {
    editInvoiceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const resId = parseInt(editInvResId.value, 10);
      const guestName = editInvGuestName.value.trim();
      const guestPhone = editInvGuestPhone.value.trim();
      const guestIdNumber = editInvGuestId.value.trim();
      const totalPrice = parseFloat(editInvTotalPrice.value) || 0;
      const paidAmount = parseFloat(editInvPaidAmount.value) || 0;
      const depositAmount = parseFloat(editInvDepositAmount ? editInvDepositAmount.value : 0) || 0;
      const paymentMethod = editInvPaymentMethod.value;
      const isOpenContract = currentInvoiceData && currentInvoiceData.booking_type === 'عقد مفتوح';

      if (!guestName) {
        showToast('يرجى إدخال اسم النزيل.', 'error');
        return;
      }
      if (guestPhone && !/^05\d{8}$/.test(guestPhone)) {
        showToast('رقم الجوال غير صحيح: يجب أن يبدأ بـ 05 ويتكون من 10 أرقام (مثال: 0501234567).', 'error');
        return;
      }
      if (guestIdNumber && !/^(?:\d{10}|[a-zA-Z0-9]{6,9})$/i.test(guestIdNumber)) {
        showToast('رقم الهوية الوطنية أو الإقامة (10 أرقام) أو جواز السفر (6 إلى 9 خانات) غير صحيح.', 'error');
        return;
      }
      if (!isOpenContract && totalPrice <= 0) {
        showToast('السعر الإجمالي يجب أن يكون أكبر من الصفر.', 'error');
        return;
      }
      if (isOpenContract && totalPrice < 0) {
        showToast('السعر الإجمالي لا يمكن أن يكون سالباً.', 'error');
        return;
      }
      if (paidAmount < 0) {
        showToast('المبلغ المدفوع لا يمكن أن يكون سالباً.', 'error');
        return;
      }
      if (!isOpenContract && paidAmount - totalPrice > 0.005) {
        showToast(`المبلغ المدفوع (${paidAmount} ريال) لا يمكن أن يتجاوز السعر الإجمالي (${totalPrice} ريال).`, 'error');
        return;
      }

      try {
        const res = await window.api.updateReservationReceipt({
          reservationId: resId,
          guestName,
          guestPhone,
          guestIdNumber,
          totalPrice,
          paidAmount,
          depositAmount,
          paymentMethod
        });

        if (res && res.success) {
          showToast('تم حفظ وتحديث بيانات السند بنجاح!', 'success');
          closeEditInvoiceModal();
          // Reload updated invoice preview
          await openInvoiceModal(resId);
          // Sync all views
          await Promise.all([
            window.DashboardApp.Helpers.loadOverviewData(),
            window.DashboardApp.Helpers.loadRoomsData(),
            window.DashboardApp.Helpers.loadReservationsData()
          ]);
        } else {
          showToast(res?.error || 'فشل تحديث بيانات السند.', 'error');
        }
      } catch (err) {
        showToast(`خطأ أثناء الحفظ: ${err.message}`, 'error');
      }
    });
  }

  // Shift Audit Handlers
  if (btnOpenShiftAudit) {
    btnOpenShiftAudit.addEventListener('click', () => openShiftAuditModal());
  }
  if (btnRunNightAudit) {
    btnRunNightAudit.addEventListener('click', async () => {
      const state = await refreshHotelBusinessState();
      const activeDate = state?.current_business_date || window.DashboardApp.State.businessDate;
      if (!activeDate) {
        showToast('تعذر قراءة تاريخ العمل الحالي.', 'error');
        return;
      }
      if (currentShiftAuditStartDate !== activeDate || currentShiftAuditEndDate !== activeDate) {
        showToast(`اختر تقرير اليوم المفتوح (${activeDate}) قبل إقفاله.`, 'warning');
        return;
      }

      const confirmed = await showConfirmDialog({
        title: 'إقفال اليوم الفندقي',
        message: `سيتم إقفال تاريخ العمل ${activeDate} وحفظ ملخص المقبوضات والتأمين، ثم فتح تاريخ العمل التالي. هذا الإجراء لا يمكن التراجع عنه من داخل النظام. إذا لم تكن متأكداً، اختر «مراجعة التقرير».`,
        confirmText: 'إقفال اليوم والانتقال',
        cancelText: 'مراجعة التقرير',
        isDanger: true
      });
      if (!confirmed) return;

      btnRunNightAudit.disabled = true;
      try {
        const result = await window.api.runNightAudit(activeDate);
        if (!result || !result.success || !result.data) {
          showToast(result?.error || 'تعذر إقفال اليوم الفندقي.', 'error');
          return;
        }

        await refreshHotelBusinessState();
        btnRunNightAudit.title = `تاريخ العمل المفتوح الآن ${result.data.currentBusinessDate}`;
        showToast(`تم إقفال ${result.data.closedBusinessDate}. تاريخ العمل الجديد: ${result.data.currentBusinessDate}.`, 'success');
        await Promise.all([
          window.DashboardApp.Helpers.loadOverviewData?.(),
          window.DashboardApp.Helpers.loadRoomsData?.(),
          window.DashboardApp.Helpers.loadReservationsData?.()
        ]);
        if (currentUser?.role === 'Admin') await refreshBusinessDayReconciliationNotice();
        currentShiftAuditPreset = 'custom';
        const presetButtons = document.querySelectorAll('#shift-audit-filter-bar .btn-audit-preset');
        presetButtons.forEach(button => {
          const isActive = button.dataset.preset === 'custom';
          button.style.background = isActive ? '#1a432a' : 'transparent';
          button.style.color = isActive ? '#a7f3c4' : '#cbd5e1';
          button.style.fontWeight = isActive ? '800' : '600';
        });
        const customDates = document.getElementById('shift-audit-custom-dates');
        const customStart = document.getElementById('shift-audit-custom-start');
        const customEnd = document.getElementById('shift-audit-custom-end');
        if (customDates) customDates.style.display = 'flex';
        if (customStart) customStart.value = result.data.closedBusinessDate;
        if (customEnd) customEnd.value = result.data.closedBusinessDate;
        currentShiftAuditStartDate = result.data.closedBusinessDate;
        currentShiftAuditEndDate = result.data.closedBusinessDate;
        await renderShiftAuditData(currentShiftAuditStartDate, currentShiftAuditEndDate);
      } catch (err) {
        showToast(`تعذر إقفال اليوم: ${err.message}`, 'error');
      } finally {
        btnRunNightAudit.disabled = false;
      }
    });
  }
  if (btnCloseShiftAudit) {
    btnCloseShiftAudit.addEventListener('click', () => {
      if (shiftAuditModal) shiftAuditModal.style.display = 'none';
      document.body.classList.remove('printing-invoice', 'printing-shift-audit');
    });
  }
  if (shiftAuditModal) {
    shiftAuditModal.addEventListener('click', (e) => {
      if (e.target === shiftAuditModal) {
        shiftAuditModal.style.display = 'none';
        document.body.classList.remove('printing-invoice', 'printing-shift-audit');
      }
    });
  }
  if (btnPrintShiftAudit) {
    btnPrintShiftAudit.addEventListener('click', () => {
      const isMultiDay = currentShiftAuditStartDate && currentShiftAuditEndDate && currentShiftAuditStartDate !== currentShiftAuditEndDate;
      const title = isMultiDay
        ? `تقرير إقفال الفترة (${formatArabicDateRange(currentShiftAuditStartDate, currentShiftAuditEndDate)})`
        : 'تقرير إقفال الوردية والموازنة المالية';
      printIsolatedElement(shiftAuditContent ? shiftAuditContent.innerHTML : '', title, false);
    });
  }
  if (btnExportPdfShiftAudit) {
    btnExportPdfShiftAudit.addEventListener('click', async () => {
      try {
        if (!shiftAuditContent || !shiftAuditContent.innerHTML.trim()) {
          showToast('لا توجد بيانات تقرير لتصديرها.', 'error');
          return;
        }
        showToast('جاري إنشاء وحفظ تقرير الوردية بصيغة PDF...', 'info');
        const isMultiDay = currentShiftAuditStartDate && currentShiftAuditEndDate && currentShiftAuditStartDate !== currentShiftAuditEndDate;
        const title = isMultiDay
          ? `تقرير إقفال الفترة (${formatArabicDateRange(currentShiftAuditStartDate, currentShiftAuditEndDate)})`
          : 'تقرير إقفال الوردية والموازنة المالية';
        const defaultFilename = isMultiDay
          ? `shift_audit_${currentShiftAuditStartDate}_to_${currentShiftAuditEndDate}.pdf`
          : `shift_audit_${getLocalDateString()}.pdf`;

        const res = await window.api.printToPdf({
          html: shiftAuditContent.innerHTML,
          title: title,
          defaultFilename: defaultFilename
        });
        if (res && res.canceled) return;
        if (res && res.success) {
          showToast(`تم تصدير وحفظ تقرير الوردية بنجاح في: ${res.filePath}`, 'success');
        } else {
          showToast(res?.error || 'فشل تصدير ملف PDF.', 'error');
        }
      } catch (err) {
        showToast(`خطأ أثناء تصدير PDF: ${err.message}`, 'error');
      }
    });
  }
  if (btnPreviewWindowShiftAudit) {
    btnPreviewWindowShiftAudit.addEventListener('click', async () => {
      try {
        if (!shiftAuditContent || !shiftAuditContent.innerHTML.trim()) {
          showToast('لا توجد بيانات تقرير للمعاينة.', 'error');
          return;
        }
        const isMultiDay = currentShiftAuditStartDate && currentShiftAuditEndDate && currentShiftAuditStartDate !== currentShiftAuditEndDate;
        const title = isMultiDay
          ? `معاينة تقرير إقفال الفترة (${formatArabicDateRange(currentShiftAuditStartDate, currentShiftAuditEndDate)})`
          : 'معاينة تقرير إقفال الوردية والموازنة المالية';
        await window.api.openPrintPreviewWindow({
          html: shiftAuditContent.innerHTML,
          title: title
        });
      } catch (err) {
        showToast(`تعذر فتح نافذة المعاينة: ${err.message}`, 'error');
      }
    });
  }

  // User Manual Modal Handlers
  function openUserManualModal() {
    if (!userManualModal) return;
    userManualModal.style.display = 'flex';
    if (manualSearchInput) {
      manualSearchInput.value = '';
      filterUserManual('');
      setTimeout(() => manualSearchInput.focus(), 100);
    }
  }

  function closeUserManualModal() {
    if (!userManualModal) return;
    userManualModal.style.display = 'none';
  }

  function filterUserManual(query) {
    if (!manualContentContainer) return;
    const term = String(query || '').trim().toLowerCase();
    const sections = manualContentContainer.querySelectorAll('.manual-section');
    sections.forEach(sec => {
      if (!term) {
        sec.style.display = '';
        return;
      }
      const text = sec.textContent.toLowerCase();
      sec.style.display = text.includes(term) ? '' : 'none';
    });
  }

  if (btnOpenUserManual) {
    btnOpenUserManual.addEventListener('click', openUserManualModal);
  }
  if (navUserManual) {
    navUserManual.addEventListener('click', (e) => {
      e.preventDefault();
      openUserManualModal();
    });
  }
  if (btnCloseUserManual) {
    btnCloseUserManual.addEventListener('click', closeUserManualModal);
  }
  if (btnCloseUserManualFooter) {
    btnCloseUserManualFooter.addEventListener('click', closeUserManualModal);
  }
  if (userManualModal) {
    userManualModal.addEventListener('click', (e) => {
      if (e.target === userManualModal) closeUserManualModal();
    });
  }
  if (btnPrintUserManual) {
    btnPrintUserManual.addEventListener('click', () => {
      window.print();
    });
  }
  if (manualSearchInput) {
    manualSearchInput.addEventListener('input', (e) => {
      filterUserManual(e.target.value);
    });
  }

  // Navigation Pills click to scroll smoothly to section
  document.querySelectorAll('.manual-nav-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const targetId = pill.dataset.target;
      const targetEl = document.getElementById(targetId);
      if (targetEl && manualContentContainer) {
        targetEl.style.display = '';
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        pill.style.background = '#1a432a';
        pill.style.color = '#ffffff';
        pill.style.borderColor = '#1a432a';
        setTimeout(() => {
          pill.style.background = '#ffffff';
          pill.style.color = '#1e293b';
          pill.style.borderColor = '#cbd5e1';
        }, 1200);
      }
    });
  });

  // Global F1 key to open manual and Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault();
      openUserManualModal();
    } else if (e.key === 'Escape' && userManualModal && userManualModal.style.display === 'flex') {
      closeUserManualModal();
    }
  });

  // Backup & Restore Database Handlers (Feature 4)
  if (btnBackupDb) {
    btnBackupDb.addEventListener('click', async () => {
      try {
        const res = await window.api.createBackup();
        if (res && res.canceled) return;
        if (res && res.success) {
          showToast(res.message || 'تم حفظ النسخة الاحتياطية لقاعدة البيانات بنجاح!', 'success');
        } else {
          showToast(res?.error || 'فشل إنشاء النسخة الاحتياطية.', 'error');
        }
      } catch (err) {
        showToast(`خطأ في النسخ الاحتياطي: ${err.message}`, 'error');
      }
    });
  }

  if (btnRestoreDb) {
    btnRestoreDb.addEventListener('click', async () => {
      const confirmed = await showConfirmDialog({
        title: 'استعادة قاعدة البيانات',
        message: 'تنبيه أمان هام جداً:\nاستعادة قاعدة بيانات ستستبدل جميع البيانات الحالية بالنسخة المحددة.\n\nهل أنت متأكد من رغبتك في المتابعة؟',
        confirmText: 'نعم، استعادة البيانات',
        cancelText: 'إلغاء',
        isDanger: true
      });
      if (!confirmed) {
        return;
      }
      try {
        const res = await window.api.restoreBackup();
        if (res && res.canceled) return;
        if (res && res.success) {
          showToast(res.message || 'تمت استعادة قاعدة البيانات بنجاح!', 'success');
          await refreshHotelBusinessState();
          await window.DashboardApp.Helpers.loadOverviewData();
          await window.DashboardApp.Helpers.loadReservationsData();
          await window.DashboardApp.Helpers.loadRoomsData();
          await window.DashboardApp.Helpers.loadGuestsData();
        } else {
          showToast(res?.error || 'فشل استعادة قاعدة البيانات.', 'error');
        }
      } catch (err) {
        showToast(`خطأ في الاستعادة: ${err.message}`, 'error');
      }
    });
  }

  // =========================================================================
  // DAILY AUTOMATED BACKUP (12:00 AM) - HANDLERS & MODAL LOGIC
  // =========================================================================

  function formatArabicDateTime(dateString, includeTime = true) { return window.DashboardApp.Helpers.formatArabicDateTime(dateString, includeTime); }

  async function openDailyBackupModal() {
    if (!dailyBackupModal) return;
    if (!currentUser || currentUser.role !== 'Admin') {
      showToast('غير مصرح: النسخ الاحتياطي مخصص لمدير النظام (Admin).', 'error');
      return;
    }
    try {
      const res = await window.api.getDailyBackupStatus();
      if (!res || !res.success) {
        showToast(res?.error || 'تعذر جلب حالة النسخ الاحتياطي اليومي.', 'error');
        return;
      }
      const data = res.data;

      // Update KPIs
      if (dailyBackupStatusBadge) {
        dailyBackupStatusBadge.textContent = data.enabled ? 'مفعّل ونشط ✅' : 'معطّل ⚠️';
        dailyBackupStatusBadge.style.color = data.enabled ? '#047831' : '#dc2626';
      }

      if (dailyBackupNextRun) {
        if (data.msUntilNext) {
          const hours = Math.floor(data.msUntilNext / (1000 * 60 * 60));
          const mins = Math.floor((data.msUntilNext % (1000 * 60 * 60)) / (1000 * 60));
          dailyBackupNextRun.textContent = `النسخة القادمة: الليلة 12:00 ص (خلال ${hours} س و ${mins} د)`;
        } else {
          dailyBackupNextRun.textContent = 'النسخة القادمة: الليلة 12:00 ص';
        }
      }

      if (dailyBackupLastTime) {
        dailyBackupLastTime.textContent = formatArabicDateTime(data.lastDailyBackupTimestamp);
      }
      if (dailyBackupLastFile) {
        dailyBackupLastFile.textContent = data.lastDailyBackupFile || 'لم يتم التسجيل بعد';
      }
      if (dailyBackupTotalCount) {
        dailyBackupTotalCount.textContent = `${data.totalBackupsCount || 0} نسخة`;
      }
      if (dailyBackupFolderPathDisplay) {
        dailyBackupFolderPathDisplay.textContent = data.backupDir || '';
        dailyBackupFolderPathDisplay.title = data.backupDir || '';
      }

      if (dailyBackupFolderTypeBadge) {
        if (data.isCustomFolder) {
          dailyBackupFolderTypeBadge.textContent = 'مجلد مخصص (Custom)';
          dailyBackupFolderTypeBadge.style.background = '#e0e7ff';
          dailyBackupFolderTypeBadge.style.color = '#3730a3';
        } else {
          dailyBackupFolderTypeBadge.textContent = 'المجلد الافتراضي (Default)';
          dailyBackupFolderTypeBadge.style.background = '#f1f5f9';
          dailyBackupFolderTypeBadge.style.color = '#475569';
        }
      }

      if (btnResetDailyBackupFolder) {
        btnResetDailyBackupFolder.style.display = data.isCustomFolder ? 'inline-flex' : 'none';
      }

      if (dailyBackupTableCountBadge) {
        dailyBackupTableCountBadge.textContent = `${data.totalBackupsCount || 0} ملف`;
      }

      // Populate Table
      if (dailyBackupsTableBody) {
        dailyBackupsTableBody.innerHTML = '';
        const list = data.backupsList || [];

        if (list.length === 0) {
          if (dailyBackupsEmpty) dailyBackupsEmpty.style.display = 'block';
        } else {
          if (dailyBackupsEmpty) dailyBackupsEmpty.style.display = 'none';
          list.forEach((item) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e2e8f0';

            const isDaily = item.isDaily;
            const isLatest = item.isLatest;

            let badgeHtml = '';
            if (isLatest) {
              badgeHtml = `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 0.75rem;">الأحدث (Latest)</span>`;
            } else if (isDaily) {
              badgeHtml = `<span style="background: #dcfce8; color: #15803e; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 0.75rem;">يومي 12:00 ص 🕛</span>`;
            } else {
              badgeHtml = `<span style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem;">نسخة يدوية 📁</span>`;
            }

            tr.innerHTML = `
              <td style="padding: 10px 14px; font-family: monospace; font-weight: 600; color: #1e293b; direction: ltr; text-align: right;">${item.filename}</td>
              <td style="padding: 10px 14px; color: #475569;">${formatArabicDateTime(item.modified)}</td>
              <td style="padding: 10px 14px; color: #475569;">${item.sizeFormatted}</td>
              <td style="padding: 10px 14px;">${badgeHtml}</td>
              <td style="padding: 10px 14px; text-align: center;">
                <button type="button" class="btn btn-sm btn-restore-single-backup" data-path="${item.path.replace(/"/g, '&quot;')}" style="background: #fffbeb; border: 1px solid #fde68a; color: #b45309; font-weight: 700; padding: 4px 10px; font-size: 0.78rem; cursor: pointer;">
                  استعادة هذه النسخة 🔄
                </button>
              </td>
            `;
            dailyBackupsTableBody.appendChild(tr);
          });

          // Attach restore handlers
          const restoreBtns = dailyBackupsTableBody.querySelectorAll('.btn-restore-single-backup');
          restoreBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
              const targetPath = btn.getAttribute('data-path');
              const confirmed = await showConfirmDialog({
                title: 'استعادة النسخة الاحتياطية اليومية',
                message: 'تنبيه أمان هام جداً:\nاستعادة هذه النسخة الاحتياطية سيستبدل بيانات النظام الحالية بالبيانات المحفوظة في هذا الملف.\n\nهل أنت متأكد من رغبتك في استعادة هذه النسخة؟',
                confirmText: 'نعم، استعادة النسخة',
                cancelText: 'إلغاء',
                isDanger: true
              });
              if (!confirmed) {
                return;
              }
              try {
                const restoreRes = await window.api.restoreDailyBackup(targetPath);
                if (restoreRes && restoreRes.success) {
                  showToast('تمت استعادة قاعدة البيانات بنجاح من النسخة المحددة!', 'success');
                  dailyBackupModal.style.display = 'none';
                  await refreshHotelBusinessState();
                  await window.DashboardApp.Helpers.loadOverviewData();
                  await window.DashboardApp.Helpers.loadReservationsData();
                  await window.DashboardApp.Helpers.loadRoomsData();
                  await window.DashboardApp.Helpers.loadGuestsData();
                } else {
                  showToast(restoreRes?.error || 'فشلت عملية استعادة النسخة.', 'error');
                }
              } catch (e) {
                showToast(`خطأ أثناء الاستعادة: ${e.message}`, 'error');
              }
            });
          });
        }
      }

      dailyBackupModal.style.display = 'flex';
    } catch (err) {
      console.error('[Daily Backup Modal Error]:', err);
      showToast(`خطأ في فتح نافذة النسخ الاحتياطي: ${err.message}`, 'error');
    }
  }

  if (btnDailyBackupModal) {
    btnDailyBackupModal.addEventListener('click', () => {
      openDailyBackupModal();
    });
  }

  if (btnCloseDailyBackup) {
    btnCloseDailyBackup.addEventListener('click', () => {
      if (dailyBackupModal) dailyBackupModal.style.display = 'none';
    });
  }

  if (dailyBackupModal) {
    dailyBackupModal.addEventListener('click', (e) => {
      if (e.target === dailyBackupModal) {
        dailyBackupModal.style.display = 'none';
      }
    });
  }

  if (btnOpenDailyBackupsFolder) {
    btnOpenDailyBackupsFolder.addEventListener('click', async () => {
      try {
        const res = await window.api.openBackupsFolder();
        if (!res || !res.success) {
          showToast(res?.error || 'تعذر فتح مجلد النسخ الاحتياطي.', 'error');
        }
      } catch (err) {
        showToast(`تعذر فتح مجلد النسخ: ${err.message}`, 'error');
      }
    });
  }

  if (btnChangeDailyBackupFolder) {
    btnChangeDailyBackupFolder.addEventListener('click', async () => {
      try {
        const originalHtml = btnChangeDailyBackupFolder.innerHTML;
        btnChangeDailyBackupFolder.disabled = true;
        btnChangeDailyBackupFolder.innerHTML = '<span>جاري الاختيار... ⏳</span>';

        const res = await window.api.selectBackupFolder();

        btnChangeDailyBackupFolder.disabled = false;
        btnChangeDailyBackupFolder.innerHTML = originalHtml;

        if (res && res.success) {
          showToast(`تم تغيير مجلد حفظ النسخ التلقائية بنجاح إلى:\n${res.folderPath}`, 'success');
          await openDailyBackupModal();
        } else if (res && res.error) {
          showToast(`تعذر تغيير المجلد: ${res.error}`, 'error');
        }
      } catch (err) {
        if (btnChangeDailyBackupFolder) {
          btnChangeDailyBackupFolder.disabled = false;
        }
        showToast(`خطأ في اختيار المجلد: ${err.message}`, 'error');
      }
    });
  }

  if (btnResetDailyBackupFolder) {
    btnResetDailyBackupFolder.addEventListener('click', async () => {
      const confirmed = await showConfirmDialog({
        title: 'استعادة مجلد الحفظ الافتراضي',
        message: 'هل ترغب في إعادة ضبط مسار حفظ النسخ الاحتياطية التلقائية إلى مجلد التطبيق الافتراضي؟',
        confirmText: 'استعادة الافتراضي',
        cancelText: 'إلغاء',
        isDanger: false
      });
      if (!confirmed) {
        return;
      }
      try {
        const res = await window.api.resetBackupFolder();
        if (res && res.success) {
          showToast('تمت استعادة مجلد الحفظ الافتراضي بنجاح.', 'info');
          await openDailyBackupModal();
        } else {
          showToast(res?.error || 'فشلت استعادة المجلد الافتراضي.', 'error');
        }
      } catch (err) {
        showToast(`خطأ: ${err.message}`, 'error');
      }
    });
  }

  if (btnTriggerDailyBackupNow) {
    btnTriggerDailyBackupNow.addEventListener('click', async () => {
      try {
        btnTriggerDailyBackupNow.disabled = true;
        const originalHtml = btnTriggerDailyBackupNow.innerHTML;
        btnTriggerDailyBackupNow.innerHTML = 'جاري النسخ... ⏳';

        const res = await window.api.runDailyBackupNow();
        if (res && res.success) {
          showToast(`تم أخذ نسخة احتياطية بنجاح! (${res.filename})`, 'success');
          await openDailyBackupModal();
        } else {
          showToast(res?.error || 'فشل إجراء النسخة الاحتياطية.', 'error');
        }
        btnTriggerDailyBackupNow.disabled = false;
        btnTriggerDailyBackupNow.innerHTML = originalHtml;
      } catch (err) {
        btnTriggerDailyBackupNow.disabled = false;
        showToast(`خطأ في النسخ الفوري: ${err.message}`, 'error');
      }
    });
  }

  if (btnRefreshDailyBackups) {
    btnRefreshDailyBackups.addEventListener('click', async () => {
      await openDailyBackupModal();
      showToast('تم تحديث قائمة النسخ الاحتياطية بنجاح.', 'info');
    });
  }

  // Live IPC Listener for 12:00 AM Automated Daily Backup
  if (window.api && window.api.onDailyBackupEvent) {
    window.api.onDailyBackupEvent((eventData) => {
      if (eventData && eventData.success) {
        showToast(`🕛 تم أخذ النسخة الاحتياطية اليومية بنجاح (12:00 AM):\n${eventData.filename}`, 'success');
        if (dailyBackupModal && dailyBackupModal.style.display === 'flex') {
          openDailyBackupModal();
        }
      }
    });
  }

  // =========================================================================
  // WHATSAPP RESERVATION CONFIRMATION (SAUDI ARABIA NUMBERS)
  // =========================================================================
  function formatSaudiWhatsAppNumber(rawPhone) {
    if (!rawPhone) return '';
    // Remove spaces, dashes, parentheses and non-numeric chars
    let cleaned = String(rawPhone).replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    if (cleaned.startsWith('00966')) {
      cleaned = '966' + cleaned.substring(5);
    } else if (cleaned.startsWith('966')) {
      // Already formatted with 966
    } else if (cleaned.startsWith('0')) {
      // e.g., '0501234567' -> '966501234567'
      cleaned = '966' + cleaned.substring(1);
    } else if (cleaned.startsWith('5') && cleaned.length === 9) {
      // e.g., '501234567' -> '966501234567'
      cleaned = '966' + cleaned;
    }
    return cleaned;
  }

  async function sendReservationWhatsApp(reservationId) {
    const targetId = parseInt(reservationId, 10);
    const res = window.DashboardApp.Helpers.findLoadedReservation(targetId);
    if (!res) {
      showToast('لم يتم العثور على بيانات هذا الحجز.', 'error');
      return;
    }

    if (!res.guest_phone || !res.guest_phone.trim()) {
      showToast('لا يوجد رقم هاتف مسجل لهذا النزيل لإرسال رسالة واتساب.', 'error');
      return;
    }

    const cleanPhone = formatSaudiWhatsAppNumber(res.guest_phone);
    if (!cleanPhone || cleanPhone.length < 9) {
      showToast(`رقم الهاتف (${res.guest_phone}) غير صالح للمراسلة عبر واتساب.`, 'error');
      return;
    }

    const activeBrand = (window.DashboardApp && window.DashboardApp.Helpers && window.DashboardApp.Helpers.getActiveBrand) ? window.DashboardApp.Helpers.getActiveBrand() : { nameAr: 'ريحانة للوحدات السكنية' };
    const hotelBrandName = activeBrand.nameAr || 'ريحانة للوحدات السكنية';

    const message = `مرحباً ${res.guest_name || 'عزيزنا النزيل'}،
تم تأكيد حجزك في ${hotelBrandName}.
رقم الغرفة: ${res.room_number || '-'}
تاريخ الوصول: ${res.check_in_date || '-'}
تاريخ المغادرة: ${res.check_out_date || '-'}
نتمنى لك إقامة سعيدة!`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    try {
      showToast(`جاري فتح محادثة واتساب مع النزيل: ${res.guest_name}...`, 'info');
      const response = await window.api.openWhatsApp(whatsappUrl);
      if (response && response.success) {
        showToast('تم فتح محادثة واتساب بنجاح! ✓', 'success');
      } else {
        showToast(response?.error || 'تعذر فتح تطبيق واتساب.', 'error');
      }
    } catch (err) {
      showToast(`خطأ أثناء فتح واتساب: ${err.message}`, 'error');
    }
  }


  // In-App Logout Confirmation System (Zero native modal freezing)
  const logoutModal = document.getElementById('logout-confirm-modal');
  const btnCancelLogout = document.getElementById('btn-cancel-logout');
  const btnConfirmLogout = document.getElementById('btn-confirm-logout');

  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      if (logoutModal) {
        logoutModal.style.display = 'flex';
      } else {
        doLogout();
      }
    });
  }

  if (btnCancelLogout) {
    btnCancelLogout.addEventListener('click', () => {
      if (logoutModal) logoutModal.style.display = 'none';
    });
  }

  if (btnConfirmLogout) {
    btnConfirmLogout.addEventListener('click', async () => {
      if (logoutModal) logoutModal.style.display = 'none';
      await doLogout();
    });
  }

  async function doLogout() {
    const storedLogId = localStorage.getItem('ahmed_hotel_log_id');
    try {
      if (window.api && window.api.logout) {
        await window.api.logout(storedLogId ? parseInt(storedLogId, 10) : null);
      }
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      localStorage.removeItem('ahmed_hotel_log_id');
      localStorage.removeItem('currentUserRole');
      localStorage.removeItem('currentUsername');
      localStorage.removeItem('currentUserId');
      window.location.href = 'login.html';
    }
  }

  // Open DB folder
  btnOpenDb.addEventListener('click', async () => {
    try {
      const res = await window.api.openDbFolder();
      if (!res || !res.success) {
        showToast(res?.error || 'تعذر فتح مجلد قاعدة البيانات.', 'error');
      }
    } catch (err) {
      showToast(`تعذر فتح مجلد قاعدة البيانات: ${err.message}`, 'error');
    }
  });

  function loadLogsData() { return window.DashboardApp.Helpers.loadLogsData(); }

  function applyRbacUi(role) {
    const isAdmin = role === 'Admin';
    if (navAdmin) navAdmin.style.display = isAdmin ? 'flex' : 'none';
    if (navLogs) navLogs.style.display = isAdmin ? 'flex' : 'none';

    // If 'User', completely hide user management sections/buttons
    const adminElements = document.querySelectorAll('.admin-only, [data-role-required="Admin"]');
    adminElements.forEach(el => {
      el.style.display = isAdmin ? '' : 'none';
    });
  }

  // --- INITIALIZE APPLICATION ---
  async function init() {

    try {
      if (window.api && typeof window.api.getBrandingConfig === 'function') {
        const brandRes = await window.api.getBrandingConfig();
        if (brandRes && brandRes.success && brandRes.current) {
          window.DashboardApp.State.branding = brandRes.current;
          window.DashboardApp.State.brands = brandRes.brands;
          window.DashboardApp.State.activeBrandId = brandRes.activeBrandId;
          window.DashboardApp.Helpers.applyBranding(brandRes.current);
        }
      }
      if (window.api && typeof window.api.onBrandChanged === 'function') {
        window.api.onBrandChanged((brandData) => {
          if (brandData && brandData.current) {
            window.DashboardApp.State.branding = brandData.current;
            window.DashboardApp.State.brands = brandData.brands;
            window.DashboardApp.State.activeBrandId = brandData.activeBrandId;
            window.DashboardApp.Helpers.applyBranding(brandData.current);
          }
        });
      }
    } catch (brandErr) {
      console.warn('[Branding] Initial load failed:', brandErr);
    }

    // Phase 5 DOM Bindings
    window.DashboardApp.DOM.roomsList = document.getElementById('rooms-list');
    window.DashboardApp.DOM.btnRefreshRooms = document.getElementById('btn-refresh-rooms');
    window.DashboardApp.DOM.roomsFilterTabs = document.querySelectorAll('#rooms-filter-tabs .filter-tab-btn');
    window.DashboardApp.DOM.roomsPaymentFilterTabs = document.querySelectorAll('#rooms-payment-filter-tabs .filter-tab-btn');
    window.DashboardApp.DOM.roomsPaymentFilterContainer = roomsPaymentFilterContainer;
    window.DashboardApp.DOM.roomsFilterResult = roomsFilterResult;
    window.DashboardApp.DOM.roomsClearFiltersButton = roomsClearFiltersButton;
    window.DashboardApp.DOM.roomsActiveFilterCount = roomsActiveFilterCount;
    window.DashboardApp.DOM.searchRoomsInput = document.getElementById('search-rooms');
    window.DashboardApp.DOM.roomsBookingTypeTabs = document.querySelectorAll('#rooms-booking-type-tabs .filter-tab-btn');
    window.DashboardApp.DOM.roomsGridContainer = document.getElementById('rooms-grid-container');
    window.DashboardApp.DOM.btnToggleAddRoom = document.getElementById('btn-toggle-add-room');
    window.DashboardApp.DOM.addRoomPanel = document.getElementById('add-room-panel');
    window.DashboardApp.DOM.btnCancelAddRoom = document.getElementById('btn-cancel-add-room');
    window.DashboardApp.DOM.addRoomForm = document.getElementById('add-room-form');
    window.DashboardApp.DOM.newRoomNumber = document.getElementById('new-room-number');
    window.DashboardApp.DOM.newRoomType = document.getElementById('new-room-type');
    window.DashboardApp.DOM.newRoomPrice = document.getElementById('new-room-price');
    window.DashboardApp.DOM.newRoomMonthlyPrice = document.getElementById('new-room-monthly-price');
    window.DashboardApp.DOM.newRoomStatus = document.getElementById('new-room-status');
    window.DashboardApp.DOM.editRoomModal = document.getElementById('edit-room-modal');
    window.DashboardApp.DOM.btnCloseEditRoomModal = document.getElementById('btn-close-edit-room');
    window.DashboardApp.DOM.btnCancelEditRoom = document.getElementById('btn-cancel-edit-room');
    window.DashboardApp.DOM.editRoomForm = document.getElementById('edit-room-form');
    window.DashboardApp.DOM.editRoomId = document.getElementById('edit-room-id');
    window.DashboardApp.DOM.editRoomNumber = document.getElementById('edit-room-number');
    window.DashboardApp.DOM.editRoomType = document.getElementById('edit-room-type');
    window.DashboardApp.DOM.editRoomPrice = document.getElementById('edit-room-price');
    window.DashboardApp.DOM.editRoomMonthlyPrice = document.getElementById('edit-room-monthly-price');
    window.DashboardApp.DOM.editRoomStatus = document.getElementById('edit-room-status');
    window.DashboardApp.DOM.editRoomStatusLockedHint = document.getElementById('edit-room-status-locked-hint');
    window.DashboardApp.DOM.btnDeleteRoom = document.getElementById('btn-delete-room');
    window.DashboardApp.DOM.btnSaveEditRoom = document.getElementById('btn-save-edit-room');
    window.DashboardApp.DOM.roomRevenueModal = document.getElementById('room-revenue-modal');
    window.DashboardApp.DOM.btnCloseRoomRevenueModal = document.getElementById('btn-close-room-revenue-modal');
    window.DashboardApp.DOM.roomRevenueContent = document.getElementById('room-revenue-content');
    window.DashboardApp.DOM.roomRevenueModalTitle = document.getElementById('room-revenue-modal-title');


    // Phase 4 DOM Bindings
    window.DashboardApp.DOM.guestsTableBody = guestsTableBody;
    window.DashboardApp.DOM.guestsEmpty = guestsEmpty;
    window.DashboardApp.DOM.searchGuests = searchGuests;
    window.DashboardApp.DOM.guestsBanFilterTabs = guestsBanFilterTabs;
    window.DashboardApp.DOM.guestsCountBadge = guestsCountBadge;
    window.DashboardApp.DOM.btnExportGuestsExcel = btnExportGuestsExcel;
    window.DashboardApp.DOM.inputImportGuestsExcel = inputImportGuestsExcel;
    window.DashboardApp.DOM.btnGuestsPrevPage = btnGuestsPrevPage;
    window.DashboardApp.DOM.btnGuestsNextPage = btnGuestsNextPage;
    window.DashboardApp.DOM.guestsCurrentPageEl = guestsCurrentPageEl;
    window.DashboardApp.DOM.guestsTotalPagesEl = guestsTotalPagesEl;
    window.DashboardApp.DOM.guestsPageRangeEl = guestsPageRangeEl;
    window.DashboardApp.DOM.guestsTotalCountEl = guestsTotalCountEl;
    window.DashboardApp.DOM.editGuestModal = editGuestModal;
    window.DashboardApp.DOM.btnCloseEditGuest = btnCloseEditGuest;
    window.DashboardApp.DOM.btnCancelEditGuest = btnCancelEditGuest;
    window.DashboardApp.DOM.editGuestForm = editGuestForm;
    window.DashboardApp.DOM.editGuestId = editGuestId;
    window.DashboardApp.DOM.editGuestName = editGuestName;
    window.DashboardApp.DOM.editGuestPhone = editGuestPhone;
    window.DashboardApp.DOM.editGuestIdNumber = editGuestIdNumber;
    window.DashboardApp.DOM.btnSaveEditGuest = btnSaveEditGuest;
    window.DashboardApp.DOM.importResultModal = importResultModal;
    window.DashboardApp.DOM.btnCloseImportResultModal = btnCloseImportResultModal;
    window.DashboardApp.DOM.btnConfirmImportResult = btnConfirmImportResult;
    window.DashboardApp.DOM.btnToggleUpdatedGuestsList = btnToggleUpdatedGuestsList;
    window.DashboardApp.DOM.importModalUpdatedContainer = importModalUpdatedContainer;
    window.DashboardApp.DOM.importModalToggleArrow = importModalToggleArrow;


    // Phase 3 DOM Bindings
    window.DashboardApp.DOM.usersTableBody = usersTableBody;
    window.DashboardApp.DOM.addUserForm = addUserForm;
    window.DashboardApp.DOM.newUsernameInput = newUsernameInput;
    window.DashboardApp.DOM.newUserPasswordInput = newUserPasswordInput;
    window.DashboardApp.DOM.newUserRoleSelect = newUserRoleSelect;
    window.DashboardApp.DOM.updatePasswordForm = updatePasswordForm;
    window.DashboardApp.DOM.currentAdminNewPasswordInput = currentAdminNewPasswordInput;
    window.DashboardApp.DOM.btnRefreshUsers = btnRefreshUsers;
    window.DashboardApp.DOM.btnOpenFactoryReset = btnOpenFactoryReset;
    window.DashboardApp.DOM.factoryResetModal = factoryResetModal;
    window.DashboardApp.DOM.btnCloseFactoryReset = btnCloseFactoryReset;
    window.DashboardApp.DOM.btnCancelFactoryReset = btnCancelFactoryReset;
    window.DashboardApp.DOM.factoryResetForm = factoryResetForm;
    window.DashboardApp.DOM.factoryResetPasswordInput = factoryResetPasswordInput;
    window.DashboardApp.DOM.factoryResetErrorMsg = factoryResetErrorMsg;
    window.DashboardApp.DOM.btnSubmitFactoryReset = btnSubmitFactoryReset;


    // Phase 2 DOM Bindings
    window.DashboardApp.DOM.searchLogs = searchLogs;
    window.DashboardApp.DOM.logsCountBadge = logsCountBadge;
    window.DashboardApp.DOM.logsTableBody = logsTableBody;
    window.DashboardApp.DOM.logsEmpty = logsEmpty;
    window.DashboardApp.DOM.btnRefreshLogs = btnRefreshLogs;



    // Phase 1 DOM Bindings
    window.DashboardApp.DOM.statAvailableRooms = statAvailableRooms;
    window.DashboardApp.DOM.statOccupiedRooms = statOccupiedRooms;
    window.DashboardApp.DOM.statCleaningRooms = statCleaningRooms;
    window.DashboardApp.DOM.statTotalReservations = statTotalReservations;
    window.DashboardApp.DOM.roomSelect = roomSelect;
    window.DashboardApp.DOM.overviewTableBody = overviewTableBody;
    window.DashboardApp.DOM.overviewEmpty = overviewEmpty;
    window.DashboardApp.DOM.overviewRecentTabCount = overviewRecentTabCount;
    window.DashboardApp.DOM.todayDateBadge = todayDateBadge;
    window.DashboardApp.DOM.todayCheckoutsTableBody = todayCheckoutsTableBody;
    window.DashboardApp.DOM.todayCheckoutsCountBadge = todayCheckoutsCountBadge;
    window.DashboardApp.DOM.todayCheckoutsSearch = todayCheckoutsSearch;
    window.DashboardApp.DOM.todayCheckoutsEmpty = todayCheckoutsEmpty;
    window.DashboardApp.DOM.btnRefreshCheckouts = btnRefreshCheckouts;
    window.DashboardApp.DOM.todayCheckoutsFilters = todayCheckoutsFilters;

    if (window.DashboardApp.Helpers.initRooms) window.DashboardApp.Helpers.initRooms();
    if (window.DashboardApp.Helpers.initGuests) window.DashboardApp.Helpers.initGuests();
    if (window.DashboardApp.Helpers.initAdmin) window.DashboardApp.Helpers.initAdmin();
    if (window.DashboardApp.Helpers.initOverview) window.DashboardApp.Helpers.initOverview();
    if (window.DashboardApp.Helpers.initLogs) window.DashboardApp.Helpers.initLogs();

    // [Spike] Test State write
    window.DashboardApp.State.testVar = 42;
    console.assert(window.DashboardApp.State.testVar === 42, "Spike testVar failed");
    window.DashboardApp.Helpers.showConfirmDialog = showConfirmDialog;

    // Bind State
    window.DashboardApp.Helpers.showPromptDialog = showPromptDialog;
    window.DashboardApp.Helpers.sendReservationWhatsApp = sendReservationWhatsApp;
    window.DashboardApp.Helpers.openInvoiceModal = openInvoiceModal;
    window.DashboardApp.State.currentUser = currentUser;
    // 1. Immediate UI state from localStorage cache
    const cachedRole = localStorage.getItem('currentUserRole');
    if (cachedRole) {
      applyRbacUi(cachedRole);
      userDisplayRole.textContent = cachedRole === 'Admin' ? 'مدير نظام (Admin)' : 'مستخدم (User)';
    }

    try {
      const info = await window.api.getAppInfo();
      if (info && info.user) {
        currentUser = info.user;
        window.DashboardApp.State.currentUser = info.user;
        userDisplayName.textContent = currentUser.username;
        userDisplayRole.textContent = currentUser.role === 'Admin' ? 'مدير نظام (Admin)' : 'مستخدم (User)';
        localStorage.setItem('currentUserRole', currentUser.role);
        localStorage.setItem('currentUsername', currentUser.username);
        localStorage.setItem('currentUserId', String(currentUser.id));

        applyRbacUi(currentUser.role);

        if (info.logId) {
          localStorage.setItem('ahmed_hotel_log_id', String(info.logId));
        }
      } else {
        currentUser = null;
        window.DashboardApp.State.currentUser = null;
        applyRbacUi(null);
      }
      if (info && info.dbPath) {
        const name = info.dbPath.split(/[/\\]/).pop();
        dbFileName.textContent = `SQLite: ${name}`;
        dbFileName.title = info.dbPath;
      }

      // Initialize Daily Backup Tooltip
      try {
        const backupStatus = await window.api.getDailyBackupStatus();
        if (backupStatus && backupStatus.success && backupStatus.data && btnDailyBackupModal) {
          const d = backupStatus.data;
          btnDailyBackupModal.title = `النسخ الاحتياطي التلقائي: يومياً الساعة 12:00 منتصف الليل\nآخر نسخة: ${d.lastDailyBackupFile || 'اليوم'}`;
        }
      } catch (be) {}
    } catch (err) {
      currentUser = null;
        window.DashboardApp.State.currentUser = null;
      applyRbacUi(null);
      console.warn('App info error:', err);
    }

    if (currentUser) {
      try { await refreshHotelBusinessState(); }
      catch (businessDateErr) { console.warn('Hotel business date unavailable:', businessDateErr); }
      if (currentUser.role === 'Admin') await refreshBusinessDayReconciliationNotice();
    }

    // Default view: overview
    window.switchView('overview');
  }

  // Escape HTML helper
  function escapeHtml(str) { return window.DashboardApp.Helpers.escapeHtml(str); }

  async function refreshBusinessDayReconciliationNotice() {
    const notice = document.getElementById('business-day-shift-notice');
    const text = document.getElementById('business-day-shift-notice-text');
    if (!notice || !text || currentUser?.role !== 'Admin') return;
    try {
      const response = await window.api.getPendingShiftReconciliationAudits();
      const pending = response?.success && Array.isArray(response.data) ? response.data : [];
      notice.hidden = pending.length === 0;
      text.textContent = pending.length
        ? `هناك ${pending.length} إقفال تلقائي بانتظار مطابقة الوردية (${pending[0].closed_business_date}).`
        : '';
    } catch (error) {
      console.warn('Business day reconciliation notice unavailable:', error);
    }
  }

  const openReconciliationButton = document.getElementById('btn-open-business-day-reconciliation');
  if (openReconciliationButton) {
    openReconciliationButton.addEventListener('click', () => window.switchView('admin'));
  }

  if (window.api?.onHotelBusinessDateChanged) {
    window.api.onHotelBusinessDateChanged(async event => {
      if (!currentUser || !event?.businessDate || event.businessDate === window.DashboardApp.State.businessDate) return;
      
      // Show prominent notification with sound
      showToast(`🌅 بدأ يوم فندقي جديد: ${event.businessDate}`, 'success');
      
      // Refresh all data
      await refreshHotelBusinessState();
      updateSystemClock();
      const helpers = window.DashboardApp.Helpers;
      await Promise.all([
        helpers.loadOverviewData?.(),
        helpers.loadRoomsData?.(),
        helpers.loadReservationsData?.()
      ]);
      
      if (currentUser.role === 'Admin') await refreshBusinessDayReconciliationNotice();
      
      // Optional: Play a subtle notification sound if browser supports it
      try {
        const AudioCtor = (typeof window !== 'undefined' && window.Audio) || (typeof globalThis !== 'undefined' && globalThis.Audio);
        if (AudioCtor) {
          const audio = new AudioCtor('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUKrk8LNhHAU7k9n0yXYpBSh+zPLaizsKGGS66OugVBELTKXh8bllHgU1iM/z1oU3BxlqvO/knE0MD1Gn4/KyYhwGOpPY88p5KwUofszx3I4+CRdlu+rqnlIRC0yn4fG5Zh4FNIjP89aFNwcZarz05JxNDA9Rp+Lxs2IcBjqT2fPKeSsFKH7M8NyOPgkXZbzq6p5SE');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        }
      } catch {}
    });
  }
  window.refreshBusinessDayReconciliationNotice = refreshBusinessDayReconciliationNotice;

  window.openInvoiceModal = openInvoiceModal;
  window.openRoomRevenueModal = window.DashboardApp.Helpers.openRoomRevenueModal;
  window.openEditGuestModal = window.DashboardApp.Helpers.openEditGuestModal;
  window.openShiftAuditModal = openShiftAuditModal;
  window.openDailyBackupModal = openDailyBackupModal;
  window.showConfirmDialog = showConfirmDialog;
  window.showPromptDialog = showPromptDialog;
  window.sendReservationWhatsApp = sendReservationWhatsApp;
  window.openUserManualModal = openUserManualModal;
  window.DashboardApp.Helpers.refreshHotelBusinessState = refreshHotelBusinessState;
  updateSystemClock();
  window.setInterval(updateSystemClock, 1000);
  
  // Periodically check if business day rollover is needed (every 2 minutes)
  // This ensures the day changes even if the backend scheduler is delayed
  window.setInterval(async () => {
    if (window.api?.checkBusinessDayRollover && typeof window.api.checkBusinessDayRollover === 'function') {
      try {
        await window.api.checkBusinessDayRollover();
      } catch (error) {
        console.warn('فشل التحقق من الإقفال التلقائي:', error);
      }
    }
  }, 120_000); // Check every 2 minutes
  
  // Check business day when window regains focus (handles sleep/wake scenarios)
  window.addEventListener('focus', async () => {
    if (window.api?.checkBusinessDayRollover && typeof window.api.checkBusinessDayRollover === 'function') {
      try {
        await window.api.checkBusinessDayRollover();
      } catch (error) {
        console.warn('فشل التحقق من الإقفال التلقائي عند استعادة النشاط:', error);
      }
    }
  });

  init();

})();
