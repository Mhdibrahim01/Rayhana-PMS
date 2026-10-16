/**
 * نظام أحمد لإدارة الفنادق (Ahmed Hotel ERP)
 * Reservations Management, Payments Ledger & Check-in/out Module
 */

const connection = require('./connection');
const { db, queryOne, queryAll, saveToFile, roundMoney, getLocalDateString, getCurrentBusinessDate, getHotelTimezone, formatHotelDateTime } = connection;

function getDepositLedger(reservationId) {
  const row = queryOne(`
    SELECT COUNT(*) AS movement_count,
      COALESCE(SUM(CASE WHEN movement_type IN ('collected', 'reconciled') THEN amount ELSE -amount END), 0) AS balance
    FROM deposit_movements WHERE reservation_id = ?
  `, [reservationId]);
  return {
    movementCount: Number(row?.movement_count || 0),
    balance: roundMoney(Math.max(0, Number(row?.balance || 0)))
  };
}

function recordDepositMovement({ reservationId, type, amount, paymentMethod = 'نقداً', userId = null, reason = null }) {
  const value = roundMoney(amount);
  if (!['collected', 'reconciled', 'refunded', 'applied', 'retained'].includes(type)) throw new Error('نوع حركة التأمين غير صالح.');
  if (!Number.isFinite(value) || value <= 0) throw new Error('مبلغ حركة التأمين يجب أن يكون أكبر من الصفر.');
  const current = getDepositLedger(reservationId).balance;
  if (!['collected', 'reconciled'].includes(type) && value - current > 0.005) {
    throw new Error(`حركة التأمين (${value} ريال) تتجاوز الرصيد المسجل (${current} ريال).`);
  }
  db.run("SAVEPOINT dep_mv_sp;");
  try {
    const stmt = db.prepare(`
      INSERT INTO deposit_movements (reservation_id, movement_type, amount, payment_method, movement_date, user_id, reason)
      VALUES (?, ?, ?, ?, datetime('now', 'localtime'), ?, ?)
    `);
    stmt.run([reservationId, type, value, paymentMethod || 'نقداً', userId ? parseInt(userId, 10) : null, reason || null]);
    stmt.free();
    const nextBalance = roundMoney(current + (['collected', 'reconciled'].includes(type) ? value : -value));
    const upd = db.prepare('UPDATE reservations SET deposit_amount = ? WHERE id = ?');
    upd.run([nextBalance, reservationId]);
    upd.free();
    db.run("RELEASE SAVEPOINT dep_mv_sp;");
    return nextBalance;
  } catch (err) {
    try {
      db.run("ROLLBACK TO SAVEPOINT dep_mv_sp;");
      db.run("RELEASE SAVEPOINT dep_mv_sp;");
    } catch (_) {}
    throw err;
  }
}

function reconcileLegacyDeposit({ reservationId, amount, paymentMethod = 'نقداً', userId = null }) {
  const targetId = parseInt(reservationId, 10);
  if (!targetId) throw new Error('معرف الحجز غير صالح.');
  const reservation = queryOne('SELECT deposit_amount FROM reservations WHERE id = ?', [targetId]);
  if (!reservation) throw new Error('الحجز غير موجود.');
  const ledger = getDepositLedger(targetId);
  if (ledger.movementCount > 0) throw new Error('للحجز سجل تأمين بالفعل ولا يحتاج إلى مطابقة تاريخية.');
  const recordedAmount = roundMoney(reservation.deposit_amount || 0);
  const confirmedAmount = roundMoney(amount);
  if (recordedAmount <= 0 || Math.abs(recordedAmount - confirmedAmount) > 0.005) {
    throw new Error('المبلغ المؤكد يجب أن يطابق مبلغ التأمين التاريخي المسجل بالحجز.');
  }
  db.run('BEGIN TRANSACTION;');
  try {
    recordDepositMovement({
      reservationId: targetId, type: 'reconciled', amount: confirmedAmount,
      paymentMethod, userId,
      reason: 'مطابقة رصيد تأمين تاريخي بموافقة المدير'
    });
    db.run('COMMIT;');
  } catch (err) {
    try { db.run('ROLLBACK;'); } catch (_) {}
    throw err;
  }
  saveToFile();
  return { success: true, reconciledAmount: confirmedAmount };
}

const RESERVATION_LIST_SQL = `
  SELECT
    r.id,
    r.guest_id,
    r.room_id,
    r.check_in_date,
    r.check_out_date,
    r.total_price,
    r.paid_amount,
    COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.reservation_id = r.id), r.paid_amount) AS ledger_paid_amount,
    r.deposit_amount,
    COALESCE((SELECT SUM(CASE WHEN dm.movement_type IN ('collected', 'reconciled') THEN dm.amount ELSE -dm.amount END) FROM deposit_movements dm WHERE dm.reservation_id = r.id), 0) AS deposit_ledger_balance,
    CASE WHEN NOT EXISTS (SELECT 1 FROM deposit_movements dm WHERE dm.reservation_id = r.id) AND r.deposit_amount > 0 THEN 1 ELSE 0 END AS deposit_legacy_unreconciled,
    r.payment_method,
    r.payment_status,
    r.status,
    r.booking_type,
    r.custom_nightly_price,
    r.monthly_rate_snapshot,
    r.monthly_extension_amount,
    r.discount_amount,
    r.discount_reason,
    r.late_checkout_fee,
    r.original_calculated_charge,
    r.checkout_policy,
    r.checkout_policy_reason,
    r.booked_check_out_date,
    r.is_early_checkin,
    r.actual_check_in_at,
    r.checked_out_at,
    r.created_at,
    strftime('%H:%M', r.created_at, 'localtime') AS booking_time,
    strftime('%H:%M', COALESCE(r.actual_check_in_at, r.created_at), 'localtime') AS actual_checkin_time,
    strftime('%H:%M', r.checked_out_at, 'localtime') AS checkout_time,
    g.name AS guest_name,
    g.phone AS guest_phone,
    g.id_number AS guest_id_number,
    rm.room_number,
    rm.type AS room_type,
    rm.price_per_night,
    rm.monthly_price
  FROM reservations r
  JOIN guests g ON r.guest_id = g.id
  JOIN rooms rm ON r.room_id = rm.id
`;

function getLateReservationSqlCondition(todayStr, tableAlias = 'r') {
  const tz = connection.getHotelTimezone ? connection.getHotelTimezone() : 'Asia/Riyadh';
  let calendarDate, hour;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
    calendarDate = `${p.year}-${p.month}-${p.day}`;
    hour = Number(p.hour || 0);
  } catch (_) {
    const now = new Date();
    calendarDate = connection.getLocalDateString ? connection.getLocalDateString(now) : now.toISOString().slice(0, 10);
    hour = now.getHours();
  }

  const prefix = `${tableAlias}.status = 'مؤكد' AND ${tableAlias}.booking_type != 'عقد مفتوح'`;

  if (calendarDate > todayStr || (calendarDate === todayStr && hour >= 18)) {
    return {
      condition: `${prefix} AND ${tableAlias}.check_out_date <= ?`,
      params: [todayStr]
    };
  }

  if (calendarDate === todayStr && hour >= 14) {
    return {
      condition: `${prefix} AND (${tableAlias}.check_out_date < ? OR (${tableAlias}.check_out_date = ? AND ${tableAlias}.booking_type != 'استخدام يومي' AND COALESCE(${tableAlias}.late_checkout_fee, 0) <= 0))`,
      params: [todayStr, todayStr]
    };
  }

  return {
    condition: `${prefix} AND ${tableAlias}.check_out_date < ?`,
    params: [todayStr]
  };
}

