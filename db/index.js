/**
 * نظام أحمد لإدارة الفنادق (Ahmed Hotel ERP)
 * Database Subsystem Unified Facade
 * Aggregates and re-exports all domain modules preserving exact backward compatibility.
 */

const connection = require('./connection');
const users = require('./users');
const guests = require('./guests');
const rooms = require('./rooms');
const reservations = require('./reservations');
const reports = require('./reports');
const businessDay = require('./business-day');

module.exports = {
  // connection & lifecycle
  init: connection.init,
  factoryReset: connection.factoryReset,
  getLocalDateString: connection.getLocalDateString,
  getHotelBusinessDate: connection.getHotelBusinessDate,
  getCurrentBusinessDate: connection.getCurrentBusinessDate,
  getCurrentBusinessState: connection.getCurrentBusinessState,
  getHotelTimezone: connection.getHotelTimezone,
  formatHotelDateTime: connection.formatHotelDateTime,
  getBusinessDaySettings: connection.getBusinessDaySettings,
  updateBusinessDaySettings: connection.updateBusinessDaySettings,
  getReceiptStayPolicies: connection.getReceiptStayPolicies,
  updateReceiptStayPolicies: connection.updateReceiptStayPolicies,
  getPendingShiftReconciliationAudits: connection.getPendingShiftReconciliationAudits,
  markShiftAuditReconciled: connection.markShiftAuditReconciled,
  runNightAudit: businessDay.runNightAudit,
  getDatabaseFilePath: connection.getDatabaseFilePath,
  createBackupCopy: connection.createBackupCopy,
  restoreDatabaseFile: connection.restoreDatabaseFile,
  roundMoney: connection.roundMoney,
  close: connection.close,

  // users & logs
  verifyUser: users.verifyUser,
  getAllUsers: users.getAllUsers,
  addUser: users.addUser,
  updateUserPassword: users.updateUserPassword,
  deleteUser: users.deleteUser,
  logEmployeeLogin: users.logEmployeeLogin,
  logEmployeeLogout: users.logEmployeeLogout,
  getEmployeeLogs: users.getEmployeeLogs,

  // guests
  getAllGuests: guests.getAllGuests,
  getGuestsPaginated: guests.getGuestsPaginated,
  getGuestReservationHistory: guests.getGuestReservationHistory,
  addCustomer: guests.addCustomer,
  addGuest: guests.addGuest,
  updateGuest: guests.updateGuest,
  searchGuest: guests.searchGuest,
  findGuestByPhoneOrId: guests.findGuestByPhoneOrId,
  setGuestBanStatus: guests.setGuestBanStatus,
  bulkImportGuests: guests.bulkImportGuests,

  // rooms
  getAllRooms: rooms.getAllRooms,
  getAvailableRooms: rooms.getAvailableRooms,
  updateRoomStatus: rooms.updateRoomStatus,
  addRoom: rooms.addRoom,
  updateRoom: rooms.updateRoom,
  deleteRoom: rooms.deleteRoom,
  autoUpdateRoomStatuses: rooms.autoUpdateRoomStatuses,
  getRoomRevenueStats: rooms.getRoomRevenueStats,

  // reservations & payments
  getAllReservations: reservations.getAllReservations,
  getReservationsPage: reservations.getReservationsPage,
  getReservationById: reservations.getReservationById,
  createReservation: reservations.createReservation,
  updateReservationReceipt: reservations.updateReservationReceipt,
  computeCheckoutSettlement: reservations.computeCheckoutSettlement,
  isMonthlyEarlyCheckout: reservations.isMonthlyEarlyCheckout,
  computeContractValue: reservations.computeContractValue,
  countNights: reservations.countNights,
  checkoutReservation: reservations.checkoutReservation,
  extendReservation: reservations.extendReservation,
  cancelReservation: reservations.cancelReservation,
  addPaymentToReservation: reservations.addPaymentToReservation,
  getReservationPayments: reservations.getReservationPayments,
  getMonthlyBillingPeriods: reservations.getMonthlyBillingPeriods,
  getReservationDepositMovements: reservations.getReservationDepositMovements,
  reconcileLegacyDeposit: reservations.reconcileLegacyDeposit,
  getPaymentReceipt: reservations.getPaymentReceipt,
  generateReceiptNumber: reservations.generateReceiptNumber,
  bulkImportReservations: reservations.bulkImportReservations,
  getTransferEligibleRooms: reservations.getTransferEligibleRooms,
  previewRoomTransfer: reservations.previewRoomTransfer,
  executeRoomTransfer: reservations.executeRoomTransfer,
  validateTransferEligibility: reservations.validateTransferEligibility,
  computeStaySegments: reservations.computeStaySegments,
  getReservationCompanions: reservations.getReservationCompanions,
  addReservationCompanion: reservations.addReservationCompanion,
  updateReservationCompanion: reservations.updateReservationCompanion,
  deleteReservationCompanion: reservations.deleteReservationCompanion,

  // reports
  getTodayCheckouts: reports.getTodayCheckouts,
  getMonthlyRevenue: reports.getMonthlyRevenue,
  getDashboardStats: reports.getDashboardStats,
  getCurrentShiftRevenueSummary: reports.getCurrentShiftRevenueSummary,
  getShiftAuditReport: reports.getShiftAuditReport
};
