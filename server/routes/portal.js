import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import db, {
  GUIDELINE_STORAGE_DIR,
  recordPortalActivity,
} from '../db/database.js';
import { requireRole } from '../middleware/auth.js';
import {
  finalizeAttemptInternal,
  syncAttemptTimingAndExpiry,
} from '../utils/assessmentEngine.js';

const router = express.Router();

// Enforce authenticated 'employee' role on EVERY route in this router
router.use(requireRole('employee'));

/**
 * Helper: check if employee currently has an active in-progress assessment attempt
 * (syncing any expired timed attempt first so an expired test never permanently locks navigation!).
 */
function getActiveInProgressAttempt(userId) {
  const candidates = db
    .prepare("SELECT id, assessment_id FROM assessment_attempts WHERE user_id = ? AND status = 'in_progress'")
    .all(userId);

  for (const c of candidates) {
    const synced = syncAttemptTimingAndExpiry(c.id);
    if (synced?.attempt?.status === 'in_progress') {
      return synced.attempt;
    }
  }
  return null;
}

/**
 * GET /api/portal/status
 * Lightweight shell status for unread notifications & active assessment navigation lock.
 */
router.get('/status', (req, res) => {
  const activeAttempt = getActiveInProgressAttempt(req.user.id);
  const unreadRow = db
    .prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(req.user.id);

  return res.json({
    activeAttempt: activeAttempt
      ? { id: activeAttempt.id, assessmentId: activeAttempt.assessment_id, title: activeAttempt.assessment_title }
      : null,
    unreadNotifications: unreadRow?.count || 0,
  });
});

/**
 * GET /api/portal/overview
 * Complete Employee Dashboard overview (Section 6.2) — strictly isolated to req.user.id.
 */
router.get('/overview', (req, res) => {
  const activeAttempt = getActiveInProgressAttempt(req.user.id);

  // Available assessments (excluding future assessments!)
  const availableAssessments = db
    .prepare(
      `SELECT
         a.id,
         a.title,
         a.project_task_ref AS projectTaskRef,
         a.is_timed AS isTimed,
         a.time_limit_minutes AS timeLimitMinutes,
         p.name AS projectName
       FROM assessments a
       LEFT JOIN projects p ON p.id = a.project_id
       WHERE a.status = 'published'
         AND (a.available_from IS NULL OR a.available_from = '' OR datetime(a.available_from) <= datetime('now'))
         AND (a.available_until IS NULL OR a.available_until = '' OR datetime(a.available_until) >= datetime('now'))
       ORDER BY a.created_at DESC
       LIMIT 6`
    )
    .all();

  // Strictly RELEASED results only (Section 6.2 & 6.7)
  const recentReleasedResults = db
    .prepare(
      `SELECT
         att.id,
         att.assessment_id AS assessmentId,
         a.title AS assessmentTitle,
         att.attempt_number AS attemptNumber,
         att.status,
         att.status_detail AS statusDetail,
         att.final_score AS finalScore,
         att.total_possible_marks AS totalPossibleMarks,
         att.percentage,
         att.passed,
         att.released_at AS releasedAt
       FROM assessment_attempts att
       JOIN assessments a ON a.id = att.assessment_id
       WHERE att.user_id = ? AND att.is_released = 1
       ORDER BY att.released_at DESC
       LIMIT 5`
    )
    .all(req.user.id);

  // Project-specific readiness statuses
  const projectReadiness = db
    .prepare(
      `SELECT
         p.id AS projectId,
         p.code AS projectCode,
         p.name AS projectName,
         p.domain_category AS domainCategory,
         COALESCE(r.readiness_status, 'not_ready') AS readinessStatus,
         r.updated_at AS updatedAt
       FROM projects p
       LEFT JOIN employee_project_readiness r
         ON r.project_id = p.id AND r.user_id = ?
       WHERE p.status = 'active'
       ORDER BY p.name ASC`
    )
    .all(req.user.id);

  // Recent company-wide announcements
  const recentAnnouncements = db
    .prepare(
      `SELECT id, title, category, body, published_at AS publishedAt, created_at AS createdAt
       FROM announcements
       WHERE status = 'published'
       ORDER BY COALESCE(published_at, created_at) DESC
       LIMIT 4`
    )
    .all();

  // Recent notifications
  const notifications = db
    .prepare(
      `SELECT id, notification_type AS type, title, message, link_path AS linkPath,
              is_read AS isRead, created_at AS createdAt
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 5`
    )
    .all(req.user.id);

  const recentActivity = db
    .prepare(
      `SELECT id, event_type AS eventType, area, detail, created_at AS createdAt
       FROM portal_activity_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 8`
    )
    .all(req.user.id);

  const guidelineCount = db
    .prepare("SELECT COUNT(*) AS count FROM guidelines WHERE status = 'published'")
    .get();

  return res.json({
    profile: req.user,
    activeAttempt: activeAttempt
      ? { id: activeAttempt.id, assessmentId: activeAttempt.assessment_id, title: activeAttempt.assessment_title }
      : null,
    availableAssessments: availableAssessments.map((a) => ({ ...a, isTimed: Boolean(a.isTimed) })),
    recentReleasedResults: recentReleasedResults.map((r) => ({ ...r, passed: Boolean(r.passed) })),
    projectReadiness,
    recentAnnouncements,
    notifications: notifications.map((n) => ({ ...n, isRead: Boolean(n.isRead) })),
    recentActivity,
    publishedGuidelinesCount: guidelineCount?.count || 0,
  });
});

