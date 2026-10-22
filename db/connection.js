/**
 * نظام ريحانة للوحدات السكنية (Rayhana Suites ERP)
 * Database Connection & Core Persistence Module
 * SQLite Engine via WebAssembly (sql.js)
 * Now with bcrypt password hashing migration (eager + lazy).
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;
function _isBcryptHash(val) {
  return typeof val === 'string' && /^\$2[aby]\$\d{2}\$/.test(val);
}
function _hashPassword(plain) {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

let db = null;
let currentDbPath = '';
let SQLRuntime = null;

const dbProxy = new Proxy({}, {
  get(target, prop) {
    if (!db) throw new Error('قاعدة البيانات غير مهيأة.');
    const val = db[prop];
    return typeof val === 'function' ? val.bind(db) : val;
  }
});

/**
 * Saves current in-memory SQLite state to the physical .sqlite file on disk.
 * Includes a synchronous retry loop for EBUSY/EPERM file locking errors on Windows.
 */
function saveToFile() {
  if (!db || !currentDbPath) return false;
  const tempPath = `${currentDbPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const maxRetries = 3;
  let lastErr = null;

  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(tempPath, buffer);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        fs.renameSync(tempPath, currentDbPath);
        return true;
      } catch (renameErr) {
        lastErr = renameErr;
        if ((renameErr.code === 'EBUSY' || renameErr.code === 'EPERM') && attempt < maxRetries) {
          // Brief synchronous sleep for Windows file lock release
          const waitTill = Date.now() + 50 * attempt;
          while (Date.now() < waitTill) {}
          continue;
        }
        throw renameErr;
      }
    }
    return false;
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (_) {}
    console.error('[DB] خطأ أثناء حفظ قاعدة البيانات إلى القرص:', lastErr || err);
    return false;
  }
}

/**
 * Helper to execute a SELECT query and return an array of objects.
 */
function queryAll(sql, params = []) {
  if (!db) throw new Error('قاعدة البيانات غير مهيأة.');
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/**
 * Helper to execute a single row SELECT query.
 */
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Initialize SQLite database, create tables, and seed initial records.
 * @param {string} dbPath - File path to .sqlite database
 */
async function init(dbPath) {
  try {
    currentDbPath = dbPath;
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const SQL = await initSqlJs();
    SQLRuntime = SQL;

    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
      console.log('[DB] تم تحميل قاعدة البيانات الحالية من:', dbPath);
    } else {
      db = new SQL.Database();
      console.log('[DB] تم إنشاء قاعدة بيانات SQLite جديدة في:', dbPath);
    }

    // 1. Create Tables
    db.run(`
      -- جدول المستخدمين (Users with RBAC: 'Admin' or 'Staff')
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Staff',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- جدول النزلاء (Guests)
      CREATE TABLE IF NOT EXISTS guests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        id_number TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- جدول الغرف (Rooms)
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_number TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        price_per_night REAL NOT NULL,
        monthly_price REAL,
        status TEXT DEFAULT 'متاحة',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- جدول الحجوزات (Reservations)
      CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guest_id INTEGER NOT NULL,
        room_id INTEGER NOT NULL,
        check_in_date TEXT NOT NULL,
        check_out_date TEXT,
        total_price REAL NOT NULL,
        paid_amount REAL DEFAULT 0,
        deposit_amount REAL DEFAULT 0,
        payment_method TEXT DEFAULT 'نقداً',
        payment_status TEXT DEFAULT 'غير مدفوع',
        status TEXT DEFAULT 'مؤكد',
        booking_type TEXT DEFAULT 'عادي',
        custom_nightly_price REAL,
        monthly_rate_snapshot REAL,
        monthly_extension_amount REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        discount_reason TEXT,
        late_checkout_fee REAL DEFAULT 0,
        original_calculated_charge REAL,
        checked_out_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_business_date TEXT,
        is_early_checkin INTEGER DEFAULT 0,
        actual_check_in_at DATETIME,
        FOREIGN KEY(guest_id) REFERENCES guests(id),
        FOREIGN KEY(room_id) REFERENCES rooms(id)
      );

      CREATE INDEX IF NOT EXISTS idx_reservations_status_id ON reservations(status, id DESC);

      -- جدول سجل المدفوعات وسندات القبض (Payments / Receipts Ledger Table)
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT UNIQUE NOT NULL,
        reservation_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'نقداً',
        payment_type TEXT NOT NULL DEFAULT 'legacy_unclassified',
        payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        business_date TEXT,
        user_id INTEGER,
        notes TEXT,
        FOREIGN KEY(reservation_id) REFERENCES reservations(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_payments_reservation_id ON payments(reservation_id);
      CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

      -- سجل مستقل لحركات التأمين؛ لا يمثل رصيد التأمين إيراد إقامة أو تحصيلاً يومياً.
      CREATE TABLE IF NOT EXISTS deposit_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reservation_id INTEGER NOT NULL,
        movement_type TEXT NOT NULL CHECK (movement_type IN ('collected', 'reconciled', 'refunded', 'applied', 'retained')),
        amount REAL NOT NULL CHECK (amount > 0),
        payment_method TEXT NOT NULL DEFAULT 'نقداً',
        movement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        business_date TEXT,
        user_id INTEGER,
        reason TEXT,
        FOREIGN KEY(reservation_id) REFERENCES reservations(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_deposit_movements_reservation ON deposit_movements(reservation_id, id);
      CREATE INDEX IF NOT EXISTS idx_deposit_movements_date ON deposit_movements(movement_date);

      -- جدول تتبع نشاط الموظفين (EmployeeLogs)
      CREATE TABLE IF NOT EXISTS EmployeeLogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        logout_time DATETIME,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS hotel_business_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_business_date TEXT NOT NULL,
        last_audit_at DATETIME,
        last_audit_user_id INTEGER,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(last_audit_user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS night_audits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        closed_business_date TEXT NOT NULL UNIQUE,
        business_date TEXT NOT NULL,
        next_business_date TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER,
        closed_by TEXT,
        shift_reconciliation_required INTEGER NOT NULL DEFAULT 0,
        shift_reconciled_at DATETIME,
        shift_reconciled_by INTEGER,
        payment_count INTEGER NOT NULL DEFAULT 0,
        payment_net REAL NOT NULL DEFAULT 0,
        deposit_movement_count INTEGER NOT NULL DEFAULT 0,
        deposit_net REAL NOT NULL DEFAULT 0,
        summary_json TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS reservation_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL CHECK (entity_type IN ('reservation', 'room')),
        entity_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        business_date TEXT NOT NULL,
        user_id INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      -- جدول حركات نقل النزلاء بين الغرف وتتبع الشرائح وإيرادات الغرف (Phase 1)
      CREATE TABLE IF NOT EXISTS reservation_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reservation_id INTEGER NOT NULL,
        from_room_id INTEGER NOT NULL,
        to_room_id INTEGER NOT NULL,
        transfer_business_date TEXT NOT NULL,
        transfer_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        segment_start_date TEXT NOT NULL,
        segment_end_date TEXT NOT NULL,
        segment_nights INTEGER NOT NULL,
        pinned_rate REAL NOT NULL,
        segment_revenue REAL NOT NULL,
        reason_category TEXT NOT NULL DEFAULT 'other',
        reason_details TEXT,
        user_id INTEGER,
        FOREIGN KEY(reservation_id) REFERENCES reservations(id),
        FOREIGN KEY(from_room_id) REFERENCES rooms(id),
        FOREIGN KEY(to_room_id) REFERENCES rooms(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_reservation_transfers_res ON reservation_transfers(reservation_id);
      CREATE INDEX IF NOT EXISTS idx_reservation_transfers_from ON reservation_transfers(from_room_id);
      CREATE INDEX IF NOT EXISTS idx_reservation_transfers_to ON reservation_transfers(to_room_id);
      CREATE INDEX IF NOT EXISTS idx_reservation_transfers_date ON reservation_transfers(transfer_business_date);
    `);

    // Enable foreign key enforcement (SQLite has it OFF by default)
    db.run("PRAGMA foreign_keys = ON;");

    // Add compatibility columns only when they are absent. Checking the schema
    // first keeps startup quiet and makes this migration safe to run repeatedly.
    const migrations = [
      { table: 'rooms', column: 'monthly_price', sql: 'ALTER TABLE rooms ADD COLUMN monthly_price REAL' },
      { table: 'reservations', column: 'monthly_rate_snapshot', sql: 'ALTER TABLE reservations ADD COLUMN monthly_rate_snapshot REAL' },
      { table: 'reservations', column: 'monthly_extension_amount', sql: 'ALTER TABLE reservations ADD COLUMN monthly_extension_amount REAL DEFAULT 0' },
      { table: 'payments', column: 'payment_type', sql: "ALTER TABLE payments ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'legacy_unclassified'" },
      { table: 'reservations', column: 'paid_amount', sql: 'ALTER TABLE reservations ADD COLUMN paid_amount REAL DEFAULT 0' },
      { table: 'reservations', column: 'deposit_amount', sql: 'ALTER TABLE reservations ADD COLUMN deposit_amount REAL DEFAULT 0' },
      { table: 'reservations', column: 'payment_method', sql: "ALTER TABLE reservations ADD COLUMN payment_method TEXT DEFAULT 'نقداً'" },
      { table: 'reservations', column: 'payment_status', sql: "ALTER TABLE reservations ADD COLUMN payment_status TEXT DEFAULT 'غير مدفوع'" },
      { table: 'guests', column: 'is_banned', sql: 'ALTER TABLE guests ADD COLUMN is_banned INTEGER DEFAULT 0' },
      { table: 'guests', column: 'ban_reason', sql: 'ALTER TABLE guests ADD COLUMN ban_reason TEXT' },
      { table: 'reservations', column: 'booking_type', sql: "ALTER TABLE reservations ADD COLUMN booking_type TEXT DEFAULT 'عادي'" },
      { table: 'reservations', column: 'custom_nightly_price', sql: 'ALTER TABLE reservations ADD COLUMN custom_nightly_price REAL' },
      { table: 'reservations', column: 'discount_amount', sql: 'ALTER TABLE reservations ADD COLUMN discount_amount REAL DEFAULT 0' },
      { table: 'reservations', column: 'discount_reason', sql: 'ALTER TABLE reservations ADD COLUMN discount_reason TEXT' },
      { table: 'reservations', column: 'late_checkout_fee', sql: 'ALTER TABLE reservations ADD COLUMN late_checkout_fee REAL DEFAULT 0' },
      { table: 'reservations', column: 'checked_out_at', sql: 'ALTER TABLE reservations ADD COLUMN checked_out_at DATETIME' },
      { table: 'reservations', column: 'original_calculated_charge', sql: 'ALTER TABLE reservations ADD COLUMN original_calculated_charge REAL' },
      { table: 'reservations', column: 'checkout_policy', sql: 'ALTER TABLE reservations ADD COLUMN checkout_policy TEXT' },
      { table: 'reservations', column: 'checkout_policy_reason', sql: 'ALTER TABLE reservations ADD COLUMN checkout_policy_reason TEXT' },
      { table: 'reservations', column: 'booked_check_out_date', sql: 'ALTER TABLE reservations ADD COLUMN booked_check_out_date TEXT' },
      { table: 'reservations', column: 'created_business_date', sql: 'ALTER TABLE reservations ADD COLUMN created_business_date TEXT' },
      { table: 'reservations', column: 'is_early_checkin', sql: 'ALTER TABLE reservations ADD COLUMN is_early_checkin INTEGER DEFAULT 0' },
      { table: 'reservations', column: 'actual_check_in_at', sql: 'ALTER TABLE reservations ADD COLUMN actual_check_in_at DATETIME' },
      { table: 'payments', column: 'created_at', sql: 'ALTER TABLE payments ADD COLUMN created_at DATETIME' },
      { table: 'payments', column: 'business_date', sql: 'ALTER TABLE payments ADD COLUMN business_date TEXT' },
      { table: 'deposit_movements', column: 'created_at', sql: 'ALTER TABLE deposit_movements ADD COLUMN created_at DATETIME' },
      { table: 'deposit_movements', column: 'business_date', sql: 'ALTER TABLE deposit_movements ADD COLUMN business_date TEXT' },
      { table: 'night_audits', column: 'business_date', sql: 'ALTER TABLE night_audits ADD COLUMN business_date TEXT' },
      { table: 'night_audits', column: 'closed_by', sql: 'ALTER TABLE night_audits ADD COLUMN closed_by TEXT' },
      { table: 'night_audits', column: 'shift_reconciliation_required', sql: 'ALTER TABLE night_audits ADD COLUMN shift_reconciliation_required INTEGER NOT NULL DEFAULT 0' },
      { table: 'night_audits', column: 'shift_reconciled_at', sql: 'ALTER TABLE night_audits ADD COLUMN shift_reconciled_at DATETIME' },
      { table: 'night_audits', column: 'shift_reconciled_by', sql: 'ALTER TABLE night_audits ADD COLUMN shift_reconciled_by INTEGER' },
      { table: 'night_audits', column: 'payment_count', sql: 'ALTER TABLE night_audits ADD COLUMN payment_count INTEGER NOT NULL DEFAULT 0' },
      { table: 'night_audits', column: 'payment_net', sql: 'ALTER TABLE night_audits ADD COLUMN payment_net REAL NOT NULL DEFAULT 0' },
      { table: 'night_audits', column: 'deposit_movement_count', sql: 'ALTER TABLE night_audits ADD COLUMN deposit_movement_count INTEGER NOT NULL DEFAULT 0' },
      { table: 'night_audits', column: 'deposit_net', sql: 'ALTER TABLE night_audits ADD COLUMN deposit_net REAL NOT NULL DEFAULT 0' },
      { table: 'night_audits', column: 'summary_json', sql: "ALTER TABLE night_audits ADD COLUMN summary_json TEXT NOT NULL DEFAULT '{}'" },
      { table: 'reservation_transfers', column: 'from_rate', sql: 'ALTER TABLE reservation_transfers ADD COLUMN from_rate REAL' },
      { table: 'reservation_transfers', column: 'transfer_mode', sql: "ALTER TABLE reservation_transfers ADD COLUMN transfer_mode TEXT DEFAULT 'keep_rate'" },
      { table: 'reservation_transfers', column: 'from_monthly_price', sql: 'ALTER TABLE reservation_transfers ADD COLUMN from_monthly_price REAL' },
      { table: 'reservation_transfers', column: 'to_monthly_price', sql: 'ALTER TABLE reservation_transfers ADD COLUMN to_monthly_price REAL' }
    ];
    for (const migration of migrations) {
      try {
        const columns = queryAll(`PRAGMA table_info("${migration.table}")`);
        if (!columns.some(column => column.name === migration.column)) {
          db.run(migration.sql);
        }
      } catch (e) {
        console.warn('[DB Migration]:', e.message);
      }
    }

    const defaultSettings = [
      ['business_day_cutoff_time', '06:00'],
      ['hotel_timezone', 'Asia/Riyadh'],
      ['auto_rollover_enabled', 'true']
    ];
    for (const [key, value] of defaultSettings) {
      const insertSetting = db.prepare('INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)');
      insertSetting.run([key, value]);
      insertSetting.free();
    }

    // Seed the operational date only once. The legacy 06:00 rule is used solely
    // to choose the initial date for an existing installation; later date changes
    // are performed only by a successful Night Audit.
    db.run(`
      INSERT OR IGNORE INTO hotel_business_state (id, current_business_date)
      VALUES (1, '${getHotelBusinessDate()}')
    `);

    // Preserve the historical report day for old rows. Exact historical business
    // dates cannot be reconstructed because the old database did not store them.
    db.run(`
      UPDATE payments
      SET created_at = COALESCE(NULLIF(created_at, ''), NULLIF(payment_date, ''), CURRENT_TIMESTAMP),
          business_date = COALESCE(NULLIF(business_date, ''), date(payment_date),
            (SELECT current_business_date FROM hotel_business_state WHERE id = 1))
      WHERE created_at IS NULL OR created_at = '' OR business_date IS NULL OR business_date = '';
      UPDATE deposit_movements
      SET created_at = COALESCE(NULLIF(created_at, ''), NULLIF(movement_date, ''), CURRENT_TIMESTAMP),
          business_date = COALESCE(NULLIF(business_date, ''), date(movement_date),
            (SELECT current_business_date FROM hotel_business_state WHERE id = 1))
      WHERE created_at IS NULL OR created_at = '' OR business_date IS NULL OR business_date = '';
      UPDATE reservations
      SET created_business_date = COALESCE(NULLIF(created_business_date, ''), date(created_at, 'localtime'),
            (SELECT current_business_date FROM hotel_business_state WHERE id = 1))
      WHERE created_business_date IS NULL OR created_business_date = '';
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_reservations_room ON reservations(room_id);
      CREATE INDEX IF NOT EXISTS idx_reservations_guest ON reservations(guest_id);
      CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(check_in_date, check_out_date);
      CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
      CREATE INDEX IF NOT EXISTS idx_guests_phone ON guests(phone);
      CREATE INDEX IF NOT EXISTS idx_guests_id_number ON guests(id_number);
      CREATE INDEX IF NOT EXISTS idx_employee_logs_user ON EmployeeLogs(user_id, id DESC);
      CREATE INDEX IF NOT EXISTS idx_payments_business_date ON payments(business_date);
      CREATE INDEX IF NOT EXISTS idx_deposit_movements_business_date ON deposit_movements(business_date);
      CREATE INDEX IF NOT EXISTS idx_reservations_created_business_date ON reservations(created_business_date);
      CREATE INDEX IF NOT EXISTS idx_reservation_events_business_date ON reservation_events(business_date);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_reservation_events_one_checkin
        ON reservation_events(entity_id, event_type)
        WHERE entity_type = 'reservation' AND event_type = 'check_in';

      CREATE TRIGGER IF NOT EXISTS trg_payments_stamp_business_date
      AFTER INSERT ON payments
      WHEN NEW.business_date IS NULL OR NEW.business_date = '' OR NEW.created_at IS NULL OR NEW.created_at = ''
      BEGIN
        UPDATE payments
        SET business_date = COALESCE(NULLIF(NEW.business_date, ''),
              (SELECT current_business_date FROM hotel_business_state WHERE id = 1)),
            created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS trg_deposit_movements_stamp_business_date
      AFTER INSERT ON deposit_movements
      WHEN NEW.business_date IS NULL OR NEW.business_date = '' OR NEW.created_at IS NULL OR NEW.created_at = ''
      BEGIN
        UPDATE deposit_movements
        SET business_date = COALESCE(NULLIF(NEW.business_date, ''),
              (SELECT current_business_date FROM hotel_business_state WHERE id = 1)),
            created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS trg_reservations_created_event
      AFTER INSERT ON reservations
      BEGIN
        UPDATE reservations
        SET created_business_date = COALESCE(NULLIF(NEW.created_business_date, ''),
              (SELECT current_business_date FROM hotel_business_state WHERE id = 1)),
            actual_check_in_at = COALESCE(NULLIF(NEW.actual_check_in_at, ''),
              COALESCE(NEW.created_at, CURRENT_TIMESTAMP))
        WHERE id = NEW.id AND (NEW.created_business_date IS NULL OR NEW.created_business_date = '' OR NEW.actual_check_in_at IS NULL OR NEW.actual_check_in_at = '');
        INSERT INTO reservation_events (entity_type, entity_id, event_type, new_status, created_at, business_date)
        VALUES ('reservation', NEW.id, 'created', NEW.status, COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
          COALESCE(NULLIF(NEW.created_business_date, ''), (SELECT current_business_date FROM hotel_business_state WHERE id = 1)));
        INSERT OR IGNORE INTO reservation_events (entity_type, entity_id, event_type, new_status, created_at, business_date)
        SELECT 'reservation', NEW.id, 'check_in', 'وصل النزيل', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          (SELECT current_business_date FROM hotel_business_state WHERE id = 1)
        WHERE NEW.check_in_date <= (SELECT current_business_date FROM hotel_business_state WHERE id = 1);
      END;

      CREATE TRIGGER IF NOT EXISTS trg_reservations_status_event
      AFTER UPDATE OF status ON reservations
      WHEN OLD.status IS NOT NEW.status
      BEGIN
        INSERT INTO reservation_events (entity_type, entity_id, event_type, old_status, new_status, created_at, business_date)
        VALUES ('reservation', NEW.id, 'status_changed', OLD.status, NEW.status, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          (SELECT current_business_date FROM hotel_business_state WHERE id = 1));
      END;

      CREATE TRIGGER IF NOT EXISTS trg_reservations_payment_status_event
      AFTER UPDATE OF payment_status ON reservations
      WHEN OLD.payment_status IS NOT NEW.payment_status
      BEGIN
        INSERT INTO reservation_events (entity_type, entity_id, event_type, old_status, new_status, created_at, business_date)
        VALUES ('reservation', NEW.id, 'payment_status_changed', OLD.payment_status, NEW.payment_status, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          (SELECT current_business_date FROM hotel_business_state WHERE id = 1));
      END;

      CREATE TRIGGER IF NOT EXISTS trg_rooms_status_event
      AFTER UPDATE OF status ON rooms
      WHEN OLD.status IS NOT NEW.status
      BEGIN
        INSERT INTO reservation_events (entity_type, entity_id, event_type, old_status, new_status, created_at, business_date)
        VALUES ('room', NEW.id, 'status_changed', OLD.status, NEW.status, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
          (SELECT current_business_date FROM hotel_business_state WHERE id = 1));
      END;
    `);

    // Backfill historical payments from reservations if payments table is empty
    try {
      const existingPaymentsCount = queryOne("SELECT COUNT(*) AS count FROM payments")?.count || 0;
      if (existingPaymentsCount === 0) {
        const paidReservations = queryAll("SELECT id, paid_amount, payment_method, created_at FROM reservations WHERE paid_amount > 0");
        for (const r of paidReservations) {
          const year = new Date().getFullYear();
          const receiptNo = `REC-${year}-${String(r.id).padStart(5, '0')}`;
          const stmt = db.prepare(`
            INSERT OR IGNORE INTO payments (
              receipt_number, reservation_id, amount, payment_method, payment_type,
              payment_date, notes, created_at, business_date
            ) VALUES (?, ?, ?, ?, 'legacy_unclassified', ?, 'دفعة الحجز المبدئية (ترحيل آلي)', ?, date(?))
          `);
          const legacyCreatedAt = r.created_at || new Date().toISOString();
          stmt.run([receiptNo, r.id, r.paid_amount, r.payment_method || 'نقداً', legacyCreatedAt, legacyCreatedAt, legacyCreatedAt]);
          stmt.free();
        }
      }
    } catch (migErr) {
      console.warn('[DB Migration payments warning]:', migErr.message);
    }

    // 2. Ensure Admin User exists and has 'Admin' role — password always bcrypt-hashed
    const adminUser = queryOne("SELECT id, password, role FROM users WHERE username = 'admin'");
    if (!adminUser) {
      const stmt = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
      stmt.run(['admin', _hashPassword('admin'), 'Admin']);
      stmt.free();
      console.log('[DB] تم إنشاء حساب المسؤول الافتراضي بنجاح (admin / admin / Admin)');
    } else {
      // Ensure role is Admin and password is bcrypt-hashed (eager migration)
      if (adminUser.role !== 'Admin') {
        db.run("UPDATE users SET role = 'Admin' WHERE username = 'admin'");
      }
      if (!_isBcryptHash(adminUser.password)) {
        try {
          const h = _hashPassword(adminUser.password);
          const stmt = db.prepare("UPDATE users SET password = ? WHERE username = 'admin'");
          stmt.run([h]);
          stmt.free();
          console.log('[DB Migration] تم ترقية كلمة مرور admin إلى bcrypt بنجاح.');
        } catch (e) { console.warn('[DB Migration] فشل ترقية كلمة مرور admin:', e.message); }
      }
    }

    // 3. Seed default staff and user members — passwords bcrypt-hashed
    const staffUser = queryOne("SELECT id, password FROM users WHERE username = 'staff'");
    if (!staffUser) {
      const stmt = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
      stmt.run(['staff', _hashPassword('staff'), 'User']);
      stmt.free();
      console.log('[DB] تم إنشاء حساب موظف الاستقبال الافتراضي (staff / staff / User)');
    } else if (!_isBcryptHash(staffUser.password)) {
      try {
        const h = _hashPassword(staffUser.password);
        const stmt = db.prepare("UPDATE users SET password = ? WHERE username = 'staff'");
        stmt.run([h]);
        stmt.free();
      } catch (e) { console.warn('[DB Migration] فشل ترقية staff:', e.message); }
    }

    const normalUser = queryOne("SELECT id, password FROM users WHERE username = 'user'");
    if (!normalUser) {
      const stmt = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
      stmt.run(['user', _hashPassword('user'), 'User']);
      stmt.free();
      console.log('[DB] تم إنشاء حساب المستخدم العادي الافتراضي (user / user / User)');
    } else if (!_isBcryptHash(normalUser.password)) {
      try {
        const h = _hashPassword(normalUser.password);
        const stmt = db.prepare("UPDATE users SET password = ? WHERE username = 'user'");
        stmt.run([h]);
        stmt.free();
      } catch (e) { console.warn('[DB Migration] فشل ترقية user:', e.message); }
    }

    // 3b. Eager bulk migration: hash any other legacy plaintext passwords in one sweep
    // This ensures existing custom users created before bcrypt are upgraded on next app start,
    // without waiting for their first login (lazy path in db/users.js covers remaining edge).
    try {
      const allUsers = queryAll("SELECT id, password FROM users");
      let migratedCount = 0;
      for (const u of allUsers) {
        if (!_isBcryptHash(u.password)) {
          const h = _hashPassword(u.password);
          const stmt = db.prepare("UPDATE users SET password = ? WHERE id = ?");
          stmt.run([h, u.id]);
          stmt.free();
          migratedCount++;
        }
      }
      if (migratedCount > 0) {
        console.log(`[DB Migration] تم ترقية ${migratedCount} كلمة مرور من النص الصريح إلى bcrypt تلقائياً.`);
      }
    } catch (e) {
      console.warn('[DB Migration] فشل الترحيل الجماعي لكلمات المرور:', e.message);
    }

    // 4. Seed Default Rooms if empty
    const roomCount = queryOne("SELECT COUNT(*) AS count FROM rooms");
    if (!roomCount || roomCount.count === 0) {
      const defaultRooms = [
        ['101', 'مفردة قياسية (Single)', 250.00, 'متاحة'],
        ['102', 'مفردة قياسية (Single)', 250.00, 'متاحة'],
        ['103', 'مزدوجة ديلوكس (Double)', 450.00, 'متاحة'],
        ['104', 'مزدوجة ديلوكس (Double)', 450.00, 'متاحة'],
        ['201', 'جناح عائلي (Family Suite)', 750.00, 'متاحة'],
        ['202', 'جناح ملكي (Royal Suite)', 1200.00, 'متاحة'],
        ['203', 'إطلالة بانورامية (Panoramic)', 600.00, 'متاحة']
      ];

      const roomStmt = db.prepare("INSERT INTO rooms (room_number, type, price_per_night, status) VALUES (?, ?, ?, ?)");
      for (const r of defaultRooms) {
        roomStmt.run(r);
      }
      roomStmt.free();
      console.log('[DB] تم تزويد الغرف الافتراضية بنجاح (جميعها متاحة للتشغيل).');
    }

    saveToFile();
    console.log('[DB] قاعدة بيانات الفندق جاهزة للعمل.');
  } catch (err) {
    console.error('[DB] خطأ أثناء تهيئة قاعدة البيانات:', err);
    throw err;
  }
}

/**
 * Safe currency rounding helper to prevent IEEE-754 floating-point drift.
 * Rounds to 2 decimal places using Number.EPSILON.
 *
 * Negative zero is normalised to positive zero: Math.round can return -0 for a tiny
 * negative input such as -0.001, and that would render as "-0.00" on an invoice.
 * Only the sign of a value that rounds to exactly zero is changed — a real negative
 * amount such as a -1850.00 refund keeps its sign. Never clamp negatives to zero:
 * refund rows and signed deposit adjustments are stored negative on purpose.
 */
function roundMoney(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return 0.0;
  const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

/**
 * Format local date as YYYY-MM-DD (immune to UTC timezone offsets)
 */
function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Legacy cutoff calculation used only to seed the persisted business date once
 * when a hotel database is first initialized. Never use it for later rollover.
 */
function getHotelBusinessDate(d = new Date(), cutoffHour = 6) {
  const date = new Date(d);
  if (date.getHours() < cutoffHour) {
    date.setDate(date.getDate() - 1);
  }
  return getLocalDateString(date);
}

/** Read the persisted operational date. This date changes only through Night Audit. */
function getCurrentBusinessState() {
  const state = queryOne(`
    SELECT current_business_date, last_audit_at, last_audit_user_id, updated_at
    FROM hotel_business_state WHERE id = 1
  `);
  if (!state || !/^\d{4}-\d{2}-\d{2}$/.test(String(state.current_business_date || ''))) {
    throw new Error('تاريخ العمل الفندقي غير مهيأ في قاعدة البيانات.');
  }
  return state;
}

function getCurrentBusinessDate() {
  return getCurrentBusinessState().current_business_date;
}

const DEFAULT_RECEIPT_STAY_POLICIES = [
  'موعد المغادرة الساعة 2:00 ظهراً، وأي تأخير عنه قد يترتب عليه رسوم إضافية وفق سياسة المنشأة.',
  'يُسترد مبلغ التأمين عند المغادرة بعد معاينة الوحدة، ويحق للمنشأة خصم قيمة أي تلفيات مع بيان السبب.',
  'في الحجوزات الشهرية لا تُسترد قيمة الليالي غير المستخدمة عند المغادرة المبكرة إلا بموافقة الإدارة.',
  'يلتزم النزيل بالمحافظة على الوحدة ومحتوياتها، ويتحمل قيمة أي تلف أو فقد ناتج عن الاستخدام.',
  'يقتصر السكن على النزلاء المسجلين، ويُمنع التنازل عن الوحدة للغير، مع الالتزام بالهدوء وأنظمة المنشأة.',
  'المنشأة غير مسؤولة عن المقتنيات الشخصية المتروكة أو المفقودة داخل الوحدة.'
];

function getReceiptStayPolicies() {
  const row = queryOne('SELECT setting_value FROM app_settings WHERE setting_key = ?', ['receipt_stay_policies']);
  if (!row || !row.setting_value) return [...DEFAULT_RECEIPT_STAY_POLICIES];
  try {
    const parsed = JSON.parse(row.setting_value);
    if (!Array.isArray(parsed)) return [...DEFAULT_RECEIPT_STAY_POLICIES];
    const policies = parsed.map(value => String(value || '').trim()).filter(Boolean).slice(0, 7);
    return policies.length ? policies : [...DEFAULT_RECEIPT_STAY_POLICIES];
  } catch (_) {
    return [...DEFAULT_RECEIPT_STAY_POLICIES];
  }
}

function updateReceiptStayPolicies(input) {
  const policies = (Array.isArray(input) ? input : String(input || '').split(/\r?\n/))
    .map(value => String(value || '').trim())
    .filter(Boolean);
  if (policies.length > 7) throw new Error('يمكن حفظ 7 شروط كحد أقصى.');
  if (policies.some(policy => policy.length > 180)) throw new Error('يجب أن يكون كل شرط سطراً مختصراً لا يتجاوز 180 حرفاً.');
  if (!policies.length) throw new Error('أدخل شرطاً واحداً على الأقل.');

  const database = db;
  const previousSnapshot = database.export();
  database.run('BEGIN TRANSACTION');
  try {
    const statement = database.prepare(`
      INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
    `);
    statement.run(['receipt_stay_policies', JSON.stringify(policies)]);
    statement.free();
    database.run('COMMIT');
  } catch (error) {
    try { database.run('ROLLBACK'); } catch (_) {}
    throw error;
  }
  if (!saveToFile()) {
    restoreInMemorySnapshot(previousSnapshot);
    throw new Error('تعذر حفظ سياسات الإقامة إلى قاعدة البيانات.');
  }
  return getReceiptStayPolicies();
}

function getBusinessDaySettings() {
  const rows = queryAll('SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN (?, ?, ?)', [
    'business_day_cutoff_time', 'hotel_timezone', 'auto_rollover_enabled'
  ]);
  const values = Object.fromEntries(rows.map(row => [row.setting_key, row.setting_value]));
  return {
    business_day_cutoff_time: values.business_day_cutoff_time || '06:00',
    hotel_timezone: values.hotel_timezone || 'Asia/Riyadh',
    auto_rollover_enabled: values.auto_rollover_enabled !== 'false'
  };
}

function getHotelTimezone() {
  return getBusinessDaySettings().hotel_timezone || 'Asia/Riyadh';
}

function formatHotelDateTime(d = new Date()) {
  const tz = getHotelTimezone();
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (!dateObj || Number.isNaN(dateObj.getTime())) return '-';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(dateObj);
  const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

function updateBusinessDaySettings(input = {}) {
  const current = getBusinessDaySettings();
  const cutoff = input.business_day_cutoff_time ?? current.business_day_cutoff_time;
  const timezone = input.hotel_timezone ?? current.hotel_timezone;
  const enabled = input.auto_rollover_enabled ?? current.auto_rollover_enabled;
  const isEnabled = enabled === true || enabled === 'true';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(cutoff))) throw new Error('وقت بداية اليوم يجب أن يكون بصيغة HH:MM.');
  try { new Intl.DateTimeFormat('en', { timeZone: String(timezone) }).format(new Date()); }
  catch (_) { throw new Error('المنطقة الزمنية المحددة غير صالحة.'); }
  const database = db;
  const previousSnapshot = database.export();
  database.run('BEGIN TRANSACTION');
  try {
    const statement = database.prepare(`
      INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
    `);
    statement.run(['business_day_cutoff_time', String(cutoff)]);
    statement.run(['hotel_timezone', String(timezone)]);
    statement.run(['auto_rollover_enabled', isEnabled ? 'true' : 'false']);
    statement.free();
    database.run('COMMIT');
  } catch (error) {
    try { database.run('ROLLBACK'); } catch (_) {}
    throw error;
  }
  if (!saveToFile()) {
    restoreInMemorySnapshot(previousSnapshot);
    throw new Error('تعذر حفظ إعدادات اليوم الفندقي إلى قاعدة البيانات.');
  }
  return getBusinessDaySettings();
}

function getPendingShiftReconciliationAudits() {
  return queryAll(`
    SELECT id, closed_business_date, next_business_date, created_at, summary_json
    FROM night_audits WHERE shift_reconciliation_required = 1 AND shift_reconciled_at IS NULL
    ORDER BY id DESC
  `);
}

function markShiftAuditReconciled(auditId, userId) {
  const id = Number.parseInt(auditId, 10);
  const actor = Number.parseInt(userId, 10);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(actor) || actor <= 0) throw new Error('بيانات المصالحة غير صالحة.');
  const statement = db.prepare(`
    UPDATE night_audits SET shift_reconciled_at = CURRENT_TIMESTAMP, shift_reconciled_by = ?
    WHERE id = ? AND shift_reconciliation_required = 1 AND shift_reconciled_at IS NULL
  `);
  statement.run([actor, id]);
  statement.free();
  const changed = queryOne('SELECT changes() AS count')?.count || 0;
  if (Number(changed) !== 1) throw new Error('تمت المصالحة مسبقاً أو لم يعد السجل موجوداً.');
  if (!saveToFile()) throw new Error('تعذر حفظ تأكيد المصالحة.');
  return { success: true };
}

/**
 * Backup Database Copy to selected destination
 */
function createBackupCopy(targetDestinationPath) {
  if (!currentDbPath || !fs.existsSync(currentDbPath)) {
    throw new Error('ملف قاعدة البيانات غير موجود.');
  }
  if (!saveToFile()) {
    throw new Error('تعذر تفريغ وحفظ بيانات الذاكرة إلى القرص قبل أخذ النسخة الاحتياطية.');
  }
  fs.copyFileSync(currentDbPath, targetDestinationPath);
  return { success: true, backupPath: targetDestinationPath };
}

/**
 * Restore Database from selected file
 */
async function restoreDatabaseFile(sourceBackupPath) {
  if (!fs.existsSync(sourceBackupPath)) {
    throw new Error('ملف النسخة الاحتياطية غير موجود.');
  }
  if (!currentDbPath) {
    throw new Error('مسار قاعدة البيانات الحالي غير محدد.');
  }

  const rollbackPath = currentDbPath + '.safety_rollback';
  if (fs.existsSync(currentDbPath)) {
    fs.copyFileSync(currentDbPath, rollbackPath);
  }

  try {
    if (db) {
      db.close();
      db = null;
    }

    fs.copyFileSync(sourceBackupPath, currentDbPath);
    await init(currentDbPath);

    return { success: true };
  } catch (err) {
    if (fs.existsSync(rollbackPath)) {
      fs.copyFileSync(rollbackPath, currentDbPath);
      await init(currentDbPath);
    }
    throw new Error(`فشلت استعادة النسخة الاحتياطية: ${err.message}`);
  }
}

/**
 * Returns current database file path.
 */
function getDatabaseFilePath() {
  return currentDbPath;
}

/**
 * Safely flush and close database.
 */
function close() {
  if (db) {
    saveToFile();
    db.close();
    db = null;
  }
}

function restoreInMemorySnapshot(snapshot) {
  if (!SQLRuntime || !snapshot) throw new Error('تعذر استعادة لقطة قاعدة البيانات السابقة.');
  if (db) {
    try { db.close(); } catch (_) {}
  }
  db = new SQLRuntime.Database(snapshot);
  db.run('PRAGMA foreign_keys = ON;');
}

/**
 * Factory Reset: Wipes the SQLite file completely and reinitializes fresh baseline data
 * (Default Admin/Staff/User accounts, 7 default available rooms, empty reservations/guests/logs).
 */
async function factoryReset(targetPath) {
  const p = targetPath || currentDbPath;
  if (db) {
    try {
      db.close();
    } catch (e) {
      console.warn('[DB] Warning closing db during reset:', e.message);
    }
    db = null;
  }
  if (p && fs.existsSync(p)) {
    try {
      fs.unlinkSync(p);
      console.log('[DB] تم حذف ملف قاعدة البيانات لإعادة ضبط المصنع:', p);
    } catch (err) {
      console.error('[DB] فشل حذف ملف قاعدة البيانات القديم:', err);
    }
  }
  await init(p);
  console.log('[DB] تم إعادة ضبط المصنع وتهيئة قاعدة بيانات جديدة بالكامل.');
  return { success: true };
}

module.exports = {
  db: dbProxy,
  getDb: () => db,
  saveToFile,
  restoreInMemorySnapshot,
  queryAll,
  queryOne,
  init,
  roundMoney,
  getLocalDateString,
  getHotelBusinessDate,
  getCurrentBusinessState,
  getCurrentBusinessDate,
  getHotelTimezone,
  formatHotelDateTime,
  getBusinessDaySettings,
  updateBusinessDaySettings,
  getReceiptStayPolicies,
  updateReceiptStayPolicies,
  getPendingShiftReconciliationAudits,
  markShiftAuditReconciled,
  createBackupCopy,
  restoreDatabaseFile,
  getDatabaseFilePath,
  close,
  factoryReset
};
