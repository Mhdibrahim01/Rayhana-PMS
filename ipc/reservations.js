/**
 * Rayhana ERP - Reservations, Check-outs, Payments & Invoices IPC Handlers
 * Domain: ipc/reservations.js
 */

module.exports = function registerReservationsIpc(ipcMain, { db, session, helpers }) {
  // Every handler in this file requires a signed-in session. Previously only
  // reservations:extend checked this, so an unauthenticated caller could list every
  // reservation, read the invoice and settlement figures, read the payment and deposit
  // ledgers, and - worst - settle a booking through reservations:checkout, which
  // rewrites total_price and paid_amount. There is no global wrapper in this codebase,
  // so each handler opts in; the comment in tests/ipc-policy-coverage.test.js tracks
  // that expectation.
  function requireSession() {
    return session.currentUser
      ? null
      : { success: false, error: 'غير مصرح: يرجى تسجيل الدخول أولاً.' };
  }

  async function ensureOpenBusinessDateIsCurrent() {
    if (typeof helpers.checkBusinessDayRollover === 'function') await helpers.checkBusinessDayRollover();
  }

  // 5. Reservations
  ipcMain.handle('reservations:get-all', async () => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      const list = db.getAllReservations();
      return { success: true, data: list };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('reservations:get-page', async (event, params = {}) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      const result = db.getReservationsPage(params);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // =========================================================================
  // Strict Backend Data Validations
  // =========================================================================
  function validateReservationData(data, getLocalDateString, currentBusinessDate) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'بيانات الحجز غير صالحة.' };
    }

    const bookingType = (data.bookingType || data.booking_type || 'عادي').trim();
    const guestName = (data.guestName || data.name || '').trim();
    const guestPhone = (data.guestPhone || data.phone || '').trim();
    const guestIdNumber = (data.guestIdNumber || data.id_number || '').trim();
    const roomId = data.roomId || data.room_id;
    const checkInDate = (data.checkInDate || data.check_in_date || '').trim();
    const checkOutDate = (data.checkOutDate || data.check_out_date || '').trim();
    const totalPrice = parseFloat(data.totalPrice !== undefined ? data.totalPrice : data.total_price);
    const customNightlyPrice = data.customNightlyPrice !== undefined ? data.customNightlyPrice : data.custom_nightly_price;
    const monthlyPrice = data.monthlyPrice !== undefined ? data.monthlyPrice : data.monthly_price;
    const discountAmount = data.discountAmount !== undefined ? data.discountAmount : data.discount_amount;

    // 1. Required Fields: Name, Room, Total Price
    if (!guestName) {
      return { valid: false, error: 'اسم النزيل مطلوب ولا يمكن تركه فارغاً.' };
    }
    if (!roomId) {
      return { valid: false, error: 'يرجى تحديد الغرفة المراد حجزها.' };
    }

    if (customNightlyPrice !== undefined && customNightlyPrice !== null && customNightlyPrice !== '') {
      const cRate = parseFloat(customNightlyPrice);
      if (isNaN(cRate) || cRate < 0) {
        return { valid: false, error: 'سعر الليلة المخصص يجب أن يكون صفراً أو أكبر.' };
      }
    }

    if (monthlyPrice !== undefined && monthlyPrice !== null && monthlyPrice !== '') {
      const mRate = Number(monthlyPrice);
      if (!Number.isFinite(mRate) || mRate <= 0) {
        return { valid: false, error: 'السعر الشهري المخصص يجب أن يكون أكبر من الصفر.' };
      }
    }

    if (discountAmount !== undefined && discountAmount !== null && discountAmount !== '') {
      const dAmt = parseFloat(discountAmount);
      if (isNaN(dAmt) || dAmt < 0) {
        return { valid: false, error: 'قيمة الخصم يجب أن تكون صفراً أو أكبر.' };
      }
    }

    if (bookingType === 'عقد مفتوح') {
      if (isNaN(totalPrice) || totalPrice < 0) {
        return { valid: false, error: 'السعر الإجمالي يجب أن يكون صفراً أو أكبر.' };
      }
    } else {
      const dAmt = parseFloat(discountAmount) || 0;
      if (isNaN(totalPrice) || totalPrice < 0 || (dAmt === 0 && totalPrice <= 0)) {
        return { valid: false, error: 'السعر الإجمالي مطلوب ويجب أن يكون أكبر من الصفر.' };
      }
    }

    // 2. Phone Number: Must start with '05' and be exactly 10 digits
    if (!guestPhone) {
      return { valid: false, error: 'رقم الجوال مطلوب لتأكيد الحجز.' };
    }
    if (!/^05\d{8}$/.test(guestPhone)) {
      return { valid: false, error: 'رقم الجوال غير صحيح: يجب أن يبدأ بـ 05 ويتكون من 10 أرقام (مثال: 0501234567).' };
    }

    // 3. National ID (10 digits) OR Passport (6-9 alphanumeric characters)
    if (guestIdNumber && !/^(?:\d{10}|[a-zA-Z0-9]{6,9})$/i.test(guestIdNumber)) {
      return { valid: false, error: 'رقم الهوية الوطنية أو الإقامة (10 أرقام) أو جواز السفر (6 إلى 9 خانات) غير صحيح.' };
    }

    // 4. Dates Logic: check_in_date cannot be in the past
    if (!checkInDate) {
      return { valid: false, error: 'تاريخ الوصول مطلوب.' };
    }

    const todayStr = getLocalDateString ? getLocalDateString(new Date()) : new Date().toISOString().split('T')[0];
    const minimumAllowedDate = currentBusinessDate || todayStr;
    if (checkInDate < minimumAllowedDate) {
      return { valid: false, error: 'تاريخ الوصول لا يمكن أن يسبق تاريخ العمل الفندقي الحالي.' };
    }

    if (bookingType === 'عقد مفتوح') {
      if (checkOutDate && checkOutDate <= checkInDate) {
        return { valid: false, error: 'يجب أن تكون المغادرة في اليوم التالي للوصول على الأقل (ليلة واحدة).' };
      }
    } else if (bookingType === 'حجز شهري') {
      if (checkOutDate && checkOutDate <= checkInDate) {
        return { valid: false, error: 'يجب أن تكون المغادرة في اليوم التالي للوصول على الأقل (ليلة واحدة).' };
      }
    } else if (bookingType === 'استخدام يومي') {
      if (checkOutDate !== checkInDate) {
        return { valid: false, error: 'حجز الاستخدام اليومي يتطلب أن يكون تاريخ المغادرة هو نفس تاريخ الوصول.' };
      }
    } else {
      if (!checkOutDate) {
        return { valid: false, error: 'تاريخ المغادرة مطلوب.' };
      }
      if (checkOutDate <= checkInDate) {
        return { valid: false, error: 'يجب أن تكون المغادرة في اليوم التالي للوصول على الأقل (ليلة واحدة).' };
      }
    }

    return { valid: true };
  }

  ipcMain.handle('reservations:create', async (event, data) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      await ensureOpenBusinessDateIsCurrent();
      const currentBusinessDate = typeof db.getCurrentBusinessDate === 'function'
        ? db.getCurrentBusinessDate()
        : (helpers.getHotelBusinessDate ? helpers.getHotelBusinessDate(new Date()) : helpers.getLocalDateString());
      const validation = validateReservationData(data, helpers.getLocalDateString, currentBusinessDate);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Check if guest is banned unless overrideBan is explicitly true
      const guestPhone = (data.guestPhone || data.phone || '').trim();
      const guestIdNumber = (data.guestIdNumber || data.id_number || '').trim();
      const existingGuest = db.searchGuest({ phone: guestPhone, id_number: guestIdNumber });
      const isBannedGuest = existingGuest && Number(existingGuest.is_banned) === 1;
      if (isBannedGuest && !data.overrideBan) {
        const banReason = existingGuest.ban_reason ? ` (سبب الحظر: ${existingGuest.ban_reason})` : '';
        return {
          success: false,
          requiresOverride: true,
          error: 'تنبيه: هذا النزيل مدرج في قائمة الحظر...' + banReason
        };
      }

      const result = db.createReservation({
        ...data,
        userId: session.currentUser ? session.currentUser.id : null,
        overrideBan: Boolean(data.overrideBan && isBannedGuest),
        overrideUsername: session.currentUser?.username || 'الموظف'
      });
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('reservations:checkout', async (event, arg1, arg2) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      await ensureOpenBusinessDateIsCurrent();
      let id = arg1;
      let options = arg2 || {};
      if (arg1 && typeof arg1 === 'object') {
        id = arg1.reservationId || arg1.id;
        options = arg1;
      }
      const activeUserId = options.userId || (session.currentUser ? session.currentUser.id : null);

      // Safe RBAC check: strip discountAmount for non-Admin users.
      // NEVER trust any role claim from the renderer.
      // customNightlyPrice is never accepted from the renderer for non-contract bookings.
      const isAdmin = session.currentUser && session.currentUser.role === 'Admin';
      const reservation = db.getReservationById(id);
      if (!reservation) throw new Error('الحجز غير موجود.');
      const isOpenContract = reservation.booking_type === 'عقد مفتوح';

      if (!isAdmin) {
        options = { ...options, discountAmount: undefined, discountReason: undefined };
        // Monthly early-checkout policy is decided in the backend, but only an Admin may
        // pick the 'actual' exception. Strip it for everyone else so a renderer claim
        // can never reach the settlement — the default 'contract' policy applies instead.
        options = { ...options, checkoutPolicy: undefined, checkoutPolicyReason: undefined };
      }

      // Never accept a renderer-supplied rate. Only Admin may override an
      // open-contract final total; for other users, derive it from stored rates.
      options = { ...options, customNightlyPrice: undefined };
      if (!isOpenContract) {
        options = { ...options, finalTotalPrice: undefined };
      } else {
        const submittedTotal = Number(options.finalTotalPrice);
        if (!isAdmin || options.finalTotalPrice === undefined || options.finalTotalPrice === null || options.finalTotalPrice === '' || !Number.isFinite(submittedTotal) || submittedTotal < 0) {
          const today = (options.checkOutDate && /^\d{4}-\d{2}-\d{2}$/.test(String(options.checkOutDate).slice(0, 10)))
            ? String(options.checkOutDate).slice(0, 10)
            : (db.getCurrentBusinessDate ? db.getCurrentBusinessDate() : db.getLocalDateString());
          const storedDiscount = db.roundMoney(reservation.discount_amount || 0);
          const allowedDiscount = isAdmin && options.discountAmount !== undefined && options.discountAmount !== null && options.discountAmount !== ''
            ? Math.max(0, db.roundMoney(options.discountAmount))
            : storedDiscount;
          let calculatedTotal;
          try {
            const segs = db.computeStaySegments(reservation, today);
            calculatedTotal = Math.max(0, db.roundMoney(segs.totalBaseCharge - allowedDiscount));
          } catch (_) {
            const [startYear, startMonth, startDay] = String(reservation.check_in_date || today).slice(0, 10).split('-').map(Number);
            const [endYear, endMonth, endDay] = today.split('-').map(Number);
            const elapsedNights = Math.max(1, Math.round((Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay)) / 86400000));
            const nightlyRate = db.roundMoney(reservation.custom_nightly_price || reservation.price_per_night || 0);
            calculatedTotal = Math.max(0, db.roundMoney(elapsedNights * nightlyRate - allowedDiscount));
          }
          options = { ...options, finalTotalPrice: calculatedTotal };
        }
      }

      const result = db.checkoutReservation(id, { ...options, userId: activeUserId });
      // Surface whether the policy was actually applied, plus whether this session was
      // even allowed to choose it. Mirrors the preview so the modal can report honestly.
      return { ...result, isAdmin, canChoosePolicy: isAdmin };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Read-only settlement preview — writes nothing to the database.
  // Returns the same figures checkoutReservation will use, so the modal
  // can show an authoritative breakdown before the receptionist commits.
  ipcMain.handle('reservations:checkout-preview', async (event, arg1, arg2) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      let id = arg1;
      let options = arg2 || {};
      if (arg1 && typeof arg1 === 'object') {
        id = arg1.reservationId || arg1.id;
        options = arg1;
      }

      // Strip discount for non-Admin (same rule as checkout itself).
      // Always strip customNightlyPrice — rate comes only from the stored reservation.
      const isAdmin = session.currentUser && session.currentUser.role === 'Admin';
      if (!isAdmin) {
        options = { ...options, discountAmount: undefined, discountReason: undefined };
        // Same rule as checkout: only an Admin may preview the 'actual' exception.
        options = { ...options, checkoutPolicy: undefined, checkoutPolicyReason: undefined };
      }
      options = { ...options, customNightlyPrice: undefined };

      const data = db.computeCheckoutSettlement(id, options);
      // canChoosePolicy is derived HERE, in the main process, from the session role only.
      // The DB layer never sees or trusts a role claim.
      return { success: true, data: { ...data, canChoosePolicy: isAdmin } };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('reservations:extend', async (event, data) => {
    if (!session.currentUser) {
      return { success: false, error: 'غير مصرح: يرجى تسجيل الدخول أولاً.' };
    }
    try {
      await ensureOpenBusinessDateIsCurrent();
      const activeUserId = data?.userId || session.currentUser.id;
      const result = db.extendReservation({
        ...data,
        userId: activeUserId
      });
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('reservations:cancel', async (event, arg1, arg2, arg3) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      await ensureOpenBusinessDateIsCurrent();
      let reservationId = arg1;
      let actualDepartureDate = arg2;
      let manualOverrideAmount = arg3;

      if (arg1 && typeof arg1 === 'object') {
        reservationId = arg1.reservationId || arg1.id;
        actualDepartureDate = arg1.actualDepartureDate;
        manualOverrideAmount = arg1.manualOverrideAmount;
      }

      // Safe RBAC check: only allow manualOverrideAmount if session user is Admin.
      // NEVER trust client claims like requesterRole or isAdmin.
      const isAdmin = session.currentUser && session.currentUser.role === 'Admin';
      if (!isAdmin) {
        manualOverrideAmount = undefined;
      }

      const activeUserId = session.currentUser ? session.currentUser.id : null;
      const result = db.cancelReservation(reservationId, actualDepartureDate, manualOverrideAmount, activeUserId);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Subsequent Payment IPC Handler (تسجيل سداد دفعة جديدة للحجز مع تدقيق الحسابات وسند القبض)
  const handleAddPayment = async (event, data) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      await ensureOpenBusinessDateIsCurrent();
      const { reservationId, newAmount, amount, paymentMethod, userId, notes } = data || {};
      const targetId = parseInt(reservationId, 10);
      const payVal = db.roundMoney(newAmount !== undefined ? newAmount : amount);

      if (!targetId || isNaN(targetId)) {
        return { success: false, error: 'معرف الحجز غير صالح.' };
      }
      if (!Number.isFinite(payVal) || payVal <= 0) {
        return { success: false, error: 'يرجى إدخال مبلغ سداد صحيح وموجب أكبر من الصفر.' };
      }

      const activeUserId = userId || (session.currentUser ? session.currentUser.id : null);

      const result = db.addPaymentToReservation({
        reservationId: targetId,
        amount: payVal,
        paymentMethod: paymentMethod || 'نقداً',
        userId: activeUserId,
        notes: notes || 'سداد دفعة إقامة'
      });
      return result;
    } catch (err) {
      console.error('[Add Payment Error]:', err);
      return { success: false, error: err.message };
    }
  };

  ipcMain.handle('add-payment', handleAddPayment);
  ipcMain.handle('reservations:add-payment', handleAddPayment);

  // Payments Ledger History & Receipt Handlers
  ipcMain.handle('payments:get-by-reservation', async (event, reservationId) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      const payments = db.getReservationPayments(reservationId);
      return { success: true, data: payments };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('deposits:get-by-reservation', async (event, reservationId) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      const movements = db.getReservationDepositMovements(reservationId);
      return { success: true, data: movements };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('deposits:reconcile-legacy', async (event, data = {}) => {
    if (!session.currentUser || session.currentUser.role !== 'Admin') {
      return { success: false, error: 'مطابقة التأمينات التاريخية متاحة لمدير النظام فقط.' };
    }
    const denied = requireSession();
    if (denied) return denied;
    try {
      await ensureOpenBusinessDateIsCurrent();
      return db.reconcileLegacyDeposit({
        ...data,
        userId: session.currentUser.id
      });
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('payments:get-receipt', async (event, receiptIdentifier) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      const receipt = db.getPaymentReceipt(receiptIdentifier);
      if (!receipt) {
        return { success: false, error: 'سند القبض غير موجود.' };
      }
      return { success: true, data: receipt };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Today's Check-outs (مغادرات اليوم) IPC Handler
  // Queries Reservations joining Guests and Rooms, filtering strictly where check_out_date = today
  ipcMain.handle('reservations:get-today-checkouts', async (event, customDate) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      helpers.updateAutomatedRoomStatuses();
      const today = customDate || helpers.getLocalDateString();
      const checkouts = db.getTodayCheckouts(today);
      return { success: true, data: checkouts, date: today };
    } catch (err) {
      console.error('[IPC Today Checkouts Error]:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('excel:import-reservations', async (event, reservationsList) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      const result = db.bulkImportReservations(reservationsList);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 9. Invoice Data Fetching & Updating
  ipcMain.handle('reservations:get-invoice-data', async (event, reservationId) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      const data = db.getReservationById(reservationId);
      if (!data) return { success: false, error: 'لم يتم العثور على بيانات الحجز.' };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('reservations:update-receipt', async (event, updateData) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      await ensureOpenBusinessDateIsCurrent();
      // Editing a receipt rewrites total_price, paid_amount and the guest details on an
      // existing reservation, and it can create exactly the total_price divergence that
      // the monthly contract guard later refuses. That is an Admin decision, so it is
      // gated here on the session role, which is read in the main process only.
      if (!session.currentUser || session.currentUser.role !== 'Admin') {
        return { success: false, error: 'Access Denied: Admin privileges required.' };
      }
      const res = db.updateReservationReceipt({
        ...updateData,
        userId: session.currentUser ? session.currentUser.id : null
      });
      return res;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 10. Room Transfer IPC Handlers (Phase 1: Rate-Preserving Transfer)
  ipcMain.handle('reservations:get-transfer-eligible-rooms', async (event, reservationId) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      await ensureOpenBusinessDateIsCurrent();
      const result = db.getTransferEligibleRooms(reservationId);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('reservations:transfer-preview', async (event, data = {}) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      await ensureOpenBusinessDateIsCurrent();
      const userRole = session.currentUser ? session.currentUser.role : 'Staff';
      const result = db.previewRoomTransfer({
        ...data,
        userRole
      });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('reservations:transfer-room', async (event, data = {}) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      await ensureOpenBusinessDateIsCurrent();
      const userRole = session.currentUser ? session.currentUser.role : 'Staff';
      const userId = session.currentUser ? session.currentUser.id : null;
      const result = db.executeRoomTransfer({
        ...data,
        userId,
        userRole
      });
      helpers.updateAutomatedRoomStatuses();
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 11. Reservation Companions Handlers
  ipcMain.handle('reservations:get-companions', async (event, reservationId) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      const companions = db.getReservationCompanions(reservationId);
      return { success: true, data: companions };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('reservations:add-companion', async (event, payload) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      const reservationId = payload?.reservationId;
      const companion = payload?.companion || payload;
      const newCompanion = db.addReservationCompanion(reservationId, companion);
      return { success: true, data: newCompanion };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('reservations:update-companion', async (event, payload) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      const companionId = payload?.companionId || payload?.id;
      const companion = payload?.companion || payload;
      const updated = db.updateReservationCompanion(companionId, companion);
      return { success: true, data: updated };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('reservations:delete-companion', async (event, arg) => {
    const denied = requireSession();
    if (denied) return denied;
    try {
      const companionId = (arg && typeof arg === 'object') ? (arg.companionId || arg.id) : arg;
      const result = db.deleteReservationCompanion(companionId);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
};
