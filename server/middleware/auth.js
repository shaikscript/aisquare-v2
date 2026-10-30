import db from '../db/database.js';

export const SESSION_COOKIE_NAME = 'aisquare_session';
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const HEX_SESSION_RE = /^[a-f0-9]{64}$/i;

export function extractCandidateSessionTokens(req) {
  const candidates = [];
  const pushToken = (raw) => {
    if (typeof raw !== 'string') return;
    const trimmed = raw.trim();
    if (!trimmed || !HEX_SESSION_RE.test(trimmed)) return;
    if (!candidates.includes(trimmed)) {
      candidates.push(trimmed);
    }
  };

  // 1. Custom application header (never stripped or overwritten by reverse/sandbox proxies)
  const customHeader = req.headers?.['x-aisquare-session'];
  if (Array.isArray(customHeader)) {
    customHeader.forEach(pushToken);
  } else {
    pushToken(customHeader);
  }

  // 2. Explicit query parameter fallback (_sid / sid) — immune to all header/cookie stripping
  pushToken(req.query?._sid);
  pushToken(req.query?.sid);

  // 3. Standard Authorization: Bearer <token>
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    pushToken(authHeader.slice(7));
  }

  // 4. Standard HttpOnly cookie (standalone domain / first-party tab)
  pushToken(req.cookies?.[SESSION_COOKIE_NAME]);

  return candidates;
}

/**
 * Attach authenticated active user (if any) to req.user.
 * Immediately invalidates sessions belonging to deactivated, deleted, or expired accounts.
 */
export function attachSessionUser(req, res, next) {
  const candidates = extractCandidateSessionTokens(req);
  if (candidates.length === 0) {
    req.user = null;
    return next();
  }

  // Purge expired sessions periodically
  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();

  const selectStmt = db.prepare(
    `SELECT
       s.id AS session_id,
       s.expires_at,
       u.id,
       u.employee_code,
       u.full_name,
       u.email,
       u.username,
       u.role,
       u.status,
       u.department_note,
       u.must_change_password,
       u.last_login_at,
       u.last_active_at,
       u.created_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > datetime('now')`
  );

  let matchedRow = null;
  for (const token of candidates) {
    const row = selectStmt.get(token);
    if (!row) continue;
    if (row.status !== 'active') {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.id);
      continue;
    }
    matchedRow = row;
    break;
  }

  if (!matchedRow) {
    req.user = null;
    return next();
  }

  // Update session & user last_active_at timestamps
  db.prepare("UPDATE sessions SET last_seen_at = datetime('now') WHERE id = ?").run(
    matchedRow.session_id
  );
  db.prepare("UPDATE users SET last_active_at = datetime('now') WHERE id = ?").run(
    matchedRow.id
  );

  req.user = {
    id: matchedRow.id,
    sessionId: matchedRow.session_id,
    employeeCode: matchedRow.employee_code,
    fullName: matchedRow.full_name,
    email: matchedRow.email,
    username: matchedRow.username,
    role: matchedRow.role,
    status: matchedRow.status,
    departmentNote: matchedRow.department_note,
    mustChangePassword: Boolean(matchedRow.must_change_password),
    lastLoginAt: matchedRow.last_login_at,
    lastActiveAt: matchedRow.last_active_at,
    createdAt: matchedRow.created_at,
  };
  return next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in to continue.',
      code: 'UNAUTHENTICATED',
    });
  }
  return next();
}

export function requireRole(expectedRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required. Please sign in to continue.',
        code: 'UNAUTHENTICATED',
      });
    }
    if (req.user.role !== expectedRole) {
      return res.status(403).json({
        error: 'Forbidden: your account role is not authorized to access this area.',
        code: 'FORBIDDEN_ROLE',
      });
    }
    return next();
  };
}