router.post('/heartbeat', (req, res) => {
  const currentPath = String(req.body?.path || '/portal').slice(0, 120);
  recordPortalActivity({
    userId: req.user.id,
    userIdentity: `${req.user.fullName} (${req.user.employeeCode})`,
    eventType: 'PORTAL_NAVIGATION',
    area: 'employee_portal',
    detail: `Visited ${currentPath}`,
  });
  return res.json({ ok: true });
});

/* ============================================================================
 * PHASE 4: CENTRAL GUIDELINE LIBRARY (Employee Access — Section 6.3)
 * ========================================================================== */

router.get('/guidelines', (req, res) => {
  const activeAttempt = getActiveInProgressAttempt(req.user.id);
  if (activeAttempt) {
    return res.status(409).json({
      error: 'Guideline navigation is restricted while an active assessment is in progress.',
      code: 'ACTIVE_ASSESSMENT_LOCK',
      activeAttemptId: activeAttempt.id,
    });
  }

  const nameQuery = String(req.query.q || '').trim().toLowerCase();
  const projectQuery = String(req.query.project || '').trim().toLowerCase();

  let sql = `
    SELECT
      id,
      title,
      client_project_task AS clientProjectTask,
      summary,
      guideline_type AS guidelineType,
      pdf_original_name AS pdfOriginalName,
      pdf_size_bytes AS pdfSizeBytes,
      current_version AS currentVersion,
      updated_at AS updatedAt
    FROM guidelines
    WHERE status = 'published'
  `;
  const params = [];

  if (nameQuery) {
    sql += ' AND LOWER(title) LIKE ?';
    params.push(`%${nameQuery}%`);
  }
  if (projectQuery) {
    sql += ' AND LOWER(client_project_task) LIKE ?';
    params.push(`%${projectQuery}%`);
  }
  sql += ' ORDER BY updated_at DESC';

  const guidelines = db.prepare(sql).all(...params);
  return res.json({ guidelines });
});

router.get('/guidelines/:id', (req, res) => {
  const activeAttempt = getActiveInProgressAttempt(req.user.id);
  if (activeAttempt) {
    return res.status(409).json({
      error: 'Guideline access is restricted during an active assessment.',
      code: 'ACTIVE_ASSESSMENT_LOCK',
      activeAttemptId: activeAttempt.id,
    });
  }

  const gid = parseInt(req.params.id, 10);
  const guideline = db
    .prepare(
      `SELECT
         id,
         title,
         client_project_task AS clientProjectTask,
         summary,
         guideline_type AS guidelineType,
         content_body AS contentBody,
         pdf_original_name AS pdfOriginalName,
         pdf_size_bytes AS pdfSizeBytes,
         current_version AS currentVersion,
         updated_at AS updatedAt
       FROM guidelines
       WHERE id = ? AND status = 'published'`
    )
    .get(gid);

  if (!guideline) {
    return res.status(404).json({ error: 'Guideline not found.' });
  }

  const logRes = db
    .prepare(
      `INSERT INTO guideline_access_logs
        (user_id, guideline_id, version_number, duration_seconds, opened_at, last_ping_at)
       VALUES (?, ?, ?, 0, datetime('now'), datetime('now'))`
    )
    .run(req.user.id, guideline.id, guideline.currentVersion);

  recordPortalActivity({
    userId: req.user.id,
    userIdentity: `${req.user.fullName} (${req.user.employeeCode})`,
    eventType: 'GUIDELINE_ACCESSED',
    area: 'guideline_library',
    detail: `Opened "${guideline.title}" (v${guideline.currentVersion})`,
  });

  return res.json({
    guideline,
    accessLogId: logRes.lastInsertRowid,
  });
});

