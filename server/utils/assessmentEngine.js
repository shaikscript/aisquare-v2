import db, { createNotification } from '../db/database.js';

function parseSqliteUtc(sqliteDateStr) {
  if (!sqliteDateStr) return Date.now();
  const normalized = sqliteDateStr.includes('T')
    ? sqliteDateStr
    : `${sqliteDateStr.replace(' ', 'T')}Z`;
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? Date.now() : ms;
}

/**
 * Compute authoritative timing state for an attempt and auto-expire if time limit elapsed.
 */
export function syncAttemptTimingAndExpiry(attemptId) {
  const attempt = db
    .prepare(
      `SELECT att.*, a.passing_percentage, a.pause_on_disconnect, a.title AS assessment_title
       FROM assessment_attempts att
       JOIN assessments a ON a.id = att.assessment_id
       WHERE att.id = ?`
    )
    .get(attemptId);

  if (!attempt) return null;

  const nowMs = Date.now();
  const startedMs = parseSqliteUtc(attempt.started_at);
  let activeDisconnectSec = 0;
  if (attempt.disconnect_started_at && attempt.pause_on_disconnect) {
    activeDisconnectSec = Math.max(
      0,
      Math.floor((nowMs - parseSqliteUtc(attempt.disconnect_started_at)) / 1000)
    );
  }

  const totalPausedSec = (attempt.paused_disconnect_seconds || 0) + activeDisconnectSec;
  const rawElapsedSec = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
  const effectiveElapsedSec = Math.max(0, rawElapsedSec - totalPausedSec);

  let remainingSeconds = null;
  if (attempt.is_timed && attempt.time_limit_seconds) {
    remainingSeconds = Math.max(0, attempt.time_limit_seconds - effectiveElapsedSec);

    if (attempt.status === 'in_progress' && remainingSeconds <= 0) {
      finalizeAttemptInternal(attempt.id, { expired: true });
      const refreshed = db
        .prepare(
          `SELECT att.*, a.passing_percentage, a.pause_on_disconnect, a.title AS assessment_title
           FROM assessment_attempts att
           JOIN assessments a ON a.id = att.assessment_id
           WHERE att.id = ?`
        )
        .get(attemptId);
      return {
        attempt: refreshed,
        effectiveElapsedSec: attempt.time_limit_seconds,
        remainingSeconds: 0,
      };
    }
  }

  return {
    attempt,
    effectiveElapsedSec,
    remainingSeconds,
  };
}

/**
 * Finalize an attempt (either normal submission or timer expiration) and run objective scoring.
 */
