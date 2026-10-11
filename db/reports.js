/**
 * نظام أحمد لإدارة الفنادق (Ahmed Hotel ERP)
 * Reports, Analytics, Daily Shifts & Checkouts Module
 */

const { db, queryOne, queryAll, roundMoney, getLocalDateString, getCurrentBusinessDate } = require('./connection');

/**
 * Queries reservations where check_out_date strictly equals today's date.
 * Strictly joins Guests and Rooms tables.
 */
function getTodayCheckouts(targetDate) {
  const today = targetDate || getCurrentBusinessDate();
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
      r.payment_status,
      r.booking_type,
      r.status,
      r.checked_out_at,
      r.created_at,
      r.custom_nightly_price,
      r.discount_amount,
      strftime('%H:%M', r.created_at, 'localtime') AS booking_time,
      strftime('%H:%M', r.checked_out_at, 'localtime') AS checkout_time,
      g.name AS guest_name,
      g.phone AS guest_phone,
      g.id_number AS guest_id_number,
      rm.room_number,
      rm.type AS room_type,
      rm.status AS room_status,
      rm.price_per_night
    FROM reservations r
    JOIN guests g ON r.guest_id = g.id
    JOIN rooms rm ON r.room_id = rm.id
    WHERE (DATE(r.check_out_date) = DATE(?) AND r.status != 'ملغي')
       OR (r.status = 'مؤكد' AND DATE(r.check_out_date) < DATE(?))
    ORDER BY rm.room_number ASC
  `;
  return queryAll(sql, [today, today]);
}

/**
 * Analytics Data: Monthly Revenue (Expected vs Collected)
 * Returns month-by-month financial summary:
 * - expected: SUM(total_price) for reservations created in each hotel business month
 * - collected: SUM(payments.amount) grouped by the payment's hotel business month
 */
function getMonthlyRevenue() {
  const sql = `
    WITH expected_monthly AS (
      SELECT 
        strftime('%Y-%m', created_business_date) AS month,
        SUM(total_price) AS expected
      FROM reservations
      WHERE status != 'ملغي'
        AND created_at IS NOT NULL
        AND created_at != ''
      GROUP BY month
    ),
    collected_monthly AS (
      SELECT 
        strftime('%Y-%m', p.business_date) AS month,
        SUM(p.amount) AS collected
      FROM payments p
      WHERE p.business_date IS NOT NULL
        AND p.business_date != ''
        AND p.payment_method != 'من التأمين'
      GROUP BY month
    ),
    all_months AS (
      SELECT month FROM expected_monthly WHERE month IS NOT NULL
      UNION
      SELECT month FROM collected_monthly WHERE month IS NOT NULL
    )
    SELECT 
      m.month,
      COALESCE(e.expected, 0) AS expected,
      COALESCE(c.collected, 0) AS collected
    FROM all_months m
    LEFT JOIN expected_monthly e ON m.month = e.month
    LEFT JOIN collected_monthly c ON m.month = c.month
    ORDER BY m.month ASC
  `;
  const rows = queryAll(sql);
  return rows.map(r => ({
    month: r.month,
    expected: roundMoney(r.expected || 0),
    collected: roundMoney(r.collected || 0)
  }));
}

/**
 * Dashboard KPIs & Summary
 */
function getDashboardStats() {
  // Removed autoUpdateRoomStatuses() — this function is read-only.
  // Room status updates are triggered explicitly by the scheduler or
  // by operations that change reservation state, not by a stats query.
  const totalRooms = queryOne("SELECT COUNT(*) AS c FROM rooms")?.c || 0;
  const availableRooms = queryOne("SELECT COUNT(*) AS c FROM rooms WHERE status = 'متاحة'")?.c || 0;
  const occupiedRooms = queryOne("SELECT COUNT(*) AS c FROM rooms WHERE status = 'مشغولة'")?.c || 0;
  const reservedRooms = queryOne("SELECT COUNT(*) AS c FROM rooms WHERE status = 'محجوزة'")?.c || 0;
  const cleaningRooms = queryOne("SELECT COUNT(*) AS c FROM rooms WHERE status = 'تنظيف'")?.c || 0;

  const totalReservations = queryOne("SELECT COUNT(*) AS c FROM reservations")?.c || 0;
  const activeReservations = queryOne("SELECT COUNT(*) AS c FROM reservations WHERE status = 'مؤكد'")?.c || 0;
  const totalRevenue = roundMoney(queryOne("SELECT SUM(total_price) AS sum FROM reservations WHERE status != 'ملغي'")?.sum || 0);
  const totalGuests = queryOne("SELECT COUNT(*) AS c FROM guests")?.c || 0;

  return {
    totalRooms,
    availableRooms,
    occupiedRooms,
    reservedRooms,
    cleaningRooms,
    totalReservations,
    activeReservations,
    totalRevenue,
    totalGuests
  };
}

/** Minimal current-business-day revenue summary for the overview KPI. */
function getCurrentShiftRevenueSummary() {
  const date = getCurrentBusinessDate();
  const row = queryOne(`
    SELECT
      COALESCE(SUM(amount), 0) AS totalRevenue,
      COALESCE(SUM(CASE
        WHEN payment_method NOT IN ('بطاقة / مدى', 'شبكة / مدى', 'تحويل بنكي') THEN amount
        ELSE 0
      END), 0) AS cashTotal,
      COALESCE(SUM(CASE WHEN payment_method IN ('بطاقة / مدى', 'شبكة / مدى') THEN amount ELSE 0 END), 0) AS cardTotal,
      COALESCE(SUM(CASE WHEN payment_method = 'تحويل بنكي' THEN amount ELSE 0 END), 0) AS transferTotal
    FROM payments
    WHERE business_date = ? AND payment_method != 'من التأمين'
  `, [date]);

  return {
    date,
    totalRevenue: roundMoney(row?.totalRevenue || 0),
    cashTotal: roundMoney(row?.cashTotal || 0),
    cardTotal: roundMoney(row?.cardTotal || 0),
    transferTotal: roundMoney(row?.transferTotal || 0)
  };
}

/**
 * Shift Audit & Night Closing Report Data Provider
 * Supports date ranges (startDate, endDate) with day-by-day trend breakdown.
 * If endDate is omitted or same as startDate, behaves as exact single-day report.
 * Uses each ledger row's persisted hotel business_date for daily collections while
 * retaining the real transaction timestamp for the audit detail rows.
 */
function getShiftAuditReport(startDate, endDate) {
  const today = getCurrentBusinessDate();
  const start = (startDate && typeof startDate === 'string' && startDate.trim() !== '') ? startDate.trim() : today;
  const end = (endDate && typeof endDate === 'string' && endDate.trim() !== '') ? endDate.trim() : start;

  const dateFrom = start <= end ? start : end;
  const dateTo = start <= end ? end : start;
  const isRange = dateFrom !== dateTo;

  // 1. Query actual ledger payments collected in date range
  const paymentsInRange = queryAll(`
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
      r.id AS res_id,
      r.status AS res_status,
      g.name AS guest_name,
      rm.room_number,
      rm.type AS room_type,
      u.username AS staff_username
    FROM payments p
    JOIN reservations r ON p.reservation_id = r.id
    JOIN guests g ON r.guest_id = g.id
    JOIN rooms rm ON r.room_id = rm.id
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.business_date BETWEEN ? AND ?
      AND p.payment_method != 'من التأمين'
    ORDER BY p.id DESC
  `, [dateFrom, dateTo]);

  let totalRevenue = 0;
  let cashTotal = 0;
  let cashCollected = 0;
  let cashRefunded = 0;
  let lateCheckoutFeesCollected = 0;
  let cardTotal = 0;
  let transferTotal = 0;

  for (const p of paymentsInRange) {
    const amt = roundMoney(p.amount || 0);
    totalRevenue += amt;

    if (p.payment_method === 'نقداً') {
      cashTotal += amt;
      if (amt > 0) cashCollected += amt;
      else if (amt < 0) cashRefunded += Math.abs(amt);
    } else if (p.payment_method === 'بطاقة / مدى' || p.payment_method === 'شبكة / مدى') {
      cardTotal += amt;
    } else if (p.payment_method === 'تحويل بنكي') {
      transferTotal += amt;
    } else {
      cashTotal += amt;
    }
  }

  totalRevenue = roundMoney(totalRevenue);
  cashTotal = roundMoney(cashTotal);
  cashCollected = roundMoney(cashCollected);
  cashRefunded = roundMoney(cashRefunded);
  lateCheckoutFeesCollected = roundMoney(paymentsInRange
    .filter(p => p.payment_type === 'late_checkout_fee' && Number(p.amount) > 0)
    .reduce((total, p) => total + Number(p.amount || 0), 0));
  cardTotal = roundMoney(cardTotal);
  transferTotal = roundMoney(transferTotal);

  // 2. Reservations active, created, checked-in, or checked-out in date range
  // Operational movements in range: Created, Check-in, Check-out, Payment transaction, or Deposit movement.
  // Inactive stay-overs from prior days with no activity within this range are excluded.
  const reservationsInRange = queryAll(`
    SELECT r.*,
      COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.reservation_id = r.id), r.paid_amount) AS ledger_paid_amount,
      g.name AS guest_name, rm.room_number, rm.type AS room_type,
      COALESCE((SELECT SUM(CASE WHEN dm.movement_type IN ('collected', 'reconciled') THEN dm.amount ELSE -dm.amount END) FROM deposit_movements dm WHERE dm.reservation_id = r.id), 0) AS deposit_ledger_balance,
      CASE WHEN NOT EXISTS (SELECT 1 FROM deposit_movements dm WHERE dm.reservation_id = r.id) AND r.deposit_amount > 0 THEN 1 ELSE 0 END AS deposit_legacy_unreconciled
    FROM reservations r
    JOIN guests g ON r.guest_id = g.id
    JOIN rooms rm ON r.room_id = rm.id
    WHERE (
       (r.created_business_date BETWEEN ? AND ?)
       OR (r.check_in_date BETWEEN ? AND ? AND r.status != 'ملغي')
       OR (r.check_out_date != 'مفتوح' AND r.check_out_date BETWEEN ? AND ? AND r.status = 'مكتمل')
       OR EXISTS (SELECT 1 FROM payments p WHERE p.reservation_id = r.id AND p.business_date BETWEEN ? AND ?)
       OR EXISTS (SELECT 1 FROM deposit_movements dm WHERE dm.reservation_id = r.id AND dm.business_date BETWEEN ? AND ?)
       OR EXISTS (SELECT 1 FROM reservation_events ev WHERE ev.entity_type = 'reservation' AND ev.entity_id = r.id AND ev.business_date BETWEEN ? AND ?)
       OR EXISTS (SELECT 1 FROM reservation_transfers rt WHERE rt.reservation_id = r.id AND rt.transfer_business_date BETWEEN ? AND ?)
    )
    ORDER BY r.id DESC
  `, [dateFrom, dateTo, dateFrom, dateTo, dateFrom, dateTo, dateFrom, dateTo, dateFrom, dateTo, dateFrom, dateTo, dateFrom, dateTo]);

  let expectedTotal = 0;
  let outstandingTotal = 0;
  for (const r of reservationsInRange) {
    if (r.status === 'ملغي') continue;
    const price = roundMoney(r.total_price || 0);
    const paid = roundMoney(r.ledger_paid_amount ?? r.paid_amount ?? 0);
    expectedTotal += price;
    outstandingTotal += Math.max(0, roundMoney(price - paid));
  }
  expectedTotal = roundMoney(expectedTotal);
  outstandingTotal = roundMoney(outstandingTotal);

  const depositMovements = queryAll(`
    SELECT dm.id, dm.reservation_id, dm.movement_type, dm.amount, dm.payment_method,
      dm.movement_date, dm.created_at, dm.business_date, dm.reason, g.name AS guest_name, rm.room_number,
      u.username AS staff_username
    FROM deposit_movements dm
    JOIN reservations r ON r.id = dm.reservation_id
    JOIN guests g ON g.id = r.guest_id
    JOIN rooms rm ON rm.id = r.room_id
    LEFT JOIN users u ON u.id = dm.user_id
    WHERE dm.business_date BETWEEN ? AND ?
    ORDER BY dm.id DESC
  `, [dateFrom, dateTo]);
  const depositActivity = { collected: 0, refunded: 0, applied: 0, retained: 0 };
  let depositCashCollected = 0;
  let depositCashRefunded = 0;
  let depositCashRetained = 0;
  for (const movement of depositMovements) {
    depositActivity[movement.movement_type] = roundMoney((depositActivity[movement.movement_type] || 0) + Number(movement.amount || 0));
    if (movement.payment_method === 'نقداً') {
      const amount = roundMoney(movement.amount || 0);
      if (movement.movement_type === 'collected') depositCashCollected += amount;
      else if (movement.movement_type === 'refunded') depositCashRefunded += amount;
      else if (movement.movement_type === 'retained') depositCashRetained += amount;
    }
  }
  depositCashCollected = roundMoney(depositCashCollected);
  depositCashRefunded = roundMoney(depositCashRefunded);
  depositCashRetained = roundMoney(depositCashRetained);
  // Net cash held from deposits in the cash drawer (collected minus refunded to guest)
  const netCashDeposit = roundMoney(depositCashCollected - depositCashRefunded);

  // 3. Room Transfers in date range
  const transfersInRange = queryAll(`
    SELECT 
      t.id,
      t.reservation_id,
      t.transfer_business_date,
      t.transfer_timestamp,
      t.segment_start_date,
      t.segment_end_date,
      t.segment_nights,
      t.pinned_rate,
      t.from_rate,
      t.segment_revenue,
      t.transfer_mode,
      t.reason_category,
      t.reason_details,
      r.guest_id,
      r.booking_type,
      r.check_in_date,
      r.check_out_date,
      r.custom_nightly_price,
      r.monthly_rate_snapshot,
      r.total_price,
      g.name AS guest_name,
      from_rm.room_number AS from_room_number,
      from_rm.type AS from_room_type,
      from_rm.monthly_price AS from_room_monthly_price,
      from_rm.price_per_night AS from_room_price_per_night,
      to_rm.room_number AS to_room_number,
      to_rm.type AS to_room_type,
      to_rm.price_per_night AS to_room_price_per_night,
      to_rm.monthly_price AS to_room_monthly_price,
      u.username AS staff_username
    FROM reservation_transfers t
    JOIN reservations r ON t.reservation_id = r.id
    JOIN guests g ON r.guest_id = g.id
    JOIN rooms from_rm ON t.from_room_id = from_rm.id
    JOIN rooms to_rm ON t.to_room_id = to_rm.id
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.transfer_business_date BETWEEN ? AND ?
    ORDER BY t.id DESC
  `, [dateFrom, dateTo]);

  // 4. Movements (Check-ins & Check-outs in range)
  const checkinsInRange = queryOne(`
    SELECT COUNT(*) AS count 
    FROM reservations 
    WHERE check_in_date BETWEEN ? AND ? 
      AND status != 'ملغي'
  `, [dateFrom, dateTo])?.count || 0;

  const checkoutsInRange = queryOne(`
    SELECT COUNT(*) AS count 
    FROM reservations 
    WHERE check_out_date != 'مفتوح' 
      AND check_out_date BETWEEN ? AND ?
      AND status = 'مكتمل'
  `, [dateFrom, dateTo])?.count || 0;

  // 4. Room status distribution (CURRENT real-time snapshot, not historical)
  const allRooms = queryAll("SELECT status FROM rooms");
  const totalRooms = allRooms.length;
  const occupiedCount = allRooms.filter(r => r.status === 'مشغولة').length;
  const availableCount = allRooms.filter(r => r.status === 'متاحة').length;
  const cleaningCount = allRooms.filter(r => r.status === 'تنظيف').length;
  const maintenanceCount = allRooms.filter(r => r.status === 'صيانة').length;
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0;

  // 5. Day-by-Day Breakdown Array (mini trend for range)
  const revByDate = {};
  for (const p of paymentsInRange) {
    const pDate = p.business_date || '';
    if (pDate) {
      revByDate[pDate] = roundMoney((revByDate[pDate] || 0) + Number(p.amount || 0));
    }
  }

  const checkinsByDayRows = queryAll(`
    SELECT check_in_date AS d, COUNT(*) AS count
    FROM reservations
    WHERE check_in_date BETWEEN ? AND ?
      AND status != 'ملغي'
    GROUP BY check_in_date
  `, [dateFrom, dateTo]);
  const checkinsByDay = {};
  for (const r of checkinsByDayRows) {
    checkinsByDay[r.d] = r.count;
  }

  const checkoutsByDayRows = queryAll(`
    SELECT check_out_date AS d, COUNT(*) AS count
    FROM reservations
    WHERE check_out_date != 'مفتوح'
      AND check_out_date BETWEEN ? AND ?
      AND status = 'مكتمل'
    GROUP BY check_out_date
  `, [dateFrom, dateTo]);
  const checkoutsByDay = {};
  for (const r of checkoutsByDayRows) {
    checkoutsByDay[r.d] = r.count;
  }

  const dailyBreakdown = [];
  const startD = new Date(dateFrom + 'T00:00:00');
  const endD = new Date(dateTo + 'T00:00:00');
  let cur = new Date(startD);
  while (cur <= endD) {
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    const dStr = `${yyyy}-${mm}-${dd}`;

    dailyBreakdown.push({
      date: dStr,
      check_ins_count: checkinsByDay[dStr] || 0,
      check_outs_count: checkoutsByDay[dStr] || 0,
      revenue: roundMoney(revByDate[dStr] || 0)
    });

    cur.setDate(cur.getDate() + 1);
  }

  return {
    date: isRange ? `${dateFrom} إلى ${dateTo}` : dateFrom,
    startDate: dateFrom,
    endDate: dateTo,
    isRange,
    financials: {
      totalRevenue,
      cashTotal,
      cashCollected,
      cashRefunded,
      lateCheckoutFeesCollected,
      cardTotal,
      transferTotal,
      depositTotal: roundMoney(depositActivity.collected - depositActivity.refunded),
      depositActivity,
      depositCashCollected,
      depositCashRefunded,
      depositCashRetained,
      netCashDeposit,
      expectedCashInDrawer: roundMoney(cashTotal + netCashDeposit),
      expectedTotal,
      outstandingTotal
    },
    expectedTotal,
    outstandingTotal,
    movements: {
      checkinsToday: checkinsInRange,
      checkoutsToday: checkoutsInRange,
      totalCheckins: checkinsInRange,
      totalCheckouts: checkoutsInRange,
      totalReservationsToday: reservationsInRange.length,
      totalPaymentsCount: paymentsInRange.length,
      totalTransfersToday: transfersInRange.length,
      totalTransfers: transfersInRange.length
    },
    rooms: {
      totalRooms,
      occupiedCount,
      availableCount,
      cleaningCount,
      maintenanceCount,
      occupancyRate
    },
    dailyBreakdown,
    payments: paymentsInRange,
    depositMovements,
    transfers: transfersInRange,
    transactions: reservationsInRange
  };
}

module.exports = {
  getTodayCheckouts,
  getMonthlyRevenue,
  getDashboardStats,
  getCurrentShiftRevenueSummary,
  getShiftAuditReport
};