function buildReservationListFilter({ search = '', status = 'all', paymentType = 'all', sortBy = 'id_desc' } = {}) {
  const conditions = [];
  const params = [];
  const todayStr = connection.getCurrentBusinessDate();

  if (status === 'ملغي' || status === 'cancelled') {
    conditions.push("r.status IN ('ملغي', 'ملغي جزئي')");
  } else if (status === 'مؤكد' || status === 'active') {
    conditions.push("r.status = 'مؤكد'");
  } else if (status === 'مكتمل' || status === 'completed') {
    conditions.push("r.status = 'مكتمل'");
  } else if (status === 'late' || status === 'متأخرة') {
    const lateCond = getLateReservationSqlCondition(todayStr, 'r');
    conditions.push(lateCond.condition);
    params.push(...lateCond.params);
  } else if (status === 'today' || status === 'اليوم') {
    conditions.push("r.status = 'مؤكد' AND (r.check_out_date = ? OR r.check_in_date = ?)");
    params.push(todayStr, todayStr);
  }

  // Payment filtering
  if (paymentType === 'unpaid') {
    conditions.push("(COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.reservation_id = r.id), r.paid_amount, 0) < r.total_price AND r.status != 'ملغي')");
  } else if (paymentType === 'paid') {
    conditions.push("(COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.reservation_id = r.id), r.paid_amount, 0) >= r.total_price AND r.total_price > 0)");
  } else if (paymentType === 'cash') {
    conditions.push("r.payment_method = 'نقداً'");
  } else if (paymentType === 'transfer') {
    conditions.push("r.payment_method = 'تحويل بنكي'");
  } else if (paymentType === 'card') {
    conditions.push("r.payment_method IN ('بطاقة / مدى', 'شبكة')");
  } else {
    const allowedPaymentTypes = new Set([
      'advance_payment', 'balance_payment', 'extension_payment', 'late_checkout_fee',
      'checkout_settlement', 'refund', 'deposit_applied', 'legacy_unclassified'
    ]);
    if (allowedPaymentTypes.has(paymentType)) {
      conditions.push('EXISTS (SELECT 1 FROM payments p WHERE p.reservation_id = r.id AND p.payment_type = ?)');
      params.push(paymentType);
    }
  }

  const normalizedSearch = String(search || '').trim().slice(0, 120);
  if (normalizedSearch) {
    const escapedSearch = normalizedSearch.replace(/[\\%_]/g, '\\$&');
    const like = `%${escapedSearch}%`;
    conditions.push(`(
      CAST(r.id AS TEXT) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(g.name, '')) LIKE ? ESCAPE '\\'
      OR CAST(COALESCE(rm.room_number, '') AS TEXT) LIKE ? ESCAPE '\\'
      OR COALESCE(g.phone, '') LIKE ? ESCAPE '\\'
      OR COALESCE(g.id_number, '') LIKE ? ESCAPE '\\'
    )`);
    params.push(like, like, like, like, like);
  }

  return {
    sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
}

function attachRunningTotal(res, targetDate = null) {
  if (!res) return res;
  const isConfirmed = res.status === 'مؤكد';
  const isOpenContract = res.booking_type === 'عقد مفتوح' || !res.check_out_date || res.check_out_date === 'مفتوح';
  const today = (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(String(targetDate).slice(0, 10)))
    ? String(targetDate).slice(0, 10)
    : getCurrentBusinessDate();
  const checkOutDateStr = String(res.check_out_date || '').slice(0, 10);
  const isOverdue = isConfirmed && !isOpenContract && /^\d{4}-\d{2}-\d{2}$/.test(checkOutDateStr) && checkOutDateStr < today;

  if (isConfirmed && (isOpenContract || isOverdue)) {
    try {
      const segs = computeStaySegments(res, today);
      const accrued = Math.max(0, roundMoney(segs.totalBaseCharge - Number(res.discount_amount || 0)));
      res.running_total = Math.max(roundMoney(res.total_price || 0), accrued);
    } catch (_) {
      res.running_total = roundMoney(res.total_price || 0);
    }
  } else {
    res.running_total = roundMoney(res.total_price || 0);
  }
  return res;
}

/**
 * Reservation Functions
 */
function getAllReservations() {
  const rows = queryAll(`${RESERVATION_LIST_SQL} ORDER BY r.id DESC`);
  return rows.map(r => attachRunningTotal(r));
}

function getReservationsPage({ page = 1, pageSize = 50, search = '', status = 'all', paymentType = 'all', exportAll = false, sortBy = 'id_desc' } = {}) {
  const normalizedPageSize = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 50));
  const normalizedPage = Math.max(1, parseInt(page, 10) || 1);
  const filter = buildReservationListFilter({ search, status, paymentType, sortBy });
  const count = queryOne(
    `SELECT COUNT(*) AS total FROM reservations r JOIN guests g ON r.guest_id = g.id JOIN rooms rm ON r.room_id = rm.id ${filter.sql}`,
    filter.params
  );
  const total = Number(count?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / normalizedPageSize));
  const effectivePage = Math.min(normalizedPage, totalPages);
  const paginationSql = exportAll ? '' : 'LIMIT ? OFFSET ?';
  const paginationParams = exportAll
    ? []
    : [normalizedPageSize, (effectivePage - 1) * normalizedPageSize];

  let orderSql = 'ORDER BY r.id DESC';
  if (sortBy === 'checkout_asc') {
    orderSql = 'ORDER BY r.check_out_date ASC, r.id DESC';
  } else if (sortBy === 'checkin_desc') {
    orderSql = 'ORDER BY r.check_in_date DESC, r.id DESC';
  } else if (sortBy === 'total_desc') {
    orderSql = 'ORDER BY r.total_price DESC, r.id DESC';
  } else if (sortBy === 'room_asc') {
    orderSql = 'ORDER BY CAST(rm.room_number AS INTEGER) ASC, rm.room_number ASC, r.id DESC';
  }

  const rows = queryAll(
    `${RESERVATION_LIST_SQL} ${filter.sql} ${orderSql} ${paginationSql}`,
    [...filter.params, ...paginationParams]
  );

  const todayStr = connection.getCurrentBusinessDate();
  const lateCond = getLateReservationSqlCondition(todayStr, 'r');
  const summaryRow = queryOne(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN r.status = 'مؤكد' THEN 1 ELSE 0 END) AS activeCount,
      SUM(CASE WHEN r.status = 'مؤكد' AND (r.check_out_date = ? OR r.check_in_date = ?) THEN 1 ELSE 0 END) AS todayCount,
      SUM(CASE WHEN ${lateCond.condition} THEN 1 ELSE 0 END) AS lateCount,
      SUM(CASE WHEN r.status = 'مكتمل' THEN 1 ELSE 0 END) AS completedCount,
      SUM(CASE WHEN r.status IN ('ملغي', 'ملغي جزئي') THEN 1 ELSE 0 END) AS cancelledCount,
      SUM(CASE
        WHEN r.status IN ('مؤكد', 'مكتمل') AND r.status NOT IN ('ملغي', 'ملغي جزئي') AND r.total_price > COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.reservation_id = r.id), r.paid_amount, 0)
        THEN (r.total_price - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.reservation_id = r.id), r.paid_amount, 0))
        ELSE 0
      END) AS dueAmount
    FROM reservations r
  `, [todayStr, todayStr, ...lateCond.params]);

  const roomStats = queryOne(`
    SELECT
      COUNT(*) AS totalRooms,
      SUM(CASE WHEN status = 'مشغولة' THEN 1 ELSE 0 END) AS occupiedRooms
    FROM rooms
  `);

  const totalRooms = Number(roomStats?.totalRooms || 0);
  const occupiedRooms = Number(roomStats?.occupiedRooms || 0);

  return {
    rows: rows.map(r => attachRunningTotal(r)),
    total,
    page: effectivePage,
    pageSize: normalizedPageSize,
    totalPages,
    summary: {
      total: Number(summaryRow?.total || 0),
      activeCount: Number(summaryRow?.activeCount || 0),
      todayCount: Number(summaryRow?.todayCount || 0),
      lateCount: Number(summaryRow?.lateCount || 0),
      completedCount: Number(summaryRow?.completedCount || 0),
      cancelledCount: Number(summaryRow?.cancelledCount || 0),
      dueAmount: connection.roundMoney(Number(summaryRow?.dueAmount || 0)),
      totalRooms,
      occupiedRooms,
      occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0
    }
  };
}

function getReservationById(reservationId) {
  const sql = `
    SELECT 
      r.id, 
      r.guest_id, 
      r.room_id, 
      r.check_in_date, 
      r.check_out_date, 
      r.total_price, 
      r.paid_amount,
      COALESCE((SELECT SUM(amount) FROM payments WHERE reservation_id = r.id), r.paid_amount) AS ledger_paid_amount,
      r.deposit_amount,
      COALESCE((SELECT SUM(CASE WHEN dm.movement_type IN ('collected', 'reconciled') THEN dm.amount ELSE -dm.amount END) FROM deposit_movements dm WHERE dm.reservation_id = r.id), 0) AS deposit_ledger_balance,
      CASE WHEN NOT EXISTS (SELECT 1 FROM deposit_movements dm WHERE dm.reservation_id = r.id) AND r.deposit_amount > 0 THEN 1 ELSE 0 END AS deposit_legacy_unreconciled,
      r.payment_method,
      r.payment_status,
      r.status, 
      r.booking_type,
      r.custom_nightly_price,
      r.monthly_rate_snapshot,
      r.monthly_extension_amount,
      r.discount_amount,
      r.discount_reason,
      r.late_checkout_fee,
      r.original_calculated_charge,
      r.checkout_policy,
      r.checkout_policy_reason,
      r.booked_check_out_date,
      r.is_early_checkin,
      r.actual_check_in_at,
      r.checked_out_at,
      r.created_at,
      strftime('%H:%M', r.created_at, 'localtime') AS booking_time,
      strftime('%H:%M', COALESCE(r.actual_check_in_at, r.created_at), 'localtime') AS actual_checkin_time,
      strftime('%H:%M', r.checked_out_at, 'localtime') AS checkout_time,
      g.name AS guest_name, 
      g.phone AS guest_phone, 
      g.id_number AS guest_id_number,
      rm.room_number, 
      rm.type AS room_type, 
      rm.price_per_night,
      rm.monthly_price
    FROM reservations r
    JOIN guests g ON r.guest_id = g.id
    JOIN rooms rm ON r.room_id = rm.id
    WHERE r.id = ?
  `;
  const res = queryOne(sql, [parseInt(reservationId, 10)]);
  if (res) {
    res.transfers = queryAll(`
      SELECT t.id, t.from_room_id, t.to_room_id, t.segment_start_date, t.segment_end_date,
             t.segment_nights, t.pinned_rate, t.from_rate, t.segment_revenue, t.transfer_mode,
             t.from_monthly_price, t.to_monthly_price,
             t.reason_category, t.reason_details,
             t.transfer_business_date, t.transfer_timestamp,
             rf.room_number AS from_room_number, rf.type AS from_room_type, rf.monthly_price AS from_room_monthly_price, rf.price_per_night AS from_room_price_per_night,
             rt.room_number AS to_room_number, rt.type AS to_room_type, rt.monthly_price AS to_room_monthly_price, rt.price_per_night AS to_room_price_per_night
      FROM reservation_transfers t
      LEFT JOIN rooms rf ON t.from_room_id = rf.id
      LEFT JOIN rooms rt ON t.to_room_id = rt.id
      WHERE t.reservation_id = ?
      ORDER BY t.id ASC
    `, [res.id]);
    attachRunningTotal(res);
  }
  return res;
}

/**
 * Generate unique, sequential receipt number: REC-YYYY-XXXXX-XXXX
 */
function generateReceiptNumber(reservationId) {
  const year = new Date().getFullYear();
  const countRow = queryOne("SELECT COUNT(*) AS count FROM payments");
  const count = (countRow?.count || 0) + 1;
  return `REC-${year}-${String(reservationId).padStart(4, '0')}-${String(count).padStart(4, '0')}`;
}

function createReservation({
  guestName,
  guestPhone,
  guestIdNumber,
  roomId,
  checkInDate,
  checkOutDate,
  totalPrice,
  paidAmount = 0,
  depositAmount = 0,
  paymentMethod = 'نقداً',
  userId = null,
  bookingType = 'عادي',
  booking_type,
  monthlyPrice = null,
  monthly_price = null,
  customNightlyPrice = null,
  custom_nightly_price = null,
  discountAmount = 0,
  discount_amount = 0,
  discountReason = '',
  discount_reason = '',
  isEarlyCheckin = null,
  is_early_checkin = null,
  actualCheckInAt = null,
  actual_check_in_at = null,
  overrideBan = false,
  overrideUsername = null
}) {
  const explicitEarly = isEarlyCheckin !== null
    ? isEarlyCheckin
    : (is_early_checkin !== null ? is_early_checkin : null);

  let finalIsEarlyCheckin = 0;
  if (explicitEarly !== null && explicitEarly !== undefined) {
    finalIsEarlyCheckin = (explicitEarly === true || explicitEarly === 1 || explicitEarly === '1' || explicitEarly === 'true') ? 1 : 0;
  } else {
    try {
      const now = new Date();
      const tz = connection.getHotelTimezone ? connection.getHotelTimezone() : 'Asia/Riyadh';
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(now);
      const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
      const hour = Number(p.hour);
      const settings = connection.getBusinessDaySettings ? connection.getBusinessDaySettings() : { business_day_cutoff_time: '06:00' };
      const [cutoffH] = String(settings.business_day_cutoff_time || '06:00').split(':').map(Number);
      const calendarToday = `${p.year}-${p.month}-${p.day}`;
      if (hour < cutoffH && checkInDate && checkInDate < calendarToday) {
        finalIsEarlyCheckin = 1;
      }
    } catch (_) {
      finalIsEarlyCheckin = 0;
    }
  }

  const finalActualCheckInAt = actualCheckInAt || actual_check_in_at || null;
  const normBookingType = (bookingType || booking_type || 'عادي').trim();
  const rawCustomPrice = customNightlyPrice !== null && customNightlyPrice !== undefined && customNightlyPrice !== ''
    ? customNightlyPrice
    : (custom_nightly_price !== null && custom_nightly_price !== undefined && custom_nightly_price !== '' ? custom_nightly_price : null);
  const normCustomNightlyPrice = rawCustomPrice !== null && !isNaN(parseFloat(rawCustomPrice)) && parseFloat(rawCustomPrice) >= 0
    ? roundMoney(rawCustomPrice)
    : null;
  const rawMonthlyPrice = monthlyPrice !== null && monthlyPrice !== undefined && monthlyPrice !== ''
    ? monthlyPrice
    : (monthly_price !== null && monthly_price !== undefined && monthly_price !== '' ? monthly_price : null);
  const normMonthlyPrice = rawMonthlyPrice !== null && Number.isFinite(Number(rawMonthlyPrice)) && Number(rawMonthlyPrice) > 0
    ? roundMoney(rawMonthlyPrice)
    : null;
  if (rawMonthlyPrice !== null && normMonthlyPrice === null) {
    throw new Error('السعر الشهري يجب أن يكون رقماً أكبر من الصفر.');
  }

  const rawDiscount = discountAmount !== undefined && discountAmount !== null && discountAmount !== ''
    ? discountAmount
    : (discount_amount !== undefined && discount_amount !== null && discount_amount !== '' ? discount_amount : 0);
  const normDiscountAmount = Math.max(0, roundMoney(rawDiscount));
  const normDiscountReason = (discountReason || discount_reason || '').trim();
  if (normDiscountAmount > 0 && !normDiscountReason) {
    throw new Error('سبب الخصم مطلوب ولا يمكن إتمام العملية بدونه.');
  }

  if (!guestName || !guestName.trim()) {
    throw new Error('اسم النزيل مطلوب ولا يمكن تركه فارغاً.');
  }
  if (!roomId) {
    throw new Error('يرجى تحديد الغرفة المراد حجزها.');
  }

  const cleanPhone = (guestPhone || '').trim();
  if (cleanPhone && !/^05\d{8}$/.test(cleanPhone)) {
    throw new Error('رقم الجوال غير صحيح: يجب أن يبدأ بـ 05 ويتكون من 10 أرقام (مثال: 0501234567).');
  }
  const cleanId = (guestIdNumber || '').trim();
  if (cleanId && !/^(?:\d{10}|[a-zA-Z0-9]{6,9})$/i.test(cleanId)) {
    throw new Error('رقم الهوية الوطنية أو الإقامة (10 أرقام) أو جواز السفر (6 إلى 9 خانات) غير صحيح.');
  }

  const parsedRoomId = parseInt(roomId, 10);
  const roomRow = queryOne("SELECT id, room_number, status, price_per_night, monthly_price FROM rooms WHERE id = ?", [parsedRoomId]);
  if (!roomRow) {
    throw new Error('الغرفة المحددة غير موجودة.');
  }

  const todayStr = getCurrentBusinessDate();
  if (roomRow.status === 'صيانة' && checkInDate && checkInDate <= todayStr) {
    throw new Error(`الغرفة رقم (${roomRow.room_number}) تحت الصيانة حالياً ولا يمكن تسكين النزيل فيها.`);
  }

  let computedCheckOutDate = checkOutDate ? checkOutDate.trim() : null;
  let total;
  const paid = roundMoney(paidAmount);
  const deposit = roundMoney(depositAmount);
  let monthlyRateSnapshot = null;

  if (paid < 0) {
    throw new Error('المبلغ المدفوع لا يمكن أن يكون سالباً.');
  }
  if (!Number.isFinite(deposit) || deposit < 0) {
    throw new Error('مبلغ التأمين يجب أن يكون صفراً أو أكبر.');
  }

  if (normBookingType === 'عقد مفتوح') {
    // Open Contract: check_in_date required, check_out_date optional, total >= 0 (0 allowed)
    if (!checkInDate) {
      throw new Error('تاريخ الوصول مطلوب.');
    }
    if (computedCheckOutDate && computedCheckOutDate <= checkInDate) {
      throw new Error('تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول بشكل محدد.');
    }
    total = roundMoney(totalPrice || 0);
    if (total < 0) {
      throw new Error('قيمة الحجز لا يمكن أن تكون سالبة.');
    }
    // Upfront credit/overpayment is permitted for open contracts
  } else if (normBookingType === 'حجز شهري') {
    // Monthly bookings use the room's flat calendar-month price. The rate is
    // snapshotted so later room edits cannot reprice an existing reservation.
    if (!checkInDate) {
      throw new Error('تاريخ الوصول مطلوب لحساب موعد الإقامة الشهرية.');
    }

    const roomMonthlyPrice = Number(roomRow.monthly_price);
    if (!Number.isFinite(roomMonthlyPrice) || roomMonthlyPrice <= 0) {
      throw new Error('لم يتم تحديد السعر الشهري لهذه الغرفة. يرجى ضبط السعر من بيانات الغرفة أولاً.');
    }
    const effectiveRate = normMonthlyPrice !== null ? normMonthlyPrice : roomMonthlyPrice;
    monthlyRateSnapshot = roundMoney(effectiveRate);
    const baseTotal = monthlyRateSnapshot;
    total = Math.max(0, roundMoney(baseTotal - normDiscountAmount));

    // A monthly booking has an authoritative total: flat monthly rate - discount.
    // A caller-supplied total used to silently replace it, which is how total_price
    // drifted away from the stored dates and rate and later tripped the
    // contract-value guard at checkout. Accept a supplied total only when it agrees.
    if (totalPrice !== undefined && totalPrice !== null && totalPrice !== '' && !isNaN(parseFloat(totalPrice))) {
      const passedTotal = roundMoney(totalPrice);
      if (passedTotal < 0) {
        throw new Error('قيمة الحجز لا يمكن أن تكون سالبة.');
      }
      if (Math.abs(passedTotal - total) > 0.005) {
        throw new Error(
          `قيمة الحجز المُدخلة (${passedTotal} ريال) لا تطابق القيمة المحسوبة من السعر الشهري والخصم (${total} ريال). ` +
          'يرجى مراجعة البيانات المدخلة.'
        );
      }
      total = passedTotal;
    }

    if (!computedCheckOutDate) {
      // One full calendar month, clamped at month end, rather than a fixed 30-day span.
      computedCheckOutDate = getCalendarMonthCheckOut(checkInDate);
    } else if (computedCheckOutDate <= checkInDate) {
      throw new Error('تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول بشكل محدد.');
    }

    if (total <= 0 && normDiscountAmount === 0) {
      throw new Error('إجمالي قيمة الحجز الشهري يجب أن يكون أكبر من الصفر.');
    }
    if (roundMoney(paid - total) > 0.005) {
      throw new Error(`المبلغ المدفوع (${paid} ريال) لا يمكن أن يتجاوز إجمالي قيمة الحجز (${total} ريال).`);
    }
  } else {
    // Regular and same-day use bookings both charge at least one daily unit.
    if (!checkInDate || !computedCheckOutDate) {
      throw new Error('تاريخ الوصول وتاريخ المغادرة مطلوبان.');
    }
    const isDayUse = normBookingType === 'استخدام يومي';
    if (isDayUse ? computedCheckOutDate !== checkInDate : computedCheckOutDate <= checkInDate) {
      if (isDayUse) throw new Error('حجز الاستخدام اليومي يتطلب أن يكون تاريخ المغادرة هو نفس تاريخ الوصول.');
      throw new Error('تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول بشكل محدد.');
    }
    total = roundMoney(totalPrice);
    if (total < 0) {
      throw new Error('إجمالي قيمة الحجز لا يمكن أن يكون سالباً.');
    }
    if (total === 0 && normDiscountAmount === 0) {
      throw new Error('إجمالي قيمة الحجز يجب أن يكون أكبر من الصفر.');
    }
    if (roundMoney(paid - total) > 0.005) {
      throw new Error(`المبلغ المدفوع (${paid} ريال) لا يمكن أن يتجاوز إجمالي قيمة الحجز (${total} ريال).`);
    }
  }

  // Overlap & Collision Check: Prevent double-booking for the same room.
  // Decision: Open-ended contracts block the room until closed (effective checkout = '9999-12-31').
  let effectiveNewCheckout = (normBookingType === 'عقد مفتوح' && !computedCheckOutDate) ? '9999-12-31' : computedCheckOutDate;
  if (normBookingType === 'استخدام يومي') {
    const [year, month, day] = checkInDate.split('-').map(Number);
    effectiveNewCheckout = getLocalDateString(new Date(year, month - 1, day + 1));
  }

  db.run("BEGIN TRANSACTION;");
  try {
    const conflict = queryOne(`
      SELECT r.id, r.check_in_date, r.check_out_date, r.booking_type, g.name AS guest_name
      FROM reservations r
      LEFT JOIN guests g ON r.guest_id = g.id
      WHERE r.room_id = ? 
        AND r.status = 'مؤكد'
        AND r.check_in_date < ? 
        AND CASE
          WHEN r.booking_type = 'استخدام يومي' AND r.check_out_date = r.check_in_date
            THEN date(r.check_in_date, '+1 day')
          ELSE COALESCE(NULLIF(r.check_out_date, ''), '9999-12-31')
        END > ?
      LIMIT 1
    `, [parsedRoomId, effectiveNewCheckout, checkInDate]);

    if (conflict) {
      const conflictOutStr = conflict.check_out_date || 'مفتوح (غير محدد)';
      throw new Error(`الغرفة محجوزة بالفعل في الفترة المحددة: يوجد حجز مؤكد #${conflict.id} (${conflict.guest_name ? `النزيل: ${conflict.guest_name}، ` : ''}من ${conflict.check_in_date} إلى ${conflictOutStr}).`);
    }

    let guest = null;
    if (guestIdNumber) {
      guest = queryOne("SELECT id FROM guests WHERE id_number = ?", [guestIdNumber.trim()]);
    }
    if (!guest && guestPhone) {
      guest = queryOne("SELECT id FROM guests WHERE phone = ?", [guestPhone.trim()]);
    }

    let guestId;
    if (guest) {
      guestId = guest.id;
    } else {
      const guestStmt = db.prepare("INSERT INTO guests (name, phone, id_number) VALUES (?, ?, ?)");
      guestStmt.run([guestName.trim(), cleanPhone, cleanId]);
      guestStmt.free();
      const newGuest = queryOne("SELECT id FROM guests ORDER BY id DESC LIMIT 1");
      guestId = newGuest.id;
    }

    const method = paymentMethod || 'نقداً';

    let paymentStatus = 'غير مدفوع';
    if (normBookingType === 'عقد مفتوح') {
      if (paid > total) {
        paymentStatus = 'رصيد دائن';
      } else if (paid === total && total > 0) {
        paymentStatus = 'مدفوع بالكامل';
      } else if (paid > 0) {
        paymentStatus = 'مدفوع جزئياً';
      }
    } else {
      if (paid >= total && total > 0) {
        paymentStatus = 'مدفوع بالكامل';
      } else if (paid > 0) {
        paymentStatus = 'مدفوع جزئياً';
      }
    }

    const resStmt = db.prepare(`
      INSERT INTO reservations (
        guest_id, room_id, check_in_date, check_out_date,
        total_price, paid_amount, deposit_amount, payment_method, payment_status, status,
        booking_type, custom_nightly_price, monthly_rate_snapshot, monthly_extension_amount,
        discount_amount, discount_reason, is_early_checkin, actual_check_in_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'مؤكد', ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    resStmt.run([
      guestId,
      parsedRoomId,
      checkInDate,
      (computedCheckOutDate && computedCheckOutDate.trim()) ? computedCheckOutDate.trim() : '',
      total,
      paid,
      deposit,
      method,
      paymentStatus,
      normBookingType,
      normBookingType === 'حجز شهري' ? null : normCustomNightlyPrice,
      monthlyRateSnapshot,
      0,
      normDiscountAmount,
      normDiscountReason,
      finalIsEarlyCheckin,
      finalActualCheckInAt
    ]);
    resStmt.free();

    const createdRes = queryOne("SELECT id FROM reservations ORDER BY id DESC LIMIT 1");
    const newReservationId = createdRes.id;

    if (overrideBan) {
      const auditUser = overrideUsername || (userId ? `مستخدم #${userId}` : 'الموظف');
      const stmtAudit = db.prepare(`
        INSERT INTO reservation_events (
          entity_type, entity_id, event_type,
          old_status, new_status, created_at, business_date, user_id
        ) VALUES ('reservation', ?, 'ban_overridden', 'محظور', ?, datetime('now', 'localtime'), ?, ?)
      `);
      stmtAudit.run([
        newReservationId,
        `تم تجاوز الحظر بواسطة: ${auditUser}`,
        todayStr,
        userId ? parseInt(userId, 10) : null
      ]);
      stmtAudit.free();
    }

    // Record initial payment in the payments ledger table
    let receiptNumber = null;
    if (paid > 0) {
      receiptNumber = generateReceiptNumber(newReservationId);
      const payStmt = db.prepare(`
        INSERT INTO payments (receipt_number, reservation_id, amount, payment_method, payment_type, payment_date, user_id, notes)
        VALUES (?, ?, ?, ?, 'advance_payment', datetime('now', 'localtime'), ?, 'دفعة الحجز المبدئية عند تسجيل الوصول')
      `);
      payStmt.run([
        receiptNumber,
        newReservationId,
        paid,
        method,
        userId ? parseInt(userId, 10) : null
      ]);
      payStmt.free();
    }

    // The entered deposit is money received now, tracked separately from accommodation payments.
    if (deposit > 0) {
      recordDepositMovement({
        reservationId: newReservationId,
        type: 'collected',
        amount: deposit,
        paymentMethod: method,
        userId,
        reason: `استلام تأمين عند إنشاء الحجز #${newReservationId}`
      });
    }

    // Dynamic Room Status Evaluation:
    // Only mark room as 'مشغولة' if CURRENT_DATE >= check_in_date AND CURRENT_DATE < effectiveNewCheckout.
    // If check_in_date is in the future, mark as 'محجوزة' (unless it is already occupied today by another guest).
    let assignedRoomStatus = 'متاحة';
    const currentRoom = queryOne("SELECT status FROM rooms WHERE id = ?", [parsedRoomId]);

    if (checkInDate <= todayStr && (effectiveNewCheckout >= todayStr || !effectiveNewCheckout)) {
      assignedRoomStatus = 'مشغولة';
    } else if (checkInDate > todayStr) {
      if (currentRoom && currentRoom.status === 'مشغولة') {
        assignedRoomStatus = 'مشغولة';
      } else {
        assignedRoomStatus = 'محجوزة';
      }
    }

    if (currentRoom && (currentRoom.status === 'متاحة' || currentRoom.status === 'محجوزة' || (assignedRoomStatus === 'مشغولة' && currentRoom.status === 'تنظيف'))) {
      const roomStmt = db.prepare("UPDATE rooms SET status = ? WHERE id = ?");
      roomStmt.run([assignedRoomStatus, parsedRoomId]);
      roomStmt.free();
    }

    db.run("COMMIT;");
    saveToFile();

    return { 
      success: true, 
      reservationId: newReservationId,
      receiptNumber 
    };
  } catch (err) {
    try { db.run("ROLLBACK;"); } catch (rbErr) {}
    throw err;
  }
}

/**
 * Whole nights between two ISO dates. Returns 0 when either date is missing/unparseable
 * or the end is not strictly after the start. UTC-based so it is immune to the local
 * timezone and daylight-saving shifts.
 */
