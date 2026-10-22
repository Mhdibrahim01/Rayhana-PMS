/**
 * نظام ريحانة للوحدات السكنية (Rayhana Suites ERP)
 * Users, Authentication & Employee Activity Logs Module
 */

const { db, queryOne, queryAll, saveToFile } = require('./connection');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;

/**
 * Check if a stored value is a bcrypt hash ( $2a$ / $2b$ / $2y$ )
 */
function isBcryptHash(val) {
  return typeof val === 'string' && /^\$2[aby]\$\d{2}\$/.test(val);
}

function hashPassword(plain) {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

/**
 * Verify user login credentials.
 * Supports both bcrypt-hashed and legacy plaintext passwords.
 * On successful legacy plaintext match, transparently migrates the
 * stored password to bcrypt and persists it (lazy migration).
 */
function verifyUser(username, password) {
  const cleanUsername = (username || '').trim();
  if (!cleanUsername || !password) {
    return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' };
  }
  // Fetch by username only — password verification is done in JS via bcrypt
  const row = queryOne("SELECT id, username, password, role FROM users WHERE username = ?", [cleanUsername]);
  if (!row) {
    return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' };
  }

  const stored = row.password || '';
  let ok = false;

  if (isBcryptHash(stored)) {
    try {
      ok = bcrypt.compareSync(password, stored);
    } catch (e) {
      ok = false;
    }
  } else {
    // Legacy plaintext path — direct comparison
    ok = (password === stored);
    // Transparent migration: upgrade plaintext to bcrypt on success
    if (ok) {
      try {
        const newHash = hashPassword(password);
        const stmt = db.prepare("UPDATE users SET password = ? WHERE id = ?");
        stmt.run([newHash, row.id]);
        stmt.free();
        saveToFile();
      } catch (migErr) {
        console.warn('[Auth Migration] Failed to re-hash legacy password for user', cleanUsername, migErr.message);
      }
    }
  }

  if (ok) {
    const user = { id: row.id, username: row.username, role: row.role };
    return { success: true, user };
  }
  return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' };
}

/**
 * User Management (RBAC) Functions
 */
function getAllUsers() {
  return queryAll("SELECT id, username, role, created_at FROM users ORDER BY id ASC");
}

function addUser({ username, password, role }) {
  if (!username || !password) throw new Error('اسم المستخدم وكلمة المرور مطلوبان.');
  const cleanUsername = username.trim();
  const existing = queryOne("SELECT id FROM users WHERE username = ?", [cleanUsername]);
  if (existing) throw new Error(`اسم المستخدم "${cleanUsername}" مسجل مسبقاً.`);
  
  const userRole = (role === 'Admin') ? 'Admin' : 'User';
  const hashed = hashPassword(password);
  const stmt = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
  stmt.run([cleanUsername, hashed, userRole]);
  stmt.free();
  saveToFile();

  return queryOne("SELECT id, username, role, created_at FROM users WHERE username = ?", [cleanUsername]);
}

function updateUserPassword(userId, newPassword) {
  if (!newPassword || newPassword.trim().length < 3) {
    throw new Error('كلمة المرور يجب أن لا تقل عن 3 أحرف.');
  }
  const hashed = hashPassword(newPassword.trim());
  const stmt = db.prepare("UPDATE users SET password = ? WHERE id = ?");
  stmt.run([hashed, parseInt(userId, 10)]);
  stmt.free();
  saveToFile();
  return true;
}

function deleteUser(userId) {
  const targetId = parseInt(userId, 10);
  const user = queryOne("SELECT username FROM users WHERE id = ?", [targetId]);
  if (!user) throw new Error('المستخدم غير موجود.');
  if (user.username.toLowerCase() === 'admin') {
    throw new Error('لا يمكن حذف حساب المسؤول الرئيسي (admin).');
  }
  const hasPayments = queryOne("SELECT id FROM payments WHERE user_id = ? LIMIT 1", [targetId]);
  if (hasPayments) {
    throw new Error('لا يمكن حذف هذا المستخدم لوجود سندات مالية ومقبوضات مسجلة باسمه في النظام.');
  }
  const hasLogs = queryOne("SELECT id FROM EmployeeLogs WHERE user_id = ? LIMIT 1", [targetId]);
  if (hasLogs) {
    throw new Error('لا يمكن حذف هذا المستخدم لوجود سجلات دخول ونشاط مرتبطة به في النظام.');
  }
  const stmt = db.prepare("DELETE FROM users WHERE id = ?");
  stmt.run([targetId]);
  stmt.free();
  saveToFile();
  return true;
}

/**
 * Employee Activity Logs Tracking
 */
function logEmployeeLogin(userId) {
  const stmt = db.prepare("INSERT INTO EmployeeLogs (user_id, login_time) VALUES (?, datetime('now', 'localtime'))");
  stmt.run([parseInt(userId, 10)]);
  stmt.free();
  saveToFile();
  const lastLog = queryOne("SELECT id FROM EmployeeLogs WHERE user_id = ? ORDER BY id DESC LIMIT 1", [parseInt(userId, 10)]);
  return lastLog ? lastLog.id : null;
}

function logEmployeeLogout(logId) {
  if (!logId) return false;
  const stmt = db.prepare("UPDATE EmployeeLogs SET logout_time = datetime('now', 'localtime') WHERE id = ?");
  stmt.run([parseInt(logId, 10)]);
  stmt.free();
  saveToFile();
  return true;
}

function getEmployeeLogs() {
  const sql = `
    SELECT 
      l.id,
      l.user_id,
      u.username,
      u.role,
      l.login_time,
      l.logout_time
    FROM EmployeeLogs l
    JOIN users u ON l.user_id = u.id
    ORDER BY l.login_time DESC
  `;
  return queryAll(sql);
}

module.exports = {
  isBcryptHash,
  hashPassword,
  verifyUser,
  getAllUsers,
  addUser,
  updateUserPassword,
  deleteUser,
  logEmployeeLogin,
  logEmployeeLogout,
  getEmployeeLogs
};
