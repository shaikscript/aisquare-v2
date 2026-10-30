import crypto from 'node:crypto';
import express from 'express';
import db, {
  ensureBootstrapState,
  nextAccountCode,
  recordAudit,
  recordPortalActivity,
} from '../db/database.js';
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  extractCandidateSessionTokens,
  requireAuth,
} from '../middleware/auth.js';
import {
  generateSecureToken,
  hashPassword,
  verifyPassword,
} from '../utils/crypto.js';

const router = express.Router();

function isHttpsRequest(req) {
  if (req.secure) return true;
  const xfProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  if (xfProto.includes('https')) return true;
  const origin = String(req.headers.origin || '').toLowerCase();
  if (origin.startsWith('https://')) return true;
  const referer = String(req.headers.referer || '').toLowerCase();
  if (referer.startsWith('https://')) return true;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  if (host.endsWith('.e2b.app') || host.endsWith('.arena.ai')) return true;
  return false;
}

function purgeRequestSessions(req) {
  const tokens = extractCandidateSessionTokens(req);
  if (tokens.length > 0) {
    const delStmt = db.prepare('DELETE FROM sessions WHERE id = ?');
    for (const t of tokens) {
      delStmt.run(t);
    }
  }
}

function expireSessionCookies(req, res) {
  const https = isHttpsRequest(req);
  // Clear both partitioned and standard cookie variants so no browser/proxy retains a stale cookie
  res.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    sameSite: https ? 'none' : 'lax',
    secure: https,
    partitioned: https,
  });
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax`
  );
  if (https) {
    res.append(
      'Set-Cookie',
      `${SESSION_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; Secure; SameSite=None`
    );
    res.append(
      'Set-Cookie',
      `${SESSION_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned`
    );
  }
}

function createUserSession(req, res, userId) {
  // Always invalidate any previous session tokens attached to this browser request before issuing a new one
  purgeRequestSessions(req);

  const token = generateSecureToken(32);
  const expiresAtIso = new Date(Date.now() + SESSION_DURATION_MS)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  db.prepare(
    `INSERT INTO sessions (id, user_id, ip_address, user_agent, created_at, expires_at, last_seen_at)
     VALUES (?, ?, ?, ?, datetime('now'), ?, datetime('now'))`
  ).run(
    token,
    userId,
    req.ip || null,
    String(req.headers['user-agent'] || '').slice(0, 255),
    expiresAtIso
  );

  db.prepare(
    "UPDATE users SET last_login_at = datetime('now'), last_active_at = datetime('now') WHERE id = ?"
  ).run(userId);

  const https = isHttpsRequest(req);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: https ? 'none' : 'lax',
    secure: https,
    partitioned: https,
    maxAge: SESSION_DURATION_MS,
    path: '/',
  });

  return token;
}

function sanitizeUser(row) {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    fullName: row.full_name,
    email: row.email,
    username: row.username,
    role: row.role,
    status: row.status,
    departmentNote: row.department_note,
    mustChangePassword: Boolean(row.must_change_password),
    lastLoginAt: row.last_login_at,
    lastActiveAt: row.last_active_at,
    createdAt: row.created_at,
  };
}

router.get('/me', (req, res) => {
  return res.json({ user: req.user || null });
});

router.get('/setup-status', (_req, res) => {
  const state = ensureBootstrapState();
  return res.json({ needsInitialAdmin: state.needsInitialAdmin });
});

/**
 * First-run secure administrator initialization.
 * Disabled permanently as soon as at least one active/existing admin account is present.
 */
router.post('/bootstrap-admin', async (req, res) => {
  const state = ensureBootstrapState();
  if (!state.needsInitialAdmin) {
    return res.status(403).json({
      error: 'Initial administrator setup has already been completed.',
    });
  }

  const providedToken = String(req.body?.bootstrapToken || '').trim();
  const fullName = String(req.body?.fullName || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  const expectedBuf = Buffer.from(state.token, 'utf8');
  const providedBuf = Buffer.from(providedToken, 'utf8');
  if (
    !providedToken ||
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return res.status(403).json({ error: 'Invalid server bootstrap setup token.' });
  }

  if (!fullName || fullName.length < 2) {
    return res.status(400).json({ error: 'Please provide the administrator full name.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid administrator email address.' });
  }
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return res.status(400).json({
      error: 'Username must be 3–40 characters using lowercase letters, numbers, dots, underscores, or hyphens.',
    });
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters and include both letters and numbers.',
    });
  }

  const passwordHash = await hashPassword(password);
  const code = nextAccountCode('admin');

  const insert = db
    .prepare(
      `INSERT INTO users
        (employee_code, full_name, email, username, password_hash, role, status, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'admin', 'active', 0, datetime('now'), datetime('now'))`
    )
    .run(code, fullName, email, username, passwordHash);

  ensureBootstrapState(); // Removes one-time bootstrap token file

  const created = db.prepare('SELECT * FROM users WHERE id = ?').get(insert.lastInsertRowid);

  recordAudit({
    adminId: created.id,
    adminIdentity: `${created.full_name} (${created.email})`,
    action: 'ADMIN_BOOTSTRAP_INITIALIZED',
    entityType: 'user',
    entityId: created.id,
    summary: `Initialized primary administrator account ${created.employee_code} (${created.email}).`,
    after: { employeeCode: created.employee_code, email: created.email, role: 'admin' },
  });

  const sessionToken = createUserSession(req, res, created.id);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(created.id);
  return res.status(201).json({ user: sanitizeUser(updated), sessionToken });
});

/**
 * Employee Portal Login — strictly for active 'employee' role accounts.
 */
router.post('/employee/login', async (req, res) => {
  const identifier = String(req.body?.identifier || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Please enter both your email/username and password.' });
  }

  const user = db
    .prepare(
      `SELECT * FROM users
       WHERE (LOWER(email) = ? OR LOWER(username) = ?)
         AND status != 'deleted'`
    )
    .get(identifier, identifier);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email/username or password.' });
  }

  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Invalid email/username or password.' });
  }

  if (user.role !== 'employee') {
    return res.status(403).json({
      error: 'This sign-in form is exclusively for employee accounts. Administrators must sign in at the separate Admin Portal.',
    });
  }

  if (user.status !== 'active') {
    return res.status(403).json({
      error: 'Your employee account is currently deactivated. Please contact an AI Square IT Solutions administrator.',
    });
  }

  const sessionToken = createUserSession(req, res, user.id);
  recordPortalActivity({
    userId: user.id,
    userIdentity: `${user.full_name} (${user.employee_code})`,
    eventType: 'EMPLOYEE_LOGIN',
    area: 'employee_portal',
    detail: 'Authenticated via Employee Login',
  });

  const refreshed = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  return res.json({ user: sanitizeUser(refreshed), sessionToken });
});

/**
 * Admin Portal Login — strictly for active 'admin' role accounts.
 */
router.post('/admin/login', async (req, res) => {
  const identifier = String(req.body?.identifier || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Please enter administrator email/username and password.' });
  }

  const user = db
    .prepare(
      `SELECT * FROM users
       WHERE (LOWER(email) = ? OR LOWER(username) = ?)
         AND status != 'deleted'`
    )
    .get(identifier, identifier);

  if (!user) {
    return res.status(401).json({ error: 'Invalid administrator credentials.' });
  }

  const passwordValid = await verifyPassword(password, user.password_hash);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Invalid administrator credentials.' });
  }

  if (user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied. Employee accounts are not authorized to access the Admin Portal.',
    });
  }

  if (user.status !== 'active') {
    return res.status(403).json({
      error: 'This administrator account is currently deactivated.',
    });
  }

  const sessionToken = createUserSession(req, res, user.id);
  recordPortalActivity({
    userId: user.id,
    userIdentity: `${user.full_name} (${user.employee_code})`,
    eventType: 'ADMIN_LOGIN',
    area: 'admin_portal',
    detail: 'Authenticated via Admin Login',
  });

  const refreshed = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  return res.json({ user: sanitizeUser(refreshed), sessionToken });
});

router.post('/logout', (req, res) => {
  if (req.user) {
    // Delete current session AND all active sessions for this user + any stale tokens in headers/cookies
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
    recordPortalActivity({
      userId: req.user.id,
      userIdentity: `${req.user.fullName} (${req.user.employeeCode})`,
      eventType: 'LOGOUT',
      area: req.user.role === 'admin' ? 'admin_portal' : 'employee_portal',
      detail: 'Signed out of session',
    });
  }
  purgeRequestSessions(req);
  expireSessionCookies(req, res);
  return res.json({ success: true });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Please provide both your current password and new password.' });
  }
  if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({
      error: 'New password must be at least 8 characters and include both letters and numbers.',
    });
  }

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = await verifyPassword(currentPassword, row.password_hash);
  if (!valid) {
    return res.status(400).json({ error: 'Your current password is incorrect.' });
  }

  const newHash = await hashPassword(newPassword);
  db.prepare(
    "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?"
  ).run(newHash, req.user.id);

  // Revoke other active sessions for this user while preserving the current session
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(req.user.id, req.user.sessionId);

  recordPortalActivity({
    userId: req.user.id,
    userIdentity: `${req.user.fullName} (${req.user.employeeCode})`,
    eventType: 'PASSWORD_UPDATED',
    area: req.user.role === 'admin' ? 'admin_portal' : 'employee_portal',
    detail: 'Updated account password',
  });

  return res.json({ success: true, message: 'Your password has been securely updated.' });
});

export default router;