function countNights(startDate, endDate) {
  const start = String(startDate || '').trim();
  const end = String(endDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return 0;
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  if (!Number.isFinite(startUtc) || !Number.isFinite(endUtc) || endUtc <= startUtc) return 0;
  return Math.round((endUtc - startUtc) / 86400000);
}

  /**
   * Legacy monthly rows without monthly_rate_snapshot retain their original 30 x nightly
   * rate calculation. New monthly rows use a saved flat monthly-rate snapshot.
   */
  const MONTHLY_PACKAGE_NIGHTS = 30;

  /**
   * The checkout date that ends one full calendar month after the given check-in, with
   * month-end clamping: 2026-07-03 -> 2026-08-03, 2026-01-31 -> 2026-02-28,
   * 2028-01-31 -> 2028-02-29 (leap year). Returns '' for anything unparseable.
   */
  function getCalendarMonthCheckOut(checkInDateStr) {
    const value = String(checkInDateStr || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const [y, m, d] = value.split('-').map(Number);
    // m is the 1-based check-in month, so the next month is 0-based index m.
    const lastDayOfNextMonth = new Date(y, m + 1, 0).getDate();
    const clampedDay = Math.min(d, lastDayOfNextMonth);
    // Let Date roll month index 12 over into January of the following year.
    const nextMonthStart = new Date(y, m, 1);
    return `${nextMonthStart.getFullYear()}-${String(nextMonthStart.getMonth() + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
  }

/**
 * Is this a MONTHLY booking being checked out before its stored departure date?
 * The stored check_out_date must be a real date (never '' / 'مفتوح'), and the actual
 * departure date must fall strictly before it. Everything else keeps today's behaviour.
 */
function isMonthlyEarlyCheckout(res, departureDate) {
  if (!res || res.booking_type !== 'حجز شهري') return false;
  const booked = String(res.check_out_date || '').trim();
  if (!booked || booked === 'مفتوح' || !/^\d{4}-\d{2}-\d{2}$/.test(booked)) return false;
  return String(departureDate || '') < booked;
}

/**
 * Single source of truth for stay segments across historical transfers and the active room.
 * Read-only helper: queries reservation_transfers and computes per-segment nights and rates.
 * If total nights across all segments is 0, the active segment is clamped to 1 night
 * (matching today's Math.max(1, diffDays) behavior).
 *
 * @param {object} res - Reservation record (must include room_id)
 * @param {string} [targetCheckOutDate=null] - Optional cutoff checkout date (e.g. todayStr for actual checkout)
 * @returns {{ segments: Array, totalNights: number, totalBaseCharge: number, effectiveNightlyRate: number }}
 */
function computeStaySegments(res, targetCheckOutDate = null) {
  if (!res || res.room_id == null) {
    throw new Error('تعذر احتساب شرائح الإقامة: معرف الغرفة (room_id) مفقود.');
  }

  const isValidDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(String(d).trim().slice(0, 10));
  const cutoff = (isValidDate(targetCheckOutDate) ? String(targetCheckOutDate).trim().slice(0, 10) : null)
    || (isValidDate(res.check_out_date) ? String(res.check_out_date).trim().slice(0, 10) : null)
    || getCurrentBusinessDate();

  const pastTransfers = res.id ? queryAll(`
    SELECT t.id, t.from_room_id, t.to_room_id, t.segment_start_date, t.segment_end_date,
           t.segment_nights, t.pinned_rate, t.from_rate, t.transfer_mode,
           rm.room_number AS from_room_number, rm.type AS from_room_type
    FROM reservation_transfers t
    LEFT JOIN rooms rm ON t.from_room_id = rm.id
    WHERE t.reservation_id = ?
    ORDER BY t.id ASC
  `, [res.id]) : [];

  const segments = [];
  let totalNights = 0;
  let totalBaseCharge = 0;
  let lastCoveredDate = res.check_in_date;

  for (const t of pastTransfers) {
    // If past segment starts at or after cutoff, drop it
    if (cutoff && t.segment_start_date >= cutoff) {
      continue;
    }

    // If past segment ends after cutoff, truncate it
    const effectiveStart = t.segment_start_date;
    const effectiveEnd = (cutoff && t.segment_end_date > cutoff) ? cutoff : t.segment_end_date;
    const nights = countNights(effectiveStart, effectiveEnd);
    const rate = roundMoney(t.from_rate != null ? t.from_rate : t.pinned_rate);
    const charge = roundMoney(nights * rate);

    segments.push({
      roomId: t.from_room_id,
      roomNumber: t.from_room_number || null,
      roomType: t.from_room_type || null,
      startDate: effectiveStart,
      endDate: effectiveEnd,
      nights,
      rate,
      charge,
      isTransferred: true
    });

    totalNights += nights;
    totalBaseCharge = roundMoney(totalBaseCharge + charge);
    lastCoveredDate = effectiveEnd;

    // If truncated at cutoff, do not process subsequent transfers
    if (cutoff && effectiveEnd >= cutoff) {
      break;
    }
  }

  let activeRate = (res.custom_nightly_price != null && !isNaN(Number(res.custom_nightly_price)))
    ? roundMoney(res.custom_nightly_price)
    : roundMoney(res.price_per_night || 0);

  let activeRoomNumber = res.room_number || null;
  let activeRoomType = res.room_type || null;

  if (activeRate <= 0 && res.room_id) {
    const room = queryOne("SELECT room_number, type, price_per_night FROM rooms WHERE id = ?", [res.room_id]);
    if (room) {
      if (activeRate <= 0) activeRate = roundMoney(room.price_per_night || 0);
      if (!activeRoomNumber) activeRoomNumber = room.room_number;
      if (!activeRoomType) activeRoomType = room.type;
    }
  }

  const activeStartDate = lastCoveredDate;
  const activeEndDate = cutoff;

  let activeNights = 0;
  if (!cutoff || activeStartDate < cutoff) {
    activeNights = countNights(activeStartDate, activeEndDate);
  }

  // Zero-night rule identical to Math.max(1, nights):
  // when the sum over all segments (clamped) is 0, charge one night at active rate
  if (totalNights === 0 && activeNights === 0) {
    activeNights = 1;
  }

  const activeCharge = roundMoney(activeNights * activeRate);
  totalNights += activeNights;
  totalBaseCharge = roundMoney(totalBaseCharge + activeCharge);

  segments.push({
    roomId: res.room_id,
    roomNumber: activeRoomNumber,
    roomType: activeRoomType,
    startDate: activeStartDate,
    endDate: activeEndDate,
    nights: activeNights,
    rate: activeRate,
    charge: activeCharge,
    isTransferred: false
  });

  return {
    segments,
    totalNights,
    totalBaseCharge,
    effectiveNightlyRate: activeRate
  };
}

/**
 * Single source of truth for the monthly contract value.
 *
 *   contractValue = max(0, savedMonthlyRate + extensionCharges - storedDiscount)
 * or, for legacy monthly rows, 30 x storedRate - discount.
 *
 * bookedNights come from the STORED check_in_date / check_out_date pair (so extensions
 * are included), never from total_price or any renderer-supplied value. The stored
 * discount is applied in FULL — deliberately NOT prorated, unlike the actual-nights
 * path which goes through calculateCheckoutDiscount().
 */
function computeContractValue(res) {
  // If res.id exists and room_id is missing, throw immediately (persisted reservations must supply room_id)
  if (res && res.id != null && res.room_id == null) {
    throw new Error('تعذر حساب قيمة العقد: معرف الغرفة (room_id) مفقود.');
  }

  // Must resolve the rate exactly like the actual-nights path (see the three
  // `custom_nightly_price || price_per_night` sites in this file): a stored 0 means
  // "no custom rate", so it falls back to the room rate. Treating 0 as a real rate
  // here used to throw, which froze BOTH the preview and the checkout of a monthly
  // booking and left it impossible to settle.
  const storedRate = roundMoney(res.custom_nightly_price || res.price_per_night || 0);
  if (!Number.isFinite(storedRate) || storedRate <= 0) {
    throw new Error('تعذر حساب قيمة العقد: سعر الليلة غير صالح (يجب أن يكون أكبر من الصفر).');
  }
  const bookedNights = countNights(res.check_in_date, res.check_out_date);
  if (!bookedNights) {
    throw new Error('تعذر حساب قيمة العقد: تواريخ الإقامة غير صالحة.');
  }
  const isMonthly = res.booking_type === 'حجز شهري';
  const extensionAmount = isMonthly ? roundMoney(res.monthly_extension_amount || 0) : 0;
  // New monthly records use a flat price snapshot. Old records keep their
  // original 30 x nightly-rate calculation, including after later room edits.
  const base = isMonthly
    ? roundMoney((Number(res.monthly_rate_snapshot) > 0 ? Number(res.monthly_rate_snapshot) : MONTHLY_PACKAGE_NIGHTS * storedRate) + extensionAmount)
    : (res && res.room_id != null
        ? computeStaySegments(res, res.check_out_date).totalBaseCharge
        : roundMoney(bookedNights * storedRate));
  const fullDiscount = Math.max(0, roundMoney(res.discount_amount || 0));
  return {
    bookedNights,
    storedRate,
    baseCharge: base,
    monthlyRateSnapshot: Number(res.monthly_rate_snapshot) > 0 ? roundMoney(res.monthly_rate_snapshot) : null,
    extensionAmount,
    discountAppliedInFull: fullDiscount,
    contractValue: Math.max(0, roundMoney(base - fullDiscount))
  };
}

function calculateCheckoutDiscount(discountAmount, actualNights, checkInDate, bookedCheckOutDate, baseCharge, prorate) {
  const normalizedDiscount = Math.max(0, roundMoney(discountAmount || 0));
  if (!normalizedDiscount || !baseCharge) return 0;

  let appliedDiscount = normalizedDiscount;
  if (prorate && checkInDate && bookedCheckOutDate && bookedCheckOutDate !== 'مفتوح') {
    const [startYear, startMonth, startDay] = String(checkInDate).slice(0, 10).split('-').map(Number);
    const [endYear, endMonth, endDay] = String(bookedCheckOutDate).slice(0, 10).split('-').map(Number);
    const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
    const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
    if (Number.isFinite(startUtc) && Number.isFinite(endUtc) && endUtc > startUtc) {
      const bookedNights = Math.max(1, Math.round((endUtc - startUtc) / 86400000));
      if (actualNights < bookedNights) {
        appliedDiscount = 0; // Strict Rate Reversion: Cancel discount completely
      }
    }
  }

  return Math.min(roundMoney(baseCharge), appliedDiscount);
}

/**
 * computeCheckoutSettlement — read-only preview (writes nothing).
 *
 * Uses only the rate stored on the reservation (custom_nightly_price, else
 * price_per_night). No renderer-supplied rate override is accepted.
 * The caller (IPC layer) strips discountAmount for non-Admin users.
 *
 * @param {number|string} reservationId
 * @param {object}        opts
 * @param {number}        [opts.discountAmount]  – checkout discount (Admin only)
 * @param {string}        [opts.discountReason]
 * @returns {{
 *   reservationId, isOpenContract, checkInDate, actualCheckOutDate,
 *   actualNights, effectiveNightlyRate, baseCharge, discountApplied,
 *   netCharge, paidAmount, difference,
 *   needsCollection, needsRefund, isSettled
 * }}
 */
function computeCheckoutSettlement(reservationId, {
  discountAmount,
  discountReason,
  lateCheckoutFee = 0
} = {}) {
  const targetId = parseInt(reservationId, 10);
  if (!targetId || isNaN(targetId)) throw new Error('معرف الحجز غير صالح.');

  const res = queryOne(`
    SELECT r.id, r.room_id, r.booking_type, r.check_in_date, r.check_out_date, r.total_price, r.paid_amount,
           COALESCE((SELECT SUM(amount) FROM payments WHERE reservation_id = r.id), r.paid_amount) AS ledger_paid_amount,
           r.deposit_amount,
            r.custom_nightly_price, r.monthly_rate_snapshot, r.monthly_extension_amount,
            r.discount_amount, r.discount_reason, r.status,
            rm.room_number, rm.type AS room_type, rm.price_per_night
    FROM reservations r
    LEFT JOIN rooms rm ON r.room_id = rm.id
    WHERE r.id = ?
  `, [targetId]);
  if (!res) throw new Error('الحجز غير موجود.');

  if (res.status === 'مكتمل' || res.status === 'ملغي' || res.status === 'ملغي جزئي') {
    throw new Error('لا يمكن احتساب تسوية لحجز مغلق بالفعل.');
  }

  const isOpenContract = res.booking_type === 'عقد مفتوح';
  const todayStr = getCurrentBusinessDate();
  if (todayStr < res.check_in_date) {
    throw new Error('لم تبدأ الإقامة بعد. استخدم إلغاء الحجز بدلاً من تسجيل الخروج.');
  }

  // Effective nightly rate: stored custom rate, else room default.
  // No renderer-supplied rate override is accepted.
  const effectiveNightlyRate = roundMoney(res.custom_nightly_price || res.price_per_night || 0);

  // A stored reservation discount is allocated across the booked stay. An
  // explicit checkout discount is already for this settlement and is not prorated.
  const storedDisc = roundMoney(res.discount_amount || 0);
  const explicitDisc = (discountAmount !== undefined && discountAmount !== null && discountAmount !== '' && !isNaN(Number(discountAmount))) ? Math.max(0, roundMoney(discountAmount)) : null;
  const hasExplicitDiscount = explicitDisc !== null && Math.abs(explicitDisc - storedDisc) > 0.005;
  const normDiscount = hasExplicitDiscount ? explicitDisc : storedDisc;

  let actualNights = null;
  let baseCharge = null;
  let netCharge = null;
  let appliedDiscount = null;

  if (!isOpenContract) {
    if (!Number.isFinite(effectiveNightlyRate) || effectiveNightlyRate <= 0) {
      throw new Error('تعذر حساب التسوية: سعر الليلة غير صالح (يجب أن يكون أكبر من الصفر).');
    }
    const stay = computeStaySegments(res, todayStr);
    actualNights = stay.totalNights;
    baseCharge = stay.totalBaseCharge;
    appliedDiscount = calculateCheckoutDiscount(
      normDiscount,
      actualNights,
      res.check_in_date,
      res.check_out_date,
      baseCharge,
      !hasExplicitDiscount
    );
    netCharge = Math.max(0, roundMoney(baseCharge - appliedDiscount));
  }

  // Monthly early checkout: report BOTH candidate values so the modal can show them.
  // Nothing is decided here — the preview only describes the reservation.
  const monthlyEarly = !isOpenContract && isMonthlyEarlyCheckout(res, todayStr);
  let contractValue = null;
  let contractValueMismatch = false;
  let bookedNights = null;
  if (monthlyEarly) {
    const contract = computeContractValue(res);
    contractValue = contract.contractValue;
    bookedNights = contract.bookedNights;
    const storedTotal = roundMoney(res.total_price || 0);
      if (res.booking_type === 'حجز شهري') {
        contractValueMismatch = Math.abs(roundMoney(contract.contractValue - storedTotal)) > 0.005;
      } else {
        contractValueMismatch = roundMoney(contract.contractValue) > storedTotal + 0.005;
      }
  }
  const actualValue = netCharge;

  // At the scheduled monthly checkout, collect the saved package price plus
  // any daily-rate extension charges. The early-checkout policy still exposes
  // its existing actual-nights alternative above; daily and day-use bookings
  // continue using the actual-nights calculation unchanged.
  if (res.booking_type === 'حجز شهري' && !monthlyEarly) {
    const contract = computeContractValue({ ...res, discount_amount: normDiscount });
    baseCharge = contract.baseCharge;
    appliedDiscount = contract.discountAppliedInFull;
    netCharge = contract.contractValue;
  }

  const normalizedLateCheckoutFee = roundMoney(lateCheckoutFee);
  if (!Number.isFinite(normalizedLateCheckoutFee) || normalizedLateCheckoutFee < 0) {
    throw new Error('مبلغ تأخير المغادرة يجب أن يكون صفراً أو أكبر.');
  }

  const ledgerPaid = (res.ledger_paid_amount !== null && res.ledger_paid_amount !== undefined)
    ? Number(res.ledger_paid_amount)
    : Number(res.paid_amount || 0);
  const paidAmount = roundMoney(ledgerPaid);
  const depositLedger = getDepositLedger(targetId);
  const depositAvailable = depositLedger.balance;
  const difference = isOpenContract ? null : roundMoney(netCharge + normalizedLateCheckoutFee - paidAmount);

  return {
    reservationId: targetId,
    isOpenContract,
    checkInDate: res.check_in_date,
    actualCheckOutDate: todayStr,
    actualNights,
    effectiveNightlyRate,
    baseCharge,
    discountApplied: appliedDiscount,
    netCharge: netCharge === null ? null : roundMoney(netCharge + normalizedLateCheckoutFee),
    accommodationNetCharge: netCharge,
    lateCheckoutFee: normalizedLateCheckoutFee,
    // Monthly early-checkout policy inputs. The caller (main process) supplies
    // canChoosePolicy from the session role; the DB layer never sees a role.
    isMonthlyEarlyCheckout: monthlyEarly,
    bookedCheckOutDate: monthlyEarly ? res.check_out_date : null,
    bookedNights,
    contractValue,
    contractValueMismatch,
    actualValue,
    paidAmount,
    depositAvailable,
    depositLegacyUnreconciled: !depositLedger.movementCount && roundMoney(res.deposit_amount || 0) > 0,
    // difference > 0 → guest owes money
    // difference < 0 → guest overpaid (refund due)
    // difference = 0 → settled
    difference,
    needsCollection: difference !== null && difference > 0.005,
    needsRefund:     difference !== null && difference < -0.005,
    isSettled:       difference !== null && Math.abs(difference) <= 0.005
  };
}

function checkoutReservation(reservationId, {
  // Settlement choices from the renderer/IPC:
  //   settleMode:     'collect' | 'defer' (آجل) | 'refund' | 'credit'
  //   collectAmount:  amount collected now (mode='collect')
  //   refundAmount:   amount refunded now (mode='refund')
  //   paymentMethod:  method for payment or refund row
  //   discountAmount: checkout discount (Admin only – IPC strips for non-Admin)
  //   discountReason: required when discount > 0
  //   customNightlyPrice: override nightly rate (optional)
  //   checkoutPolicy:     'contract' (default) | 'actual' — monthly early checkouts only.
  //                      The IPC layer strips this for non-Admin callers, so 'actual'
  //                      is only reachable by an Admin session.
  //   checkoutPolicyReason: mandatory non-empty reason when policy is 'actual'
  //   userId:         acting user id
  settleMode,
  collectAmount,
  refundAmount,
  paymentMethod = 'نقداً',
  userId = null,
  discountAmount,
  discountReason,
  checkoutPolicy,
  checkoutPolicyReason,
  lateCheckoutFee = 0,
  customNightlyPrice,
  depositDisposition = 'refund',
  depositRetainAmount = 0,
  depositRetainReason = '',
  depositRefundMethod = 'نقداً',
  // Legacy shim: the open-contract settle modal still passes these
  finalTotalPrice,
  settleAmount,
  notes
} = {}) {
  const targetId = parseInt(reservationId, 10);
  if (!targetId || isNaN(targetId)) throw new Error('معرف الحجز غير صالح.');

  const res = queryOne(`
    SELECT r.id, r.room_id, r.total_price, r.paid_amount,
           COALESCE((SELECT SUM(amount) FROM payments WHERE reservation_id = r.id), r.paid_amount) AS ledger_paid_amount,
           r.deposit_amount, r.payment_method, r.payment_status, r.booking_type,
           r.check_in_date, r.check_out_date, r.original_calculated_charge, r.status,
            r.custom_nightly_price, r.monthly_rate_snapshot, r.monthly_extension_amount,
            r.discount_amount, r.discount_reason,
           r.checkout_policy, r.checkout_policy_reason, r.booked_check_out_date,
           rm.room_number, rm.type AS room_type, rm.price_per_night
    FROM reservations r
    LEFT JOIN rooms rm ON r.room_id = rm.id
    WHERE r.id = ?
  `, [targetId]);
  if (!res) throw new Error('الحجز غير موجود.');

  // Safety net: never close an already-closed reservation
  if (res.status === 'مكتمل' || res.status === 'ملغي' || res.status === 'ملغي جزئي') {
    throw new Error('الحجز مغلق بالفعل ولا يمكن تسجيل مغادرة جديدة له.');
  }

  const todayStr = getCurrentBusinessDate();
  if (todayStr < res.check_in_date) {
    throw new Error('لم تبدأ الإقامة بعد. استخدم إلغاء الحجز بدلاً من تسجيل الخروج.');
  }

  const isOpenContract = res.booking_type === 'عقد مفتوح';

  // -------------------------------------------------------------------------
  // UNIFIED SETTLEMENT ENGINE: handles open contracts, monthly stays, day-use,
  // and regular bookings with shared deposit and ledger reconciliation.
  // -------------------------------------------------------------------------

  // Resolve discount and rate.
  // Rate: always from the stored reservation — no caller override accepted for non-contracts.
  // Discount: already stripped for non-Admin by the IPC layer.
  const storedDiscountAtBooking = roundMoney(res.discount_amount || 0);
  const rawProvidedDisc = (discountAmount !== undefined && discountAmount !== null && discountAmount !== '' && !isNaN(Number(discountAmount))) ? Math.max(0, roundMoney(discountAmount)) : null;
  const hasExplicitDiscount = rawProvidedDisc !== null && Math.abs(rawProvidedDisc - storedDiscountAtBooking) > 0.005;
  const normDiscountAmount = hasExplicitDiscount ? rawProvidedDisc : (isOpenContract && rawProvidedDisc !== null ? rawProvidedDisc : null);
  const normDiscountReason = discountReason !== undefined ? (discountReason || '').trim() : null;
  const normCustomNightlyPrice = (customNightlyPrice !== undefined && customNightlyPrice !== null && customNightlyPrice !== '')
    ? roundMoney(customNightlyPrice) : null;
  // Policy reason applies only to a monthly early checkout; it is independent of any
  // explicit checkout discount.
  const normPolicyReason = checkoutPolicyReason !== undefined ? String(checkoutPolicyReason || '').trim() : null;

  const requestedDiscount = normDiscountAmount !== null
    ? normDiscountAmount
    : roundMoney(res.discount_amount || 0);
  // Stored rate only — finalTotalPrice from renderer is ignored for non-contract.
  const effectiveNightlyRate = roundMoney(res.custom_nightly_price || res.price_per_night || 0);

  if (!isOpenContract && (!Number.isFinite(effectiveNightlyRate) || effectiveNightlyRate <= 0)) {
    throw new Error('تعذر إتمام التسوية: سعر الليلة غير صالح (يجب أن يكون أكبر من الصفر).');
  }

  // Discount validation: a reason is required only for a discount introduced AT
  // checkout. A discount already stored on the reservation keeps whatever reason it
  // was created with — that field is optional at booking time, so requiring a reason
  // here made an unrelated stored discount block an otherwise valid checkout.
  if (!isOpenContract && hasExplicitDiscount && normDiscountAmount > 0 && !normDiscountReason) {
    throw new Error('سبب الخصم مطلوب عند تعديله أو إضافته أثناء المغادرة.');
  }

  // Compute net charge from actual stay (backend-authoritative)
  const stay = computeStaySegments(res, todayStr);
  const actualNights = stay.totalNights;
  const actualBaseCharge = stay.totalBaseCharge;
  const actualDiscount = calculateCheckoutDiscount(
    requestedDiscount,
    actualNights,
    res.check_in_date,
    res.check_out_date,
    actualBaseCharge,
    normDiscountAmount === null
  );
  const actualAccommodationNet = Math.max(0, roundMoney(actualBaseCharge - actualDiscount));

  // -------------------------------------------------------------------------
  // MONTHLY EARLY CHECKOUT: default to the FULL CONTRACT VALUE.
  //
  // 'contract' -> charge bookedNights x stored rate minus the stored discount in
  //              FULL (no proration). Unused nights are NOT refunded.
  // 'actual'   -> the Admin-only exception, which is today's actual-nights maths.
  //
  // The policy is decided HERE, in the backend, from the stored booking type and
  // the departing date. A policy/reason sent by the renderer is only honoured when
  // the IPC layer has already verified the caller is an Admin; a non-Admin caller
  // arrives here with the fields stripped, so 'actual' is unreachable for them.
  // -------------------------------------------------------------------------
  const monthlyEarly = isMonthlyEarlyCheckout(res, todayStr);
  let appliedPolicy = null;
  let policyReasonForWrite = null;
  let bookedCheckOutForWrite = null;
  let baseCharge;
  let effectiveDiscount;
  let accommodationNetTotal;

  if (isOpenContract) {
    accommodationNetTotal = (finalTotalPrice !== undefined && finalTotalPrice !== null)
      ? roundMoney(finalTotalPrice)
      : roundMoney(res.total_price || 0);
    baseCharge = accommodationNetTotal;
    effectiveDiscount = roundMoney(normDiscountAmount !== null ? normDiscountAmount : (res.discount_amount || 0));
  } else if (monthlyEarly) {
    const requested = String(checkoutPolicy || '').trim();
    if (requested && !['contract', 'actual'].includes(requested)) {
      throw new Error('سياسة المغادرة غير معروفة.');
    }
    appliedPolicy = requested === 'actual' ? 'actual' : 'contract';
    policyReasonForWrite = normPolicyReason !== null ? normPolicyReason : null;

    if (appliedPolicy === 'actual') {
      if (!policyReasonForWrite) {
        throw new Error('يرجى إدخال سبب احتساب الليالي الفعلية بدل قيمة العقد.');
      }
      baseCharge = actualBaseCharge;
      effectiveDiscount = actualDiscount;
      accommodationNetTotal = actualAccommodationNet;
    } else {
      const contract = computeContractValue(res);
      const storedTotal = roundMoney(res.total_price || 0);
      if (res.booking_type === 'حجز شهري') {
        if (Math.abs(roundMoney(contract.contractValue - storedTotal)) > 0.005) {
          throw new Error(
            `قيمة العقد المحسوبة (${contract.contractValue} ريال) لا تطابق الإجمالي المخزن (${storedTotal} ريال). ` +
            'يرجى مراجعة بيانات الحجز، أو اختيار احتساب الليالي الفعلية من قبل مدير النظام.'
          );
        }
      } else {
        const computed = roundMoney(contract.contractValue);
        if (computed > storedTotal + 0.005) {
          throw new Error(
            `تنبيه: القيمة المحسوبة للعقد (${computed} ريال) أعلى من الإجمالي المخزن (${storedTotal} ريال). ` +
            'الرجاء مراجعة الإجمالي أو استخدام الليالي الفعلية.'
          );
        }
      }
      baseCharge = contract.baseCharge;
      effectiveDiscount = contract.discountAppliedInFull;
      accommodationNetTotal = contract.contractValue;
      bookedCheckOutForWrite = res.check_out_date;
    }
  } else if (res.booking_type === 'حجز شهري') {
    const contract = computeContractValue({ ...res, discount_amount: requestedDiscount });
    baseCharge = contract.baseCharge;
    effectiveDiscount = contract.discountAppliedInFull;
    accommodationNetTotal = contract.contractValue;
    bookedCheckOutForWrite = res.check_out_date;
  } else {
    baseCharge = actualBaseCharge;
    effectiveDiscount = actualDiscount;
    accommodationNetTotal = actualAccommodationNet;
  }

  const normalizedLateCheckoutFee = isOpenContract ? 0 : roundMoney(lateCheckoutFee);
  if (!Number.isFinite(normalizedLateCheckoutFee) || normalizedLateCheckoutFee < 0) {
    throw new Error('مبلغ تأخير المغادرة يجب أن يكون صفراً أو أكبر.');
  }
  // finalTotal = accommodation net + late fee. Unchanged by the policy branch:
  // the late fee is orthogonal and applies identically under both policies.
  const finalTotal = roundMoney(accommodationNetTotal + normalizedLateCheckoutFee);

  const ledgerPaid = (res.ledger_paid_amount !== null && res.ledger_paid_amount !== undefined)
    ? Number(res.ledger_paid_amount)
    : Number(res.paid_amount || 0);
  const currentPaid = roundMoney(ledgerPaid);
  const depositLedger = getDepositLedger(targetId);
  const depositHeld = depositLedger.balance;
  if (!['refund', 'apply', 'retain'].includes(depositDisposition)) {
    throw new Error('طريقة تسوية التأمين غير معروفة.');
  }
  if (depositDisposition === 'retain' && Number(depositRetainAmount) > 0 && !String(depositRetainReason || '').trim()) {
    throw new Error('يرجى إدخال سبب الاحتفاظ بالتأمين.');
  }
  const depositApplied = depositDisposition === 'apply'
    ? roundMoney(Math.min(depositHeld, Math.max(0, finalTotal - currentPaid))) : 0;
  const requestedRetain = depositDisposition === 'retain' ? Number(depositRetainAmount || 0) : 0;
  const depositRetained = roundMoney(requestedRetain);
  if (!Number.isFinite(requestedRetain) || depositRetained < 0 || depositRetained - depositHeld > 0.005) {
    throw new Error(`المبلغ المحتفظ به يجب ألا يتجاوز التأمين المسجل (${depositHeld} ريال).`);
  }
  const depositRefunded = roundMoney(depositHeld - depositApplied - depositRetained);
  const adjustedCurrentPaid = roundMoney(currentPaid + depositApplied);
  const difference = roundMoney(finalTotal - adjustedCurrentPaid);

  // Resolve settleMode from either new or legacy fields
  // Legacy: settleAmount >= 0 means 'collect now' if > 0 else 'defer'
  let resolvedMode = settleMode;
  if (!resolvedMode) {
    if (collectAmount !== undefined) {
      resolvedMode = (roundMoney(collectAmount) > 0) ? 'collect' : 'defer';
    } else if (refundAmount !== undefined) {
      resolvedMode = 'refund';
    } else if (settleAmount !== undefined) {
      resolvedMode = roundMoney(settleAmount) > 0 ? 'collect' : 'defer';
    } else {
      // No mode provided — caller must supply one when there is a non-zero difference
      if (Math.abs(difference) > 0.005) {
        throw new Error('يرجى تحديد طريقة تسوية الحساب (تحصيل، ترحيل، أو استرداد) قبل إتمام تسجيل المغادرة.');
      }
      resolvedMode = 'defer'; // difference ≈ 0, no payment row needed
    }
  }

  // Safety net: if paid > net and mode is not refund, block the close
  if (adjustedCurrentPaid > finalTotal + 0.005 && resolvedMode !== 'refund') {
    throw new Error(
      `المبلغ المدفوع (${adjustedCurrentPaid} ريال) يتجاوز الرسوم الصافية المستحقة (${finalTotal} ريال). ` +
      'يجب اختيار "استرداد" لإتمام تسجيل المغادرة.'
    );
  }

  // Safety net: if amount due and mode is not collect or defer, block
  if (finalTotal > adjustedCurrentPaid + 0.005 && resolvedMode !== 'collect' && resolvedMode !== 'defer') {
    throw new Error(`يوجد مبلغ مستحق. (resId: ${reservationId}, mode: ${resolvedMode}, finalTotal: ${finalTotal}, paid: ${adjustedCurrentPaid}, checkin: ${res.check_in_date}, today: ${todayStr})`);
  }

  // Preserve original booked total (written once, never overwritten)
  const storedOriginal = res.original_calculated_charge;
  const originalChargeToWrite = (storedOriginal !== null && storedOriginal !== undefined)
    ? null
    : roundMoney(res.total_price || 0);

  let newPaid = adjustedCurrentPaid;
  let collectionReceiptNumber = null;
  let refundReceiptNumber = null;
  let newPaymentStatus;

  db.run("BEGIN TRANSACTION;");
  try {
    const effMethod = paymentMethod || 'نقداً';
    const actingUser = userId ? parseInt(userId, 10) : null;

    if (depositApplied > 0) {
      recordDepositMovement({
        reservationId: targetId, type: 'applied', amount: depositApplied,
        paymentMethod: depositRefundMethod, userId: actingUser,
        reason: `تسوية من التأمين على الإقامة #${targetId}`
      });
      const applyReceipt = generateReceiptNumber(targetId);
      const applyStmt = db.prepare(`
        INSERT INTO payments (receipt_number, reservation_id, amount, payment_method, payment_type, payment_date, user_id, notes)
        VALUES (?, ?, ?, 'من التأمين', 'deposit_applied', datetime('now', 'localtime'), ?, ?)
      `);
      applyStmt.run([applyReceipt, targetId, depositApplied, actingUser, `تسوية من التأمين #${targetId}`]);
      applyStmt.free();
    }
    if (depositRetained > 0) {
      const retainReason = String(depositRetainReason || '').trim();
      recordDepositMovement({
        reservationId: targetId, type: 'retained', amount: depositRetained,
        paymentMethod: depositRefundMethod, userId: actingUser,
        reason: retainReason
      });
    }
    if (depositRefunded > 0) {
      recordDepositMovement({
        reservationId: targetId, type: 'refunded', amount: depositRefunded,
        paymentMethod: depositRefundMethod, userId: actingUser,
        reason: `رد التأمين عند تسجيل المغادرة #${targetId}`
      });
    }

    if (resolvedMode === 'collect') {
      // Positive payment row: collectAmount must be > 0 and <= amount due
      const rawCollect = collectAmount !== undefined ? roundMoney(collectAmount)
        : (settleAmount !== undefined ? roundMoney(settleAmount) : (isOpenContract ? 0 : 0));
      const amountDue = roundMoney(Math.max(0, finalTotal - adjustedCurrentPaid));
      if (collectAmount !== undefined && Number(collectAmount) <= 0) {
        throw new Error('مبلغ التحصيل يجب أن يكون أكبر من الصفر.');
      }
      if (!isOpenContract && rawCollect <= 0) {
        throw new Error('مبلغ التحصيل يجب أن يكون أكبر من الصفر.');
      }
      if (roundMoney(rawCollect - amountDue) > 0.005) {
        throw new Error(`مبلغ التحصيل (${rawCollect} ريال) يتجاوز المبلغ المستحق (${amountDue} ريال).`);
      }
      if (rawCollect > 0) {
        newPaid = roundMoney(adjustedCurrentPaid + rawCollect);
        collectionReceiptNumber = generateReceiptNumber(targetId);
        // A receipt can only have one purpose label. Mark it as a late-fee payment
        // only when accommodation was already fully settled before this collection.
        // Mixed accommodation/fee collections stay checkout_settlement to avoid
        // misreporting the whole receipt as a late fee.
        const collectionType = normalizedLateCheckoutFee > 0 && adjustedCurrentPaid >= accommodationNetTotal - 0.005
          ? 'late_checkout_fee'
          : 'checkout_settlement';
        const noteText = notes || (
          normalizedLateCheckoutFee > 0
            ? `تحصيل عند المغادرة #${targetId} (يشمل مبلغ تأخير ${normalizedLateCheckoutFee} ريال)`
            : (isOpenContract ? 'سداد تصفية حساب مغادرة' : `تحصيل عند المغادرة #${targetId}`)
        );
        const ps = db.prepare(`
          INSERT INTO payments (receipt_number, reservation_id, amount, payment_method, payment_type, payment_date, user_id, notes)
          VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), ?, ?)
        `);
        ps.run([collectionReceiptNumber, targetId, rawCollect, effMethod, collectionType, actingUser, noteText]);
        ps.free();
      }
      // Status
      if (newPaid >= finalTotal - 0.005) {
        newPaymentStatus = 'مدفوع بالكامل';
      } else if (newPaid > 0) {
        newPaymentStatus = 'مدفوع جزئياً';
      } else {
        newPaymentStatus = 'غير مدفوع';
      }

    } else if (resolvedMode === 'defer') {
      // No new payment row — debt stays on account
      newPaid = adjustedCurrentPaid;
      if (finalTotal === 0 && adjustedCurrentPaid === 0) {
        newPaymentStatus = 'مدفوع بالكامل';
      } else if (adjustedCurrentPaid >= finalTotal - 0.005) {
        newPaymentStatus = 'مدفوع بالكامل';
      } else if (adjustedCurrentPaid > 0) {
        newPaymentStatus = 'مدفوع جزئياً';
      } else {
        newPaymentStatus = 'غير مدفوع';
      }

    } else if (resolvedMode === 'refund') {
      // Negative payment row — exact mechanism of cancelReservation mid-stay.
      // refundAmount must equal exactly paid - net (roundMoney both sides).
      const exactRefundDue = roundMoney(Math.max(0, adjustedCurrentPaid - finalTotal));
      const rawRefund = refundAmount !== undefined
        ? roundMoney(refundAmount)
        : exactRefundDue;

      if (rawRefund <= 0) {
        throw new Error('مبلغ الاسترداد يجب أن يكون أكبر من الصفر.');
      }
      if (currentPaid <= 0 && depositApplied <= 0) {
        throw new Error('لا يمكن تسجيل استرداد نقدي لعدم وجود دفعات مسجلة في السجل.');
      }
      if (roundMoney(Math.abs(rawRefund - exactRefundDue)) > 0.005) {
        throw new Error(
          `مبلغ الاسترداد (${rawRefund} ريال) يجب أن يساوي الفرق الفعلي المستحق (${exactRefundDue} ريال).`
        );
      }
      refundReceiptNumber = generateReceiptNumber(targetId);
      const ps = db.prepare(`
        INSERT INTO payments (receipt_number, reservation_id, amount, payment_method, payment_type, payment_date, user_id, notes)
        VALUES (?, ?, ?, ?, 'refund', datetime('now', 'localtime'), ?, ?)
      `);
      ps.run([refundReceiptNumber, targetId, -rawRefund, effMethod, actingUser,
        `استرداد - تسوية مغادرة #${targetId}`]);
      ps.free();
      newPaid = roundMoney(adjustedCurrentPaid - rawRefund);
      // After refund paid_amount == finalTotal → fully settled
      newPaymentStatus = 'مدفوع بالكامل';

    } else {
      throw new Error('طريقة تسوية الحساب غير معروفة.');
    }

    // Single UPDATE that includes checked_out_at (inside the transaction)
    // Store the amount actually applied to this completed stay so the receipt
    // and the checkout settlement use the same figures.
    const effectiveDiscountForWrite = effectiveDiscount;
    const effectiveReasonForWrite   = normDiscountReason !== null ? normDiscountReason : null;

    const stmt1 = db.prepare(`
      UPDATE reservations
      SET status = 'مكتمل',
          check_out_date = ?,
          total_price = ?,
          paid_amount = ?,
          payment_status = ?,
          payment_method = CASE WHEN ? IS NOT NULL THEN ? ELSE payment_method END,
          discount_amount = CASE WHEN ? IS NOT NULL THEN ? ELSE discount_amount END,
          discount_reason = CASE WHEN ? IS NOT NULL THEN ? ELSE discount_reason END,
          custom_nightly_price = CASE WHEN ? IS NOT NULL THEN ? ELSE custom_nightly_price END,
          late_checkout_fee = ?,
          original_calculated_charge = CASE WHEN original_calculated_charge IS NULL THEN ? ELSE original_calculated_charge END,
          checkout_policy = ?,
          checkout_policy_reason = ?,
          booked_check_out_date = ?,
          checked_out_at = datetime('now')
      WHERE id = ? AND status != 'مكتمل'
    `);

    // Preserve original reservation payment method. Only set it at checkout if the
    // reservation had zero prior payments or had no payment method set.
    const originalPaid = currentPaid;
    const updateMethod = (resolvedMode === 'collect' && (originalPaid === 0 || !res.payment_method)) ? effMethod : null;

    stmt1.run([
      todayStr, finalTotal, newPaid, newPaymentStatus,
      updateMethod, updateMethod,
      normDiscountAmount, normDiscountAmount,
      effectiveReasonForWrite, effectiveReasonForWrite,
      normCustomNightlyPrice, normCustomNightlyPrice,
      normalizedLateCheckoutFee,
      originalChargeToWrite,
      appliedPolicy,
      policyReasonForWrite,
      bookedCheckOutForWrite,
      targetId
    ]);
    stmt1.free();

    // Room → cleaning
    const stmt2 = db.prepare("UPDATE rooms SET status = 'تنظيف' WHERE id = ?");
    stmt2.run([res.room_id]);
    stmt2.free();

    db.run("COMMIT;");
  } catch (err) {
    try { db.run("ROLLBACK;"); } catch (_) {}
    throw err;
  }

  saveToFile();
  return {
    success: true,
    finalTotal,
    lateCheckoutFee: normalizedLateCheckoutFee,
    actualNights,
    baseCharge,
    discountApplied: effectiveDiscount,
    isMonthlyEarlyCheckout: monthlyEarly,
    checkoutPolicy: appliedPolicy,
    checkoutPolicyReason: policyReasonForWrite,
    bookedCheckOutDate: bookedCheckOutForWrite,
    paidAmount: newPaid,
    settleMode: resolvedMode,
    collectionReceiptNumber,
    refundReceiptNumber,
    depositApplied,
    depositRefunded,
    depositRetained,
    difference
  };
}

