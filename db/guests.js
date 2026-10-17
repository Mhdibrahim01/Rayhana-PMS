/**
 * نظام أحمد لإدارة الفنادق (Ahmed Hotel ERP)
 * Guests Management, Directory & Search Module
 */

const { db, queryOne, queryAll, saveToFile, roundMoney } = require('./connection');

/**
 * Guest Functions
 */
function getAllGuests() {
  const sql = `
    SELECT 
      g.id, 
      g.name, 
      g.phone, 
      g.id_number, 
      g.nationality,
      g.created_at,
      g.is_banned,
      g.ban_reason,
      COUNT(CASE WHEN r.status = 'مكتمل' THEN r.id END) AS total_stays,
      IFNULL(SUM(CASE
        WHEN r.status = 'مكتمل' THEN COALESCE(p.total_amount, r.paid_amount, 0)
        ELSE 0
      END), 0) AS total_spent
    FROM guests g
    LEFT JOIN reservations r ON g.id = r.guest_id
    LEFT JOIN (
      SELECT reservation_id, SUM(amount) AS total_amount
      FROM payments
      GROUP BY reservation_id
    ) p ON p.reservation_id = r.id
    GROUP BY g.id
    ORDER BY g.id DESC
  `;
  return queryAll(sql).map((g) => ({ ...g, total_spent: roundMoney(g.total_spent || 0) }));
}

/**
 * Server-Side Pagination for Guests directory (LIMIT & OFFSET)
 * Returns the requested chunk of data (e.g. 50 records) and the total COUNT(*)
 */