router.post('/guidelines/access/:accessLogId/ping', (req, res) => {
  const logId = parseInt(req.params.accessLogId, 10);
  const incrementSec = Math.min(60, Math.max(1, Number(req.body?.seconds || 15)));

  db.prepare(
    `UPDATE guideline_access_logs
     SET duration_seconds = duration_seconds + ?, last_ping_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  ).run(incrementSec, logId, req.user.id);

  return res.json({ ok: true });
});

router.get('/guidelines/:id/pdf', (req, res) => {
  const activeAttempt = getActiveInProgressAttempt(req.user.id);
  if (activeAttempt) {
    return res.status(409).json({ error: 'Restricted during active assessment.' });
  }

  const gid = parseInt(req.params.id, 10);
  const guideline = db
    .prepare(
      "SELECT * FROM guidelines WHERE id = ? AND status = 'published' AND guideline_type = 'pdf'"
    )
    .get(gid);

  if (!guideline || !guideline.pdf_stored_name) {
    return res.status(404).json({ error: 'PDF guideline not found.' });
  }

  const safePath = path.join(GUIDELINE_STORAGE_DIR, path.basename(guideline.pdf_stored_name));
  if (!fs.existsSync(safePath)) {
    return res.status(404).json({ error: 'Stored PDF file missing on server.' });
  }

  const safeName = path.basename(guideline.pdf_original_name || 'guideline.pdf').replace(/["\r\n]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
  return res.sendFile(safePath);
});

/* ============================================================================
 * PHASE 5: EMPLOYEE ASSESSMENTS & ATTEMPT RUNNER (Sections 6.4–6.7)
 * ========================================================================== */

router.get('/assessments', (req, res) => {
  // Sync any in-progress attempts first
  getActiveInProgressAttempt(req.user.id);

  const assessments = db
    .prepare(
      `SELECT
         a.id,
         a.title,
         a.instructions,
         a.project_id AS projectId,
         p.name AS projectName,
         a.project_task_ref AS projectTaskRef,
         a.is_timed AS isTimed,
         a.time_limit_minutes AS timeLimitMinutes,
         a.selection_mode AS selectionMode,
         a.random_sample_count AS randomSampleCount,
         a.available_until AS availableUntil,
         (SELECT COUNT(*) FROM assessment_questions aq WHERE aq.assessment_id = a.id) AS fixedQuestionCount
       FROM assessments a
       LEFT JOIN projects p ON p.id = a.project_id
       WHERE a.status = 'published'
         AND (a.available_from IS NULL OR a.available_from = '' OR datetime(a.available_from) <= datetime('now'))
         AND (a.available_until IS NULL OR a.available_until = '' OR datetime(a.available_until) >= datetime('now'))
       ORDER BY a.created_at DESC`
    )
    .all();

  const enriched = assessments.map((a) => {
    const attempts = db
      .prepare(
        `SELECT id, attempt_number AS attemptNumber, status, status_detail AS statusDetail,
                is_released AS isReleased, passed, submitted_at AS submittedAt
         FROM assessment_attempts
         WHERE user_id = ? AND assessment_id = ?
         ORDER BY attempt_number DESC`
      )
      .all(req.user.id, a.id);

    const openRetake = db
      .prepare(
        `SELECT id, conditions_note AS conditionsNote
         FROM retake_authorizations
         WHERE user_id = ? AND assessment_id = ? AND used_in_attempt_id IS NULL
         ORDER BY id DESC LIMIT 1`
      )
      .get(req.user.id, a.id);

    const inProgress = attempts.find((att) => att.status === 'in_progress');
    const latest = attempts[0] || null;

    let canStartNew = false;
    let actionState = 'start';

    if (inProgress) {
      actionState = 'resume';
    } else if (!latest) {
      canStartNew = true;
      actionState = 'start';
    } else if (openRetake) {
      canStartNew = true;
      actionState = 'retake_authorized';
    } else {
      actionState = 'completed_locked';
    }

    return {
      id: a.id,
      title: a.title,
      instructions: a.instructions,
      projectName: a.projectName || a.projectTaskRef || 'General Evaluation',
      isTimed: Boolean(a.isTimed),
      timeLimitMinutes: a.isTimed ? a.timeLimitMinutes : null,
      questionCount:
        a.selectionMode === 'random_pool' ? a.randomSampleCount : a.fixedQuestionCount,
      availableUntil: a.availableUntil || null,
      attemptsCount: attempts.length,
      inProgressAttemptId: inProgress?.id || null,
      canStartNew,
      actionState,
      retakeConditions: openRetake?.conditionsNote || null,
      // Strictly never expose unreleased pass/fail or score!
      latestAttemptSummary: latest
        ? {
            attemptNumber: latest.attemptNumber,
            status: latest.status,
            statusDetail: latest.isReleased
              ? latest.status === 'expired'
                ? 'Not Attempted — Time Expired'
                : latest.passed
                ? 'Released — Passed'
                : 'Released — Did Not Pass'
              : latest.status === 'expired'
              ? 'Not Attempted — Time Expired (Pending Release)'
              : 'Submitted — Pending Administrator Release',
          }
        : null,
    };
  });

  return res.json({ assessments: enriched });
});

router.post('/assessments/:id/start', (req, res) => {
  const assessmentId = parseInt(req.params.id, 10);

  const assessment = db
    .prepare(
      `SELECT * FROM assessments
       WHERE id = ?
         AND status = 'published'
         AND (available_from IS NULL OR available_from = '' OR datetime(available_from) <= datetime('now'))
         AND (available_until IS NULL OR available_until = '' OR datetime(available_until) >= datetime('now'))`
    )
    .get(assessmentId);

  if (!assessment) {
    return res.status(403).json({
      error: 'This assessment is not currently available for access.',
    });
  }

  // Resume existing in-progress attempt on the same assessment without creating a duplicate!
  const existingInProgress = db
    .prepare(
      "SELECT id FROM assessment_attempts WHERE user_id = ? AND assessment_id = ? AND status = 'in_progress'"
    )
    .get(req.user.id, assessmentId);

  if (existingInProgress) {
    const synced = syncAttemptTimingAndExpiry(existingInProgress.id);
    if (synced?.attempt?.status === 'in_progress') {
      return res.json({ attemptId: existingInProgress.id, resumed: true });
    }
  }

  // Prevent starting a second concurrent assessment if another one is currently in progress
  const otherActive = getActiveInProgressAttempt(req.user.id);
  if (otherActive && otherActive.assessment_id !== assessmentId) {
    return res.status(409).json({
      error: `You already have an active attempt in progress ("${otherActive.assessment_title}"). Please finish it first.`,
      activeAttemptId: otherActive.id,
    });
  }

  // Check prior attempts & retake authorization
  const priorCountRow = db
    .prepare('SELECT COUNT(*) AS count FROM assessment_attempts WHERE user_id = ? AND assessment_id = ?')
    .get(req.user.id, assessmentId);
  const priorCount = priorCountRow?.count || 0;

  let retakeAuth = null;
  if (priorCount > 0) {
    retakeAuth = db
      .prepare(
        `SELECT * FROM retake_authorizations
         WHERE user_id = ? AND assessment_id = ? AND used_in_attempt_id IS NULL
         ORDER BY id DESC LIMIT 1`
      )
      .get(req.user.id, assessmentId);

    if (!retakeAuth) {
      return res.status(403).json({
        code: 'RETAKE_NOT_AUTHORIZED',
        error:
          'You have already attempted this assessment. Retakes require explicit administrator approval.',
      });
    }
  }

  // Assemble question snapshot for this attempt (fixed vs random pool)
  let selectedQuestions = [];
  if (assessment.selection_mode === 'fixed') {
    selectedQuestions = db
      .prepare(
        `SELECT qb.*, aq.marks_override, aq.sort_order
         FROM assessment_questions aq
         JOIN question_bank qb ON qb.id = aq.question_id
         WHERE aq.assessment_id = ? AND qb.status = 'active'
         ORDER BY aq.sort_order ASC, aq.id ASC`
      )
      .all(assessmentId);
  } else {
    // Random selection from eligible pool without duplicates!
    let poolSql = "SELECT * FROM question_bank WHERE status = 'active' AND is_reusable = 1";
    const poolParams = [];
    if (assessment.random_pool_project_ref) {
      poolSql += ' AND LOWER(project_ref) = LOWER(?)';
      poolParams.push(assessment.random_pool_project_ref);
    }

    // If admin also linked specific pool questions in assessment_questions, prefer those if present
    const linkedPool = db
      .prepare(
        `SELECT qb.*, aq.marks_override
         FROM assessment_questions aq
         JOIN question_bank qb ON qb.id = aq.question_id
         WHERE aq.assessment_id = ? AND qb.status = 'active'`
      )
      .all(assessmentId);

    const eligible = linkedPool.length > 0 ? linkedPool : db.prepare(poolSql).all(...poolParams);

    // Fisher-Yates shuffle to guarantee zero duplicates
    const shuffled = [...eligible];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const desiredCount = Math.max(1, Number(assessment.random_sample_count || shuffled.length));
    selectedQuestions = shuffled.slice(0, Math.min(desiredCount, shuffled.length));
  }

  if (selectedQuestions.length === 0) {
    return res.status(400).json({
      error: 'This assessment has no active questions configured yet. Please notify an administrator.',
    });
  }

  const timeLimitSeconds =
    assessment.is_timed && assessment.time_limit_minutes
      ? Number(assessment.time_limit_minutes) * 60
      : null;

  const totalMarks = selectedQuestions.reduce(
    (sum, q) => sum + Number(q.marks_override ?? q.marks ?? 1),
    0
  );

  let createdAttemptId = null;

  const tx = db.transaction(() => {
    const ins = db
      .prepare(
        `INSERT INTO assessment_attempts (
           assessment_id,
           user_id,
           attempt_number,
           status,
           status_detail,
           started_at,
           is_timed,
           time_limit_seconds,
           total_possible_marks,
           review_status,
           is_released
         ) VALUES (?, ?, ?, 'in_progress', 'In Progress', datetime('now'), ?, ?, ?, 'pending', 0)`
      )
      .run(
        assessmentId,
        req.user.id,
        priorCount + 1,
        assessment.is_timed ? 1 : 0,
        timeLimitSeconds,
        totalMarks
      );

    createdAttemptId = ins.lastInsertRowid;

    const insSnap = db.prepare(
      `INSERT INTO attempt_questions (
         attempt_id,
         source_question_id,
         question_version,
         sort_order,
         question_type,
         prompt,
         scenario_context,
         options_json,
         correct_answer,
         acceptable_answers_json,
         scoring_rubric,
         marks,
         explanation
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    selectedQuestions.forEach((q, idx) => {
      insSnap.run(
        createdAttemptId,
        q.id,
        q.version || 1,
        idx + 1,
        q.question_type,
        q.prompt,
        q.scenario_context || null,
        q.options_json || null,
        q.correct_answer || null,
        q.acceptable_answers_json || null,
        q.scoring_rubric || null,
        Number(q.marks_override ?? q.marks ?? 1),
        q.explanation || null
      );
    });

    if (retakeAuth) {
      db.prepare('UPDATE retake_authorizations SET used_in_attempt_id = ? WHERE id = ?').run(
        createdAttemptId,
        retakeAuth.id
      );
    }

    db.prepare(
      `INSERT INTO attempt_events (attempt_id, event_type, detail, created_at)
       VALUES (?, 'ATTEMPT_STARTED', ?, datetime('now'))`
    ).run(
      createdAttemptId,
      retakeAuth
        ? `Started authorized retake attempt #${priorCount + 1}`
        : `Started attempt #${priorCount + 1}`
    );
  });

  tx();

  recordPortalActivity({
    userId: req.user.id,
    userIdentity: `${req.user.fullName} (${req.user.employeeCode})`,
    eventType: 'ASSESSMENT_STARTED',
    area: 'assessments',
    detail: `Started "${assessment.title}" (Attempt #${priorCount + 1})`,
  });

  return res.status(201).json({
    attemptId: createdAttemptId,
    attemptNumber: priorCount + 1,
    resumed: false,
  });
});