/**
 * Extend an active reservation stay.
 * Checks room availability for the extension period.
 * Updates check_out_date, total_price, and optionally records payment.
 */
function extendReservation({
  reservationId,
  newCheckOutDate,
  customNightlyPrice,
  discountAmount = 0,
  additionalCost,
  settleAmount = 0,
  paymentMethod = 'نقداً',
  userId = null,
  notes = 'سداد دفعة تمديد إقامة'
}) {
  const targetId = parseInt(reservationId, 10);
  if (!targetId || isNaN(targetId)) throw new Error('معرف الحجز غير صالح.');

  const res = queryOne(`
    SELECT r.*, rm.room_number, rm.type AS room_type, rm.price_per_night, g.name AS guest_name,
           (SELECT SUM(p.amount) FROM payments p WHERE p.reservation_id = r.id) AS ledger_paid_amount
    FROM reservations r
    JOIN rooms rm ON r.room_id = rm.id
    JOIN guests g ON r.guest_id = g.id
    WHERE r.id = ?
  `, [targetId]);
  if (!res) throw new Error('الحجز غير موجود.');

  if (res.status === 'ملغي' || res.status === 'ملغي جزئي') {
    throw new Error('لا يمكن تمديد حجز ملغي.');
  }
  if (res.status === 'مكتمل') {
    throw new Error('لا يمكن تمديد حجز تم تسجيل مغادرته بالكامل.');
  }
  if (res.booking_type === 'عقد مفتوح' || !res.check_out_date || res.check_out_date === 'مفتوح') {
    throw new Error('حجوزات العقود المفتوحة ليس لها تاريخ مغادرة محدد ليتم تمديدها.');
  }

  const oldCheckOut = res.check_out_date;
  const cleanNewCheckOut = (newCheckOutDate || '').trim();
  if (!cleanNewCheckOut) {
    throw new Error('يرجى تحديد تاريخ المغادرة الجديد.');
  }
  if (cleanNewCheckOut <= oldCheckOut) {
    throw new Error(`تاريخ المغادرة الجديد (${cleanNewCheckOut}) يجب أن يكون بعد تاريخ المغادرة الحالي (${oldCheckOut}).`);
  }

  // Calculate extra nights
  const dOld = new Date(oldCheckOut + 'T00:00:00');
  const dNew = new Date(cleanNewCheckOut + 'T00:00:00');
  const diffTime = dNew.getTime() - dOld.getTime();
  const extraNights = Math.round(diffTime / (1000 * 60 * 60 * 24));
  if (extraNights <= 0) {
    throw new Error('عدد الليالي الإضافية يجب أن يكون ليلة واحدة على الأقل.');
  }

  // Calculate additional cost using custom rate if specified, otherwise existing custom or room rate
  const isMonthly = res.booking_type === 'حجز شهري';
  const monthlyRate = isMonthly
    ? ((Number(res.monthly_rate_snapshot) > 0)
      ? Number(res.monthly_rate_snapshot)
      : (Number(res.monthly_price) > 0
        ? Number(res.monthly_price)
        : roundMoney((res.price_per_night || 0) * 30)))
    : null;

  const normCustomNightlyPrice = isMonthly
    ? roundMoney(res.price_per_night || 0)
    : ((customNightlyPrice !== undefined && customNightlyPrice !== null && customNightlyPrice !== '' && !isNaN(Number(customNightlyPrice)))
      ? roundMoney(customNightlyPrice)
      : ((res.custom_nightly_price !== null && res.custom_nightly_price !== undefined && !isNaN(Number(res.custom_nightly_price)))
        ? roundMoney(res.custom_nightly_price)
        : roundMoney(res.price_per_night || 0)));

  if (normCustomNightlyPrice < 0) {
    throw new Error('سعر الليلة لا يمكن أن يكون سالباً.');
  }
  // A zero nightly rate is not a free stay — it is a missing value. The Extend Stay
  // modal submits 0 when its rate box is left at zero, and that used to be stored as
  // a real rate: the extra nights were billed at 0 AND the reservation was left with
  // custom_nightly_price = 0, which froze its later checkout. Refuse it here, where
  // the mistake enters, instead of papering over it downstream.
  if (normCustomNightlyPrice <= 0) {
    throw new Error('سعر الليلة يجب أن يكون أكبر من الصفر. اترك الحقل فارغاً لاستخدام سعر الغرفة.');
  }

  const normDiscountAmount = (discountAmount !== undefined && discountAmount !== null && discountAmount !== '' && !isNaN(Number(discountAmount)))
    ? Math.max(0, roundMoney(discountAmount))
    : 0;

  let baseCost;
  if (isMonthly && monthlyRate > 0) {
    if (cleanNewCheckOut === getCalendarMonthCheckOut(oldCheckOut)) {
      baseCost = (additionalCost !== undefined && additionalCost !== null && !isNaN(Number(additionalCost)))
        ? roundMoney(additionalCost)
        : monthlyRate;
    } else if (additionalCost !== undefined && additionalCost !== null && !isNaN(Number(additionalCost))) {
      baseCost = roundMoney(additionalCost);
    } else {
      baseCost = roundMoney(extraNights * (res.price_per_night || roundMoney(monthlyRate / 30)));
    }
  } else {
    baseCost = roundMoney(extraNights * normCustomNightlyPrice);
  }

  const calculatedCost = Math.max(0, roundMoney(baseCost - normDiscountAmount));
  const calcAdditionalCost = (additionalCost !== undefined && additionalCost !== null && !isNaN(Number(additionalCost)) && (!isMonthly || cleanNewCheckOut === getCalendarMonthCheckOut(oldCheckOut)))
    ? roundMoney(additionalCost)
    : calculatedCost;

  // Check room availability for the extension period (oldCheckOut to cleanNewCheckOut)
  const conflict = queryOne(`
    SELECT r.id, g.name AS guest_name, r.check_in_date, r.check_out_date
    FROM reservations r
    JOIN guests g ON r.guest_id = g.id
    WHERE r.room_id = ?
      AND r.status = 'مؤكد'
      AND r.id != ?
      AND r.check_in_date < ?
      AND CASE
        WHEN r.booking_type = 'استخدام يومي' AND r.check_out_date = r.check_in_date
          THEN date(r.check_in_date, '+1 day')
        ELSE COALESCE(NULLIF(r.check_out_date, ''), '9999-12-31')
      END > ?
    LIMIT 1
  `, [res.room_id, targetId, cleanNewCheckOut, oldCheckOut]);

  if (conflict) {
    const conflictOut = conflict.check_out_date || 'مفتوح';
    throw new Error(`تعذر تمديد الإقامة: الغرفة رقم (${res.room_number}) محجوزة مسبقاً لنزيل آخر (${conflict.guest_name}) من تاريخ ${conflict.check_in_date} إلى ${conflictOut}.`);
  }

  const hasLedger = res.ledger_paid_amount !== null && res.ledger_paid_amount !== undefined;
  const currentPaid = roundMoney(hasLedger ? Number(res.ledger_paid_amount) : (res.paid_amount || 0));
  const currentTotal = roundMoney(res.total_price || 0);
  const newTotal = roundMoney(currentTotal + calcAdditionalCost);

  const payAmount = (settleAmount !== undefined && settleAmount !== null && !isNaN(Number(settleAmount)))
    ? roundMoney(settleAmount)
    : 0;

  if (payAmount < 0) {
    throw new Error('مبلغ السداد لا يمكن أن يكون سالباً.');
  }

  db.run("BEGIN TRANSACTION;");
  try {
    let receiptNumber = null;
    let newPaid = currentPaid;

    if (payAmount > 0) {
      newPaid = roundMoney(currentPaid + payAmount);
      receiptNumber = generateReceiptNumber(targetId);
      const payStmt = db.prepare(`
        INSERT INTO payments (receipt_number, reservation_id, amount, payment_method, payment_type, payment_date, user_id, notes)
        VALUES (?, ?, ?, ?, 'extension_payment', datetime('now', 'localtime'), ?, ?)
      `);
      payStmt.run([
        receiptNumber,
        targetId,
        payAmount,
        paymentMethod || 'نقداً',
        userId ? parseInt(userId, 10) : null,
        notes || 'سداد دفعة تمديد إقامة'
      ]);
      payStmt.free();
    }

    let newPaymentStatus = res.payment_status;
    if (newPaid >= newTotal && newTotal > 0) {
      newPaymentStatus = 'مدفوع بالكامل';
    } else if (newPaid > 0) {
      newPaymentStatus = 'مدفوع جزئياً';
    } else {
      newPaymentStatus = 'غير مدفوع';
    }

    const updatedCustomRate = res.booking_type === 'حجز شهري'
      ? res.custom_nightly_price
      : ((customNightlyPrice !== undefined && customNightlyPrice !== null && customNightlyPrice !== '' && !isNaN(Number(customNightlyPrice)))
        ? roundMoney(customNightlyPrice)
        : res.custom_nightly_price);

    const newCumulativeDiscount = roundMoney((res.discount_amount || 0) + normDiscountAmount);

    const stmt = db.prepare(`
      UPDATE reservations
      SET check_out_date = ?,
          total_price = ?,
          paid_amount = ?,
          payment_status = ?,
          custom_nightly_price = ?,
          discount_amount = ?,
          monthly_extension_amount = CASE WHEN booking_type = 'حجز شهري' THEN COALESCE(monthly_extension_amount, 0) + ? ELSE monthly_extension_amount END
      WHERE id = ?
    `);
    stmt.run([cleanNewCheckOut, newTotal, newPaid, newPaymentStatus, updatedCustomRate, newCumulativeDiscount, res.booking_type === 'حجز شهري' ? calcAdditionalCost : 0, targetId]);
    stmt.free();

    db.run("COMMIT;");
    saveToFile();

    const updatedRes = queryOne(`
      SELECT r.*, rm.room_number, rm.type AS room_type, g.name AS guest_name
      FROM reservations r
      JOIN rooms rm ON r.room_id = rm.id
      JOIN guests g ON r.guest_id = g.id
      WHERE r.id = ?
    `, [targetId]);

    return {
      success: true,
      reservation: updatedRes,
      extraNights,
      nightlyRate: normCustomNightlyPrice,
      discountAmount: normDiscountAmount,
      additionalCost: calcAdditionalCost,
      paidAmount: payAmount,
      receiptNumber
    };
  } catch (err) {
    try { db.run("ROLLBACK;"); } catch (rbErr) {}
    throw err;
  }
}

