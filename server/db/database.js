import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { generateSecureToken } from '../utils/crypto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '../..');

export const DATA_DIR = process.env.AISQUARE_DATA_DIR
  ? path.resolve(process.env.AISQUARE_DATA_DIR)
  : path.join(ROOT_DIR, 'data');

export const STORAGE_ROOT_DIR = process.env.AISQUARE_STORAGE_DIR
  ? path.resolve(process.env.AISQUARE_STORAGE_DIR)
  : path.join(ROOT_DIR, 'storage');

export const RESUME_STORAGE_DIR = path.join(STORAGE_ROOT_DIR, 'resumes');
export const GUIDELINE_STORAGE_DIR = path.join(STORAGE_ROOT_DIR, 'guidelines');

export const DB_PATH = path.join(DATA_DIR, 'aisquare.db');
export const BOOTSTRAP_TOKEN_PATH = path.join(DATA_DIR, '.bootstrap_token');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(RESUME_STORAGE_DIR, { recursive: true });
fs.mkdirSync(GUIDELINE_STORAGE_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schemaSql);

export function ensureBootstrapState() {
  const adminCountRow = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status != 'deleted'")
    .get();
  const hasAdmin = (adminCountRow?.count || 0) > 0;

  if (hasAdmin) {
    if (fs.existsSync(BOOTSTRAP_TOKEN_PATH)) {
      try {
        fs.unlinkSync(BOOTSTRAP_TOKEN_PATH);
      } catch {
        // Ignore cleanup failure
      }
    }
    return { needsInitialAdmin: false };
  }

  let token = process.env.ADMIN_BOOTSTRAP_TOKEN || '';
  if (!token) {
    if (fs.existsSync(BOOTSTRAP_TOKEN_PATH)) {
      token = fs.readFileSync(BOOTSTRAP_TOKEN_PATH, 'utf8').trim();
    } else {
      token = generateSecureToken(20);
      fs.writeFileSync(BOOTSTRAP_TOKEN_PATH, token, { mode: 0o600 });
    }
  }
  return { needsInitialAdmin: true, token };
}

export function recordAudit({
  adminId = null,
  adminIdentity,
  action,
  entityType,
  entityId = null,
  summary,
  before = null,
  after = null,
}) {
  db.prepare(
    `INSERT INTO audit_logs
      (admin_id, admin_identity, action, entity_type, entity_id, summary, before_json, after_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    adminId,
    adminIdentity,
    action,
    entityType,
    entityId !== null && entityId !== undefined ? String(entityId) : null,
    summary,
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null
  );
}

export function recordPortalActivity({ userId, userIdentity, eventType, area, detail = null }) {
  db.prepare(
    `INSERT INTO portal_activity_logs (user_id, user_identity, event_type, area, detail, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(userId, userIdentity, eventType, area, detail);
}

export function createNotification({ userId, type, title, message, linkPath = null }) {
  db.prepare(
    `INSERT INTO notifications (user_id, notification_type, title, message, link_path, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`
  ).run(userId, type, title, message, linkPath);
}

export function notifyAllActiveEmployees({ type, title, message, linkPath = null }) {
  const activeEmployees = db
    .prepare("SELECT id FROM users WHERE role = 'employee' AND status = 'active'")
    .all();
  const stmt = db.prepare(
    `INSERT INTO notifications (user_id, notification_type, title, message, link_path, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`
  );
  const tx = db.transaction(() => {
    for (const emp of activeEmployees) {
      stmt.run(emp.id, type, title, message, linkPath);
    }
  });
  tx();
}

export function nextAccountCode(role) {
  const prefix = role === 'admin' ? 'ADM' : 'EMP';
  const rows = db
    .prepare('SELECT employee_code FROM users WHERE employee_code LIKE ?')
    .all(`${prefix}-%`);
  let maxNum = 0;
  for (const r of rows) {
    const num = parseInt(String(r.employee_code).split('-')[1], 10);
    if (!Number.isNaN(num) && num > maxNum) maxNum = num;
  }
  return `${prefix}-${String(maxNum + 1).padStart(4, '0')}`;
}

ensureBootstrapState();

export default db;