router.get('/attempts/:attemptId', (req, res) => {
  const attemptId = parseInt(req.params.attemptId, 10);
  const synced = syncAttemptTimingAndExpiry(attemptId);

  if (!synced || synced.attempt.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Assessment attempt not found.' });
  }

  const { attempt, remainingSeconds, effectiveElapsedSec } = synced;
  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(attempt.assessment_id);

  // Sanitize questions: NEVER send answer keys, rubrics, or explanations to the runner!
  const questions = db
    .prepare(
      `SELECT
         id,
         sort_order AS sortOrder,
         question_type AS questionType,
         prompt,
         scenario_context AS scenarioContext,
         options_json AS optionsJson,
         marks
       FROM attempt_questions
       WHERE attempt_id = ?
       ORDER BY sort_order ASC`
    )
    .all(attemptId)
    .map((q) => ({
      id: q.id,
      sortOrder: q.sortOrder,
      questionType: q.questionType,
      prompt: q.prompt,
      scenarioContext: q.scenarioContext,
      options: q.optionsJson ? JSON.parse(q.optionsJson) : [],
      marks: q.marks,
    }));

  const savedAnswers = db
    .prepare(
      `SELECT
         attempt_question_id AS attemptQuestionId,
         answer_value AS answerValue,
         reasoning_text AS reasoningText,
         updated_at AS updatedAt
       FROM attempt_answers
       WHERE attempt_id = ?`
    )
    .all(attemptId);

  return res.json({
    attempt: {
      id: attempt.id,
      assessmentId: attempt.assessment_id,
      assessmentTitle: assessment?.title || 'Assessment',
      instructions: assessment?.instructions || '',
      attemptNumber: attempt.attempt_number,
      status: attempt.status,
      statusDetail: attempt.status_detail,
      isTimed: Boolean(attempt.is_timed),
      timeLimitSeconds: attempt.time_limit_seconds,
      remainingSeconds,
      effectiveElapsedSec,
      pauseOnDisconnect: Boolean(assessment?.pause_on_disconnect),
      interruptionCount: attempt.interruption_count,
      startedAt: attempt.started_at,
      submittedAt: attempt.submitted_at,
    },
    questions,
    savedAnswers,
  });
});