function cancelReservation(reservationId, actualDepartureDate = null, manualOverrideAmount = undefined, userId = null, refundPaymentMethod = null) {
  const targetId = parseInt(reservationId, 10);
  if (!targetId || isNaN(targetId)) throw new Error('معرف الحجز غير صالح.');

  const res = queryOne(`
    SELECT r.id, r.room_id, r.payment_method, r.check_in_date, r.check_out_date, r.total_price, r.paid_amount,
           (SELECT SUM(p.amount) FROM payments p WHERE p.reservation_id = r.id) AS ledger_paid_amount,
           r.status,
           r.custom_nightly_price,
           rm.price_per_night
    FROM reservations r
    LEFT JOIN rooms rm ON r.room_id = rm.id
    WHERE r.id = ?
  `, [targetId]);
  if (!res) throw new Error('الحجز غير موجود.');

  const today = getCurrentBusinessDate();
  if (['مكتمل', 'ملغي', 'ملغي جزئي'].includes(res.status)) {
    throw new Error('الحجز مغلق بالفعل ولا يمكن إلغاؤه.');
  }
  // Cancellation / Void is allowed before arrival or on the arrival date (immediate void of walk-in/same-day booking).
  // Once arrival day has passed (guest stayed overnight), use the checkout settlement flow so the stay keeps one lifecycle.
  const isArrivalDate = res.check_in_date >= today;
  const hasStarted = !isArrivalDate;
  if (hasStarted) {
    throw new Error('الإقامة بدأت بالفعل. استخدم تسجيل الخروج لتصفية الحساب بدلاً من إلغاء الحجز.');
  }
  const effectiveDeparture = today;
  const hasLedger = res.ledger_paid_amount !== null && res.ledger_paid_amount !== undefined;
  const paidAmount = roundMoney(hasLedger ? Number(res.ledger_paid_amount) : (res.paid_amount || 0));
  const depositLedger = getDepositLedger(targetId);
  let depositRefunded = 0;

  const lastPositivePayment = queryOne(
    "SELECT payment_method FROM payments WHERE reservation_id = ? AND amount > 0 ORDER BY id DESC LIMIT 1",
    [targetId]
  );
  const effRefundMethod = (refundPaymentMethod && typeof refundPaymentMethod === 'string' && refundPaymentMethod.trim())
    ? refundPaymentMethod.trim()
    : (lastPositivePayment?.payment_method || res.payment_method || 'نقداً');

  let proRatedCharge = 0;
  let refundDue = 0;
  let stillOwed = 0;
  let daysStayed = 0;
  let originalCalculated = null;

  db.run("BEGIN TRANSACTION;");
  try {
    if (!hasStarted) {
      // Pre-arrival or same-day void cancellation: full refund of any deposit per confirmed business policy.
      // paid_amount is reset to 0 because the entire amount was physically returned to the guest
      // and that refund is recorded as a negative ledger entry below.
      refundDue = paidAmount;
      proRatedCharge = 0;
      stillOwed = 0;

      const stmt1 = db.prepare(`
        UPDATE reservations
        SET status = 'ملغي',
            paid_amount = 0,
            payment_status = CASE WHEN ? > 0 THEN 'مستردة' ELSE payment_status END
        WHERE id = ?
      `);
      stmt1.run([paidAmount, targetId]);
      stmt1.free();

      // Record the full refund as a negative payment in the ledger so that revenue
      // reports (getDailyRevenueStats / getMonthlyRevenue / getShiftAuditReport) correctly
      // net down by the refunded amount on the day the refund is processed.
      if (refundDue > 0) {
        const refundReceiptNumber = generateReceiptNumber(targetId);
        const cancelNote = (today < res.check_in_date)
          ? 'استرداد كامل - إلغاء قبل الوصول #' + targetId
          : 'استرداد كامل - إبطال الحجز المباشر #' + targetId;
        const refundStmt = db.prepare(`
          INSERT INTO payments (receipt_number, reservation_id, amount, payment_method, payment_type, payment_date, user_id, notes)
          VALUES (?, ?, ?, ?, 'refund', datetime('now', 'localtime'), ?, ?)
        `);
        refundStmt.run([
          refundReceiptNumber,
          targetId,
          -refundDue,
          effRefundMethod,
          userId ? parseInt(userId, 10) : null,
          cancelNote
        ]);
        refundStmt.free();
      }
      // Refund only deposits whose receipt is proven in the deposit ledger.
      // Historical deposit_amount values without movements need manual reconciliation.
      depositRefunded = depositLedger.balance;
      if (depositRefunded > 0) {
        recordDepositMovement({
          reservationId: targetId, type: 'refunded', amount: depositRefunded,
          paymentMethod: effRefundMethod, userId,
          reason: `رد التأمين عند إلغاء الحجز قبل الوصول #${targetId}`
        });
      }
    } else {
      // Mid-stay cancellation: calculate pro-rated charge using segment reconciliation
      let calculatedProRated;
      try {
        const segs = computeStaySegments(res, effectiveDeparture);
        daysStayed = segs.totalNights;
        calculatedProRated = segs.totalBaseCharge;
      } catch (_) {
        const d1 = new Date(res.check_in_date + 'T00:00:00');
        const d2 = new Date(effectiveDeparture + 'T00:00:00');
        const diffTime = d2.getTime() - d1.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        daysStayed = Math.max(1, diffDays);
        const nightlyRate = roundMoney(res.custom_nightly_price || res.price_per_night || 0);
        calculatedProRated = roundMoney(daysStayed * nightlyRate);
      }

      let finalCharge = calculatedProRated;

      if (manualOverrideAmount !== undefined && manualOverrideAmount !== null && manualOverrideAmount !== '' && !isNaN(Number(manualOverrideAmount))) {
        finalCharge = Math.max(0, roundMoney(manualOverrideAmount));
        originalCalculated = calculatedProRated;
      }

      proRatedCharge = finalCharge;
      refundDue = roundMoney(Math.max(0, paidAmount - finalCharge));
      stillOwed = roundMoney(Math.max(0, finalCharge - paidAmount));

      let newPaymentStatus = 'مدفوع بالكامل';
      if (stillOwed > 0) {
        newPaymentStatus = (paidAmount > 0) ? 'مدفوع جزئياً' : 'غير مدفوع';
      } else if (refundDue > 0) {
        // The refund is recorded immediately as a negative ledger entry and paid_amount
        // is set to finalCharge, so the reservation is fully settled — not a dangling credit.
        newPaymentStatus = 'مدفوع بالكامل';
      }

      const stmt1 = db.prepare(`
        UPDATE reservations 
        SET status = 'ملغي جزئي', 
            total_price = ?,
            paid_amount = ?,
            payment_status = ?,
            check_out_date = ?,
            original_calculated_charge = ?,
            checked_out_at = datetime('now')
        WHERE id = ?
      `);
      // Preserve the amount actually received when a balance remains so it can be
      // collected later. When a refund is due, paid_amount reflects the net amount
      // kept after the negative payment is recorded below.
      const settledPaidAmount = refundDue > 0 ? finalCharge : paidAmount;
      stmt1.run([finalCharge, settledPaidAmount, newPaymentStatus, effectiveDeparture, originalCalculated, targetId]);
      stmt1.free();

      // Record the refund as a negative payment in the ledger so that all revenue
      // reports (getDailyRevenueStats / getMonthlyRevenue / getShiftAuditReport),
      // which SUM payments.amount, correctly net down by the refunded amount.
      if (refundDue > 0) {
        const refundReceiptNumber = generateReceiptNumber(targetId);
        const refundStmt = db.prepare(`
          INSERT INTO payments (receipt_number, reservation_id, amount, payment_method, payment_type, payment_date, user_id, notes)
          VALUES (?, ?, ?, ?, 'refund', datetime('now', 'localtime'), ?, ?)
        `);
        refundStmt.run([
          refundReceiptNumber,
          targetId,
          -refundDue,
          effRefundMethod,
          userId ? parseInt(userId, 10) : null,
          'استرداد نقدي - إلغاء جزئي #' + targetId
        ]);
        refundStmt.free();
      }
    }

    // Do NOT delete payment rows — payment history is fully preserved!

    // Update room status properly:
    // If room is under maintenance, do not overwrite 'صيانة'.
    // Otherwise check if another confirmed reservation actively occupies the room today.
    const roomRow = queryOne("SELECT status FROM rooms WHERE id = ?", [res.room_id]);
    if (roomRow && roomRow.status !== 'صيانة') {
      const todayStr = getCurrentBusinessDate();
      const otherCurrentlyActive = queryOne(`
        SELECT id FROM reservations 
        WHERE room_id = ? 
          AND status = 'مؤكد' 
          AND id != ?
          AND check_in_date <= ?
          AND CASE
            WHEN booking_type = 'استخدام يومي' AND check_out_date = check_in_date
              THEN date(check_in_date, '+1 day')
            ELSE COALESCE(NULLIF(check_out_date, ''), '9999-12-31')
          END > ?
        LIMIT 1
      `, [res.room_id, targetId, todayStr, todayStr]);

      if (otherCurrentlyActive) {
        const stmt2 = db.prepare("UPDATE rooms SET status = 'مشغولة' WHERE id = ?");
        stmt2.run([res.room_id]);
        stmt2.free();
      } else {
        const futureBooking = queryOne(
          "SELECT id FROM reservations WHERE room_id = ? AND status = 'مؤكد' AND id != ? AND check_in_date > ? LIMIT 1",
          [res.room_id, targetId, todayStr]
        );
        const newStatus = futureBooking ? 'محجوزة' : 'متاحة';
        const stmt2 = db.prepare("UPDATE rooms SET status = ? WHERE id = ?");
        stmt2.run([newStatus, res.room_id]);
        stmt2.free();
      }
    }

    db.run("COMMIT;");
  } catch (err) {
    try { db.run("ROLLBACK;"); } catch (rbErr) {}
    throw err;
  }

  saveToFile();
  return { 
    success: true, 
    proRatedCharge, 
    originalCalculatedCharge: originalCalculated !== null ? originalCalculated : proRatedCharge,
    refundDue, 
    stillOwed, 
    daysStayed,
    hasStarted,
    depositRefunded,
    isOverridden: originalCalculated !== null
  };
}

