/**
 * Rayhana ERP - Reports, Analytics & Shift Audit IPC Handlers
 * Domain: ipc/reports.js
 */

module.exports = function registerReportsIpc(ipcMain, { db, session, helpers }) {
  function requireSession() {
    if (!session.currentUser) {
      return { success: false, error: 'غير مصرح: يرجى تسجيل الدخول أولاً.' };
    }
    return null;
  }

  // 3. Analytics & Statistics
  ipcMain.handle('dashboard:get-stats', async () => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      const stats = db.getDashboardStats();
      return { success: true, data: stats };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Logged-in staff can see the current shift totals on the overview. Return only
  // aggregate amounts here; guest and transaction details remain Admin-only.
  ipcMain.handle('reports:get-current-shift-summary', async () => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      return { success: true, data: db.getCurrentShiftRevenueSummary() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('analytics:get-monthly-revenue', async () => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      const monthlyData = db.getMonthlyRevenue();
      return { success: true, data: monthlyData };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('hotel-business-day:get-state', async () => {
    if (!session.currentUser) {
      return { success: false, error: 'غير مصرح: يرجى تسجيل الدخول أولاً.' };
    }
    try {
      return { success: true, data: db.getCurrentBusinessState() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('hotel-business-day:get-settings', async () => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: إعدادات اليوم الفندقي مخصصة لمدير النظام.' };
    }
    try { return { success: true, data: db.getBusinessDaySettings() }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('hotel-business-day:update-settings', async (_event, settings) => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: تعديل إعدادات اليوم الفندقي مخصص لمدير النظام.' };
    }
    try { return { success: true, data: db.updateBusinessDaySettings(settings) }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('receipt-stay-policies:get', async () => {
    if (!session.currentUser) return { success: false, error: 'غير مصرح: يرجى تسجيل الدخول أولاً.' };
    try { return { success: true, data: db.getReceiptStayPolicies() }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('receipt-stay-policies:update', async (_event, policies) => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: تعديل سياسات الإقامة مخصص لمدير النظام.' };
    }
    try { return { success: true, data: db.updateReceiptStayPolicies(policies) }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('hotel-business-day:get-pending-reconciliation', async () => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح.' };
    }
    try { return { success: true, data: db.getPendingShiftReconciliationAudits() }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('hotel-business-day:reconcile-shift-audit', async (_event, auditId) => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: تأكيد المصالحة مخصص لمدير النظام.' };
    }
    try { return { success: true, data: db.markShiftAuditReconciled(auditId, session.currentUser.id) }; }
    catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('hotel-business-day:check-rollover', async () => {
    if (!session.currentUser) return { success: false, error: 'غير مصرح: يرجى تسجيل الدخول أولاً.' };
    try {
      if (typeof helpers.checkBusinessDayRollover === 'function') {
        const result = await helpers.checkBusinessDayRollover();
        return { success: true, data: result };
      }
      return { success: true, data: { advancedDays: 0 } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('hotel-business-day:run-audit', async (event, expectedBusinessDate) => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: إقفال اليوم الفندقي مخصص لمدير النظام (Admin).' };
    }
    try {
      const result = db.runNightAudit(session.currentUser.id, expectedBusinessDate);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 10. Shift Audit & Night Closing Report
  ipcMain.handle('reports:get-shift-audit', async (event, customDate, endDate) => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'غير مصرح: تقرير الوردية يتطلب صلاحيات مدير النظام (Admin).' };
    }
    try {
      let start = customDate;
      let end = endDate;

      if (customDate && typeof customDate === 'object') {
        start = customDate.startDate || customDate.date || customDate.customDate;
        end = customDate.endDate;
      }

      const date = start || (db.getCurrentBusinessDate ? db.getCurrentBusinessDate() : helpers.getLocalDateString());
      // Guard against unbounded date ranges that could exhaust memory.
      const maxRangeDays = 365;
      const rangeMs = new Date(end || date).getTime() - new Date(date).getTime();
      if (rangeMs > maxRangeDays * 86400000) {
        return { success: false, error: `لا يمكن طلب تقرير لأكثر من ${maxRangeDays} يوم.` };
      }
      const report = db.getShiftAuditReport(date, end);
      return { success: true, data: report, currentUser: session.currentUser };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
};