router.put('/attempts/:attemptId/answers', (req, res) => {
  const attemptId = parseInt(req.params.attemptId, 10);
  const synced = syncAttemptTimingAndExpiry(attemptId);

  if (!synced || synced.attempt.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Attempt not found.' });
  }

  if (synced.attempt.status !== 'in_progress') {
    return res.status(409).json({
      error:
        synced.attempt.status === 'expired'
          ? 'Time has expired for this attempt. Further answering is disabled.'
          : 'This attempt has already been submitted.',
      status: synced.attempt.status,
      statusDetail: synced.attempt.status_detail,
    });
  }

  const incoming = Array.isArray(req.body?.answers) ? req.body.answers : [];
  const validQuestionIds = new Set(
    db
      .prepare('SELECT id FROM attempt_questions WHERE attempt_id = ?')
      .all(attemptId)
      .map((r) => r.id)
  );

  const upsert = db.prepare(
    `INSERT INTO attempt_answers
      (attempt_id, attempt_question_id, answer_value, reasoning_text, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(attempt_id, attempt_question_id) DO UPDATE SET
       answer_value = excluded.answer_value,
       reasoning_text = excluded.reasoning_text,
       updated_at = datetime('now')`
  );

  const tx = db.transaction(() => {
    for (const item of incoming) {
      const qid = Number(item.attemptQuestionId);
      if (!validQuestionIds.has(qid)) continue;
      const val = item.answerValue !== undefined && item.answerValue !== null ? String(item.answerValue) : null;
      const reasoning =
        item.reasoningText !== undefined && item.reasoningText !== null
          ? String(item.reasoningText)
          : null;
      upsert.run(attemptId, qid, val, reasoning);
    }
  });
  tx();

  return res.json({
    saved: true,
    remainingSeconds: synced.remainingSeconds,
    savedAt: new Date().toISOString(),
  });
});