function getGuestsPaginated({ page = 1, limit = 50, search = '', banFilter = 'all' } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
  const offset = (p - 1) * l;
  const cleanSearch = (search || '').trim();

  let conditions = [];
  let queryParams = [];
  let countParams = [];

  if (cleanSearch) {
    conditions.push('(g.name LIKE ? OR g.phone LIKE ? OR g.id_number LIKE ? OR g.nationality LIKE ?)');
    const wildcard = `%${cleanSearch}%`;
    queryParams.push(wildcard, wildcard, wildcard, wildcard);
    countParams.push(wildcard, wildcard, wildcard, wildcard);
  }

  // Ban-status filter: only add a clause when not 'all' — existing callers
  // that omit banFilter (or pass 'all') get identical query behaviour as before.
  if (banFilter === 'banned') {
    conditions.push('g.is_banned = 1');
  } else if (banFilter === 'active') {
    conditions.push('g.is_banned = 0');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 1. Get total COUNT(*) of matching guests
  const countSql = `SELECT COUNT(*) AS total FROM guests g ${whereClause}`;
  const countRow = queryOne(countSql, countParams);
  const totalCount = countRow ? (countRow.total || 0) : 0;
  const totalPages = Math.ceil(totalCount / l) || 1;

  // 2. Fetch only the requested chunk using LIMIT and OFFSET
  const dataSql = `
    SELECT 
      g.id, 
      g.name, 
      g.phone, 
      g.id_number, 
      g.nationality,
      g.created_at,
      g.is_banned,
      g.ban_reason,
      COUNT(CASE WHEN r.status = 'مكتمل' THEN r.id END) AS total_stays,
      IFNULL(SUM(CASE
        WHEN r.status = 'مكتمل' THEN COALESCE(p.total_amount, r.paid_amount, 0)
        ELSE 0
      END), 0) AS total_spent
    FROM guests g
    LEFT JOIN reservations r ON g.id = r.guest_id
    LEFT JOIN (
      SELECT reservation_id, SUM(amount) AS total_amount
      FROM payments
      GROUP BY reservation_id
    ) p ON p.reservation_id = r.id
    ${whereClause}
    GROUP BY g.id
    ORDER BY g.id DESC
    LIMIT ? OFFSET ?
  `;
  queryParams.push(l, offset);
  const rows = queryAll(dataSql, queryParams).map((g) => ({
    ...g,
    total_spent: roundMoney(g.total_spent || 0)
  }));

  return {
    data: rows,
    pagination: {
      page: p,
      limit: l,
      totalCount,
      totalPages,
      hasNext: p < totalPages,
      hasPrev: p > 1
    }
  };
}

function getGuestReservationHistory(guestId) {
  const id = Number(guestId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('معرف النزيل غير صالح.');
  return queryAll(`
    SELECT
      r.id, r.guest_id, r.check_in_date, r.check_out_date,
      r.total_price,
      COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.reservation_id = r.id), r.paid_amount) AS paid_amount,
      r.payment_method, r.payment_status, r.status, r.booking_type,
      r.is_early_checkin, r.actual_check_in_at, r.created_at,
      rm.room_number, rm.type AS room_type
    FROM reservations r
    JOIN rooms rm ON rm.id = r.room_id
    WHERE r.guest_id = ?
    ORDER BY COALESCE(NULLIF(r.actual_check_in_at, ''), r.created_at) DESC, r.id DESC
  `, [id]);
}

/**
 * Add a new guest / customer directly.
 * Accessible to both 'Admin' and 'User' roles.
 */
function addCustomer({ name, phone = '', id_number = '', nationality = 'سعودي' }) {
  if (!name || !name.trim()) {
    throw new Error('يرجى إدخال اسم العميل / النزيل.');
  }

  const cleanName = name.trim();
  const cleanPhone = (phone || '').trim();
  const cleanId = (id_number || '').trim();
  const cleanNationality = (nationality || 'سعودي').trim() || 'سعودي';

  if (cleanPhone && !/^05\d{8}$/.test(cleanPhone)) {
    throw new Error('رقم الجوال غير صحيح: يجب أن يبدأ بـ 05 ويتكون من 10 أرقام (مثال: 0501234567).');
  }
  if (cleanId && !/^(?:\d{10}|[a-zA-Z0-9]{6,9})$/i.test(cleanId)) {
    throw new Error('رقم الهوية الوطنية أو الإقامة (10 أرقام) أو جواز السفر (6 إلى 9 خانات) غير صحيح.');
  }

  // If ID number is provided, check if already registered
  if (cleanId) {
    const existing = queryOne("SELECT id, name FROM guests WHERE id_number = ?", [cleanId]);
    if (existing) {
      throw new Error(`النزيل مسجل مسبقاً برقم الهوية أو الجواز: ${cleanId} (الاسم: ${existing.name})`);
    }
  }

  const stmt = db.prepare("INSERT INTO guests (name, phone, id_number, nationality) VALUES (?, ?, ?, ?)");
  stmt.run([cleanName, cleanPhone, cleanId, cleanNationality]);
  stmt.free();
  saveToFile();

  return queryOne("SELECT * FROM guests ORDER BY id DESC LIMIT 1");
}

/**
 * Set Guest Ban Status
 */
function setGuestBanStatus(guestId, isBanned, reason) {
  const targetId = parseInt(guestId, 10);
  if (!targetId || isNaN(targetId)) {
    throw new Error('معرف النزيل غير صالح.');
  }

  const guest = queryOne("SELECT id FROM guests WHERE id = ?", [targetId]);
  if (!guest) {
    throw new Error('النزيل غير موجود.');
  }

  const bannedVal = isBanned ? 1 : 0;
  const reasonVal = (reason || '').trim();

  const stmt = db.prepare("UPDATE guests SET is_banned = ?, ban_reason = ? WHERE id = ?");
  stmt.run([bannedVal, reasonVal, targetId]);
  stmt.free();
  saveToFile();

  return { success: true };
}

/**
 * Update guest details (name, phone, id_number, nationality).
 * Accessible to authenticated staff and admin.
 */
function updateGuest(guestId, { name, phone = '', id_number = '', nationality = 'سعودي' } = {}) {
  const targetId = parseInt(guestId, 10);
  if (!targetId || isNaN(targetId)) {
    throw new Error('معرف النزيل غير صالح.');
  }

  const existingGuest = queryOne("SELECT id, name, phone, id_number, nationality FROM guests WHERE id = ?", [targetId]);
  if (!existingGuest) {
    throw new Error('النزيل غير موجود في قاعدة البيانات.');
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('اسم النزيل مطلوب ولا يمكن تركه فارغاً.');
  }

  const cleanName = name.trim();
  const cleanPhone = (phone || '').trim();
  const cleanId = (id_number || '').trim();
  const cleanNationality = (nationality !== undefined && nationality !== null)
    ? (nationality.trim() || 'سعودي')
    : (existingGuest.nationality || 'سعودي');

  // Validate phone format (Saudi format: 05xxxxxxxx, 10 digits) - reuses exact rule from addCustomer / createReservation
  if (cleanPhone && !/^05\d{8}$/.test(cleanPhone)) {
    throw new Error('رقم الجوال غير صحيح: يجب أن يبدأ بـ 05 ويتكون من 10 أرقام (مثال: 0501234567).');
  }

  // Validate ID format (National ID / Iqama 10 digits, or Passport 6-9 alphanumeric) - reuses exact rule from addCustomer / createReservation
  if (cleanId && !/^(?:\d{10}|[a-zA-Z0-9]{6,9})$/i.test(cleanId)) {
    throw new Error('رقم الهوية الوطنية أو الإقامة (10 أرقام) أو جواز السفر (6 إلى 9 خانات) غير صحيح.');
  }

  // Check for duplicate ID on ANOTHER guest (excluding this guest's own row)
  if (cleanId) {
    const duplicateIdGuest = queryOne("SELECT id, name FROM guests WHERE id_number = ? AND id != ?", [cleanId, targetId]);
    if (duplicateIdGuest) {
      throw new Error(`رقم الهوية أو الجواز (${cleanId}) مسجل مسبقاً لنزيل آخر (الاسم: ${duplicateIdGuest.name}).`);
    }
  }

  // Check for duplicate phone on ANOTHER guest (excluding this guest's own row)
  if (cleanPhone) {
    const duplicatePhoneGuest = queryOne("SELECT id, name FROM guests WHERE phone = ? AND id != ?", [cleanPhone, targetId]);
    if (duplicatePhoneGuest) {
      throw new Error(`رقم الجوال (${cleanPhone}) مسجل مسبقاً لنزيل آخر (الاسم: ${duplicatePhoneGuest.name}).`);
    }
  }

  const stmt = db.prepare("UPDATE guests SET name = ?, phone = ?, id_number = ?, nationality = ? WHERE id = ?");
  stmt.run([cleanName, cleanPhone, cleanId, cleanNationality, targetId]);
  stmt.free();
  saveToFile();

  const updatedGuest = queryOne("SELECT * FROM guests WHERE id = ?", [targetId]);
  return { success: true, guest: updatedGuest };
}

/**
 * Search returning guest by Phone Number or ID Number.
 * Returns guest profile along with completed total stays for auto-fill.
 */
function searchGuest({ phone = '', id_number = '' } = {}) {
  const cleanPhone = (phone || '').trim();
  const cleanId = (id_number || '').trim();
  if (!cleanPhone && !cleanId) return null;

  const sql = `
    SELECT 
      g.id, 
      g.name, 
      g.phone, 
      g.id_number, 
      g.nationality,
      g.created_at,
      g.is_banned,
      g.ban_reason,
      COUNT(CASE WHEN r.status = 'مكتمل' THEN r.id END) AS total_stays
    FROM guests g
    LEFT JOIN reservations r ON g.id = r.guest_id
    WHERE (? != '' AND g.phone = ?)
       OR (? != '' AND g.id_number = ?)
    GROUP BY g.id
    ORDER BY g.id DESC
    LIMIT 1
  `;

  return queryOne(sql, [cleanPhone, cleanPhone, cleanId, cleanId]);
}

/**
 * Helper to find a returning guest by single phone or ID string.
 */
function findGuestByPhoneOrId(query) {
  if (!query || typeof query !== 'string' || !query.trim()) return null;
  const clean = query.trim();
  return searchGuest({ phone: clean, id_number: clean });
}

/**
 * Excel / CSV Bulk Import: Guests
 */
function bulkImportGuests(guestsList) {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const updatedGuests = [];

  const insertStmt = db.prepare("INSERT INTO guests (name, phone, id_number, nationality) VALUES (?, ?, ?, ?)");
  const updateStmt = db.prepare("UPDATE guests SET name = ?, phone = ?, id_number = ?, nationality = ? WHERE id = ?");

  db.run("BEGIN TRANSACTION;");
  try {
    for (const g of guestsList) {
      // Resolve Name from multiple common Arabic & English column headers
      let name = String(
        g.name || g.Name || g.guest_name || g.customer_name ||
        g['الاسم'] || g['اسم النزيل'] || g['اسم العميل'] || g['الاسم الكامل'] || ''
      ).trim();

      // Resolve Phone
      let rawPhone = String(
        g.phone || g.Phone || g.mobile || g.Mobile || g.telephone ||
        g['الجوال'] || g['الهاتف'] || g['رقم الجوال'] || g['رقم الهاتف'] || g['الموبايل'] || ''
      ).trim();

      // Resolve ID Number
      let rawId = String(
        g.id_number || g.idNumber || g.national_id || g.iqama ||
        g['الهوية'] || g['رقم الهوية'] || g['الهوية الوطنية'] || g['السجل المدني'] || g['الإقامة'] || g['رقم الإقامة'] || ''
      ).trim();

      // Resolve Nationality
      let rawNationality = String(
        g.nationality || g.Nationality ||
        g['الجنسية'] || g['جنسية'] || ''
      ).trim();
      let nationality = rawNationality || 'سعودي';

      // Normalize Saudi mobile number (e.g. +9665..., 9665..., 5...)
      let phone = rawPhone.replace(/\D/g, '');
      if (phone.startsWith('9665') && phone.length === 12) {
        phone = '0' + phone.substring(3);
      } else if (phone.startsWith('009665') && phone.length === 14) {
        phone = '0' + phone.substring(5);
      } else if (phone.startsWith('5') && (phone.length === 8 || phone.length === 9)) {
        phone = '0' + phone;
      }

      // Normalize ID or Passport number (preserve letters, digits, and hyphens)
      let id_number = rawId.replace(/[^A-Za-z0-9\-]/g, '').trim();

      if (!name) {
        skipped++;
        continue;
      }

      // Check if customer already exists by ID or Phone
      let existing = null;
      let matchReason = '';
      if (id_number) {
        existing = queryOne("SELECT id, name, phone, id_number, nationality FROM guests WHERE id_number = ?", [id_number]);
        if (existing) matchReason = `تطابق رقم الهوية (${id_number})`;
      }
      if (!existing && phone) {
        existing = queryOne("SELECT id, name, phone, id_number, nationality FROM guests WHERE phone = ?", [phone]);
        if (existing) matchReason = `تطابق رقم الجوال (${phone})`;
      }

      if (!existing) {
        insertStmt.run([name, phone, id_number, nationality]);
        inserted++;
      } else {
        // Merge/update missing fields if existing record had incomplete data
        const mergedName = name || existing.name;
        const mergedPhone = phone || existing.phone;
        const mergedId = id_number || existing.id_number;
        const mergedNationality = rawNationality || existing.nationality || 'سعودي';
        updateStmt.run([mergedName, mergedPhone, mergedId, mergedNationality, existing.id]);
        updated++;
        if (updatedGuests.length < 100) {
          updatedGuests.push({
            id: existing.id,
            name: mergedName,
            phone: mergedPhone,
            id_number: mergedId,
            nationality: mergedNationality,
            matchReason: matchReason || 'تطابق في البيانات السابقة'
          });
        }
      }
    }

    insertStmt.free();
    updateStmt.free();
    db.run("COMMIT;");
    saveToFile();
    return { inserted, updated, skipped, total: guestsList.length, updatedGuests };
  } catch (err) {
    try { insertStmt.free(); } catch (_) {}
    try { updateStmt.free(); } catch (_) {}
    try { db.run("ROLLBACK;"); } catch (_) {}
    throw err;
  }
}

module.exports = {
  getAllGuests,
  getGuestsPaginated,
  getGuestReservationHistory,
  addCustomer,
  addGuest: addCustomer,
  setGuestBanStatus,
  updateGuest,
  searchGuest,
  findGuestByPhoneOrId,
  bulkImportGuests
};
