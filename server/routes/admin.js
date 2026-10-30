import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import db, {
  RESUME_STORAGE_DIR,
  nextAccountCode,
  recordAudit,
} from '../db/database.js';
import { requireRole } from '../middleware/auth.js';
import { hashPassword } from '../utils/crypto.js';

const router = express.Router();

// Enforce authenticated 'admin' role on EVERY route in this router
router.use(requireRole('admin'));

function adminIdentityString(user) {
  return `${user.fullName} (${user.employeeCode})`;
}

/**
 * GET /api/admin/overview
 * Real operational counts from persistent SQLite tables + honest incomplete-phase markers.
 */
router.get('/overview', (_req, res) => {
  const employeeStats = db
    .prepare(
      `SELECT
         COUNT(CASE WHEN status != 'deleted' THEN 1 END) AS total,
         COUNT(CASE WHEN status = 'active' THEN 1 END) AS active,
         COUNT(CASE WHEN status = 'deactivated' THEN 1 END) AS deactivated,
         COUNT(CASE WHEN status = 'deleted' THEN 1 END) AS archived
       FROM users
       WHERE role = 'employee'`
    )
    .get();

  const adminCount = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'")
    .get();

  const onlineSessions = db
    .prepare(
      `SELECT COUNT(DISTINCT s.user_id) AS count
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE u.role = 'employee'
         AND u.status = 'active'
         AND s.expires_at > datetime('now')
         AND s.last_seen_at >= datetime('now', '-15 minutes')`
    )
    .get();

  const jobStats = db
    .prepare(
      `SELECT
         COUNT(*) AS totalJobs,
         COUNT(CASE WHEN status = 'published' THEN 1 END) AS publishedJobs,
         COUNT(CASE WHEN status = 'closed' THEN 1 END) AS closedJobs
       FROM jobs`
    )
    .get();

  const appStats = db
    .prepare(
      `SELECT
         COUNT(*) AS totalApplications,
         COUNT(CASE WHEN status = 'New' THEN 1 END) AS newApplications
       FROM job_applications`
    )
    .get();

  const contactStats = db
    .prepare(
      `SELECT
         COUNT(*) AS totalMessages,
         COUNT(CASE WHEN status = 'unread' THEN 1 END) AS unreadMessages
       FROM contact_messages`
    )
    .get();

  const guidelineStats = db
    .prepare(
      `SELECT
         COUNT(*) AS totalGuidelines,
         COUNT(CASE WHEN status = 'published' THEN 1 END) AS publishedGuidelines
       FROM guidelines`
    )
    .get();

  const assessmentStats = db
    .prepare(
      `SELECT
         COUNT(*) AS totalAssessments,
         COUNT(CASE WHEN status = 'published' THEN 1 END) AS publishedAssessments,
         (SELECT COUNT(*) FROM question_bank WHERE status = 'active' AND is_reusable = 1) AS reusableQuestions
       FROM assessments`
    )
    .get();

  const attemptStats = db
    .prepare(
      `SELECT
         COUNT(*) AS totalAttempts,
         COUNT(CASE WHEN status != 'in_progress' AND review_status = 'pending' AND requires_manual_review = 1 THEN 1 END) AS pendingManualReviews,
         COUNT(CASE WHEN status != 'in_progress' AND is_released = 0 THEN 1 END) AS pendingRelease,
         COUNT(CASE WHEN status != 'in_progress' AND passed = 0 THEN 1 END) AS failedAttempts,
         COUNT(CASE WHEN status = 'expired' THEN 1 END) AS expiredAttempts,
         COUNT(CASE WHEN interruption_count > 0 THEN 1 END) AS interruptedAttempts,
         ROUND(AVG(CASE WHEN is_released = 1 AND percentage IS NOT NULL THEN percentage END), 1) AS avgReleasedPercentage
       FROM assessment_attempts`
    )
    .get();

  const readinessStats = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM projects WHERE status = 'active') AS activeProjects,
         COUNT(CASE WHEN readiness_status = 'approved' THEN 1 END) AS approvedAssignments,
         COUNT(CASE WHEN readiness_status = 'pending_approval' THEN 1 END) AS pendingApprovals
       FROM employee_project_readiness`
    )
    .get();

  const recentFeedback = db
    .prepare(
      `SELECT id, employee_identity AS employeeIdentity, category, subject, status, created_at AS createdAt
       FROM employee_feedback
       ORDER BY created_at DESC
       LIMIT 5`
    )
    .all();

  const recentAnnouncements = db
    .prepare(
      `SELECT id, title, category, status, created_at AS createdAt
       FROM announcements
       ORDER BY created_at DESC
       LIMIT 5`
    )
    .all();

  const recentAudit = db
    .prepare(
      `SELECT id, admin_identity AS adminIdentity, action, entity_type AS entityType,
              entity_id AS entityId, summary, created_at AS createdAt
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT 8`
    )
    .all();

  const recentEmployeeActivity = db
    .prepare(
      `SELECT p.id, p.user_id AS userId, p.user_identity AS userIdentity,
              p.event_type AS eventType, p.area, p.detail, p.created_at AS createdAt,
              u.role
       FROM portal_activity_logs p
       JOIN users u ON u.id = p.user_id
       WHERE u.role = 'employee'
       ORDER BY p.created_at DESC
       LIMIT 8`
    )
    .all();

  return res.json({
    employees: {
      total: employeeStats?.total || 0,
      active: employeeStats?.active || 0,
      deactivated: employeeStats?.deactivated || 0,
      archived: employeeStats?.archived || 0,
      recentlyConnected: onlineSessions?.count || 0,
    },
    admins: {
      active: adminCount?.count || 0,
    },
    guidelines: {
      total: guidelineStats?.totalGuidelines || 0,
      published: guidelineStats?.publishedGuidelines || 0,
    },
    assessments: {
      total: assessmentStats?.totalAssessments || 0,
      published: assessmentStats?.publishedAssessments || 0,
      reusableQuestions: assessmentStats?.reusableQuestions || 0,
      totalAttempts: attemptStats?.totalAttempts || 0,
      pendingManualReviews: attemptStats?.pendingManualReviews || 0,
      pendingRelease: attemptStats?.pendingRelease || 0,
      failedAttempts: attemptStats?.failedAttempts || 0,
      expiredAttempts: attemptStats?.expiredAttempts || 0,
      interruptedAttempts: attemptStats?.interruptedAttempts || 0,
      avgReleasedPercentage: attemptStats?.avgReleasedPercentage ?? null,
    },
    readiness: {
      activeProjects: readinessStats?.activeProjects || 0,
      approvedAssignments: readinessStats?.approvedAssignments || 0,
      pendingApprovals: readinessStats?.pendingApprovals || 0,
    },
    careers: {
      totalJobs: jobStats?.totalJobs || 0,
      publishedJobs: jobStats?.publishedJobs || 0,
      closedJobs: jobStats?.closedJobs || 0,
      totalApplications: appStats?.totalApplications || 0,
      newApplications: appStats?.newApplications || 0,
    },
    enquiries: {
      totalMessages: contactStats?.totalMessages || 0,
      unreadMessages: contactStats?.unreadMessages || 0,
    },
    recentFeedback,
    recentAnnouncements,
    recentAudit,
    recentEmployeeActivity,
  });
});

/* ============================================================================
 * EMPLOYEE ACCOUNT MANAGEMENT (Section 7.3)
 * ========================================================================== */

router.get('/employees', (req, res) => {
  const statusFilter = String(req.query.status || 'non_deleted');
  const search = String(req.query.q || '').trim().toLowerCase();

  let whereClause = "u.role = 'employee'";
  const params = [];

  if (statusFilter === 'active' || statusFilter === 'deactivated' || statusFilter === 'deleted') {
    whereClause += ' AND u.status = ?';
    params.push(statusFilter);
  } else {
    whereClause += " AND u.status != 'deleted'";
  }

  if (search) {
    whereClause +=
      ' AND (LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.username) LIKE ? OR LOWER(u.employee_code) LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const rows = db
    .prepare(
      `SELECT
         u.id,
         u.employee_code AS employeeCode,
         u.full_name AS fullName,
         u.email,
         u.username,
         u.status,
         u.department_note AS departmentNote,
         u.must_change_password AS mustChangePassword,
         u.last_login_at AS lastLoginAt,
         u.last_active_at AS lastActiveAt,
         u.created_at AS createdAt,
         u.deleted_at AS deletedAt,
         (
           SELECT COUNT(*) FROM sessions s
           WHERE s.user_id = u.id
             AND s.expires_at > datetime('now')
             AND s.last_seen_at >= datetime('now', '-15 minutes')
         ) AS activeConnections
       FROM users u
       WHERE ${whereClause}
       ORDER BY u.created_at DESC`
    )
    .all(...params);

  return res.json({
    employees: rows.map((r) => ({
      ...r,
      mustChangePassword: Boolean(r.mustChangePassword),
      recentlyConnected: r.activeConnections > 0,
    })),
  });
});

router.get('/employees/:id', (req, res) => {
  const empId = parseInt(req.params.id, 10);
  if (Number.isNaN(empId)) {
    return res.status(400).json({ error: 'Invalid employee ID.' });
  }

  const emp = db
    .prepare(
      `SELECT
         id,
         employee_code AS employeeCode,
         full_name AS fullName,
         email,
         username,
         role,
         status,
         department_note AS departmentNote,
         must_change_password AS mustChangePassword,
         last_login_at AS lastLoginAt,
         last_active_at AS lastActiveAt,
         created_at AS createdAt,
         deleted_at AS deletedAt
       FROM users
       WHERE id = ? AND role = 'employee'`
    )
    .get(empId);

  if (!emp) {
    return res.status(404).json({ error: 'Employee record not found.' });
  }

  const activity = db
    .prepare(
      `SELECT id, event_type AS eventType, area, detail, created_at AS createdAt
       FROM portal_activity_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 25`
    )
    .all(empId);

  const auditHistory = db
    .prepare(
      `SELECT id, admin_identity AS adminIdentity, action, summary, created_at AS createdAt
       FROM audit_logs
       WHERE entity_type = 'employee' AND entity_id = ?
       ORDER BY created_at DESC
       LIMIT 20`
    )
    .all(String(empId));

  const assessmentHistory = db
    .prepare(
      `SELECT
         att.id,
         a.title AS assessmentTitle,
         att.attempt_number AS attemptNumber,
         att.status,
         att.status_detail AS statusDetail,
         att.final_score AS finalScore,
         att.total_possible_marks AS totalPossibleMarks,
         att.percentage,
         att.passed,
         att.is_released AS isReleased,
         att.started_at AS startedAt
       FROM assessment_attempts att
       JOIN assessments a ON a.id = att.assessment_id
       WHERE att.user_id = ?
       ORDER BY att.started_at DESC
       LIMIT 20`
    )
    .all(empId);

  const projectReadiness = db
    .prepare(
      `SELECT
         p.code AS projectCode,
         p.name AS projectName,
         r.readiness_status AS readinessStatus,
         r.decision_source AS decisionSource,
         r.updated_at AS updatedAt
       FROM employee_project_readiness r
       JOIN projects p ON p.id = r.project_id
       WHERE r.user_id = ?
       ORDER BY r.updated_at DESC`
    )
    .all(empId);

  return res.json({
    employee: {
      ...emp,
      mustChangePassword: Boolean(emp.mustChangePassword),
    },
    activity,
    auditHistory,
    assessmentHistory,
    projectReadiness,
  });
});

router.post('/employees', async (req, res) => {
  const fullName = String(req.body?.fullName || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const departmentNote = String(req.body?.departmentNote || '').trim();
  const mustChangePassword = req.body?.mustChangePassword !== false ? 1 : 0;

  if (!fullName || fullName.length < 2 || fullName.length > 120) {
    return res.status(400).json({ error: 'Full name must be between 2 and 120 characters.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid employee email address.' });
  }
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return res.status(400).json({
      error: 'Username must be 3–40 characters (lowercase letters, numbers, dots, underscores, or hyphens).',
    });
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({
      error: 'Initial password must be at least 8 characters and contain both letters and numbers.',
    });
  }

  const conflict = db
    .prepare('SELECT id, email, username FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?')
    .get(email, username);
  if (conflict) {
    return res.status(409).json({
      error:
        conflict.email.toLowerCase() === email
          ? 'An account with this email address already exists.'
          : 'An account with this username already exists.',
    });
  }

  const passwordHash = await hashPassword(password);
  const employeeCode = nextAccountCode('employee');

  const result = db
    .prepare(
      `INSERT INTO users
        (employee_code, full_name, email, username, password_hash, role, status, department_note, must_change_password, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'employee', 'active', ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .run(
      employeeCode,
      fullName,
      email,
      username,
      passwordHash,
      departmentNote || null,
      mustChangePassword,
      req.user.id
    );

  const newId = result.lastInsertRowid;

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: 'EMPLOYEE_CREATED',
    entityType: 'employee',
    entityId: newId,
    summary: `Created employee account ${employeeCode} for ${fullName} (${email}).`,
    after: {
      employeeCode,
      fullName,
      email,
      username,
      status: 'active',
      departmentNote: departmentNote || null,
      mustChangePassword: Boolean(mustChangePassword),
    },
  });

  return res.status(201).json({
    success: true,
    employee: {
      id: newId,
      employeeCode,
      fullName,
      email,
      username,
      status: 'active',
      departmentNote: departmentNote || null,
      mustChangePassword: Boolean(mustChangePassword),
    },
  });
});

function generateStrongTempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(9);
  let body = '';
  for (let i = 0; i < bytes.length; i += 1) {
    body += alphabet[bytes[i] % alphabet.length];
  }
  return `AiSq${body}9!`;
}

function buildBaseUsername(rawUsername, email, fullName) {
  let candidate = String(rawUsername || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '');

  if (candidate.length < 3 && email.includes('@')) {
    candidate = email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '.')
      .replace(/\.{2,}/g, '.')
      .replace(/^[._-]+|[._-]+$/g, '');
  }

  if (candidate.length < 3) {
    candidate = fullName
      .toLowerCase()
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/\.{2,}/g, '.');
  }

  if (candidate.length < 3) {
    candidate = `evaluator.${crypto.randomBytes(2).toString('hex')}`;
  }

  return candidate.slice(0, 34);
}

/**
 * POST /api/admin/employees/bulk
 * Bulk onboard multiple employee accounts (CSV / spreadsheet rows) with automatic
 * unique username resolution, temporary password generation, and audit logging.
 */
router.post('/employees/bulk', async (req, res, next) => {
  try {
    const rawRows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const defaultDeptNote = String(req.body?.defaultDepartmentNote || '').trim();
    const mustChangePassword = req.body?.mustChangePassword !== false ? 1 : 0;

    if (rawRows.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one employee row to import.' });
    }
    if (rawRows.length > 200) {
      return res.status(400).json({ error: 'Bulk import is capped at 200 employee rows per batch.' });
    }

    const existingUsers = db
      .prepare('SELECT LOWER(email) AS email, LOWER(username) AS username FROM users')
      .all();
    const takenEmails = new Set(existingUsers.map((u) => u.email));
    const takenUsernames = new Set(existingUsers.map((u) => u.username));

    const prepared = [];
    const skipped = [];

    for (let idx = 0; idx < rawRows.length; idx += 1) {
      const item = rawRows[idx] || {};
      const rowNum = idx + 1;
      const fullName = String(item.fullName || '').trim();
      const email = String(item.email || '').trim().toLowerCase();
      const deptNote = String(item.departmentNote || defaultDeptNote || '').trim();
      const customPwd = String(item.password || '').trim();

      if (!fullName || fullName.length < 2 || fullName.length > 120) {
        skipped.push({
          rowNumber: rowNum,
          fullName: fullName || '—',
          email: email || '—',
          reason: 'Full name must be 2–120 characters.',
        });
        continue;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        skipped.push({
          rowNumber: rowNum,
          fullName,
          email: email || '—',
          reason: 'Invalid email format.',
        });
        continue;
      }

      if (takenEmails.has(email)) {
        skipped.push({
          rowNumber: rowNum,
          fullName,
          email,
          reason: 'Email address already exists.',
        });
        continue;
      }

      let passwordPlain = customPwd || generateStrongTempPassword();
      if (passwordPlain.length < 8 || !/[A-Za-z]/.test(passwordPlain) || !/[0-9]/.test(passwordPlain)) {
        skipped.push({
          rowNumber: rowNum,
          fullName,
          email,
          reason: 'Provided password must be at least 8 chars with letters and numbers.',
        });
        continue;
      }

      const baseUser = buildBaseUsername(item.username, email, fullName);
      let uniqueUsername = baseUser;
      let suffix = 2;
      while (takenUsernames.has(uniqueUsername)) {
        uniqueUsername = `${baseUser.slice(0, 34)}${suffix}`;
        suffix += 1;
      }

      takenEmails.add(email);
      takenUsernames.add(uniqueUsername);

      const passwordHash = await hashPassword(passwordPlain);
      prepared.push({
        fullName,
        email,
        username: uniqueUsername,
        passwordPlain,
        passwordHash,
        departmentNote: deptNote || null,
      });
    }

    const insertStmt = db.prepare(
      `INSERT INTO users
        (employee_code, full_name, email, username, password_hash, role, status, department_note, must_change_password, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'employee', 'active', ?, ?, ?, datetime('now'), datetime('now'))`
    );

    const created = [];
    const runBatch = db.transaction((items) => {
      for (const p of items) {
        const employeeCode = nextAccountCode('employee');
        const info = insertStmt.run(
          employeeCode,
          p.fullName,
          p.email,
          p.username,
          p.passwordHash,
          p.departmentNote,
          mustChangePassword,
          req.user.id
        );
        created.push({
          id: info.lastInsertRowid,
          employeeCode,
          fullName: p.fullName,
          email: p.email,
          username: p.username,
          temporaryPassword: p.passwordPlain,
          departmentNote: p.departmentNote,
          mustChangePassword: Boolean(mustChangePassword),
        });
      }
    });

    if (prepared.length > 0) {
      runBatch(prepared);
      recordAudit({
        adminId: req.user.id,
        adminIdentity: adminIdentityString(req.user),
        action: 'EMPLOYEE_BULK_IMPORTED',
        entityType: 'employee',
        entityId: null,
        summary: `Bulk provisioned ${created.length} employee account(s) (${skipped.length} skipped).`,
        after: {
          createdCount: created.length,
          skippedCount: skipped.length,
          employeeCodes: created.map((c) => c.employeeCode),
        },
      });
    }

    return res.status(created.length > 0 ? 201 : 200).json({
      success: true,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    });
  } catch (err) {
    return next(err);
  }
});