export function finalizeAttemptInternal(attemptId, { expired = false } = {}) {
  const attempt = db
    .prepare(
      `SELECT att.*, a.passing_percentage
       FROM assessment_attempts att
       JOIN assessments a ON a.id = att.assessment_id
       WHERE att.id = ?`
    )
    .get(attemptId);

  if (!attempt || attempt.status !== 'in_progress') return attempt;

  const nowMs = Date.now();
  const startedMs = parseSqliteUtc(attempt.started_at);
  let extraPaused = 0;
  if (attempt.disconnect_started_at && attempt.pause_on_disconnect) {
    extraPaused = Math.max(
      0,
      Math.floor((nowMs - parseSqliteUtc(attempt.disconnect_started_at)) / 1000)
    );
  }
  const totalPaused = (attempt.paused_disconnect_seconds || 0) + extraPaused;
  const elapsedSec = Math.max(0, Math.floor((nowMs - startedMs) / 1000) - totalPaused);

  const questions = db
    .prepare('SELECT * FROM attempt_questions WHERE attempt_id = ? ORDER BY sort_order ASC')
    .all(attemptId);

  const answers = db
    .prepare('SELECT * FROM attempt_answers WHERE attempt_id = ?')
    .all(attemptId);

  const answerMap = new Map(answers.map((a) => [a.attempt_question_id, a]));

  let totalPossible = 0;
  let autoScoreSum = 0;
  let needsManualReview = false;

  const upsertAnswerStmt = db.prepare(
    `INSERT INTO attempt_answers
      (attempt_id, attempt_question_id, answer_value, reasoning_text, auto_marks, awarded_marks, is_correct, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(attempt_id, attempt_question_id) DO UPDATE SET
       auto_marks = excluded.auto_marks,
       awarded_marks = excluded.awarded_marks,
       is_correct = excluded.is_correct,
       updated_at = datetime('now')`
  );

  const tx = db.transaction(() => {
    for (const q of questions) {
      totalPossible += Number(q.marks || 0);
      const ans = answerMap.get(q.id);
      const val = String(ans?.answer_value ?? '').trim();
      const reasoning = String(ans?.reasoning_text ?? '').trim();

      // Unanswered questions receive zero marks automatically
      if (!val && !reasoning) {
        upsertAnswerStmt.run(attemptId, q.id, null, null, 0, 0, 0);
        continue;
      }

      if (q.question_type === 'mcq' || q.question_type === 'true_false') {
        const expected = String(q.correct_answer ?? '').trim().toLowerCase();
        const isCorrect = val.toLowerCase() === expected ? 1 : 0;
        const pts = isCorrect ? Number(q.marks || 0) : 0;
        autoScoreSum += pts;
        upsertAnswerStmt.run(attemptId, q.id, val, reasoning || null, pts, pts, isCorrect);
      } else if (q.question_type === 'short_answer') {
        let accepted = [];
        try {
          accepted = JSON.parse(q.acceptable_answers_json || '[]');
        } catch {
          accepted = [];
        }
        if (q.correct_answer && !accepted.includes(q.correct_answer)) {
          accepted.push(q.correct_answer);
        }
        const normalizedVal = val.toLowerCase();
        const matched = accepted.some((kw) => {
          const cleanKw = String(kw || '').trim().toLowerCase();
          return cleanKw && (normalizedVal === cleanKw || normalizedVal.includes(cleanKw));
        });
        const pts = matched ? Number(q.marks || 0) : 0;
        autoScoreSum += pts;
        upsertAnswerStmt.run(attemptId, q.id, val, reasoning || null, pts, pts, matched ? 1 : 0);
      } else if (q.question_type === 'practical_scenario') {
        // Practical scenarios with an employee response require manual judgment review
        needsManualReview = true;
        upsertAnswerStmt.run(attemptId, q.id, val || null, reasoning || null, null, null, null);
      }
    }

    const nextStatus = expired ? 'expired' : 'submitted';
    const nextStatusDetail = expired
      ? 'Not Attempted — Time Expired'
      : needsManualReview
      ? 'Submitted — Pending Manual Review'
      : 'Submitted — Pending Result Release';

    const reviewStatus = needsManualReview ? 'pending' : 'not_applicable';
    const finalScore = needsManualReview ? null : autoScoreSum;
    const percentage =
      needsManualReview || totalPossible <= 0
        ? null
        : Number(((autoScoreSum / totalPossible) * 100).toFixed(2));

    // Per Section 6.6: Expired attempts NEVER qualify as a pass!
    let passed = null;
    if (!needsManualReview) {
      passed = expired ? 0 : percentage >= Number(attempt.passing_percentage) ? 1 : 0;
    } else if (expired) {
      passed = 0;
    }

    db.prepare(
      `UPDATE assessment_attempts
       SET status = ?,
           status_detail = ?,
           submitted_at = datetime('now'),
           paused_disconnect_seconds = ?,
           disconnect_started_at = NULL,
           duration_seconds = ?,
           total_possible_marks = ?,
           auto_score = ?,
           final_score = ?,
           percentage = ?,
           passed = ?,
           requires_manual_review = ?,
           review_status = ?
       WHERE id = ?`
    ).run(
      nextStatus,
      nextStatusDetail,
      totalPaused,
      elapsedSec,
      totalPossible,
      autoScoreSum,
      finalScore,
      percentage,
      passed,
      needsManualReview ? 1 : 0,
      reviewStatus,
      attemptId
    );

    db.prepare(
      `INSERT INTO attempt_events (attempt_id, event_type, detail, created_at)
       VALUES (?, ?, ?, datetime('now'))`
    ).run(
      attemptId,
      expired ? 'TIMEOUT_EXPIRED' : 'ATTEMPT_SUBMITTED',
      expired
        ? 'Timer reached zero; attempt saved as Not Attempted — Time Expired.'
        : 'Employee confirmed and submitted assessment attempt.'
    );
  });

  tx();
  return db.prepare('SELECT * FROM assessment_attempts WHERE id = ?').get(attemptId);
}

/**
 * Recompute attempt totals after an Admin grades manual review items or adjusts marks.
 */