router.post('/attempts/:attemptId/interruption', (req, res) => {
  const attemptId = parseInt(req.params.attemptId, 10);
  const attempt = db
    .prepare(
      `SELECT att.*, a.pause_on_disconnect
       FROM assessment_attempts att
       JOIN assessments a ON a.id = att.assessment_id
       WHERE att.id = ? AND att.user_id = ?`
    )
    .get(attemptId, req.user.id);

  if (!attempt || attempt.status !== 'in_progress') {
    return res.status(400).json({ error: 'Attempt is not active.' });
  }

  const eventType = String(req.body?.eventType || 'RECONNECTED');
  const offlineSecondsReported = Math.min(
    1800,
    Math.max(0, Math.floor(Number(req.body?.offlineSeconds || 0)))
  );

  if (eventType === 'CONNECTION_LOST') {
    db.prepare(
      `UPDATE assessment_attempts
       SET disconnect_started_at = COALESCE(disconnect_started_at, datetime('now')),
           interruption_count = interruption_count + 1
       WHERE id = ?`
    ).run(attemptId);

    db.prepare(
      `INSERT INTO attempt_events (attempt_id, event_type, detail, created_at)
       VALUES (?, 'CONNECTION_LOST', 'Temporary connection loss detected.', datetime('now'))`
    ).run(attemptId);
  } else {
    // Reconnected after temporary offline state
    let addedPause = 0;
    if (attempt.pause_on_disconnect) {
      addedPause = offlineSecondsReported;
    }

    db.prepare(
      `UPDATE assessment_attempts
       SET paused_disconnect_seconds = paused_disconnect_seconds + ?,
           disconnect_started_at = NULL,
           interruption_count = interruption_count + CASE WHEN ? > 0 AND disconnect_started_at IS NULL THEN 1 ELSE 0 END
       WHERE id = ?`
    ).run(addedPause, offlineSecondsReported, attemptId);

    db.prepare(
      `INSERT INTO attempt_events (attempt_id, event_type, detail, created_at)
       VALUES (?, 'RECONNECTED', ?, datetime('now'))`
    ).run(
      attemptId,
      `Connection restored (offline ${offlineSecondsReported}s; timer pause applied: ${addedPause}s).`
    );
  }

  const synced = syncAttemptTimingAndExpiry(attemptId);
  return res.json({
    ok: true,
    status: synced.attempt.status,
    remainingSeconds: synced.remainingSeconds,
  });
});

router.post('/attempts/:attemptId/submit', (req, res) => {
  const attemptId = parseInt(req.params.attemptId, 10);
  const forceExpired = Boolean(req.body?.expiredByTimer);

  const existing = db
    .prepare('SELECT * FROM assessment_attempts WHERE id = ? AND user_id = ?')
    .get(attemptId, req.user.id);

  if (!existing) {
    return res.status(404).json({ error: 'Attempt not found.' });
  }

  // Save any final answers included in the submit request IF still within valid time
  const syncedBefore = syncAttemptTimingAndExpiry(attemptId);
  if (syncedBefore.attempt.status === 'in_progress' && Array.isArray(req.body?.answers)) {
    const validQuestionIds = new Set(
      db
        .prepare('SELECT id FROM attempt_questions WHERE attempt_id = ?')
        .all(attemptId)
        .map((r) => r.id)
    );
    const upsert = db.prepare(
      `INSERT INTO attempt_answers
        (attempt_id, attempt_question_id, answer_value, reasoning_text, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(attempt_id, attempt_question_id) DO UPDATE SET
         answer_value = excluded.answer_value,
         reasoning_text = excluded.reasoning_text,
         updated_at = datetime('now')`
    );
    const tx = db.transaction(() => {
      for (const item of req.body.answers) {
        const qid = Number(item.attemptQuestionId);
        if (!validQuestionIds.has(qid)) continue;
        upsert.run(
          attemptId,
          qid,
          item.answerValue !== undefined && item.answerValue !== null ? String(item.answerValue) : null,
          item.reasoningText !== undefined && item.reasoningText !== null
            ? String(item.reasoningText)
            : null
        );
      }
    });
    tx();
  }

  const finalRow =
    syncedBefore.attempt.status === 'in_progress'
      ? finalizeAttemptInternal(attemptId, { expired: forceExpired })
      : syncedBefore.attempt;

  recordPortalActivity({
    userId: req.user.id,
    userIdentity: `${req.user.fullName} (${req.user.employeeCode})`,
    eventType: finalRow.status === 'expired' ? 'ASSESSMENT_EXPIRED' : 'ASSESSMENT_SUBMITTED',
    area: 'assessments',
    detail: `Attempt #${finalRow.attempt_number} recorded as ${finalRow.status_detail}`,
  });

  // Return ONLY confirmation & status — NEVER reveal score or pass/fail before release!
  return res.json({
    success: true,
    attemptId: finalRow.id,
    status: finalRow.status,
    statusDetail: finalRow.status_detail,
    submittedAt: finalRow.submitted_at,
    message:
      finalRow.status === 'expired'
        ? 'Time expired. Available answers were saved and the attempt was recorded as Not Attempted — Time Expired. Results remain subject to administrator release.'
        : 'Your assessment attempt has been submitted and saved. Scores and pass/fail status will become visible only after an administrator reviews and releases the result.',
  });
});