/**
 * Add a subsequent payment to a reservation with an atomic transaction and audit trail.
 * - Validates positive finite amount.
 * - Prevents overpayment beyond remaining balance for regular/monthly bookings.
 * - Allows negative balance (credit) for Open Contracts ('عقد مفتوح').
 * - Prevents IEEE-754 precision drift.
 * - Inserts receipt in 'payments' ledger table.
 * - Updates reservations table atomically.
 */
function addPaymentToReservation({ reservationId, amount, paymentMethod = 'نقداً', userId = null, notes = '' }) {
  const targetId = parseInt(reservationId, 10);
  if (!targetId || isNaN(targetId)) {
    throw new Error('معرف الحجز غير صالح.');
  }

  const payAmount = roundMoney(amount);
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    throw new Error('يرجى إدخال مبلغ سداد صحيح وموجب أكبر من الصفر.');
  }

  const res = queryOne(`
    SELECT r.id, r.total_price, r.paid_amount, r.payment_method, r.status, r.booking_type,
           r.check_in_date, r.check_out_date, r.custom_nightly_price, rm.price_per_night, r.discount_amount,
           (SELECT SUM(p.amount) FROM payments p WHERE p.reservation_id = r.id) AS ledger_paid_amount
    FROM reservations r
    LEFT JOIN rooms rm ON r.room_id = rm.id
    WHERE r.id = ?
  `, [targetId]);
  if (!res) {
    throw new Error('الحجز غير موجود.');
  }

  if (res.status === 'ملغي') {
    throw new Error('لا يمكن تسجيل دفعات لحجز ملغي.');
  }

  const hasLedger = res.ledger_paid_amount !== null && res.ledger_paid_amount !== undefined;
  const currentPaid = roundMoney(hasLedger ? Number(res.ledger_paid_amount) : (res.paid_amount || 0));
  const totalPrice = roundMoney(res.total_price || 0);
  const isContract = res.booking_type === 'عقد مفتوح';
  const todayStr = getCurrentBusinessDate();
  const isOverdue = res.status === 'مؤكد' && !isContract && res.check_out_date && res.check_out_date < todayStr;
  let effectiveTotalPrice = totalPrice;
  if ((isOverdue || (isContract && res.status === 'مؤكد')) && res.check_in_date) {
    try {
      const segs = computeStaySegments(res, todayStr);
      const runningTotal = Math.max(0, roundMoney(segs.totalBaseCharge - (res.discount_amount || 0)));
      effectiveTotalPrice = Math.max(totalPrice, runningTotal);
    } catch (_) {
      const nightlyRate = roundMoney(res.custom_nightly_price || res.price_per_night || 0);
      if (nightlyRate > 0) {
        const d1 = new Date(res.check_in_date + 'T00:00:00');
        const d2 = new Date(todayStr + 'T00:00:00');
        const elapsedNights = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
        const runningTotal = Math.max(0, roundMoney(elapsedNights * nightlyRate - (res.discount_amount || 0)));
        effectiveTotalPrice = Math.max(totalPrice, runningTotal);
      }
    }
  }

  let remainingBalance;
  let newRemaining;
  let isFullyPaid;
  let newPaymentStatus;

  if (isContract) {
    // Open Contract: Allow paying in advance (advance credit), skip overpayment error
    const newPaidAmount = roundMoney(currentPaid + payAmount);
    newRemaining = roundMoney(effectiveTotalPrice - newPaidAmount);

    if (newRemaining < -0.005) {
      newPaymentStatus = 'رصيد دائن';
      isFullyPaid = true;
    } else if (Math.abs(newRemaining) <= 0.005) {
      newPaymentStatus = 'مدفوع بالكامل';
      isFullyPaid = true;
    } else {
      newPaymentStatus = 'مدفوع جزئياً';
      isFullyPaid = false;
    }
  } else {
    // Normal & Monthly Bookings: Hard overpayment guard
    remainingBalance = roundMoney(Math.max(0, effectiveTotalPrice - currentPaid));

    if (remainingBalance <= 0) {
      throw new Error('الحجز مسدد بالكامل بالفعل، ولا يوجد رصيد متبقي مستحق.');
    }

    // Strict overpayment validation
    if (roundMoney(payAmount - remainingBalance) > 0.005) {
      throw new Error(`المبلغ المدفوع (${payAmount.toLocaleString()} ريال) يتجاوز الرصيد المتبقي المستحق (${remainingBalance.toLocaleString()} ريال). لا يمكن تحصيل مبالغ زائدة.`);
    }

    const newPaidAmount = roundMoney(currentPaid + payAmount);
    newRemaining = roundMoney(Math.max(0, effectiveTotalPrice - newPaidAmount));
    isFullyPaid = newRemaining <= 0.005;
    newPaymentStatus = isFullyPaid ? 'مدفوع بالكامل' : 'مدفوع جزئياً';
  }

  const newPaidAmount = roundMoney(currentPaid + payAmount);

  db.run("BEGIN TRANSACTION;");
  try {
    const receiptNumber = generateReceiptNumber(targetId);

    // 1. Insert entry into payments ledger table
    const payStmt = db.prepare(`
      INSERT INTO payments (receipt_number, reservation_id, amount, payment_method, payment_type, payment_date, user_id, notes)
      VALUES (?, ?, ?, ?, 'balance_payment', datetime('now', 'localtime'), ?, ?)
    `);
    payStmt.run([
      receiptNumber,
      targetId,
      payAmount,
      paymentMethod || 'نقداً',
      userId ? parseInt(userId, 10) : null,
      notes || 'سداد دفعة حجز'
    ]);
    payStmt.free();

    // 2. Update reservations table
    // Preserve initial reservation payment method if one was already set or paid for
    const prevPaid = currentPaid;
    const updatePayMethod = (prevPaid === 0 || !res.payment_method) ? (paymentMethod || null) : null;
    const updatedTotalPrice = isOverdue ? Math.max(totalPrice, newPaidAmount) : totalPrice;
    const resStmt = db.prepare(`
      UPDATE reservations 
      SET paid_amount = ?, 
          total_price = ?,
          payment_status = ?, 
          payment_method = CASE WHEN ? IS NOT NULL THEN ? ELSE payment_method END 
      WHERE id = ?
    `);
    resStmt.run([newPaidAmount, updatedTotalPrice, newPaymentStatus, updatePayMethod, updatePayMethod, targetId]);
    resStmt.free();

    db.run("COMMIT;");
    saveToFile();

    return {
      success: true,
      receiptNumber,
      reservationId: targetId,
      amountAdded: payAmount,
      newPaidAmount,
      totalPrice,
      remainingBalance: newRemaining,
      paymentStatus: newPaymentStatus,
      isFullyPaid
    };
  } catch (err) {
    try { db.run("ROLLBACK;"); } catch (rbErr) {}
    throw err;
  }
}

/**
 * Query complete payment ledger history for a specific reservation
 */
function getReservationPayments(reservationId) {
  const targetId = parseInt(reservationId, 10);
  if (!targetId || isNaN(targetId)) return [];

  const sql = `
    SELECT 
      p.id,
      p.receipt_number,
      p.reservation_id,
      p.amount,
      p.payment_method,
      p.payment_type,
      p.payment_date,
      p.created_at,
      p.business_date,
      p.notes,
      p.user_id,
      u.username AS staff_username
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.reservation_id = ?
    ORDER BY p.id ASC
  `;
  return queryAll(sql, [targetId]);
}

function getReservationDepositMovements(reservationId) {
  const targetId = parseInt(reservationId, 10);
  if (!targetId || isNaN(targetId)) return [];
  return queryAll(`
    SELECT dm.id, dm.reservation_id, dm.movement_type, dm.amount, dm.payment_method,
      dm.movement_date, dm.created_at, dm.business_date, dm.user_id, dm.reason, u.username AS staff_username
    FROM deposit_movements dm
    LEFT JOIN users u ON u.id = dm.user_id
    WHERE dm.reservation_id = ?
    ORDER BY dm.id ASC
  `, [targetId]);
}

/**
 * Query detailed receipt details by receipt number or payment id
 */
function getPaymentReceipt(receiptIdentifier) {
  if (!receiptIdentifier) return null;
  const sql = `
    SELECT 
      p.id,
      p.receipt_number,
      p.reservation_id,
      p.amount,
      p.payment_method,
      p.payment_type,
      p.payment_date,
      p.created_at,
      p.business_date,
      p.notes,
      r.total_price,
      r.paid_amount,
      r.payment_status,
      r.check_in_date,
      r.check_out_date,
      g.name AS guest_name,
      g.phone AS guest_phone,
      g.id_number AS guest_id_number,
      rm.room_number,
      rm.type AS room_type,
      u.username AS staff_username
    FROM payments p
    JOIN reservations r ON p.reservation_id = r.id
    JOIN guests g ON r.guest_id = g.id
    JOIN rooms rm ON r.room_id = rm.id
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.receipt_number = ? OR p.id = ?
    LIMIT 1
  `;
  return queryOne(sql, [String(receiptIdentifier), parseInt(receiptIdentifier, 10) || 0]);
}

/**
 * Excel Bulk Import: Reservations
 */
function bulkImportReservations(reservationsList) {
  let inserted = 0;
  let skipped = 0;

  db.run("BEGIN TRANSACTION;");
  try {
    for (const r of reservationsList) {
      const guestName = String(r.guest_name || r.name || r['اسم النزيل'] || r['النزيل'] || '').trim();
      const guestPhone = String(r.guest_phone || r.phone || r['رقم الجوال'] || r['الجوال'] || '').trim();
      const roomNumber = String(r.room_number || r['رقم الغرفة'] || r['الغرفة'] || '').trim();
      const checkIn = String(r.check_in_date || r['تاريخ الوصول'] || r['الوصول'] || '').trim();
      const checkOut = String(r.check_out_date || r['تاريخ المغادرة'] || r['المغادرة'] || '').trim();
      const price = roundMoney(parseFloat(r.total_price || r['السعر الإجمالي'] || r['المبلغ'] || r['الإجمالي']) || 0);
      const paid = roundMoney(parseFloat(r.paid_amount || r['المدفوع'] || r['المبلغ المدفوع']) || 0);

      if (!guestName || !checkIn || !checkOut) {
        skipped++;
        continue;
      }

      // Match Room
      let room = null;
      if (roomNumber) {
        room = queryOne("SELECT id FROM rooms WHERE room_number = ?", [roomNumber]);
      }
      if (!room) {
        room = queryOne("SELECT id FROM rooms WHERE status = 'متاحة' LIMIT 1") || queryOne("SELECT id FROM rooms LIMIT 1");
      }
      if (!room) {
        skipped++;
        continue;
      }

      // Match or create guest
      let guest = null;
      if (guestPhone) guest = queryOne("SELECT id FROM guests WHERE phone = ?", [guestPhone]);
      if (!guest) guest = queryOne("SELECT id FROM guests WHERE name = ?", [guestName]);

      let guestId;
      if (guest) {
        guestId = guest.id;
      } else {
        const gStmt = db.prepare("INSERT INTO guests (name, phone, id_number) VALUES (?, ?, ?)");
        gStmt.run([guestName, guestPhone, '']);
        gStmt.free();
        guestId = queryOne("SELECT id FROM guests ORDER BY id DESC LIMIT 1").id;
      }

      let paymentStatus = 'غير مدفوع';
      if (paid >= price && price > 0) paymentStatus = 'مدفوع بالكامل';
      else if (paid > 0) paymentStatus = 'مدفوع جزئياً';

      const resStmt = db.prepare("INSERT INTO reservations (guest_id, room_id, check_in_date, check_out_date, total_price, paid_amount, payment_status, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'مؤكد')");
      resStmt.run([guestId, room.id, checkIn, checkOut, price, paid, paymentStatus]);
      resStmt.free();
      
      if (paid > 0) {
        const newResId = queryOne("SELECT id FROM reservations ORDER BY id DESC LIMIT 1").id;
        const receiptNumber = generateReceiptNumber(newResId);
        const payStmt = db.prepare("INSERT INTO payments (receipt_number, reservation_id, amount, payment_method, payment_type, payment_date, notes) VALUES (?, ?, ?, 'تحويل بنكي', 'advance_payment', datetime('now', 'localtime'), 'رصيد مرحل من استيراد النظام القديم')");
        payStmt.run([receiptNumber, newResId, paid]);
        payStmt.free();
      }
      
      inserted++;
    }

    db.run("COMMIT;");
  } catch (err) {
    try { db.run("ROLLBACK;"); } catch (_) {}
    throw err;
  }

  saveToFile();
  return { inserted, skipped, total: reservationsList.length };
}

/**
 * Update reservation receipt and financial/guest details
 */