export function recalculateAttemptScoreAfterReview(attemptId) {
  const attempt = db
    .prepare(
      `SELECT att.*, a.passing_percentage
       FROM assessment_attempts att
       JOIN assessments a ON a.id = att.assessment_id
       WHERE att.id = ?`
    )
    .get(attemptId);
  if (!attempt) return null;

  const questions = db
    .prepare('SELECT * FROM attempt_questions WHERE attempt_id = ?')
    .all(attemptId);
  const answers = db
    .prepare('SELECT * FROM attempt_answers WHERE attempt_id = ?')
    .all(attemptId);
  const ansMap = new Map(answers.map((a) => [a.attempt_question_id, a]));

  let totalPossible = 0;
  let awardedSum = 0;
  let allGraded = true;

  for (const q of questions) {
    totalPossible += Number(q.marks || 0);
    const ans = ansMap.get(q.id);
    if (!ans || ans.awarded_marks === null || ans.awarded_marks === undefined) {
      allGraded = false;
    } else {
      awardedSum += Number(ans.awarded_marks);
    }
  }

  const reviewStatus = allGraded
    ? attempt.requires_manual_review
      ? 'reviewed'
      : 'not_applicable'
    : 'pending';

  const finalScore = allGraded ? Number(awardedSum.toFixed(2)) : null;
  const percentage =
    allGraded && totalPossible > 0
      ? Number(((awardedSum / totalPossible) * 100).toFixed(2))
      : null;

  let passed = null;
  if (attempt.status === 'expired') {
    passed = 0; // Expired attempt can never qualify as a pass (Section 6.6)
  } else if (allGraded && percentage !== null) {
    passed = percentage >= Number(attempt.passing_percentage) ? 1 : 0;
  }

  const nextDetail =
    attempt.status === 'expired'
      ? 'Not Attempted — Time Expired'
      : attempt.is_released
      ? 'Result Released'
      : allGraded
      ? 'Reviewed — Ready for Release'
      : 'Submitted — Pending Manual Review';

  db.prepare(
    `UPDATE assessment_attempts
     SET total_possible_marks = ?,
         final_score = ?,
         percentage = ?,
         passed = ?,
         review_status = ?,
         status_detail = ?
     WHERE id = ?`
  ).run(totalPossible, finalScore, percentage, passed, reviewStatus, nextDetail, attemptId);

  return db.prepare('SELECT * FROM assessment_attempts WHERE id = ?').get(attemptId);
}

/**
 * Evaluate project-specific readiness ONLY for projects associated with this assessment (Phase 6).
 * Never grants blanket readiness across unrelated projects!
 */
export function evaluateProjectReadinessForEmployee(userId, assessmentId, actorIdentity) {
  const linkedProjects = db
    .prepare(
      `SELECT DISTINCT p.*
       FROM projects p
       JOIN project_assessments pa ON pa.project_id = p.id
       WHERE pa.assessment_id = ? AND p.status = 'active'`
    )
    .all(assessmentId);

  for (const project of linkedProjects) {
    recomputeSingleProjectReadiness(project.id, userId, actorIdentity);
  }
}