/* ============================================================================
 * PHASE 5: EMPLOYEE RELEASED RESULTS & HISTORY (Section 6.7)
 * ========================================================================== */

router.get('/results', (req, res) => {
  // Sync any active timed attempts first
  getActiveInProgressAttempt(req.user.id);

  const attempts = db
    .prepare(
      `SELECT
         att.*,
         a.title AS assessmentTitle,
         a.project_task_ref AS projectTaskRef,
         p.name AS projectName
       FROM assessment_attempts att
       JOIN assessments a ON a.id = att.assessment_id
       LEFT JOIN projects p ON p.id = a.project_id
       WHERE att.user_id = ? AND att.status != 'in_progress'
       ORDER BY att.started_at DESC, att.id DESC`
    )
    .all(req.user.id);

  const formatted = attempts.map((att) => {
    // STRICT GATE: Unreleased attempts NEVER expose scores, percentages, pass/fail, or answer keys!
    if (!att.is_released) {
      return {
        id: att.id,
        assessmentId: att.assessment_id,
        assessmentTitle: att.assessmentTitle,
        projectName: att.projectName || att.projectTaskRef || 'General',
        attemptNumber: att.attempt_number,
        startedAt: att.started_at,
        submittedAt: att.submitted_at,
        durationSeconds: att.duration_seconds,
        status: att.status,
        statusDetail:
          att.status === 'expired'
            ? 'Not Attempted — Time Expired (Pending Admin Release)'
            : 'Submitted — Pending Administrator Review & Release',
        isReleased: false,
      };
    }

    const questionBreakdown = db
      .prepare(
        `SELECT
           aq.id,
           aq.sort_order AS sortOrder,
           aq.question_type AS questionType,
           aq.prompt,
           aq.scenario_context AS scenarioContext,
           aq.marks,
           aq.correct_answer AS correctAnswer,
           aq.acceptable_answers_json AS acceptableAnswersJson,
           aq.explanation,
           aa.answer_value AS employeeAnswer,
           aa.reasoning_text AS employeeReasoning,
           aa.awarded_marks AS awardedMarks,
           aa.is_correct AS isCorrect,
           aa.reviewer_comment AS reviewerComment
         FROM attempt_questions aq
         LEFT JOIN attempt_answers aa
           ON aa.attempt_question_id = aq.id AND aa.attempt_id = aq.attempt_id
         WHERE aq.attempt_id = ?
         ORDER BY aq.sort_order ASC`
      )
      .all(att.id)
      .map((q) => ({
        id: q.id,
        sortOrder: q.sortOrder,
        questionType: q.questionType,
        prompt: q.prompt,
        scenarioContext: q.scenarioContext,
        marks: q.marks,
        awardedMarks: q.awardedMarks ?? 0,
        isCorrect:
          q.isCorrect !== null && q.isCorrect !== undefined
            ? Boolean(q.isCorrect)
            : Number(q.awardedMarks || 0) >= Number(q.marks || 0),
        employeeAnswer: q.employeeAnswer || null,
        employeeReasoning: q.employeeReasoning || null,
        correctAnswer:
          q.correctAnswer ||
          (q.acceptableAnswersJson ? JSON.parse(q.acceptableAnswersJson).join(' / ') : null),
        explanation: q.explanation || null,
        reviewerComment: q.reviewerComment || null,
      }));

    return {
      id: att.id,
      assessmentId: att.assessment_id,
      assessmentTitle: att.assessmentTitle,
      projectName: att.projectName || att.projectTaskRef || 'General',
      attemptNumber: att.attempt_number,
      startedAt: att.started_at,
      submittedAt: att.submitted_at,
      durationSeconds: att.duration_seconds,
      status: att.status,
      statusDetail:
        att.status === 'expired' ? 'Not Attempted — Time Expired' : 'Result Released',
      isReleased: true,
      releasedAt: att.released_at,
      finalScore: att.final_score,
      totalPossibleMarks: att.total_possible_marks,
      percentage: att.percentage,
      passed: att.status === 'expired' ? false : Boolean(att.passed),
      reviewerOverallComment: att.reviewer_overall_comment || null,
      questions: questionBreakdown,
    };
  });

  return res.json({ results: formatted });
});

/* ============================================================================
 * PHASE 6: EMPLOYEE PROJECT READINESS (Section 6.8)
 * ========================================================================== */