function updateReservationReceipt({
  reservationId,
  totalPrice,
  paidAmount,
  paymentMethod,
  guestName,
  guestPhone,
  guestIdNumber,
  discountAmount,
  discountReason,
  customNightlyPrice,
  userId = null
}) {
  const targetId = parseInt(reservationId, 10);
  if (!targetId || isNaN(targetId)) {
    throw new Error('معرف الحجز أو السند غير صالح.');
  }

  const res = queryOne(`
    SELECT r.id, r.guest_id, r.room_id, r.status, r.booking_type, r.check_in_date, r.check_out_date,
           r.total_price, r.paid_amount, r.discount_amount, r.monthly_extension_amount,
           (SELECT SUM(p.amount) FROM payments p WHERE p.reservation_id = r.id) AS ledger_paid_amount
    FROM reservations r
    WHERE r.id = ?
  `, [targetId]);
  if (!res) {
    throw new Error('الحجز غير موجود.');
  }

  const total = roundMoney(totalPrice);
  const paid = roundMoney(paidAmount);
  const isContract = res.booking_type === 'عقد مفتوح';

  const normDiscountAmount = (discountAmount !== undefined && discountAmount !== null && discountAmount !== '')
    ? Math.max(0, roundMoney(discountAmount))
    : null;
  const normDiscountReason = discountReason !== undefined ? (discountReason || '').trim() : null;
  const normCustomNightlyPrice = (customNightlyPrice !== undefined && customNightlyPrice !== null && customNightlyPrice !== '')
    ? roundMoney(customNightlyPrice)
    : null;
  const existingDiscount = roundMoney(res.discount_amount || 0);
  const monthlySnapshotToWrite = res.booking_type === 'حجز شهري'
    ? Math.max(0, roundMoney(total + (normDiscountAmount ?? existingDiscount) - Number(res.monthly_extension_amount || 0)))
    : null;

  if (normDiscountAmount > 0 && !normDiscountReason) {
    throw new Error('سبب الخصم مطلوب ولا يمكن إتمام العملية بدونه.');
  }

  if (!isContract) {
    if (res.booking_type !== 'حجز شهري' && normCustomNightlyPrice !== null && res.check_in_date && res.check_out_date && res.check_out_date !== '—' && res.check_out_date !== 'ـ') {
      const [sy, sm, sd] = res.check_in_date.slice(0, 10).split('-').map(Number);
      const [ey, em, ed] = res.check_out_date.slice(0, 10).split('-').map(Number);
      const sUtc = Date.UTC(sy, sm - 1, sd);
      const eUtc = Date.UTC(ey, em - 1, ed);
      if (eUtc > sUtc) {
        const nights = Math.round((eUtc - sUtc) / 86400000);
        const expectedTotal = roundMoney((nights * normCustomNightlyPrice) - (normDiscountAmount || 0));
        if (Math.abs(expectedTotal - total) > 0.005) {
           throw new Error(`السعر اليومي المخصص (${normCustomNightlyPrice}) يتناقض مع الإجمالي (${total}). الإجمالي المتوقع هو ${expectedTotal}.`);
        }
      }
    }
    if (total < 0) {
      throw new Error('إجمالي قيمة الحجز لا يمكن أن يكون سالباً.');
    }
    if (total === 0 && (normDiscountAmount === null || normDiscountAmount === 0)) {
      throw new Error('إجمالي قيمة الحجز يجب أن يكون أكبر من الصفر.');
    }
    if (roundMoney(paid - total) > 0.005) {
      throw new Error(`المبلغ المدفوع (${paid} ريال) لا يمكن أن يتجاوز إجمالي قيمة الحجز (${total} ريال).`);
    }
  } else {
    if (total < 0) {
      throw new Error('إجمالي قيمة الحجز لا يمكن أن يكون سالباً.');
    }
  }

  if (paid < 0) {
    throw new Error('المبلغ المدفوع لا يمكن أن يكون سالباً.');
  }

  const cleanPhone = (guestPhone || '').trim();
  if (cleanPhone && !/^05\d{8}$/.test(cleanPhone)) {
    throw new Error('رقم الجوال غير صحيح: يجب أن يبدأ بـ 05 ويتكون من 10 أرقام.');
  }

  const cleanId = (guestIdNumber || '').trim();
  if (cleanId && !/^(?:\d{10}|[a-zA-Z0-9]{6,9})$/i.test(cleanId)) {
    throw new Error('رقم الهوية الوطنية أو الإقامة (10 أرقام) أو جواز السفر (6 إلى 9 خانات) غير صحيح.');
  }

  let paymentStatus = 'غير مدفوع';
  if (isContract) {
    if (paid > total) {
      paymentStatus = 'رصيد دائن';
    } else if (paid === total && total > 0) {
      paymentStatus = 'مدفوع بالكامل';
    } else if (paid > 0) {
      paymentStatus = 'مدفوع جزئياً';
    }
  } else {
    if (paid >= total && total > 0) {
      paymentStatus = 'مدفوع بالكامل';
    } else if (paid > 0) {
      paymentStatus = 'مدفوع جزئياً';
    }
  }

  const method = paymentMethod || 'نقداً';

  db.run("BEGIN TRANSACTION;");
  try {
    // 1. Update reservations table
    const updateResStmt = db.prepare(`
      UPDATE reservations 
      SET total_price = ?, 
          paid_amount = ?, 
          payment_method = ?, 
          payment_status = ?,
          discount_amount = CASE WHEN ? IS NOT NULL THEN ? ELSE discount_amount END,
          discount_reason = CASE WHEN ? IS NOT NULL THEN ? ELSE discount_reason END,
          custom_nightly_price = CASE WHEN ? IS NOT NULL THEN ? ELSE custom_nightly_price END,
          monthly_rate_snapshot = CASE WHEN ? IS NOT NULL THEN ? ELSE monthly_rate_snapshot END
      WHERE id = ?
    `);
    updateResStmt.run([
      total, 
      paid, 
      method, 
      paymentStatus, 
      normDiscountAmount,
      normDiscountAmount,
      normDiscountReason,
      normDiscountReason,
      normCustomNightlyPrice,
      normCustomNightlyPrice,
      monthlySnapshotToWrite,
      monthlySnapshotToWrite,
      targetId
    ]);
    updateResStmt.free();

    // 2. Insert delta adjustment if the paid amount was manually changed
    const hasLedger = res.ledger_paid_amount !== null && res.ledger_paid_amount !== undefined;
    const previousPaid = roundMoney(hasLedger ? Number(res.ledger_paid_amount) : (res.paid_amount || 0));
    const delta = roundMoney(paid - previousPaid);
    if (Math.abs(delta) > 0.005) {
      const receiptNumber = generateReceiptNumber(targetId);
      const isRefund = delta < 0;
      const paymentType = isRefund ? 'refund' : 'balance_payment';
      const actingUserId = userId ? parseInt(userId, 10) : null;
      const insertPayStmt = db.prepare(`
        INSERT INTO payments (receipt_number, reservation_id, amount, payment_method, payment_type, payment_date, user_id, notes)
        VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), ?, ?)
      `);
      insertPayStmt.run([
        receiptNumber, 
        targetId, 
        delta, // Will be negative if it's a refund
        method, 
        paymentType,
        actingUserId,
        'تسوية رصيد من نافذة تعديل السند'
      ]);
      insertPayStmt.free();
    }

    // 3. Update guest information if changed
    if (res.guest_id) {
      const currentGuest = queryOne("SELECT name, phone, id_number FROM guests WHERE id = ?", [res.guest_id]);
      if (currentGuest) {
        const newName = (guestName && guestName.trim()) ? guestName.trim() : currentGuest.name;
        const newPhone = cleanPhone || currentGuest.phone;
        const newId = cleanId || currentGuest.id_number;
        const guestChanged = newName !== currentGuest.name || newPhone !== currentGuest.phone || newId !== currentGuest.id_number;
        if (guestChanged) {
          const usageCount = queryOne("SELECT COUNT(*) AS count FROM reservations WHERE guest_id = ?", [res.guest_id])?.count || 0;
          if (usageCount > 1) {
            // Fork guest record for this reservation so older reservations maintain historical integrity
            const newGuestStmt = db.prepare("INSERT INTO guests (name, phone, id_number) VALUES (?, ?, ?)");
            newGuestStmt.run([newName, newPhone, newId]);
            newGuestStmt.free();
            const newGuestId = queryOne("SELECT last_insert_rowid() AS id").id;
            const updateResGuest = db.prepare("UPDATE reservations SET guest_id = ? WHERE id = ?");
            updateResGuest.run([newGuestId, targetId]);
            updateResGuest.free();
          } else {
            const updateGuestStmt = db.prepare("UPDATE guests SET name = ?, phone = ?, id_number = ? WHERE id = ?");
            updateGuestStmt.run([newName, newPhone, newId, res.guest_id]);
            updateGuestStmt.free();
          }
        }
      }
    }

    db.run("COMMIT;");
    saveToFile();

    return { success: true, reservationId: targetId };
  } catch (err) {
    try { db.run("ROLLBACK;"); } catch (rbErr) {}
    throw err;
  }
}

/**
 * Phase 1: Room Transfer Functions (Rate-Preserving Transfers)
 */

/**
 * Shared helper for Room Transfer validation and evaluation (Phase 1).
 * Validates reservation stay context and evaluates target room eligibility, collisions, and pricing rules.
 */
function validateTransferEligibility(reservationInput, targetRoomInput = null, options = {}) {
  const {
    throwOnError = true,
    userRole = 'Staff',
    mode = 'keep_rate',
    customRate = null
  } = options;

  let stay = null;
  if (reservationInput && reservationInput.isResolvedStayContext) {
    stay = reservationInput;
  } else {
    const targetId = parseInt(reservationInput, 10);
    if (!targetId || isNaN(targetId)) throw new Error('معرف الحجز غير صالح.');

    const res = queryOne(`
      SELECT r.*, rm.room_number, rm.type AS room_type, rm.price_per_night, rm.monthly_price, g.name AS guest_name
      FROM reservations r
      JOIN rooms rm ON r.room_id = rm.id
      JOIN guests g ON r.guest_id = g.id
      WHERE r.id = ?
    `, [targetId]);
    if (!res) throw new Error('الحجز غير موجود.');

    // Rule 4: status='مؤكد', checked_out_at IS NULL, check_in_date <= current business date. Reject day-use.
    if (res.status !== 'مؤكد') throw new Error('لا يمكن نقل غرفة لحجز غير مؤكد أو مغلق.');
    if (res.checked_out_at) throw new Error('لا يمكن نقل غرفة لحجز تم تسجيل خروجه بالفعل.');
    if (res.booking_type === 'استخدام يومي') throw new Error('حجوزات الاستخدام اليومي غير قابلة لنقل الغرفة في المرحلة الحالية.');

    const today = getCurrentBusinessDate();
    if (res.check_in_date > today) throw new Error('لم تبدأ فترة إقامة هذا الحجز بعد.');

    const pinnedRate = roundMoney(res.custom_nightly_price || res.price_per_night || 0);

    const isMonthly = res.booking_type === 'حجز شهري';
    const currentRoomListPrice = roundMoney(res.price_per_night || 0);
    const currentRoomMonthlyPrice = isMonthly
      ? roundMoney(Number(res.monthly_rate_snapshot) > 0 ? Number(res.monthly_rate_snapshot) : (res.monthly_price || res.price_per_night * 30 || 0))
      : null;

    // Upgrade check: new list price > max(pinned rate, list price of the stay's original room)
    const firstTransfer = queryOne(`
      SELECT from_room_id FROM reservation_transfers
      WHERE reservation_id = ?
      ORDER BY id ASC LIMIT 1
    `, [targetId]);
    const originalRoomId = firstTransfer ? firstTransfer.from_room_id : res.room_id;
    const originalRoom = queryOne("SELECT price_per_night, monthly_price FROM rooms WHERE id = ?", [originalRoomId]);
    const originalRoomListPrice = originalRoom ? roundMoney(originalRoom.price_per_night || 0) : roundMoney(res.price_per_night || 0);
    const originalRoomMonthlyPrice = originalRoom ? roundMoney(originalRoom.monthly_price || originalRoom.price_per_night * 30 || 0) : (currentRoomMonthlyPrice || 0);
    const upgradeThreshold = Math.max(pinnedRate, originalRoomListPrice);
    const upgradeMonthlyThreshold = Math.max(currentRoomMonthlyPrice || 0, originalRoomMonthlyPrice);

    const isContract = res.booking_type === 'عقد مفتوح' || !res.check_out_date || res.check_out_date === 'مفتوح';
    const effectiveStayEnd = isContract ? '9999-12-31' : res.check_out_date;

    const lastTransfer = queryOne(`
      SELECT transfer_business_date FROM reservation_transfers
      WHERE reservation_id = ?
      ORDER BY id DESC LIMIT 1
    `, [targetId]);
    const segmentStartDate = lastTransfer?.transfer_business_date || res.check_in_date;
    const segmentNights = Math.max(0, countNights(segmentStartDate, today));

    let segmentRevenue = 0;
    if (isContract) {
      segmentRevenue = roundMoney(segmentNights * pinnedRate);
    } else {
      const bookedNights = Math.max(1, countNights(res.check_in_date, res.check_out_date));
      segmentRevenue = roundMoney(((res.total_price || 0) * segmentNights) / bookedNights);
    }

    const remainingNights = isContract ? null : Math.max(0, countNights(today, res.check_out_date));

    stay = {
      isResolvedStayContext: true,
      res,
      today,
      pinnedRate,
      originalRoomListPrice,
      upgradeThreshold,
      isMonthly,
      currentRoomListPrice,
      currentRoomMonthlyPrice,
      upgradeMonthlyThreshold,
      isContract,
      effectiveStayEnd,
      segmentStartDate,
      segmentNights,
      segmentRevenue,
      remainingNights
    };

    if (targetRoomInput === null || targetRoomInput === undefined) {
      return stay;
    }
  }

  // Validate target room
  let targetRoom = null;
  if (typeof targetRoomInput === 'object' && targetRoomInput !== null && targetRoomInput.id) {
    targetRoom = targetRoomInput;
  } else {
    const roomId = parseInt(targetRoomInput, 10);
    if (!roomId || isNaN(roomId)) {
      if (throwOnError) throw new Error('يرجى تحديد الغرفة البديلة المراد النقل إليها.');
      return { eligible: false, error: 'يرجى تحديد الغرفة البديلة المراد النقل إليها.' };
    }
    if (roomId === stay.res.room_id) {
      if (throwOnError) throw new Error('لا يمكن النقل إلى نفس الغرفة الحالية.');
      return { eligible: false, error: 'لا يمكن النقل إلى نفس الغرفة الحالية.' };
    }
    targetRoom = queryOne("SELECT * FROM rooms WHERE id = ?", [roomId]);
    if (!targetRoom) {
      if (throwOnError) throw new Error('الغرفة المحددة غير موجودة.');
      return { eligible: false, error: 'الغرفة المحددة غير موجودة.' };
    }
  }

  if (targetRoom.id === stay.res.room_id) {
    if (throwOnError) throw new Error('لا يمكن النقل إلى نفس الغرفة الحالية.');
    return { eligible: false, error: 'لا يمكن النقل إلى نفس الغرفة الحالية.' };
  }

  // Rule 3: Target room must be 'متاحة' or 'محجوزة'. Reject 'تنظيف' and 'صيانة'.
  if (targetRoom.status === 'تنظيف') {
    if (throwOnError) throw new Error('الغرفة المحددة تحت التنظيف حالياً وغير جاهزة للسكن.');
    return { eligible: false, error: 'الغرفة المحددة تحت التنظيف حالياً وغير جاهزة للسكن.' };
  }
  if (targetRoom.status === 'صيانة') {
    if (throwOnError) throw new Error('الغرفة المحددة تحت الصيانة حالياً ولا يمكن التسكين فيها.');
    return { eligible: false, error: 'الغرفة المحددة تحت الصيانة حالياً ولا يمكن التسكين فيها.' };
  }
  if (targetRoom.status !== 'متاحة' && targetRoom.status !== 'محجوزة') {
    const err = `حالة الغرفة (${targetRoom.status}) لا تسمح بالنقل إليها.`;
    if (throwOnError) throw new Error(err);
    return { eligible: false, error: err };
  }

  // Active reservation check on target room (any status='مؤكد' with check_in_date <= today)
  const activeOccupant = queryOne(`
    SELECT id FROM reservations
    WHERE room_id = ? AND status = 'مؤكد' AND check_in_date <= ?
    LIMIT 1
  `, [targetRoom.id, stay.today]);
  if (activeOccupant) {
    const err = `الغرفة رقم (${targetRoom.room_number}) مشغولة بنزيل حالي أو متأخر عن المغادرة (حجز #${activeOccupant.id}).`;
    if (throwOnError) throw new Error(err);
    return { eligible: false, error: err };
  }

  // Future-overlap check (NULL/''/'مفتوح' treated as 9999-12-31)
  const futureConflict = queryOne(`
    SELECT id, check_in_date, check_out_date FROM reservations
    WHERE room_id = ?
      AND status = 'مؤكد'
      AND check_in_date > ?
      AND check_in_date < ?
    LIMIT 1
  `, [targetRoom.id, stay.today, stay.effectiveStayEnd]);
  if (futureConflict) {
    const fOut = futureConflict.check_out_date || 'مفتوح';
    const err = `تعذر النقل: الغرفة رقم (${targetRoom.room_number}) محجوزة مسبقاً (حجز #${futureConflict.id} من ${futureConflict.check_in_date} إلى ${fOut}).`;
    if (throwOnError) throw new Error(err);
    return { eligible: false, error: err };
  }

  const validMode = ['keep_rate', 'upgrade_pay_difference', 'custom_rate'].includes(mode) ? mode : 'keep_rate';

  if (mode && !['keep_rate', 'upgrade_pay_difference', 'custom_rate'].includes(mode)) {
    const err = 'نمط النقل غير صالح.';
    if (throwOnError) throw new Error(err);
    return { eligible: false, error: err };
  }

  const newRoomListPrice = roundMoney(targetRoom.price_per_night || 0);
  const newRoomMonthlyPrice = roundMoney(Number(targetRoom.monthly_price) > 0 ? Number(targetRoom.monthly_price) : (targetRoom.price_per_night * 30 || 0));

  let isUpgrade, isDowngrade, isEqualPrice;
  if (stay.isMonthly) {
    const curMonthly = stay.currentRoomMonthlyPrice || 0;
    const threshMonthly = stay.upgradeMonthlyThreshold || curMonthly;
    isUpgrade = newRoomMonthlyPrice > threshMonthly;
    isDowngrade = newRoomMonthlyPrice < curMonthly;
    isEqualPrice = !isUpgrade && !isDowngrade;
  } else {
    isDowngrade = newRoomListPrice < stay.pinnedRate;
    isUpgrade = newRoomListPrice > stay.upgradeThreshold;
    isEqualPrice = !isUpgrade && !isDowngrade;
  }

  // Downgrade check (blocked for all in Phase 2)
  if (isDowngrade) {
    const err = 'تخفيض فئة الغرفة (سعر أقل) غير مدعوم حالياً.';
    if (throwOnError) throw new Error(err);
    return { eligible: false, error: err };
  }

  let newRate = stay.pinnedRate;
  let rateDelta = 0;
  let monthlyDelta = 0;
  let totalDelta = 0;
  let newTotalPrice = roundMoney(stay.res.total_price || 0);
  let requiresAdmin = false;

  const remNights = stay.isContract ? 0 : Math.max(0, stay.remainingNights || 0);

  if (validMode === 'keep_rate') {
    newRate = stay.pinnedRate;
    rateDelta = 0;
    monthlyDelta = 0;
    totalDelta = 0;
    newTotalPrice = roundMoney(stay.res.total_price || 0);
    requiresAdmin = isUpgrade;

    if (isUpgrade && userRole !== 'Admin') {
      const err = 'ترقية الغرفة (سعر أعلى) مع تثبيت السعر الحالي تتطلب صلاحية مدير النظام (Admin).';
      if (throwOnError) throw new Error(err);
      return { eligible: false, error: err };
    }
  } else if (validMode === 'upgrade_pay_difference') {
    requiresAdmin = false;
    if (stay.isMonthly) {
      if (Number(stay.res.monthly_extension_amount || 0) > 0) {
        const err = 'ترقية الغرفة مع دفع الفارق غير مسموحة عند وجود تمديد شهري مسبق.';
        if (throwOnError) throw new Error(err);
        return { eligible: false, error: err };
      }
      const bookedNights = Math.max(1, countNights(stay.res.check_in_date, stay.res.check_out_date));
      monthlyDelta = Math.max(0, roundMoney(newRoomMonthlyPrice - (stay.currentRoomMonthlyPrice || 0)));
      rateDelta = roundMoney(monthlyDelta / bookedNights);
      totalDelta = roundMoney((monthlyDelta * remNights) / bookedNights);
      newTotalPrice = roundMoney((stay.res.total_price || 0) + totalDelta);
      newRate = roundMoney(newRoomMonthlyPrice / bookedNights);
    } else if (stay.isContract) {
      const listDelta = Math.max(0, roundMoney(newRoomListPrice - stay.currentRoomListPrice));
      newRate = roundMoney(stay.pinnedRate + listDelta);
      rateDelta = roundMoney(newRate - stay.pinnedRate);
      totalDelta = 0;
      newTotalPrice = roundMoney(stay.res.total_price || 0);
    } else {
      const listDelta = Math.max(0, roundMoney(newRoomListPrice - stay.currentRoomListPrice));
      newRate = roundMoney(stay.pinnedRate + listDelta);
      rateDelta = roundMoney(newRate - stay.pinnedRate);
      totalDelta = roundMoney(rateDelta * remNights);
      newTotalPrice = roundMoney((stay.res.total_price || 0) + totalDelta);
    }
  } else if (validMode === 'custom_rate') {
    requiresAdmin = true;
    if (userRole !== 'Admin') {
      const err = 'تحديد سعر مخصص للنقل يتطلب صلاحية مدير النظام (Admin).';
      if (throwOnError) throw new Error(err);
      return { eligible: false, error: err };
    }

    const parsedCustomRate = (customRate !== null && customRate !== undefined && customRate !== '')
      ? roundMoney(Number(customRate)) : null;
    if (parsedCustomRate === null || !Number.isFinite(parsedCustomRate) || parsedCustomRate <= 0) {
      const err = 'سعر الليلة المخصص غير صالح (يجب أن يكون أكبر من الصفر).';
      if (throwOnError) throw new Error(err);
      return { eligible: false, error: err };
    }

    newRate = parsedCustomRate;
    rateDelta = roundMoney(newRate - stay.pinnedRate);
    totalDelta = stay.isContract ? 0 : roundMoney(rateDelta * remNights);
    newTotalPrice = stay.isContract ? roundMoney(stay.res.total_price || 0) : roundMoney((stay.res.total_price || 0) + totalDelta);
  }

  return {
    eligible: true,
    targetRoom,
    newRoomListPrice,
    newRoomMonthlyPrice,
    monthlyDelta,
    mode: validMode,
    newRate,
    rateDelta,
    totalDelta,
    newTotalPrice,
    remainingNights: stay.remainingNights,
    isUpgrade,
    isDowngrade,
    isEqualPrice,
    requiresAdmin,
    isMonthlyMismatch: false,
    roomData: {
      id: targetRoom.id,
      room_number: targetRoom.room_number,
      type: targetRoom.type,
      price_per_night: newRoomListPrice,
      monthly_price: newRoomMonthlyPrice,
      displayPrice: stay.isMonthly ? newRoomMonthlyPrice : newRoomListPrice,
      priceUnit: stay.isMonthly ? 'شهر' : 'يوم',
      status: targetRoom.status,
      pinnedRate: stay.pinnedRate,
      mode: validMode,
      newRate,
      rateDelta,
      monthlyDelta,
      totalDelta,
      newTotalPrice,
      isUpgrade,
      isDowngrade,
      isEqualPrice,
      requiresAdmin
    }
  };
}