router.patch('/employees/:id', (req, res) => {
  const empId = parseInt(req.params.id, 10);
  const existing = db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'employee' AND status != 'deleted'")
    .get(empId);
  if (!existing) {
    return res.status(404).json({ error: 'Active/deactivated employee record not found.' });
  }

  const fullName = String(req.body?.fullName ?? existing.full_name).trim();
  const email = String(req.body?.email ?? existing.email).trim().toLowerCase();
  const username = String(req.body?.username ?? existing.username).trim().toLowerCase();
  const departmentNote = String(req.body?.departmentNote ?? existing.department_note ?? '').trim();

  if (!fullName || fullName.length < 2) {
    return res.status(400).json({ error: 'Full name is required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return res.status(400).json({ error: 'Valid username (3–40 chars) is required.' });
  }

  const conflict = db
    .prepare(
      'SELECT id FROM users WHERE (LOWER(email) = ? OR LOWER(username) = ?) AND id != ?'
    )
    .get(email, username, empId);
  if (conflict) {
    return res.status(409).json({ error: 'Email or username is already assigned to another account.' });
  }

  db.prepare(
    `UPDATE users
     SET full_name = ?, email = ?, username = ?, department_note = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(fullName, email, username, departmentNote || null, empId);

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: 'EMPLOYEE_UPDATED',
    entityType: 'employee',
    entityId: empId,
    summary: `Updated profile details for ${existing.employee_code} (${fullName}).`,
    before: {
      fullName: existing.full_name,
      email: existing.email,
      username: existing.username,
      departmentNote: existing.department_note,
    },
    after: {
      fullName,
      email,
      username,
      departmentNote: departmentNote || null,
    },
  });

  return res.json({ success: true });
});

router.post('/employees/:id/status', (req, res) => {
  const empId = parseInt(req.params.id, 10);
  const nextStatus = String(req.body?.status || '').trim();
  if (!['active', 'deactivated'].includes(nextStatus)) {
    return res.status(400).json({ error: "Status must be 'active' or 'deactivated'." });
  }

  const existing = db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'employee' AND status != 'deleted'")
    .get(empId);
  if (!existing) {
    return res.status(404).json({ error: 'Employee account not found.' });
  }

  if (existing.status === nextStatus) {
    return res.json({ success: true, status: nextStatus });
  }

  db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    nextStatus,
    empId
  );

  // Immediately revoke active sessions when deactivating
  if (nextStatus === 'deactivated') {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(empId);
  }

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: nextStatus === 'deactivated' ? 'EMPLOYEE_DEACTIVATED' : 'EMPLOYEE_REACTIVATED',
    entityType: 'employee',
    entityId: empId,
    summary: `${nextStatus === 'deactivated' ? 'Deactivated' : 'Reactivated'} employee account ${existing.employee_code} (${existing.full_name}).`,
    before: { status: existing.status },
    after: { status: nextStatus },
  });

  return res.json({ success: true, status: nextStatus });
});

router.post('/employees/:id/reset-password', async (req, res) => {
  const empId = parseInt(req.params.id, 10);
  const newPassword = String(req.body?.newPassword || '');

  if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({
      error: 'Temporary password must be at least 8 characters and include letters and numbers.',
    });
  }

  const existing = db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'employee' AND status != 'deleted'")
    .get(empId);
  if (!existing) {
    return res.status(404).json({ error: 'Employee account not found.' });
  }

  const passwordHash = await hashPassword(newPassword);
  db.prepare(
    "UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = datetime('now') WHERE id = ?"
  ).run(passwordHash, empId);

  // Force sign-out of existing employee sessions so new password is required
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(empId);

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: 'EMPLOYEE_PASSWORD_RESET',
    entityType: 'employee',
    entityId: empId,
    summary: `Reset password and revoked active sessions for ${existing.employee_code} (${existing.full_name}).`,
  });

  return res.json({
    success: true,
    message: `Password reset for ${existing.full_name}. All active sessions for this employee were revoked.`,
  });
});

router.delete('/employees/:id', (req, res) => {
  const empId = parseInt(req.params.id, 10);
  const existing = db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'employee' AND status != 'deleted'")
    .get(empId);
  if (!existing) {
    return res.status(404).json({ error: 'Employee account not found or already deleted.' });
  }

  // Soft-delete / archive so historical assessment & audit records remain intact (Section 7.3)
  const archivedEmail = `${existing.email}.deleted.${empId}`;
  const archivedUsername = `${existing.username}.deleted.${empId}`;

  db.prepare(
    `UPDATE users
     SET status = 'deleted',
         email = ?,
         username = ?,
         deleted_at = datetime('now'),
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(archivedEmail, archivedUsername, empId);

  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(empId);

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: 'EMPLOYEE_DELETED',
    entityType: 'employee',
    entityId: empId,
    summary: `Deleted employee account ${existing.employee_code} (${existing.full_name}) while preserving audit & historical records.`,
    before: {
      employeeCode: existing.employee_code,
      fullName: existing.full_name,
      email: existing.email,
      username: existing.username,
      status: existing.status,
    },
    after: {
      status: 'deleted',
      deletedAt: new Date().toISOString(),
    },
  });

  return res.json({ success: true });
});

/* ============================================================================
 * CAREERS, APPLICATIONS & PRIVATE RESUMES (Sections 5.4 & 7.12)
 * ========================================================================== */

router.get('/jobs', (_req, res) => {
  const jobs = db
    .prepare(
      `SELECT
         j.id,
         j.title,
         j.employment_type AS employmentType,
         j.location_note AS locationNote,
         j.description,
         j.responsibilities,
         j.qualifications,
         j.skills,
         j.application_instructions AS applicationInstructions,
         j.status,
         j.created_at AS createdAt,
         j.updated_at AS updatedAt,
         (SELECT COUNT(*) FROM job_applications a WHERE a.job_id = j.id) AS applicationCount
       FROM jobs j
       ORDER BY j.created_at DESC`
    )
    .all();

  return res.json({ jobs });
});

router.post('/jobs', (req, res) => {
  const title = String(req.body?.title || '').trim();
  const employmentType = String(req.body?.employmentType || '').trim();
  const locationNote = String(req.body?.locationNote || '').trim();
  const description = String(req.body?.description || '').trim();
  const responsibilities = String(req.body?.responsibilities || '').trim();
  const qualifications = String(req.body?.qualifications || '').trim();
  const skills = String(req.body?.skills || '').trim();
  const applicationInstructions = String(req.body?.applicationInstructions || '').trim();
  const status = ['draft', 'published', 'closed'].includes(req.body?.status)
    ? req.body.status
    : 'draft';

  if (!title || title.length < 3) {
    return res.status(400).json({ error: 'Position title (at least 3 characters) is required.' });
  }
  if (!description || description.length < 15) {
    return res.status(400).json({ error: 'Job description (at least 15 characters) is required.' });
  }

  const result = db
    .prepare(
      `INSERT INTO jobs (
         title, employment_type, location_note, description, responsibilities,
         qualifications, skills, application_instructions, status, created_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .run(
      title,
      employmentType || null,
      locationNote || null,
      description,
      responsibilities || null,
      qualifications || null,
      skills || null,
      applicationInstructions || null,
      status,
      req.user.id
    );

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: 'JOB_CREATED',
    entityType: 'job',
    entityId: result.lastInsertRowid,
    summary: `Created job opening "${title}" (${status}).`,
    after: { title, employmentType, status },
  });

  return res.status(201).json({ success: true, jobId: result.lastInsertRowid });
});

router.patch('/jobs/:id', (req, res) => {
  const jobId = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!existing) {
    return res.status(404).json({ error: 'Job opening not found.' });
  }

  const title = String(req.body?.title ?? existing.title).trim();
  const employmentType = String(req.body?.employmentType ?? existing.employment_type ?? '').trim();
  const locationNote = String(req.body?.locationNote ?? existing.location_note ?? '').trim();
  const description = String(req.body?.description ?? existing.description).trim();
  const responsibilities = String(req.body?.responsibilities ?? existing.responsibilities ?? '').trim();
  const qualifications = String(req.body?.qualifications ?? existing.qualifications ?? '').trim();
  const skills = String(req.body?.skills ?? existing.skills ?? '').trim();
  const applicationInstructions = String(
    req.body?.applicationInstructions ?? existing.application_instructions ?? ''
  ).trim();
  const status = ['draft', 'published', 'closed'].includes(req.body?.status)
    ? req.body.status
    : existing.status;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required.' });
  }

  db.prepare(
    `UPDATE jobs
     SET title = ?, employment_type = ?, location_note = ?, description = ?,
         responsibilities = ?, qualifications = ?, skills = ?,
         application_instructions = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    title,
    employmentType || null,
    locationNote || null,
    description,
    responsibilities || null,
    qualifications || null,
    skills || null,
    applicationInstructions || null,
    status,
    jobId
  );

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: 'JOB_UPDATED',
    entityType: 'job',
    entityId: jobId,
    summary: `Updated job opening "${title}" (status: ${existing.status} -> ${status}).`,
    before: { title: existing.title, status: existing.status },
    after: { title, status },
  });

  return res.json({ success: true });
});