router.get('/readiness', (req, res) => {
  const projects = db
    .prepare("SELECT * FROM projects WHERE status = 'active' ORDER BY name ASC")
    .all();

  const items = projects.map((proj) => {
    const readinessRow = db
      .prepare(
        'SELECT * FROM employee_project_readiness WHERE project_id = ? AND user_id = ?'
      )
      .get(proj.id, req.user.id);

    const reqAssessments = db
      .prepare(
        `SELECT
           pa.assessment_id AS assessmentId,
           a.title,
           COALESCE(pa.minimum_percentage, a.passing_percentage) AS requiredPercentage
         FROM project_assessments pa
         JOIN assessments a ON a.id = pa.assessment_id
         WHERE pa.project_id = ?`
      )
      .all(proj.id)
      .map((ra) => {
        const bestReleasedPass = db
          .prepare(
            `SELECT percentage, released_at AS releasedAt
             FROM assessment_attempts
             WHERE user_id = ?
               AND assessment_id = ?
               AND is_released = 1
               AND status = 'submitted'
               AND passed = 1
               AND percentage >= ?
             ORDER BY percentage DESC LIMIT 1`
          )
          .get(req.user.id, ra.assessmentId, ra.requiredPercentage);

        return {
          ...ra,
          metRequirement: Boolean(bestReleasedPass),
          bestReleasedPercentage: bestReleasedPass?.percentage ?? null,
        };
      });

    return {
      projectId: proj.id,
      projectCode: proj.code,
      projectName: proj.name,
      domainCategory: proj.domain_category,
      description: proj.description,
      approvalMode: proj.approval_mode,
      readinessStatus: readinessRow?.readiness_status || 'not_ready',
      decisionSource: readinessRow?.decision_source || 'system',
      notes: readinessRow?.notes || null,
      updatedAt: readinessRow?.updated_at || null,
      requiredAssessments: reqAssessments,
    };
  });

  const history = db
    .prepare(
      `SELECT
         h.id,
         p.code AS projectCode,
         p.name AS projectName,
         h.previous_status AS previousStatus,
         h.new_status AS newStatus,
         h.decision_source AS decisionSource,
         h.reason,
         h.created_at AS createdAt
       FROM project_readiness_history h
       JOIN projects p ON p.id = h.project_id
       WHERE h.user_id = ?
       ORDER BY h.created_at DESC
       LIMIT 30`
    )
    .all(req.user.id);

  return res.json({ projects: items, history });
});

/* ============================================================================
 * PHASE 7: ANNOUNCEMENTS, NOTIFICATIONS & IDENTIFIED FEEDBACK (Sections 6.9–6.10)
 * ========================================================================== */

router.get('/announcements', (_req, res) => {
  const announcements = db
    .prepare(
      `SELECT id, title, category, body, author_identity AS authorIdentity,
              published_at AS publishedAt, created_at AS createdAt
       FROM announcements
       WHERE status = 'published'
       ORDER BY COALESCE(published_at, created_at) DESC`
    )
    .all();

  return res.json({ announcements });
});

router.get('/notifications', (req, res) => {
  const notifications = db
    .prepare(
      `SELECT id, notification_type AS type, title, message, link_path AS linkPath,
              is_read AS isRead, created_at AS createdAt
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 60`
    )
    .all(req.user.id)
    .map((n) => ({ ...n, isRead: Boolean(n.isRead) }));

  return res.json({ notifications });
});

router.post('/notifications/:id/read', (req, res) => {
  const nid = parseInt(req.params.id, 10);
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
    nid,
    req.user.id
  );
  return res.json({ ok: true });
});

router.post('/notifications/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  return res.json({ ok: true });
});

router.get('/feedback', (req, res) => {
  const items = db
    .prepare(
      `SELECT id, category, subject, message, status, admin_response AS adminResponse,
              created_at AS createdAt, updated_at AS updatedAt
       FROM employee_feedback
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .all(req.user.id);

  return res.json({ feedback: items });
});

router.post('/feedback', (req, res) => {
  const allowedCategories = new Set([
    'Guideline Problem',
    'Assessment Concern',
    'Portal Usability Issue',
    'Work-Preparation Difficulty',
    'Suggestion for Improvement',
  ]);
  const category = String(req.body?.category || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();

  if (!allowedCategories.has(category)) {
    return res.status(400).json({ error: 'Please select a valid feedback category.' });
  }
  if (!subject || subject.length < 3 || subject.length > 180) {
    return res.status(400).json({ error: 'Please enter a subject (3–180 characters).' });
  }
  if (!message || message.length < 10 || message.length > 4000) {
    return res.status(400).json({ error: 'Please enter feedback details (at least 10 characters).' });
  }

  const identity = `${req.user.fullName} (${req.user.employeeCode})`;
  const ins = db
    .prepare(
      `INSERT INTO employee_feedback
        (user_id, employee_identity, category, subject, message, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'New', datetime('now'), datetime('now'))`
    )
    .run(req.user.id, identity, category, subject, message);

  recordPortalActivity({
    userId: req.user.id,
    userIdentity: identity,
    eventType: 'FEEDBACK_SUBMITTED',
    area: 'feedback',
    detail: `Submitted feedback (${category}): "${subject}"`,
  });

  return res.status(201).json({
    success: true,
    feedbackId: ins.lastInsertRowid,
    message:
      'Thank you. Your identified feedback has been saved for administrator review. Feedback never affects assessment scores or project readiness.',
  });
});

export default router;