function getTransferEligibleRooms(reservationId) {
  const stay = validateTransferEligibility(reservationId);
  const allRooms = queryAll("SELECT * FROM rooms WHERE id != ? ORDER BY CAST(room_number AS INTEGER) ASC, room_number ASC", [stay.res.room_id]);
  const eligibleRooms = [];

  for (const room of allRooms) {
    // 1. Target room status: Reject 'تنظيف' and 'صيانة'. Must be 'متاحة' or 'محجوزة'
    if (room.status === 'تنظيف' || room.status === 'صيانة') continue;
    if (room.status !== 'متاحة' && room.status !== 'محجوزة') continue;

    // 2. Active occupant check on target room
    const activeOccupant = queryOne(`
      SELECT id FROM reservations
      WHERE room_id = ? AND status = 'مؤكد' AND check_in_date <= ?
      LIMIT 1
    `, [room.id, stay.today]);
    if (activeOccupant) continue;

    // 3. Future conflict check
    const futureConflict = queryOne(`
      SELECT id, check_in_date, check_out_date FROM reservations
      WHERE room_id = ?
        AND status = 'مؤكد'
        AND check_in_date > ?
        AND check_in_date < ?
      LIMIT 1
    `, [room.id, stay.today, stay.effectiveStayEnd]);
    if (futureConflict) continue;

    const newRoomListPrice = roundMoney(room.price_per_night || 0);
    const newRoomMonthlyPrice = roundMoney(Number(room.monthly_price) > 0 ? Number(room.monthly_price) : (room.price_per_night * 30 || 0));

    let isUpgrade, isDowngrade, isEqualPrice;
    if (stay.isMonthly) {
      const curMonthly = stay.currentRoomMonthlyPrice || 0;
      const threshMonthly = stay.upgradeMonthlyThreshold || curMonthly;
      isUpgrade = newRoomMonthlyPrice > threshMonthly;
      isDowngrade = newRoomMonthlyPrice < curMonthly;
      isEqualPrice = !isUpgrade && !isDowngrade;
    } else {
      isDowngrade = newRoomListPrice < stay.pinnedRate;
      isUpgrade = newRoomListPrice > stay.upgradeThreshold;
      isEqualPrice = !isUpgrade && !isDowngrade;
    }

    const hasMonthlyExtension = stay.isMonthly && Number(stay.res.monthly_extension_amount || 0) > 0;
    const defaultMode = (isUpgrade && !hasMonthlyExtension) ? 'upgrade_pay_difference' : 'keep_rate';
    const remNights = stay.isContract ? 0 : Math.max(0, stay.remainingNights || 0);

    let newRate = stay.pinnedRate;
    let rateDelta = 0;
    let monthlyDelta = 0;
    let totalDelta = 0;
    let newTotalPrice = roundMoney(stay.res.total_price || 0);
    const requiresAdmin = isUpgrade && (defaultMode === 'keep_rate');

    if (defaultMode === 'upgrade_pay_difference') {
      if (stay.isMonthly) {
        const bookedNights = Math.max(1, countNights(stay.res.check_in_date, stay.res.check_out_date));
        monthlyDelta = Math.max(0, roundMoney(newRoomMonthlyPrice - (stay.currentRoomMonthlyPrice || 0)));
        rateDelta = roundMoney(monthlyDelta / bookedNights);
        totalDelta = roundMoney((monthlyDelta * remNights) / bookedNights);
        newTotalPrice = roundMoney((stay.res.total_price || 0) + totalDelta);
        newRate = roundMoney(newRoomMonthlyPrice / bookedNights);
      } else if (stay.isContract) {
        const listDelta = Math.max(0, roundMoney(newRoomListPrice - stay.currentRoomListPrice));
        newRate = roundMoney(stay.pinnedRate + listDelta);
        rateDelta = roundMoney(newRate - stay.pinnedRate);
        totalDelta = 0;
        newTotalPrice = roundMoney(stay.res.total_price || 0);
      } else {
        const listDelta = Math.max(0, roundMoney(newRoomListPrice - stay.currentRoomListPrice));
        newRate = roundMoney(stay.pinnedRate + listDelta);
        rateDelta = roundMoney(newRate - stay.pinnedRate);
        totalDelta = roundMoney(rateDelta * remNights);
        newTotalPrice = roundMoney((stay.res.total_price || 0) + totalDelta);
      }
    }

    eligibleRooms.push({
      id: room.id,
      room_number: room.room_number,
      type: room.type,
      price_per_night: newRoomListPrice,
      monthly_price: newRoomMonthlyPrice,
      displayPrice: stay.isMonthly ? newRoomMonthlyPrice : newRoomListPrice,
      priceUnit: stay.isMonthly ? 'شهر' : 'يوم',
      status: room.status,
      pinnedRate: stay.pinnedRate,
      currentMonthlyRate: stay.currentRoomMonthlyPrice,
      mode: defaultMode,
      newRate,
      rateDelta,
      monthlyDelta,
      totalDelta,
      newTotalPrice,
      isUpgrade,
      isDowngrade,
      isEqualPrice,
      requiresAdmin
    });
  }

  return {
    reservation: {
      id: stay.res.id,
      guest_name: stay.res.guest_name,
      current_room_id: stay.res.room_id,
      current_room_number: stay.res.room_number,
      current_room_type: stay.res.room_type,
      check_in_date: stay.res.check_in_date,
      check_out_date: stay.res.check_out_date,
      booking_type: stay.res.booking_type,
      pinnedRate: stay.pinnedRate,
      currentMonthlyRate: stay.currentRoomMonthlyPrice,
      isContract: stay.isContract,
      isMonthly: stay.isMonthly
    },
    eligibleRooms
  };
}

function previewRoomTransfer({
  reservationId,
  targetRoomId,
  userRole = 'Staff',
  mode = 'keep_rate',
  customRate = null
}) {
  const stay = validateTransferEligibility(reservationId);
  const evalResult = validateTransferEligibility(stay, targetRoomId, {
    throwOnError: true,
    userRole,
    mode,
    customRate
  });

  return {
    reservationId: stay.res.id,
    guestName: stay.res.guest_name,
    currentRoomId: stay.res.room_id,
    currentRoomNumber: stay.res.room_number,
    currentRoomType: stay.res.room_type,
    targetRoomId: evalResult.targetRoom.id,
    targetRoomNumber: evalResult.targetRoom.room_number,
    targetRoomType: evalResult.targetRoom.type,
    pinnedRate: stay.pinnedRate,
    targetRoomListPrice: evalResult.newRoomListPrice,
    targetRoomMonthlyPrice: evalResult.newRoomMonthlyPrice,
    currentRoomMonthlyPrice: stay.currentRoomMonthlyPrice,
    displayPrice: stay.isMonthly ? evalResult.newRoomMonthlyPrice : evalResult.newRoomListPrice,
    priceUnit: stay.isMonthly ? 'شهر' : 'يوم',
    mode: evalResult.mode,
    newRate: evalResult.newRate,
    rateDelta: evalResult.rateDelta,
    monthlyDelta: evalResult.monthlyDelta,
    totalDelta: evalResult.totalDelta,
    oldTotalPrice: roundMoney(stay.res.total_price || 0),
    newTotalPrice: evalResult.newTotalPrice,
    paidAmount: roundMoney(stay.res.paid_amount || 0),
    segmentStartDate: stay.segmentStartDate,
    segmentNights: stay.segmentNights,
    segmentRevenue: stay.segmentRevenue,
    remainingNights: stay.remainingNights,
    isUpgrade: evalResult.isUpgrade,
    requiresAdmin: evalResult.requiresAdmin,
    isContract: stay.isContract,
    isMonthly: stay.isMonthly,
    userRole
  };
}

function executeRoomTransfer({
  reservationId,
  targetRoomId,
  reasonCategory = 'other',
  reasonDetails = '',
  userId = null,
  userRole = 'Staff',
  mode = 'keep_rate',
  customRate = null
}) {
  const stay = validateTransferEligibility(reservationId);
  const evalResult = validateTransferEligibility(stay, targetRoomId, {
    throwOnError: true,
    userRole,
    mode,
    customRate
  });
  const targetRoom = evalResult.targetRoom;

  // Resolve custom_nightly_price to store on reservations
  const customNightlyPriceToWrite = (stay.isMonthly && evalResult.mode === 'upgrade_pay_difference')
    ? null
    : ((evalResult.newRate !== evalResult.newRoomListPrice)
        ? evalResult.newRate
        : (stay.res.custom_nightly_price !== null && stay.res.custom_nightly_price !== undefined ? evalResult.newRate : null));

  let monthlySnapshotToWrite = stay.res.monthly_rate_snapshot;
  if (stay.isMonthly) {
    const currentSnapshot = (stay.res.monthly_rate_snapshot !== null && Number(stay.res.monthly_rate_snapshot) > 0)
      ? Number(stay.res.monthly_rate_snapshot)
      : (Number(stay.res.monthly_price) > 0
          ? Number(stay.res.monthly_price)
          : Math.max(0, roundMoney((stay.res.total_price || 0) + (stay.res.discount_amount || 0) - Number(stay.res.monthly_extension_amount || 0))));
    monthlySnapshotToWrite = roundMoney(currentSnapshot + evalResult.totalDelta);
  }

  const fromMonthlyPrice = stay.isMonthly ? roundMoney(stay.currentRoomMonthlyPrice || 0) : null;
  const toMonthlyPrice = stay.isMonthly ? roundMoney(evalResult.newRoomMonthlyPrice || 0) : null;

  const activeUserId = userId ? parseInt(userId, 10) : null;
  const validReasonCategory = ['maintenance', 'guest_request', 'noise_complaint', 'administrative', 'other'].includes(reasonCategory)
    ? reasonCategory
    : 'other';
  const cleanReasonDetails = (reasonDetails || '').trim();

  // Rule 6: BEGIN / COMMIT / ROLLBACK, saveToFile() only after COMMIT
  db.run("BEGIN TRANSACTION;");
  try {
    // Old room: always set to 'تنظيف' via direct SQL (like checkout)
    const stmtOldRoom = db.prepare("UPDATE rooms SET status = 'تنظيف' WHERE id = ?");
    stmtOldRoom.run([stay.res.room_id]);
    stmtOldRoom.free();

    // Update reservation room_id, custom_nightly_price, total_price, monthly_rate_snapshot, and payment_status
    const stmtRes = db.prepare(`
      UPDATE reservations
      SET room_id = ?,
          custom_nightly_price = ?,
          total_price = ?,
          monthly_rate_snapshot = CASE
            WHEN booking_type = 'حجز شهري' THEN ?
            ELSE monthly_rate_snapshot
          END,
          payment_status = CASE
            WHEN paid_amount >= ? THEN 'مدفوع بالكامل'
            WHEN paid_amount > 0 THEN 'مدفوع جزئياً'
            ELSE 'غير مدفوع'
          END
      WHERE id = ?
    `);
    stmtRes.run([
      targetRoom.id,
      customNightlyPriceToWrite,
      evalResult.newTotalPrice,
      monthlySnapshotToWrite,
      evalResult.newTotalPrice,
      stay.res.id
    ]);
    stmtRes.free();

    // Insert into reservation_transfers (with from_rate, transfer_mode, from_monthly_price, to_monthly_price)
    const stmtTrans = db.prepare(`
      INSERT INTO reservation_transfers (
        reservation_id, from_room_id, to_room_id,
        transfer_business_date, segment_start_date, segment_end_date,
        segment_nights, pinned_rate, segment_revenue,
        reason_category, reason_details, user_id,
        from_rate, transfer_mode,
        from_monthly_price, to_monthly_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmtTrans.run([
      stay.res.id,
      stay.res.room_id,
      targetRoom.id,
      stay.today,
      stay.segmentStartDate,
      stay.today,
      stay.segmentNights,
      stay.pinnedRate,
      stay.segmentRevenue,
      validReasonCategory,
      cleanReasonDetails || null,
      activeUserId,
      stay.pinnedRate,
      evalResult.mode,
      fromMonthlyPrice,
      toMonthlyPrice
    ]);
    stmtTrans.free();

    // Insert into reservation_events (Rule 6)
    const stmtEv = db.prepare(`
      INSERT INTO reservation_events (
        entity_type, entity_id, event_type,
        old_status, new_status, created_at, business_date, user_id
      ) VALUES ('reservation', ?, 'room_transferred', ?, ?, datetime('now', 'localtime'), ?, ?)
    `);
    stmtEv.run([
      stay.res.id,
      String(stay.res.room_number),
      String(targetRoom.room_number),
      stay.today,
      activeUserId
    ]);
    stmtEv.free();

    db.run("COMMIT;");
  } catch (err) {
    try { db.run("ROLLBACK;"); } catch (_) {}
    throw err;
  }

  // Ensure room statuses derivation runs immediately after transfer
  try {
    const { autoUpdateRoomStatuses } = require('./rooms');
    autoUpdateRoomStatuses(stay.today, { persist: false });
  } catch (e) {
    console.warn('[executeRoomTransfer] autoUpdateRoomStatuses:', e.message);
  }

  saveToFile();

  return {
    success: true,
    reservationId: stay.res.id,
    fromRoomNumber: stay.res.room_number,
    toRoomNumber: targetRoom.room_number,
    pinnedRate: stay.pinnedRate,
    mode: evalResult.mode,
    newRate: evalResult.newRate,
    oldTotalPrice: roundMoney(stay.res.total_price || 0),
    newTotalPrice: evalResult.newTotalPrice,
    totalDelta: evalResult.totalDelta,
    segmentNights: stay.segmentNights,
    segmentRevenue: stay.segmentRevenue
  };
}

module.exports = {
  getAllReservations,
  getReservationsPage,
  getReservationById,
  generateReceiptNumber,
  createReservation,
  computeCheckoutSettlement,
  isMonthlyEarlyCheckout,
  computeContractValue,
  countNights,
  checkoutReservation,
  extendReservation,
  cancelReservation,
  addPaymentToReservation,
  getReservationPayments,
  getReservationDepositMovements,
  reconcileLegacyDeposit,
  getPaymentReceipt,
  bulkImportReservations,
  updateReservationReceipt,
  getTransferEligibleRooms,
  previewRoomTransfer,
  executeRoomTransfer,
  validateTransferEligibility,
  computeStaySegments
};