router.delete('/jobs/:id', (req, res) => {
  const jobId = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!existing) {
    return res.status(404).json({ error: 'Job opening not found.' });
  }

  // ON DELETE SET NULL preserves existing job_applications and their position_title!
  db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: 'JOB_DELETED',
    entityType: 'job',
    entityId: jobId,
    summary: `Deleted job opening "${existing.title}" (received applications preserved).`,
    before: { title: existing.title, status: existing.status },
  });

  return res.json({ success: true });
});

router.get('/applications', (req, res) => {
  const statusFilter = String(req.query.status || 'all');
  let sql = `
    SELECT
      id,
      job_id AS jobId,
      position_title AS positionTitle,
      is_general_application AS isGeneralApplication,
      full_name AS fullName,
      email,
      phone,
      education_experience AS educationExperience,
      resume_original_name AS resumeOriginalName,
      resume_size_bytes AS resumeSizeBytes,
      cover_letter AS coverLetter,
      status,
      admin_notes AS adminNotes,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM job_applications
  `;
  const params = [];
  if (['New', 'Under Review', 'Shortlisted', 'Selected', 'Rejected'].includes(statusFilter)) {
    sql += ' WHERE status = ?';
    params.push(statusFilter);
  }
  sql += ' ORDER BY created_at DESC';

  const applications = db.prepare(sql).all(...params);
  return res.json({
    applications: applications.map((a) => ({
      ...a,
      isGeneralApplication: Boolean(a.isGeneralApplication),
    })),
  });
});