export function recomputeSingleProjectReadiness(projectId, userId, actorIdentity = 'System Policy') {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project || project.status !== 'active') return;

  const requirements = db
    .prepare(
      `SELECT pa.assessment_id, pa.minimum_percentage, a.passing_percentage
       FROM project_assessments pa
       JOIN assessments a ON a.id = pa.assessment_id
       WHERE pa.project_id = ?`
    )
    .all(projectId);

  if (requirements.length === 0) return;

  const existing = db
    .prepare('SELECT * FROM employee_project_readiness WHERE project_id = ? AND user_id = ?')
    .get(projectId, userId);

  // Do not automatically override a manually revoked status unless admin changes it
  if (existing?.readiness_status === 'revoked' && existing?.decision_source === 'manual') {
    return;
  }

  let allRequirementsMet = true;
  let anyReleasedAttempt = false;

  for (const req of requirements) {
    const threshold =
      req.minimum_percentage !== null && req.minimum_percentage !== undefined
        ? Number(req.minimum_percentage)
        : Number(req.passing_percentage);

    const passedAttempt = db
      .prepare(
        `SELECT id, percentage
         FROM assessment_attempts
         WHERE user_id = ?
           AND assessment_id = ?
           AND is_released = 1
           AND status = 'submitted'
           AND passed = 1
           AND percentage >= ?
         ORDER BY id DESC
         LIMIT 1`
      )
      .get(userId, req.assessment_id, threshold);

    const anyAttempt = db
      .prepare(
        `SELECT id FROM assessment_attempts
         WHERE user_id = ? AND assessment_id = ? AND is_released = 1
         LIMIT 1`
      )
      .get(userId, req.assessment_id);

    if (anyAttempt) anyReleasedAttempt = true;
    if (!passedAttempt) {
      allRequirementsMet = false;
    }
  }

  let targetStatus = existing?.readiness_status || 'not_ready';
  let source = 'system';
  let reason = '';

  if (allRequirementsMet) {
    if (project.approval_mode === 'automatic') {
      targetStatus = 'approved';
      source = 'automatic';
      reason = `Automatically approved upon meeting all required assessment thresholds for project ${project.code}.`;
    } else if (existing?.readiness_status !== 'approved') {
      targetStatus = 'pending_approval';
      source = 'system';
      reason = `Met assessment thresholds for project ${project.code}; awaiting manual administrator readiness approval.`;
    } else {
      return; // Already manually approved
    }
  } else if (anyReleasedAttempt && (!existing || existing.readiness_status === 'not_ready')) {
    targetStatus = 'in_preparation';
    source = 'system';
    reason = `Completed partial or non-qualifying assessment attempt(s) for project ${project.code}.`;
  } else {
    return;
  }

  if (existing?.readiness_status === targetStatus) return;

  db.prepare(
    `INSERT INTO employee_project_readiness
      (project_id, user_id, readiness_status, decision_source, notes, updated_by_identity, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(project_id, user_id) DO UPDATE SET
       readiness_status = excluded.readiness_status,
       decision_source = excluded.decision_source,
       notes = excluded.notes,
       updated_by_identity = excluded.updated_by_identity,
       updated_at = datetime('now')`
  ).run(projectId, userId, targetStatus, source, reason, actorIdentity);

  db.prepare(
    `INSERT INTO project_readiness_history
      (project_id, user_id, previous_status, new_status, decision_source, actor_identity, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    projectId,
    userId,
    existing?.readiness_status || 'not_ready',
    targetStatus,
    source,
    actorIdentity,
    reason
  );

  if (targetStatus === 'approved' || targetStatus === 'pending_approval') {
    createNotification({
      userId,
      type: 'READINESS_UPDATE',
      title:
        targetStatus === 'approved'
          ? `Project Readiness Approved: ${project.name}`
          : `Project Readiness Pending Sign-Off: ${project.name}`,
      message: reason,
      linkPath: '/portal/readiness',
    });
  }
}

/**
 * Parse RFC-4180 CSV text into rows of string cells.
 */
function parseCsvRows(csvText) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      if (ch === '\r') i += 1;
      row.push(cell);
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/**
 * Validate bulk question import (JSON array or CSV with header row) and report ALL malformed rows!
 */
export function parseAndValidateBulkQuestions(format, rawText) {
  const errors = [];
  const validQuestions = [];

  let rawItems = [];

  if (format === 'json') {
    try {
      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed)) {
        return {
          validQuestions: [],
          errors: [{ row: 1, message: 'JSON root must be an array of question objects.' }],
        };
      }
      rawItems = parsed.map((item, idx) => ({ rowNumber: idx + 1, item }));
    } catch (err) {
      return {
        validQuestions: [],
        errors: [{ row: 1, message: `Malformed JSON syntax: ${err.message}` }],
      };
    }
  } else {
    const csvRows = parseCsvRows(rawText || '');
    if (csvRows.length < 2) {
      return {
        validQuestions: [],
        errors: [
          {
            row: 1,
            message:
              'CSV file must contain a header row and at least one question row (columns: question_type,prompt,options,correct_answer,marks,explanation,project_ref,scoring_rubric,scenario_context).',
          },
        ],
      };
    }
    const headers = csvRows[0].map((h) => h.trim().toLowerCase());
    for (let r = 1; r < csvRows.length; r += 1) {
      const cells = csvRows[r];
      const obj = {};
      headers.forEach((h, colIdx) => {
        obj[h] = cells[colIdx] !== undefined ? cells[colIdx].trim() : '';
      });
      rawItems.push({ rowNumber: r + 1, item: obj });
    }
  }

  const allowedTypes = new Set(['mcq', 'true_false', 'short_answer', 'practical_scenario']);

  for (const { rowNumber, item } of rawItems) {
    if (!item || typeof item !== 'object') {
      errors.push({ row: rowNumber, message: 'Row is not a valid object.' });
      continue;
    }

    const qType = String(item.question_type || item.questionType || '').trim().toLowerCase();
    const prompt = String(item.prompt || '').trim();
    const scenarioContext = String(item.scenario_context || item.scenarioContext || '').trim();
    const marksRaw = item.marks !== undefined && item.marks !== '' ? Number(item.marks) : 1;
    const explanation = String(item.explanation || '').trim();
    const projectRef = String(
      item.project_ref || item.projectRef || item.project_tag || item.projectTag || ''
    ).trim();
    const scoringRubric = String(item.scoring_rubric || item.scoringRubric || '').trim();
    const correctAnswer = String(item.correct_answer ?? item.correctAnswer ?? '').trim();

    if (!allowedTypes.has(qType)) {
      errors.push({
        row: rowNumber,
        message: `Invalid question_type "${qType}". Allowed: mcq, true_false, short_answer, practical_scenario.`,
      });
      continue;
    }
    if (!prompt || prompt.length < 5) {
      errors.push({
        row: rowNumber,
        message: 'Prompt is missing or shorter than 5 characters.',
      });
      continue;
    }
    if (Number.isNaN(marksRaw) || marksRaw <= 0 || marksRaw > 100) {
      errors.push({
        row: rowNumber,
        message: `Invalid marks "${item.marks}". Must be a positive number between 0.5 and 100.`,
      });
      continue;
    }

    let options = [];
    if (Array.isArray(item.options)) {
      options = item.options.map((o) => String(o).trim()).filter(Boolean);
    } else if (typeof item.options === 'string' && item.options.trim()) {
      options = item.options
        .split('|')
        .map((o) => o.trim())
        .filter(Boolean);
    }

    let acceptableAnswers = [];
    if (Array.isArray(item.acceptable_answers || item.acceptableAnswers)) {
      acceptableAnswers = (item.acceptable_answers || item.acceptableAnswers)
        .map((a) => String(a).trim())
        .filter(Boolean);
    } else if (typeof item.acceptable_answers === 'string' && item.acceptable_answers.trim()) {
      acceptableAnswers = item.acceptable_answers
        .split('|')
        .map((a) => a.trim())
        .filter(Boolean);
    }

    if (qType === 'mcq') {
      if (options.length < 2) {
        errors.push({
          row: rowNumber,
          message: 'MCQ questions require at least 2 options (array in JSON or "|"-separated in CSV).',
        });
        continue;
      }
      if (!correctAnswer || !options.some((o) => o.toLowerCase() === correctAnswer.toLowerCase())) {
        errors.push({
          row: rowNumber,
          message: `MCQ correct_answer "${correctAnswer}" must match one of the provided options.`,
        });
        continue;
      }
    } else if (qType === 'true_false') {
      options = ['True', 'False'];
      if (!['true', 'false'].includes(correctAnswer.toLowerCase())) {
        errors.push({
          row: rowNumber,
          message: 'True/False correct_answer must be "True" or "False".',
        });
        continue;
      }
    } else if (qType === 'short_answer') {
      if (correctAnswer && !acceptableAnswers.includes(correctAnswer)) {
        acceptableAnswers.unshift(correctAnswer);
      }
      if (acceptableAnswers.length === 0) {
        errors.push({
          row: rowNumber,
          message: 'Short-answer questions require correct_answer or acceptable_answers keywords.',
        });
        continue;
      }
    } else if (qType === 'practical_scenario') {
      if (options.length === 0) {
        options = [
          'Fully Meets',
          'Highly Meets',
          'Moderately Meets',
          'Slightly Meets',
          'Fails to Meet',
        ];
      }
      if (!scoringRubric) {
        errors.push({
          row: rowNumber,
          message: 'Practical scenario questions require a scoring_rubric for manual review.',
        });
        continue;
      }
    }

    validQuestions.push({
      questionType: qType,
      prompt,
      scenarioContext: scenarioContext || null,
      options,
      correctAnswer:
        qType === 'true_false'
          ? correctAnswer.toLowerCase() === 'true'
            ? 'True'
            : 'False'
          : correctAnswer || null,
      acceptableAnswers,
      scoringRubric: scoringRubric || null,
      marks: marksRaw,
      explanation: explanation || null,
      projectRef: projectRef || null,
    });
  }

  return { validQuestions, errors };
}
