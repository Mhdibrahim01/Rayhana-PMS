const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload Script - نظام أحمد لإدارة الفنادق
 * Secure Context Bridge exposing strictly controlled IPC channels.
 */
contextBridge.exposeInMainWorld('api', {
  // Authentication & Session
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  logout: (logId) => ipcRenderer.invoke('auth:logout', logId),
  getCurrentUser: () => ipcRenderer.invoke('auth:get-current-user'),

  // Role-Based Access Control (RBAC) & User Management
  getAllUsers: () => ipcRenderer.invoke('users:get-all'),
  addUser: (userData, requesterRole) => ipcRenderer.invoke('add-user', { userData, requesterRole }),
  updateUserPassword: (data) => ipcRenderer.invoke('users:update-password', data),
  deleteUser: (userId, requesterRole) => ipcRenderer.invoke('delete-user', { userId, requesterRole }),
  getEmployeeLogs: () => ipcRenderer.invoke('logs:get-all'),

  // Analytics & Statistics
  getDashboardStats: () => ipcRenderer.invoke('dashboard:get-stats'),
  getCurrentShiftRevenueSummary: () => ipcRenderer.invoke('reports:get-current-shift-summary'),
  getMonthlyRevenue: () => ipcRenderer.invoke('analytics:get-monthly-revenue'),
  getHotelBusinessState: () => ipcRenderer.invoke('hotel-business-day:get-state'),
  checkBusinessDayRollover: () => ipcRenderer.invoke('hotel-business-day:check-rollover'),
  runNightAudit: (expectedBusinessDate) => ipcRenderer.invoke('hotel-business-day:run-audit', expectedBusinessDate),
  getBusinessDaySettings: () => ipcRenderer.invoke('hotel-business-day:get-settings'),
  updateBusinessDaySettings: (settings) => ipcRenderer.invoke('hotel-business-day:update-settings', settings),
  getReceiptStayPolicies: () => ipcRenderer.invoke('receipt-stay-policies:get'),
  updateReceiptStayPolicies: (policies) => ipcRenderer.invoke('receipt-stay-policies:update', policies),
  getPendingShiftReconciliationAudits: () => ipcRenderer.invoke('hotel-business-day:get-pending-reconciliation'),
  reconcileShiftAudit: (auditId) => ipcRenderer.invoke('hotel-business-day:reconcile-shift-audit', auditId),
  onHotelBusinessDateChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('hotel-business-day:changed', handler);
    return () => ipcRenderer.removeListener('hotel-business-day:changed', handler);
  },

  // Rooms
  getAllRooms: () => ipcRenderer.invoke('rooms:get-all'),
  getAvailableRooms: () => ipcRenderer.invoke('rooms:get-available'),
  updateRoomStatus: (roomId, status) => ipcRenderer.invoke('rooms:update-status', { roomId, status }),
  addRoom: (roomData) => ipcRenderer.invoke('rooms:add', roomData),
  updateRoom: (roomData) => ipcRenderer.invoke('rooms:update', roomData),
  deleteRoom: (roomId) => ipcRenderer.invoke('rooms:delete', roomId),
  getRoomRevenue: (roomId) => ipcRenderer.invoke('rooms:get-revenue', roomId),

  // Reservations & Payments Ledger
  getAllReservations: () => ipcRenderer.invoke('reservations:get-all'),
  getReservationsPage: (params) => ipcRenderer.invoke('reservations:get-page', params),
  getTodayCheckouts: (date) => ipcRenderer.invoke('reservations:get-today-checkouts', date),
  createReservation: (reservationData) => ipcRenderer.invoke('reservations:create', reservationData),
  // options is a single object and may carry `checkoutPolicy` ('contract' | 'actual')
  // plus `checkoutPolicyReason`. Both are stripped by the main process for non-Admin
  // sessions, so the renderer cannot grant itself the 'actual' exception.
  checkoutReservation: (reservationId, options) => ipcRenderer.invoke('reservations:checkout', reservationId, options),
  checkoutPreview: (reservationId, options) => ipcRenderer.invoke('reservations:checkout-preview', reservationId, options),
  extendReservation: (data) => ipcRenderer.invoke('reservations:extend', data),
  cancelReservation: (reservationId) => ipcRenderer.invoke('reservations:cancel', reservationId),
  addPayment: (paymentData) => ipcRenderer.invoke('add-payment', paymentData),
  getReservationPayments: (reservationId) => ipcRenderer.invoke('payments:get-by-reservation', reservationId),
  getReservationDepositMovements: (reservationId) => ipcRenderer.invoke('deposits:get-by-reservation', reservationId),
  reconcileLegacyDeposit: (data) => ipcRenderer.invoke('deposits:reconcile-legacy', data),
  getPaymentReceipt: (receiptIdentifier) => ipcRenderer.invoke('payments:get-receipt', receiptIdentifier),
  getTransferEligibleRooms: (reservationId) => ipcRenderer.invoke('reservations:get-transfer-eligible-rooms', reservationId),
  previewRoomTransfer: (data) => ipcRenderer.invoke('reservations:transfer-preview', data),
  transferRoom: (data) => ipcRenderer.invoke('reservations:transfer-room', data),
  getReservationCompanions: (reservationId) => ipcRenderer.invoke('reservations:get-companions', reservationId),
  addReservationCompanion: (reservationId, companion) => ipcRenderer.invoke('reservations:add-companion', { reservationId, companion }),
  updateReservationCompanion: (companionId, companion) => ipcRenderer.invoke('reservations:update-companion', { companionId, companion }),
  deleteReservationCompanion: (companionId) => ipcRenderer.invoke('reservations:delete-companion', companionId),
  autoUpdateRoomStatuses: () => ipcRenderer.invoke('rooms:auto-update-status'),

  // Guests & Customers
  getAllGuests: (params) => ipcRenderer.invoke('guests:get-all', params),
  getGuestsPaginated: (params) => ipcRenderer.invoke('guests:get-paginated', params),
  getGuestReservationHistory: (guestId) => ipcRenderer.invoke('guests:get-reservation-history', guestId),
  addCustomer: (customerData, requesterRole) => ipcRenderer.invoke('add-customer', { customerData, requesterRole }),
  searchGuest: (query) => ipcRenderer.invoke('guests:search', query),
  setGuestBanStatus: (data) => ipcRenderer.invoke('guests:set-ban-status', data),
  updateGuest: (guestData) => ipcRenderer.invoke('guests:update', guestData),

  // Excel & CSV Bulk Import
  importGuests: (guestsData) => ipcRenderer.invoke('import-guests', guestsData),
  bulkImportGuests: (guestsList) => ipcRenderer.invoke('import-guests', guestsList),
  bulkImportReservations: (reservationsList) => ipcRenderer.invoke('excel:import-reservations', reservationsList),

  // System & Database Info, Backups & Reports
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  openDbFolder: () => ipcRenderer.invoke('app:open-db-folder'),
  factoryResetDatabase: (password) => ipcRenderer.invoke('app:factory-reset', { password }),
  createBackup: () => ipcRenderer.invoke('db:create-backup'),
  restoreBackup: () => ipcRenderer.invoke('db:restore-backup'),
  getDailyBackupStatus: () => ipcRenderer.invoke('backups:get-status'),
  runDailyBackupNow: () => ipcRenderer.invoke('backups:run-now'),
  openBackupsFolder: () => ipcRenderer.invoke('backups:open-folder'),
  selectBackupFolder: () => ipcRenderer.invoke('backups:select-folder'),
  resetBackupFolder: () => ipcRenderer.invoke('backups:reset-folder'),
  restoreDailyBackup: (filePath) => ipcRenderer.invoke('backups:restore-file', filePath),
  onDailyBackupEvent: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('backup:daily-event', handler);
    return () => ipcRenderer.removeListener('backup:daily-event', handler);
  },
  getShiftAuditReport: (date) => ipcRenderer.invoke('reports:get-shift-audit', date),
  getInvoiceData: (reservationId) => ipcRenderer.invoke('reservations:get-invoice-data', reservationId),
  updateReservationReceipt: (data) => ipcRenderer.invoke('reservations:update-receipt', data),
  printToPdf: (options) => ipcRenderer.invoke('print:to-pdf', options),
  openPrintPreviewWindow: (options) => ipcRenderer.invoke('print:open-preview-window', options),
  openWhatsApp: (url) => ipcRenderer.invoke('open-whatsapp', url),

  // App Lock (Master Passcode Gate)
  checkAppLockStatus: () => ipcRenderer.invoke('app-lock:status'),
  setupAppLock: (password) => ipcRenderer.invoke('app-lock:setup', password),
  unlockApp: (password) => ipcRenderer.invoke('app-lock:verify', password),
  resetAppLockWithDefault: (data) => ipcRenderer.invoke('app-lock:reset-with-default', data),
  exitApp: () => ipcRenderer.invoke('app-lock:exit'),

  // Multi-Brand & White-Label Customization
  getBrandingConfig: () => ipcRenderer.invoke('brand:get-config'),
  setActiveBrand: (brandId) => ipcRenderer.invoke('brand:set-active', brandId),
  updateBrandProfile: (data) => ipcRenderer.invoke('brand:update-profile', data),
  onBrandChanged: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('brand:changed', handler);
    return () => ipcRenderer.removeListener('brand:changed', handler);
  }
});
