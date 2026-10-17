/**
 * Rayhana ERP - Guests & Customers IPC Handlers
 * Domain: ipc/guests.js
 */

module.exports = function registerGuestsIpc(ipcMain, { db, session }) {
  function requireSession() {
    return session.currentUser
      ? null
      : { success: false, error: 'غير مصرح: يرجى تسجيل الدخول أولاً.' };
  }

  function validateGuestData(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'بيانات النزيل غير صالحة.' };
    }

    const name = (data.name || '').trim();
    const phone = (data.phone || '').trim();
    const id_number = (data.id_number || '').trim();

    // 1. Required Name
    if (!name) {
      return { valid: false, error: 'اسم النزيل مطلوب ولا يمكن تركه فارغاً.' };
    }

    // 2. Phone: Saudi format 05XXXXXXXX
    if (phone && !/^05\d{8}$/.test(phone)) {
      return { valid: false, error: 'رقم الجوال غير صحيح: يجب أن يبدأ بـ 05 ويتكون من 10 أرقام (مثال: 0501234567).' };
    }

    // 3. National ID (10 digits) OR Passport (6-9 alphanumeric characters)
    if (id_number && !/^(?:\d{10}|[a-zA-Z0-9]{6,9})$/i.test(id_number)) {
      return { valid: false, error: 'رقم الهوية الوطنية أو الإقامة (10 أرقام) أو جواز السفر (6 إلى 9 خانات) غير صحيح.' };
    }

    return { valid: true };
  }

  // 6. Guests & Customers (Server-Side Pagination)
  ipcMain.handle('guests:get-all', async (event, params = {}) => {
    const authError = requireSession();
    if (authError) return authError;

    try {
      if (params && (params.page !== undefined || params.limit !== undefined || params.search !== undefined || params.banFilter !== undefined)) {
        const result = db.getGuestsPaginated(params);
        return { 
          success: true, 
          data: result.data, 
          totalCount: result.pagination.totalCount,
          totalPages: result.pagination.totalPages,
          page: result.pagination.page,
          limit: result.pagination.limit,
          pagination: result.pagination 
        };
      }
      const guests = db.getAllGuests();
      return { success: true, data: guests, totalCount: guests.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('guests:get-paginated', async (event, params = {}) => {
    const authError = requireSession();
    if (authError) return authError;

    try {
      const result = db.getGuestsPaginated(params);
      return { 
        success: true, 
        data: result.data, 
        totalCount: result.pagination.totalCount,
        totalPages: result.pagination.totalPages,
        page: result.pagination.page,
        limit: result.pagination.limit,
        pagination: result.pagination 
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('guests:get-reservation-history', async (event, guestId) => {
    const authError = requireSession();
    if (authError) return authError;

    try {
      return { success: true, data: db.getGuestReservationHistory(guestId) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  const handleAddCustomer = async (event, arg1, arg2) => {
    let customerData = arg1;
    let requesterRole = arg2;

    if (arg1 && typeof arg1 === 'object') {
      if (arg1.customerData !== undefined) {
        customerData = arg1.customerData;
        requesterRole = arg1.requesterRole !== undefined ? arg1.requesterRole : requesterRole;
      } else if (arg1.requesterRole !== undefined) {
        requesterRole = arg1.requesterRole;
      }
    }

    // Role check: Both 'Admin' and 'User' (and legacy 'Staff') are permitted
    const role = session.currentUser ? session.currentUser.role : null;
    if (role !== 'Admin' && role !== 'User' && role !== 'Staff') {
      return {
        success: false,
        error: 'Access Denied: Valid user role required.'
      };
    }

    // Validate guest/customer data strictly
    const validation = validateGuestData(customerData);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    try {
      const newCustomer = db.addCustomer(customerData);
      return { success: true, data: newCustomer };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  ipcMain.handle('add-customer', handleAddCustomer);
  ipcMain.handle('guests:add', handleAddCustomer);

  // Search Returning Guest for Auto-fill (by phone number or ID number)
  const handleSearchGuest = async (event, queryData) => {
    const authError = requireSession();
    if (authError) return authError;

    try {
      let guest = null;
      if (typeof queryData === 'string') {
        guest = db.findGuestByPhoneOrId(queryData);
      } else if (queryData && typeof queryData === 'object') {
        if (queryData.query) {
          guest = db.findGuestByPhoneOrId(queryData.query);
        } else {
          guest = db.searchGuest(queryData);
        }
      }
      return { success: true, guest: guest || null };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  ipcMain.handle('guests:search', handleSearchGuest);
  ipcMain.handle('search-guest', handleSearchGuest);

  ipcMain.handle('guests:set-ban-status', async (event, { guestId, isBanned, reason }) => {
    // Available to any signed-in session. Banning a guest stops further bookings, which
    // is front-desk work: reception needs it when a guest is repeatedly problematic.
    // Still requires a login - only the Admin restriction was lifted, not the session
    // check. Unbanning is the same action with isBanned=false.
    if (!session.currentUser) {
      return { success: false, error: 'غير مصرح: يرجى تسجيل الدخول أولاً.' };
    }
    try {
      const result = db.setGuestBanStatus(guestId, isBanned, reason);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('guests:update', async (event, { guestId, name, phone, id_number, nationality }) => {
    if (!session.currentUser) {
      return { success: false, error: 'غير مصرح: يرجى تسجيل الدخول أولاً.' };
    }
    try {
      const result = db.updateGuest(guestId, { name, phone, id_number, nationality });
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 7. Excel & CSV Bulk Import
  const handleImportGuests = async (event, guestsList) => {
    const authError = requireSession();
    if (authError) return authError;

    try {
      if (!Array.isArray(guestsList) || guestsList.length === 0) {
        return { success: false, message: 'مصفوفة بيانات النزلاء فارغة أو غير صالحة.' };
      }
      const result = db.bulkImportGuests(guestsList);
      return {
        success: true,
        importedCount: result.inserted,
        updatedCount: result.updated || 0,
        skippedCount: result.skipped,
        totalCount: result.total,
        updatedGuests: result.updatedGuests || [],
        message: `تم استيراد ${result.inserted} عميل بنجاح!`
      };
    } catch (err) {
      console.error('[IPC import-guests] خطأ أثناء استيراد النزلاء:', err);
      return { success: false, error: err.message, message: `فشل الاستيراد: ${err.message}` };
    }
  };

  ipcMain.handle('import-guests', handleImportGuests);
  ipcMain.handle('excel:import-guests', handleImportGuests);
};