router.patch('/applications/:id', (req, res) => {
  const appId = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM job_applications WHERE id = ?').get(appId);
  if (!existing) {
    return res.status(404).json({ error: 'Application not found.' });
  }

  const allowedStatuses = ['New', 'Under Review', 'Shortlisted', 'Selected', 'Rejected'];
  const status = allowedStatuses.includes(req.body?.status) ? req.body.status : existing.status;
  const adminNotes =
    req.body?.adminNotes !== undefined
      ? String(req.body.adminNotes || '').trim()
      : existing.admin_notes;

  db.prepare(
    `UPDATE job_applications
     SET status = ?, admin_notes = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(status, adminNotes || null, appId);

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: 'APPLICATION_UPDATED',
    entityType: 'job_application',
    entityId: appId,
    summary: `Updated application #${appId} (${existing.full_name} — ${existing.position_title}) status: ${existing.status} -> ${status}.`,
    before: { status: existing.status, adminNotes: existing.admin_notes },
    after: { status, adminNotes: adminNotes || null },
  });

  return res.json({ success: true });
});

router.get('/applications/:id/resume', (req, res) => {
  const appId = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM job_applications WHERE id = ?').get(appId);
  if (!existing) {
    return res.status(404).json({ error: 'Application not found.' });
  }

  const safeStoredName = path.basename(existing.resume_stored_name);
  const fullPath = path.join(RESUME_STORAGE_DIR, safeStoredName);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'Stored resume file could not be located on server.' });
  }

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: 'RESUME_ACCESSED',
    entityType: 'job_application',
    entityId: appId,
    summary: `Accessed candidate resume for ${existing.full_name} (${existing.position_title}).`,
  });

  const safeDownloadName = path.basename(existing.resume_original_name).replace(/["\r\n]/g, '_');
  res.setHeader('Content-Type', existing.resume_mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${safeDownloadName}"`);
  return res.sendFile(fullPath);
});

/* ============================================================================
 * BUSINESS CONTACT ENQUIRIES & COMPANY PUBLIC SETTINGS
 * ========================================================================== */

router.get('/contact-messages', (_req, res) => {
  const messages = db
    .prepare(
      `SELECT id, name, email, subject, message, status, created_at AS createdAt, updated_at AS updatedAt
       FROM contact_messages
       ORDER BY created_at DESC`
    )
    .all();
  return res.json({ messages });
});

router.patch('/contact-messages/:id', (req, res) => {
  const msgId = parseInt(req.params.id, 10);
  const status = String(req.body?.status || '');
  if (!['unread', 'read', 'archived'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const existing = db.prepare('SELECT * FROM contact_messages WHERE id = ?').get(msgId);
  if (!existing) {
    return res.status(404).json({ error: 'Message not found.' });
  }

  db.prepare(
    "UPDATE contact_messages SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, msgId);

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: 'CONTACT_ENQUIRY_STATUS_CHANGED',
    entityType: 'contact_message',
    entityId: msgId,
    summary: `Marked contact enquiry #${msgId} (${existing.subject}) as ${status}.`,
    before: { status: existing.status },
    after: { status },
  });

  return res.json({ success: true });
});

function parseCoordinatesFromAnyString(str = '') {
  const s = String(str || '').trim();
  if (!s) return null;
  const bang = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bang) return { lat: Number(bang[1]), lng: Number(bang[2]) };
  const at = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  const q = s.match(/[?&](?:q|ll|query)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (q) return { lat: Number(q[1]), lng: Number(q[2]) };
  const raw = s.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
  if (raw) return { lat: Number(raw[1]), lng: Number(raw[2]) };
  return null;
}

async function resolveGeoCoordinates(officeAddress, mapLink) {
  const direct = parseCoordinatesFromAnyString(mapLink) || parseCoordinatesFromAnyString(officeAddress);
  if (direct) return direct;

  // Follow short Google Maps links (e.g. https://maps.app.goo.gl/...) to extract @lat,lng
  if (/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(mapLink)) {
    try {
      const r = await fetch(mapLink, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': 'AISquarePlatform/1.0' },
      });
      const fromFinalUrl = parseCoordinatesFromAnyString(r.url);
      if (fromFinalUrl) return fromFinalUrl;
    } catch {
      // Fallback to text geocoding below
    }
  }

  // Geocode plain-text officeAddress (or non-URL mapLink) via OpenStreetMap Nominatim
  const queryText = officeAddress || (!/^https?:\/\//i.test(mapLink) ? mapLink : '');
  if (queryText && queryText.length >= 3) {
    const candidates = [
      queryText,
      // Also try simplified last 3 comma segments if full building name isn't indexed in OSM
      queryText.split(',').slice(-3).join(',').trim(),
    ].filter(Boolean);

    for (const candidate of candidates) {
      try {
        const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          candidate
        )}`;
        const resp = await fetch(geoUrl, {
          signal: AbortSignal.timeout(3000),
          headers: { 'User-Agent': 'AISquareITSolutionsPlatform/1.0' },
        });
        if (resp.ok) {
          const arr = await resp.json();
          if (Array.isArray(arr) && arr[0]?.lat && arr[0]?.lon) {
            return { lat: Number(arr[0].lat), lng: Number(arr[0].lon) };
          }
        }
      } catch {
        // Ignore network/timeout during offline tests
      }
    }
  }
  return null;
}

router.get('/company-settings', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM company_settings').all();
  const map = {};
  for (const r of rows) map[r.key] = r.value;

  let values = [];
  if (map.company_values_json) {
    try {
      const parsed = JSON.parse(map.company_values_json);
      if (Array.isArray(parsed)) values = parsed;
    } catch {
      values = [];
    }
  }

  return res.json({
    mission: map.company_mission || '',
    vision: map.company_vision || '',
    valuesText: values.join('\n'),
    contactEmail: map.public_contact_email || '',
    contactPhone: map.public_contact_phone || '',
    officeAddress: map.public_office_address || '',
    mapLink: map.public_map_link || '',
    mapLat: map.public_map_lat ? Number(map.public_map_lat) : null,
    mapLng: map.public_map_lng ? Number(map.public_map_lng) : null,
    privacyContactNote: map.privacy_contact_note || '',
  });
});

router.put('/company-settings', async (req, res) => {
  const existingRows = db.prepare('SELECT key, value FROM company_settings').all();
  const existing = {};
  for (const r of existingRows) existing[r.key] = r.value;

  const officeAddress =
    req.body?.officeAddress !== undefined
      ? String(req.body.officeAddress || '').trim()
      : existing.public_office_address || '';
  const mapLink =
    req.body?.mapLink !== undefined
      ? String(req.body.mapLink || '').trim()
      : existing.public_map_link || '';

  let coords = null;
  if (officeAddress || mapLink) {
    coords = await resolveGeoCoordinates(officeAddress, mapLink);
  }

  const fields = {
    company_mission:
      req.body?.mission !== undefined
        ? String(req.body.mission || '').trim()
        : existing.company_mission || '',
    company_vision:
      req.body?.vision !== undefined
        ? String(req.body.vision || '').trim()
        : existing.company_vision || '',
    public_contact_email:
      req.body?.contactEmail !== undefined
        ? String(req.body.contactEmail || '').trim()
        : existing.public_contact_email || '',
    public_contact_phone:
      req.body?.contactPhone !== undefined
        ? String(req.body.contactPhone || '').trim()
        : existing.public_contact_phone || '',
    public_office_address: officeAddress,
    public_map_link: mapLink,
    public_map_lat: coords ? String(coords.lat) : '',
    public_map_lng: coords ? String(coords.lng) : '',
    privacy_contact_note:
      req.body?.privacyContactNote !== undefined
        ? String(req.body.privacyContactNote || '').trim()
        : existing.privacy_contact_note || '',
  };

  if (req.body?.valuesText !== undefined) {
    const valuesArr = String(req.body.valuesText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    fields.company_values_json = JSON.stringify(valuesArr);
  } else if (existing.company_values_json) {
    fields.company_values_json = existing.company_values_json;
  }

  const upsert = db.prepare(
    `INSERT INTO company_settings (key, value, updated_by, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_by = excluded.updated_by,
       updated_at = datetime('now')`
  );

  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(fields)) {
      upsert.run(k, v || null, req.user.id);
    }
  });
  tx();

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: 'COMPANY_PUBLIC_SETTINGS_UPDATED',
    entityType: 'company_settings',
    entityId: 'global',
    summary: 'Updated approved company public profile & contact settings.',
  });

  return res.json({
    success: true,
    mapLat: coords ? coords.lat : null,
    mapLng: coords ? coords.lng : null,
  });
});

/* ============================================================================
 * ADMINISTRATIVE AUDIT LOG & EMPLOYEE PORTAL ACTIVITY (Sections 7.15 & 7.16)
 * ========================================================================== */

router.get('/activity', (req, res) => {
  const actionFilter = String(req.query.action || '').trim();

  let auditSql = `
    SELECT id, admin_id AS adminId, admin_identity AS adminIdentity, action,
           entity_type AS entityType, entity_id AS entityId, summary,
           before_json AS beforeJson, after_json AS afterJson, created_at AS createdAt
    FROM audit_logs
  `;
  const params = [];
  if (actionFilter) {
    auditSql += ' WHERE action = ?';
    params.push(actionFilter);
  }
  auditSql += ' ORDER BY created_at DESC LIMIT 100';

  const auditLogs = db.prepare(auditSql).all(...params);

  const portalActivity = db
    .prepare(
      `SELECT p.id, p.user_id AS userId, p.user_identity AS userIdentity,
              p.event_type AS eventType, p.area, p.detail, p.created_at AS createdAt,
              u.role, u.status
       FROM portal_activity_logs p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC
       LIMIT 100`
    )
    .all();

  const employeePresence = db
    .prepare(
      `SELECT
         u.id,
         u.employee_code AS employeeCode,
         u.full_name AS fullName,
         u.status,
         u.last_login_at AS lastLoginAt,
         u.last_active_at AS lastActiveAt,
         (
           SELECT MAX(s.last_seen_at)
           FROM sessions s
           WHERE s.user_id = u.id
             AND s.expires_at > datetime('now')
             AND s.last_seen_at >= datetime('now', '-15 minutes')
         ) AS recentlyConnectedAt
       FROM users u
       WHERE u.role = 'employee' AND u.status != 'deleted'
       ORDER BY u.last_active_at DESC`
    )
    .all();

  const guidelineStudyLogs = db
    .prepare(
      `SELECT
         al.id,
         u.employee_code AS employeeCode,
         u.full_name AS fullName,
         g.title AS guidelineTitle,
         al.version_number AS versionNumber,
         al.duration_seconds AS durationSeconds,
         al.opened_at AS openedAt
       FROM guideline_access_logs al
       JOIN users u ON u.id = al.user_id
       JOIN guidelines g ON g.id = al.guideline_id
       ORDER BY al.opened_at DESC
       LIMIT 50`
    )
    .all();

  const assessmentActivityLogs = db
    .prepare(
      `SELECT
         ev.id,
         att.id AS attemptId,
         u.employee_code AS employeeCode,
         u.full_name AS fullName,
         a.title AS assessmentTitle,
         ev.event_type AS eventType,
         ev.detail,
         ev.created_at AS createdAt
       FROM attempt_events ev
       JOIN assessment_attempts att ON att.id = ev.attempt_id
       JOIN users u ON u.id = att.user_id
       JOIN assessments a ON a.id = att.assessment_id
       ORDER BY ev.created_at DESC
       LIMIT 60`
    )
    .all();

  return res.json({
    auditLogs: auditLogs.map((l) => ({
      ...l,
      before: l.beforeJson ? JSON.parse(l.beforeJson) : null,
      after: l.afterJson ? JSON.parse(l.afterJson) : null,
    })),
    portalActivity,
    employeePresence,
    guidelineStudyLogs,
    assessmentActivityLogs,
  });
});

/* ============================================================================
 * ADMINISTRATOR ACCOUNT MANAGEMENT (Authorized Admin Provisioning)
 * ========================================================================== */

router.get('/admins', (req, res) => {
  const statusFilter = String(req.query.status || 'non_deleted');
  const search = String(req.query.q || '').trim().toLowerCase();

  let whereClause = "u.role = 'admin'";
  const params = [];

  if (statusFilter === 'active' || statusFilter === 'deactivated' || statusFilter === 'deleted') {
    whereClause += ' AND u.status = ?';
    params.push(statusFilter);
  } else {
    whereClause += " AND u.status != 'deleted'";
  }

  if (search) {
    whereClause +=
      ' AND (LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(u.username) LIKE ? OR LOWER(u.employee_code) LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const admins = db
    .prepare(
      `SELECT
         u.id,
         u.employee_code AS employeeCode,
         u.full_name AS fullName,
         u.email,
         u.username,
         u.status,
         u.department_note AS departmentNote,
         u.must_change_password AS mustChangePassword,
         u.last_login_at AS lastLoginAt,
         u.last_active_at AS lastActiveAt,
         u.created_at AS createdAt,
         EXISTS(
           SELECT 1 FROM sessions s
           WHERE s.user_id = u.id
             AND s.expires_at > datetime('now')
             AND s.last_seen_at >= datetime('now', '-15 minutes')
         ) AS recentlyConnected
       FROM users u
       WHERE ${whereClause}
       ORDER BY u.id ASC`
    )
    .all(...params)
    .map((a) => ({
      ...a,
      mustChangePassword: Boolean(a.mustChangePassword),
      recentlyConnected: Boolean(a.recentlyConnected),
    }));

  return res.json({ admins });
});

router.post('/admins', async (req, res) => {
  const fullName = String(req.body?.fullName || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const departmentNote = String(req.body?.departmentNote || '').trim();
  const mustChangePassword = req.body?.mustChangePassword !== false ? 1 : 0;

  if (!fullName || fullName.length < 2 || fullName.length > 120) {
    return res.status(400).json({ error: 'Full name must be between 2 and 120 characters.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid administrator email address.' });
  }
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return res.status(400).json({
      error: 'Username must be 3–40 characters (lowercase letters, numbers, dots, underscores, or hyphens).',
    });
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({
      error: 'Initial password must be at least 8 characters and contain both letters and numbers.',
    });
  }

  const conflict = db
    .prepare('SELECT id, email, username FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?')
    .get(email, username);
  if (conflict) {
    return res.status(409).json({
      error:
        conflict.email.toLowerCase() === email
          ? 'An account with this email address already exists.'
          : 'An account with this username already exists.',
    });
  }

  const adminCode = nextAccountCode('admin');
  const passwordHash = await hashPassword(password);

  const result = db
    .prepare(
      `INSERT INTO users (
         employee_code, full_name, email, username, password_hash, role, status,
         department_note, must_change_password, created_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 'admin', 'active', ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .run(
      adminCode,
      fullName,
      email,
      username,
      passwordHash,
      departmentNote || null,
      mustChangePassword,
      req.user.id
    );

  const created = db
    .prepare(
      `SELECT id, employee_code AS employeeCode, full_name AS fullName, email, username,
              status, department_note AS departmentNote, created_at AS createdAt
       FROM users WHERE id = ?`
    )
    .get(result.lastInsertRowid);

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: 'ADMIN_CREATED',
    entityType: 'admin',
    entityId: created.id,
    summary: `Provisioned authorized administrator ${created.employeeCode} (${created.fullName} — ${created.email}).`,
    after: {
      adminCode: created.employeeCode,
      fullName: created.fullName,
      email: created.email,
      username: created.username,
      status: 'active',
    },
  });

  return res.status(201).json({ admin: created });
});

router.patch('/admins/:id', (req, res) => {
  const adminId = parseInt(req.params.id, 10);
  const existing = db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'admin' AND status != 'deleted'")
    .get(adminId);
  if (!existing) {
    return res.status(404).json({ error: 'Administrator account not found.' });
  }

  const fullName = String(req.body?.fullName ?? existing.full_name).trim();
  const email = String(req.body?.email ?? existing.email).trim().toLowerCase();
  const username = String(req.body?.username ?? existing.username).trim().toLowerCase();
  const departmentNote = String(req.body?.departmentNote ?? existing.department_note ?? '').trim();

  if (!fullName || fullName.length < 2) {
    return res.status(400).json({ error: 'Full name must be at least 2 characters.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return res.status(400).json({ error: 'Invalid username format.' });
  }

  const conflict = db
    .prepare(
      'SELECT id FROM users WHERE id != ? AND (LOWER(email) = ? OR LOWER(username) = ?)'
    )
    .get(adminId, email, username);
  if (conflict) {
    return res.status(409).json({ error: 'Email or username is already assigned to another account.' });
  }

  db.prepare(
    `UPDATE users
     SET full_name = ?, email = ?, username = ?, department_note = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(fullName, email, username, departmentNote || null, adminId);

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: 'ADMIN_UPDATED',
    entityType: 'admin',
    entityId: adminId,
    summary: `Updated administrator profile ${existing.employee_code} (${fullName}).`,
    before: { fullName: existing.full_name, email: existing.email, username: existing.username },
    after: { fullName, email, username, departmentNote: departmentNote || null },
  });

  return res.json({ success: true });
});

router.post('/admins/:id/status', (req, res) => {
  const adminId = parseInt(req.params.id, 10);
  const nextStatus = String(req.body?.status || '').trim();
  if (!['active', 'deactivated'].includes(nextStatus)) {
    return res.status(400).json({ error: "Status must be 'active' or 'deactivated'." });
  }

  if (adminId === req.user.id && nextStatus === 'deactivated') {
    return res.status(400).json({
      error: 'You cannot deactivate your own currently signed-in administrator account.',
    });
  }

  const existing = db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'admin' AND status != 'deleted'")
    .get(adminId);
  if (!existing) {
    return res.status(404).json({ error: 'Administrator account not found.' });
  }

  if (nextStatus === 'deactivated') {
    const activeAdmins = db
      .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'")
      .get();
    if ((activeAdmins?.count || 0) <= 1) {
      return res.status(400).json({
        error: 'At least one active administrator account must remain enabled.',
      });
    }
  }

  db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    nextStatus,
    adminId
  );

  if (nextStatus === 'deactivated') {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(adminId);
  }

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: nextStatus === 'deactivated' ? 'ADMIN_DEACTIVATED' : 'ADMIN_REACTIVATED',
    entityType: 'admin',
    entityId: adminId,
    summary: `${nextStatus === 'deactivated' ? 'Deactivated' : 'Reactivated'} administrator ${existing.employee_code} (${existing.full_name}).`,
    before: { status: existing.status },
    after: { status: nextStatus },
  });

  return res.json({ success: true, status: nextStatus });
});

router.post('/admins/:id/reset-password', async (req, res) => {
  const adminId = parseInt(req.params.id, 10);
  const newPassword = String(req.body?.newPassword || '');

  if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({
      error: 'Temporary password must be at least 8 characters and include letters and numbers.',
    });
  }

  const existing = db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'admin' AND status != 'deleted'")
    .get(adminId);
  if (!existing) {
    return res.status(404).json({ error: 'Administrator account not found.' });
  }

  const passwordHash = await hashPassword(newPassword);
  db.prepare(
    `UPDATE users
     SET password_hash = ?, must_change_password = 1, updated_at = datetime('now')
     WHERE id = ?`
  ).run(passwordHash, adminId);

  if (adminId !== req.user.id) {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(adminId);
  }

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: 'ADMIN_PASSWORD_RESET',
    entityType: 'admin',
    entityId: adminId,
    summary: `Reset password for administrator ${existing.employee_code} (${existing.full_name}).`,
  });

  return res.json({ success: true });
});

router.delete('/admins/:id', (req, res) => {
  const adminId = parseInt(req.params.id, 10);
  if (adminId === req.user.id) {
    return res.status(400).json({
      error: 'You cannot delete your own currently signed-in administrator account.',
    });
  }

  const existing = db
    .prepare("SELECT * FROM users WHERE id = ? AND role = 'admin' AND status != 'deleted'")
    .get(adminId);
  if (!existing) {
    return res.status(404).json({ error: 'Administrator account not found.' });
  }

  const activeAdmins = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'")
    .get();
  if (existing.status === 'active' && (activeAdmins?.count || 0) <= 1) {
    return res.status(400).json({
      error: 'Cannot delete the last remaining active administrator account.',
    });
  }

  const tombstoneSuffix = `.archived.${adminId}.${Date.now()}`;
  db.prepare(
    `UPDATE users
     SET status = 'deleted',
         deleted_at = datetime('now'),
         email = email || ?,
         username = username || ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(tombstoneSuffix, tombstoneSuffix, adminId);

  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(adminId);

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentityString(req.user),
    action: 'ADMIN_DELETED',
    entityType: 'admin',
    entityId: adminId,
    summary: `Archived/deleted administrator ${existing.employee_code} (${existing.full_name}) while preserving audit trail.`,
    before: { status: existing.status, email: existing.email, username: existing.username },
    after: { status: 'deleted' },
  });

  return res.json({ success: true });
});

export default router;
