import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import db, {
  GUIDELINE_STORAGE_DIR,
  createNotification,
  notifyAllActiveEmployees,
  recordAudit,
} from '../db/database.js';
import { requireRole } from '../middleware/auth.js';
import { generateSecureToken } from '../utils/crypto.js';
import {
  evaluateProjectReadinessForEmployee,
  parseAndValidateBulkQuestions,
  recalculateAttemptScoreAfterReview,
  recomputeSingleProjectReadiness,
  syncAttemptTimingAndExpiry,
} from '../utils/assessmentEngine.js';

const router = express.Router();
router.use(requireRole('admin'));

function adminIdentity(user) {
  return `${user.fullName} (${user.employeeCode})`;
}

const pdfStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, GUIDELINE_STORAGE_DIR),
  filename: (_req, _file, cb) => cb(null, `${Date.now()}-${generateSecureToken(10)}.pdf`),
});

const uploadGuidelinePdf = multer({
  storage: pdfStorage,
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext !== '.pdf' || !['application/pdf', 'application/octet-stream'].includes(file.mimetype)) {
      return cb(new Error('Only PDF files (.pdf, max 12 MB) are permitted for PDF guidelines.'));
    }
    return cb(null, true);
  },
});

/* ============================================================================
 * PHASE 4: GUIDELINE ADMINISTRATION (Section 7.4)
 * ========================================================================== */

router.get('/guidelines', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const status = String(req.query.status || 'all');

  let sql = `
    SELECT
      g.id,
      g.title,
      g.client_project_task AS clientProjectTask,
      g.summary,
      g.guideline_type AS guidelineType,
      g.pdf_original_name AS pdfOriginalName,
      g.pdf_size_bytes AS pdfSizeBytes,
      g.status,
      g.current_version AS currentVersion,
      g.created_at AS createdAt,
      g.updated_at AS updatedAt,
      (SELECT COUNT(*) FROM guideline_access_logs al WHERE al.guideline_id = g.id) AS accessCount
    FROM guidelines g
    WHERE 1=1
  `;
  const params = [];

  if (['draft', 'published', 'archived'].includes(status)) {
    sql += ' AND g.status = ?';
    params.push(status);
  }
  if (q) {
    sql += ' AND (LOWER(g.title) LIKE ? OR LOWER(g.client_project_task) LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY g.updated_at DESC';

  return res.json({ guidelines: db.prepare(sql).all(...params) });
});

router.get('/guidelines/:id', (req, res) => {
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
         pdf_stored_name AS pdfStoredName,
         pdf_size_bytes AS pdfSizeBytes,
         status,
         current_version AS currentVersion,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM guidelines WHERE id = ?`
    )
    .get(gid);

  if (!guideline) {
    return res.status(404).json({ error: 'Guideline not found.' });
  }

  const versions = db
    .prepare(
      `SELECT
         id,
         version_number AS versionNumber,
         title,
         client_project_task AS clientProjectTask,
         guideline_type AS guidelineType,
         content_body AS contentBody,
         pdf_original_name AS pdfOriginalName,
         change_note AS changeNote,
         edited_by_identity AS editedByIdentity,
         created_at AS createdAt
       FROM guideline_versions
       WHERE guideline_id = ?
       ORDER BY version_number DESC`
    )
    .all(gid);

  const accessLogs = db
    .prepare(
      `SELECT
         al.id,
         u.employee_code AS employeeCode,
         u.full_name AS fullName,
         al.version_number AS versionNumber,
         al.duration_seconds AS durationSeconds,
         al.opened_at AS openedAt
       FROM guideline_access_logs al
       JOIN users u ON u.id = al.user_id
       WHERE al.guideline_id = ?
       ORDER BY al.opened_at DESC
       LIMIT 40`
    )
    .all(gid);

  return res.json({ guideline, versions, accessLogs });
});

router.post('/guidelines', (req, res) => {
  uploadGuidelinePdf.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'pdfFile', maxCount: 1 },
  ])(req, res, (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message || 'Invalid PDF upload.' });
    }

    const file = req.files?.pdf?.[0] || req.files?.pdfFile?.[0] || null;
    const title = String(req.body?.title || '').trim();
    const clientProjectTask = String(req.body?.clientProjectTask || '').trim();
    const summary = String(req.body?.summary || '').trim();
    const guidelineType = req.body?.guidelineType === 'pdf' ? 'pdf' : 'online';
    const contentBody = String(req.body?.contentBody || '').trim();
    const rawStatus = String(req.body?.status || 'published').trim();
    const status =
      rawStatus === 'unpublished'
        ? 'draft'
        : ['draft', 'published', 'archived'].includes(rawStatus)
        ? rawStatus
        : 'published';
    const changeNote = String(req.body?.changeNote || 'Initial guideline version').trim();

    if (!title || title.length < 3) {
      if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Guideline title (at least 3 characters) is required.' });
    }
    if (!clientProjectTask) {
      if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Client / Project / Task reference is required.' });
    }
    if (guidelineType === 'pdf' && !file) {
      return res.status(400).json({ error: 'Please attach a PDF file for a PDF guideline.' });
    }
    if (guidelineType === 'online' && contentBody.length < 10) {
      return res.status(400).json({ error: 'Online guideline content (at least 10 characters) is required.' });
    }

    let createdId = null;
    const tx = db.transaction(() => {
      const ins = db
        .prepare(
          `INSERT INTO guidelines (
             title, client_project_task, summary, guideline_type, content_body,
             pdf_original_name, pdf_stored_name, pdf_size_bytes, status,
             current_version, created_by, updated_by, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'), datetime('now'))`
        )
        .run(
          title,
          clientProjectTask,
          summary || null,
          guidelineType,
          guidelineType === 'online' ? contentBody : null,
          file ? path.basename(file.originalname) : null,
          file ? file.filename : null,
          file ? file.size : null,
          status,
          req.user.id,
          req.user.id
        );

      createdId = ins.lastInsertRowid;

      db.prepare(
        `INSERT INTO guideline_versions (
           guideline_id, version_number, title, client_project_task, guideline_type,
           content_body, pdf_original_name, pdf_stored_name, change_note, edited_by_identity, created_at
         ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        createdId,
        title,
        clientProjectTask,
        guidelineType,
        guidelineType === 'online' ? contentBody : null,
        file ? path.basename(file.originalname) : null,
        file ? file.filename : null,
        changeNote,
        adminIdentity(req.user)
      );
    });
    tx();

    recordAudit({
      adminId: req.user.id,
      adminIdentity: adminIdentity(req.user),
      action: 'GUIDELINE_CREATED',
      entityType: 'guideline',
      entityId: createdId,
      summary: `Created ${guidelineType.toUpperCase()} guideline "${title}" (v1, ${status}).`,
      after: { title, clientProjectTask, guidelineType, status, version: 1 },
    });

    return res.status(201).json({ success: true, id: createdId, guidelineId: createdId, currentVersion: 1 });
  });
});

router.put('/guidelines/:id', (req, res) => {
  uploadGuidelinePdf.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'pdfFile', maxCount: 1 },
  ])(req, res, (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message || 'Invalid PDF upload.' });
    }

    const file = req.files?.pdf?.[0] || req.files?.pdfFile?.[0] || null;
    const gid = parseInt(req.params.id, 10);
    const existing = db.prepare('SELECT * FROM guidelines WHERE id = ?').get(gid);
    if (!existing) {
      if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(404).json({ error: 'Guideline not found.' });
    }

    const title = String(req.body?.title ?? existing.title).trim();
    const clientProjectTask = String(
      req.body?.clientProjectTask ?? existing.client_project_task
    ).trim();
    const summary = String(req.body?.summary ?? existing.summary ?? '').trim();
    const rawStatus = req.body?.status;
    const status =
      rawStatus === 'unpublished'
        ? 'draft'
        : ['draft', 'published', 'archived'].includes(rawStatus)
        ? rawStatus
        : existing.status;
    const contentBody =
      existing.guideline_type === 'online'
        ? String(req.body?.contentBody ?? existing.content_body ?? '').trim()
        : null;
    const changeNote = String(req.body?.changeNote || 'Updated guideline content/status').trim();

    if (!title || !clientProjectTask) {
      if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Title and Client/Project/Task are required.' });
    }

    // Increment version whenever content, title, project, or PDF changes
    const contentChanged =
      title !== existing.title ||
      clientProjectTask !== existing.client_project_task ||
      (existing.guideline_type === 'online' && contentBody !== existing.content_body) ||
      Boolean(file);

    const nextVersion = contentChanged ? existing.current_version + 1 : existing.current_version;
    const pdfOriginalName = file ? path.basename(file.originalname) : existing.pdf_original_name;
    const pdfStoredName = file ? file.filename : existing.pdf_stored_name;
    const pdfSizeBytes = file ? file.size : existing.pdf_size_bytes;

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE guidelines
         SET title = ?,
             client_project_task = ?,
             summary = ?,
             content_body = ?,
             pdf_original_name = ?,
             pdf_stored_name = ?,
             pdf_size_bytes = ?,
             status = ?,
             current_version = ?,
             updated_by = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        title,
        clientProjectTask,
        summary || null,
        contentBody,
        pdfOriginalName,
        pdfStoredName,
        pdfSizeBytes,
        status,
        nextVersion,
        req.user.id,
        gid
      );

      if (contentChanged) {
        db.prepare(
          `INSERT INTO guideline_versions (
             guideline_id, version_number, title, client_project_task, guideline_type,
             content_body, pdf_original_name, pdf_stored_name, change_note, edited_by_identity, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).run(
          gid,
          nextVersion,
          title,
          clientProjectTask,
          existing.guideline_type,
          contentBody,
          pdfOriginalName,
          pdfStoredName,
          changeNote,
          adminIdentity(req.user)
        );
      }
    });
    tx();

    recordAudit({
      adminId: req.user.id,
      adminIdentity: adminIdentity(req.user),
      action: 'GUIDELINE_UPDATED',
      entityType: 'guideline',
      entityId: gid,
      summary: `Updated guideline "${title}" (v${existing.current_version} -> v${nextVersion}, status: ${status}).`,
      before: { title: existing.title, status: existing.status, version: existing.current_version },
      after: { title, status, version: nextVersion, changeNote },
    });

    return res.json({ success: true, currentVersion: nextVersion });
  });
});

router.post('/guidelines/:id/status', (req, res) => {
  const gid = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM guidelines WHERE id = ?').get(gid);
  if (!existing) return res.status(404).json({ error: 'Guideline not found.' });

  const rawStatus = String(req.body?.status || '').trim();
  const nextStatus =
    rawStatus === 'unpublished'
      ? 'draft'
      : ['draft', 'published', 'archived'].includes(rawStatus)
      ? rawStatus
      : existing.status;

  db.prepare("UPDATE guidelines SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    nextStatus,
    gid
  );
  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentity(req.user),
    action: 'GUIDELINE_STATUS_CHANGED',
    entityType: 'guideline',
    entityId: gid,
    summary: `Changed guideline "${existing.title}" status to ${nextStatus}.`,
    before: { status: existing.status },
    after: { status: nextStatus },
  });
  return res.json({ success: true, status: nextStatus });
});

router.get('/guidelines/:id/pdf', (req, res) => {
  const gid = parseInt(req.params.id, 10);
  if (req.query.versionId) {
    const vid = parseInt(req.query.versionId, 10);
    const v = db.prepare('SELECT * FROM guideline_versions WHERE id = ? AND guideline_id = ?').get(vid, gid);
    if (!v || !v.pdf_stored_name) return res.status(404).json({ error: 'Version PDF not found.' });
    const fullPath = path.join(GUIDELINE_STORAGE_DIR, path.basename(v.pdf_stored_name));
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'PDF file missing.' });
    res.setHeader('Content-Type', 'application/pdf');
    return res.sendFile(fullPath);
  }
  const g = db.prepare('SELECT * FROM guidelines WHERE id = ?').get(gid);
  if (!g || !g.pdf_stored_name) return res.status(404).json({ error: 'PDF not found.' });
  const fullPath = path.join(GUIDELINE_STORAGE_DIR, path.basename(g.pdf_stored_name));
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'PDF file missing.' });
  res.setHeader('Content-Type', 'application/pdf');
  return res.sendFile(fullPath);
});

router.get('/guidelines/versions/:versionId/pdf', (req, res) => {
  const vid = parseInt(req.params.versionId, 10);
  const v = db.prepare('SELECT * FROM guideline_versions WHERE id = ?').get(vid);
  if (!v || !v.pdf_stored_name) return res.status(404).json({ error: 'Version PDF not found.' });
  const fullPath = path.join(GUIDELINE_STORAGE_DIR, path.basename(v.pdf_stored_name));
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'PDF file missing.' });
  res.setHeader('Content-Type', 'application/pdf');
  return res.sendFile(fullPath);
});

/* ============================================================================
 * PHASE 5: REUSABLE QUESTION BANK & BULK IMPORT (Section 7.6)
 * ========================================================================== */

router.get('/question-bank', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const type = String(req.query.questionType || req.query.type || 'all');
  const projectRef = String(req.query.projectTag || req.query.projectRef || '').trim().toLowerCase();
  const statusFilter = String(req.query.status || 'all');

  let sql = `
    SELECT
      qb.*,
      (SELECT COUNT(*) FROM assessment_questions aq WHERE aq.question_id = qb.id) AS usedInAssessments
    FROM question_bank qb
    WHERE qb.is_reusable = 1
  `;
  const params = [];

  if (statusFilter === 'active' || statusFilter === 'archived') {
    sql += ' AND qb.status = ?';
    params.push(statusFilter);
  }

  if (['mcq', 'true_false', 'short_answer', 'practical_scenario'].includes(type)) {
    sql += ' AND qb.question_type = ?';
    params.push(type);
  }
  if (projectRef) {
    sql += ' AND LOWER(COALESCE(qb.project_ref, "")) LIKE ?';
    params.push(`%${projectRef}%`);
  }
  if (q) {
    sql += ' AND (LOWER(qb.prompt) LIKE ? OR LOWER(COALESCE(qb.project_ref, "")) LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY qb.updated_at DESC, qb.id DESC';

  const rows = db.prepare(sql).all(...params).map((r) => ({
    id: r.id,
    questionType: r.question_type,
    prompt: r.prompt,
    scenarioContext: r.scenario_context,
    options: r.options_json ? JSON.parse(r.options_json) : [],
    correctAnswer: r.correct_answer,
    acceptableAnswers: r.acceptable_answers_json ? JSON.parse(r.acceptable_answers_json) : [],
    scoringRubric: r.scoring_rubric,
    marks: r.marks,
    explanation: r.explanation,
    projectRef: r.project_ref,
    projectTag: r.project_ref,
    status: r.status,
    version: r.version,
    usedInAssessments: r.usedInAssessments,
    updatedAt: r.updated_at,
  }));

  return res.json({ questions: rows });
});

function validateAndInsertQuestion(payload, userId, isReusable = 1) {
  const { validQuestions, errors } = parseAndValidateBulkQuestions('json', JSON.stringify([payload]));
  if (errors.length > 0) {
    const err = new Error(errors[0].message);
    err.status = 400;
    throw err;
  }
  const q = validQuestions[0];
  const ins = db
    .prepare(
      `INSERT INTO question_bank (
         question_type, prompt, scenario_context, options_json, correct_answer,
         acceptable_answers_json, scoring_rubric, marks, explanation, project_ref,
         is_reusable, version, status, created_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', ?, datetime('now'), datetime('now'))`
    )
    .run(
      q.questionType,
      q.prompt,
      q.scenarioContext,
      q.options.length > 0 ? JSON.stringify(q.options) : null,
      q.correctAnswer,
      q.acceptableAnswers.length > 0 ? JSON.stringify(q.acceptableAnswers) : null,
      q.scoringRubric,
      q.marks,
      q.explanation,
      q.projectRef,
      isReusable ? 1 : 0,
      userId
    );
  return ins.lastInsertRowid;
}

router.post('/question-bank', (req, res) => {
  try {
    const newId = validateAndInsertQuestion(req.body, req.user.id, 1);
    recordAudit({
      adminId: req.user.id,
      adminIdentity: adminIdentity(req.user),
      action: 'QUESTION_CREATED',
      entityType: 'question_bank',
      entityId: newId,
      summary: `Created ${req.body.questionType} question #${newId} in reusable Question Bank.`,
    });
    return res.status(201).json({ success: true, questionId: newId });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
});

function handleUpdateQuestionBank(req, res) {
  const qid = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM question_bank WHERE id = ?').get(qid);
  if (!existing) {
    return res.status(404).json({ error: 'Question not found.' });
  }

  if (req.body?.status && Object.keys(req.body).length === 1) {
    const nextSt = req.body.status === 'archived' ? 'archived' : 'active';
    db.prepare("UPDATE question_bank SET status = ?, updated_at = datetime('now') WHERE id = ?").run(nextSt, qid);
    recordAudit({
      adminId: req.user.id,
      adminIdentity: adminIdentity(req.user),
      action: nextSt === 'archived' ? 'QUESTION_ARCHIVED' : 'QUESTION_RESTORED',
      entityType: 'question_bank',
      entityId: qid,
      summary: `Set question #${qid} status to ${nextSt}. Historical attempt snapshots remain preserved.`,
    });
    return res.json({ success: true, status: nextSt });
  }

  const mergedPayload = {
    questionType: req.body?.questionType ?? existing.question_type,
    prompt: req.body?.prompt ?? existing.prompt,
    scenarioContext: req.body?.scenarioContext ?? existing.scenario_context ?? '',
    options:
      req.body?.options ??
      (existing.options_json ? JSON.parse(existing.options_json) : []),
    correctAnswer: req.body?.correctAnswer ?? existing.correct_answer ?? '',
    acceptableAnswers:
      req.body?.acceptableAnswers ??
      (existing.acceptable_answers_json ? JSON.parse(existing.acceptable_answers_json) : []),
    scoringRubric: req.body?.scoringRubric ?? existing.scoring_rubric ?? '',
    marks: req.body?.marks ?? existing.marks,
    explanation: req.body?.explanation ?? existing.explanation ?? '',
    projectRef: req.body?.projectTag ?? req.body?.projectRef ?? existing.project_ref ?? '',
  };

  const { validQuestions, errors } = parseAndValidateBulkQuestions('json', JSON.stringify([mergedPayload]));
  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0].message });
  }
  const q = validQuestions[0];
  const nextVersion = (existing.version || 1) + 1;

  db.prepare(
    `UPDATE question_bank
     SET question_type = ?,
         prompt = ?,
         scenario_context = ?,
         options_json = ?,
         correct_answer = ?,
         acceptable_answers_json = ?,
         scoring_rubric = ?,
         marks = ?,
         explanation = ?,
         project_ref = ?,
         version = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    q.questionType,
    q.prompt,
    q.scenarioContext,
    q.options.length > 0 ? JSON.stringify(q.options) : null,
    q.correctAnswer,
    q.acceptableAnswers.length > 0 ? JSON.stringify(q.acceptableAnswers) : null,
    q.scoringRubric,
    q.marks,
    q.explanation,
    q.projectRef,
    nextVersion,
    qid
  );

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentity(req.user),
    action: 'QUESTION_UPDATED',
    entityType: 'question_bank',
    entityId: qid,
    summary: `Updated question #${qid} to v${nextVersion} (prior attempt snapshots preserved).`,
    before: { prompt: existing.prompt, version: existing.version },
    after: { prompt: q.prompt, version: nextVersion },
  });

  return res.json({ success: true, version: nextVersion });
}

router.patch('/question-bank/:id', handleUpdateQuestionBank);
router.put('/question-bank/:id', handleUpdateQuestionBank);

router.post('/question-bank/bulk-import', (req, res) => {
  const format = req.body?.format === 'csv' ? 'csv' : 'json';
  const rawContent = String(req.body?.payload ?? req.body?.content ?? '');
  const commitValid = req.body?.commitValid !== undefined ? Boolean(req.body.commitValid) : true;

  const { validQuestions, errors } = parseAndValidateBulkQuestions(format, rawContent);

  if (errors.length > 0 && req.body?.commitValid === undefined) {
    return res.status(400).json({
      error: `Import rejected due to ${errors.length} malformed or invalid row(s).`,
      errors,
      rowErrors: errors.map((e) => `Row ${e.row}: ${e.message}`),
    });
  }

  let importedIds = [];
  if (commitValid && validQuestions.length > 0) {
    const ins = db.prepare(
      `INSERT INTO question_bank (
         question_type, prompt, scenario_context, options_json, correct_answer,
         acceptable_answers_json, scoring_rubric, marks, explanation, project_ref,
         is_reusable, version, status, created_by, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'active', ?, datetime('now'), datetime('now'))`
    );
    const tx = db.transaction(() => {
      for (const q of validQuestions) {
        const r = ins.run(
          q.questionType,
          q.prompt,
          q.scenarioContext,
          q.options.length > 0 ? JSON.stringify(q.options) : null,
          q.correctAnswer,
          q.acceptableAnswers.length > 0 ? JSON.stringify(q.acceptableAnswers) : null,
          q.scoringRubric,
          q.marks,
          q.explanation,
          q.projectRef,
          req.user.id
        );
        importedIds.push(r.lastInsertRowid);
      }
    });
    tx();

    recordAudit({
      adminId: req.user.id,
      adminIdentity: adminIdentity(req.user),
      action: 'QUESTION_BULK_IMPORT',
      entityType: 'question_bank',
      entityId: 'bulk',
      summary: `Bulk imported ${importedIds.length} valid question(s) via ${format.toUpperCase()} (${errors.length} invalid row(s) rejected & reported).`,
    });
  }

  return res.status(importedIds.length > 0 ? 201 : 200).json({
    validCount: validQuestions.length,
    importedCount: importedIds.length,
    errorCount: errors.length,
    errors,
    rowErrors: errors.map((e) => `Row ${e.row}: ${e.message}`),
    validPreview: validQuestions.slice(0, 10),
  });
});

/* ============================================================================
 * PHASE 5: FLEXIBLE ASSESSMENT CREATOR (Sections 7.5 & 7.7)
 * ========================================================================== */

router.get('/assessments', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT
         a.*,
         p.name AS projectName,
         p.code AS projectCode,
         (SELECT COUNT(*) FROM assessment_questions aq WHERE aq.assessment_id = a.id) AS linkedQuestionsCount,
         (SELECT COUNT(*) FROM assessment_attempts att WHERE att.assessment_id = a.id) AS attemptsCount
       FROM assessments a
       LEFT JOIN projects p ON p.id = a.project_id
       ORDER BY a.updated_at DESC, a.id DESC`
    )
    .all()
    .map((a) => ({
      id: a.id,
      title: a.title,
      instructions: a.instructions,
      projectId: a.project_id,
      projectName: a.projectName,
      projectCode: a.projectCode,
      projectTaskRef: a.project_task_ref,
      status: a.status,
      availableFrom: a.available_from,
      availableUntil: a.available_until,
      isTimed: Boolean(a.is_timed),
      timeLimitMinutes: a.time_limit_minutes,
      pauseOnDisconnect: Boolean(a.pause_on_disconnect),
      passingPercentage: a.passing_percentage,
      selectionMode: a.selection_mode,
      randomSampleCount: a.random_sample_count,
      randomPoolProjectRef: a.random_pool_project_ref,
      version: a.version,
      linkedQuestionsCount: a.linkedQuestionsCount,
      attemptsCount: a.attemptsCount,
      updatedAt: a.updated_at,
    }));

  return res.json({ assessments: rows });
});

router.get('/assessments/:id', (req, res) => {
  const aid = parseInt(req.params.id, 10);
  const a = db.prepare('SELECT * FROM assessments WHERE id = ?').get(aid);
  if (!a) return res.status(404).json({ error: 'Assessment not found.' });

  const questions = db
    .prepare(
      `SELECT
         aq.question_id AS questionId,
         aq.sort_order AS sortOrder,
         aq.marks_override AS marksOverride,
         qb.question_type AS questionType,
         qb.prompt,
         qb.scenario_context AS scenarioContext,
         qb.options_json AS optionsJson,
         qb.marks AS defaultMarks,
         qb.project_ref AS projectRef,
         qb.is_reusable AS isReusable
       FROM assessment_questions aq
       JOIN question_bank qb ON qb.id = aq.question_id
       WHERE aq.assessment_id = ?
       ORDER BY aq.sort_order ASC`
    )
    .all(aid)
    .map((q) => ({
      ...q,
      options: q.optionsJson ? JSON.parse(q.optionsJson) : [],
      isReusable: Boolean(q.isReusable),
    }));

  return res.json({
    assessment: {
      id: a.id,
      title: a.title,
      instructions: a.instructions,
      projectId: a.project_id,
      projectTaskRef: a.project_task_ref,
      status: a.status,
      availableFrom: a.available_from,
      availableUntil: a.available_until,
      isTimed: Boolean(a.is_timed),
      timeLimitMinutes: a.time_limit_minutes,
      pauseOnDisconnect: Boolean(a.pause_on_disconnect),
      passingPercentage: a.passing_percentage,
      selectionMode: a.selection_mode,
      randomSampleCount: a.random_sample_count,
      randomPoolProjectRef: a.random_pool_project_ref,
      version: a.version,
    },
    questions,
  });
});

function saveAssessmentWithQuestions(req, existing = null) {
  const b = req.body || {};
  const title = String(b.title || '').trim();
  const instructions = String(b.instructions || '').trim();
  const projectId = b.projectId ? parseInt(b.projectId, 10) : null;
  const projectTaskRef = String(b.projectTaskRef || '').trim() || null;
  const status = ['draft', 'published', 'archived'].includes(b.status) ? b.status : 'draft';
  const availableFrom = String(b.availableFrom || '').trim() || null;
  const availableUntil = String(b.availableUntil || '').trim() || null;
  const isTimed = b.isTimed ? 1 : 0;
  const timeLimitMinutes = isTimed ? Math.max(1, parseInt(b.timeLimitMinutes || 30, 10)) : null;
  const pauseOnDisconnect = b.pauseOnDisconnect !== false ? 1 : 0;
  const passingPercentage = Math.min(100, Math.max(1, Number(b.passingPercentage ?? 75)));
  const selectionMode = b.selectionMode === 'random_pool' ? 'random_pool' : 'fixed';
  const randomSampleCount =
    selectionMode === 'random_pool' ? Math.max(1, parseInt(b.randomSampleCount || 5, 10)) : null;
  const randomPoolProjectRef = String(b.randomPoolTag || b.randomPoolProjectRef || '').trim() || null;

  if (!title || title.length < 3) {
    const err = new Error('Assessment title (at least 3 characters) is required.');
    err.status = 400;
    throw err;
  }
  if (!instructions || instructions.length < 5) {
    const err = new Error('Assessment instructions are required.');
    err.status = 400;
    throw err;
  }

  let questionLinks = Array.isArray(b.questionLinks) ? [...b.questionLinks] : [];
  let inlineQuestions = Array.isArray(b.inlineQuestions) ? [...b.inlineQuestions] : [];
  if (Array.isArray(b.questions)) {
    for (const item of b.questions) {
      if (item?.inlineQuestion) {
        inlineQuestions.push(item.inlineQuestion);
      } else if (item?.questionId) {
        questionLinks.push(item);
      }
    }
  }

  let assessmentId = existing?.id || null;

  const tx = db.transaction(() => {
    if (!existing) {
      const ins = db
        .prepare(
          `INSERT INTO assessments (
             title, instructions, project_id, project_task_ref, status,
             available_from, available_until, is_timed, time_limit_minutes,
             pause_on_disconnect, passing_percentage, selection_mode,
             random_sample_count, random_pool_project_ref, version,
             created_by, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`
        )
        .run(
          title,
          instructions,
          projectId,
          projectTaskRef,
          status,
          availableFrom,
          availableUntil,
          isTimed,
          timeLimitMinutes,
          pauseOnDisconnect,
          passingPercentage,
          selectionMode,
          randomSampleCount,
          randomPoolProjectRef,
          req.user.id
        );
      assessmentId = ins.lastInsertRowid;
    } else {
      db.prepare(
        `UPDATE assessments
         SET title = ?, instructions = ?, project_id = ?, project_task_ref = ?,
             status = ?, available_from = ?, available_until = ?, is_timed = ?,
             time_limit_minutes = ?, pause_on_disconnect = ?, passing_percentage = ?,
             selection_mode = ?, random_sample_count = ?, random_pool_project_ref = ?,
             version = version + 1, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        title,
        instructions,
        projectId,
        projectTaskRef,
        status,
        availableFrom,
        availableUntil,
        isTimed,
        timeLimitMinutes,
        pauseOnDisconnect,
        passingPercentage,
        selectionMode,
        randomSampleCount,
        randomPoolProjectRef,
        assessmentId
      );
      db.prepare('DELETE FROM assessment_questions WHERE assessment_id = ?').run(assessmentId);
    }

    const linkStmt = db.prepare(
      `INSERT OR IGNORE INTO assessment_questions
        (assessment_id, question_id, sort_order, marks_override)
       VALUES (?, ?, ?, ?)`
    );

    let orderCounter = 1;
    for (const link of questionLinks) {
      const qid = parseInt(link.questionId, 10);
      if (Number.isNaN(qid)) continue;
      const override =
        link.marksOverride !== undefined && link.marksOverride !== null && link.marksOverride !== ''
          ? Number(link.marksOverride)
          : null;
      linkStmt.run(assessmentId, qid, orderCounter++, override);
    }

    // Create any inline questions directly inside this assessment
    for (const inlineQ of inlineQuestions) {
      const saveToBankToo = Boolean(inlineQ.saveToBank);
      const createdQId = validateAndInsertQuestion(inlineQ, req.user.id, saveToBankToo ? 1 : 0);
      linkStmt.run(assessmentId, createdQId, orderCounter++, null);
    }
  });

  tx();

  // Notify active employees if assessment was newly published and is currently available
  const newlyPublished = status === 'published' && (!existing || existing.status !== 'published');
  const isFuture = availableFrom && Date.parse(`${availableFrom.replace(' ', 'T')}Z`) > Date.now();
  if (newlyPublished && !isFuture) {
    notifyAllActiveEmployees({
      type: 'ASSESSMENT_AVAILABLE',
      title: `New Assessment Available: ${title}`,
      message: `An assessment ("${title}") is now available in your portal.`,
      linkPath: '/portal/assessments',
    });
  }

  return { assessmentId, title, status };
}

router.post('/assessments', (req, res) => {
  try {
    const out = saveAssessmentWithQuestions(req, null);
    recordAudit({
      adminId: req.user.id,
      adminIdentity: adminIdentity(req.user),
      action: 'ASSESSMENT_CREATED',
      entityType: 'assessment',
      entityId: out.assessmentId,
      summary: `Created assessment "${out.title}" (${out.status}).`,
    });
    return res.status(201).json({ success: true, id: out.assessmentId, assessmentId: out.assessmentId });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
});

router.post('/assessments/:id/status', (req, res) => {
  const aid = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM assessments WHERE id = ?').get(aid);
  if (!existing) return res.status(404).json({ error: 'Assessment not found.' });

  const nextStatus = ['draft', 'published', 'archived'].includes(req.body?.status)
    ? req.body.status
    : existing.status;

  db.prepare("UPDATE assessments SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    nextStatus,
    aid
  );

  if (nextStatus === 'published' && existing.status !== 'published') {
    notifyAllActiveEmployees({
      type: 'ASSESSMENT_AVAILABLE',
      title: `New Assessment Available: ${existing.title}`,
      message: `An assessment ("${existing.title}") is now published and open for taking.`,
      linkPath: '/portal/assessments',
    });
  }

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentity(req.user),
    action: 'ASSESSMENT_STATUS_CHANGED',
    entityType: 'assessment',
    entityId: aid,
    summary: `Changed assessment "${existing.title}" status to ${nextStatus}.`,
    before: { status: existing.status },
    after: { status: nextStatus },
  });
  return res.json({ success: true, status: nextStatus });
});

router.put('/assessments/:id', (req, res) => {
  const aid = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM assessments WHERE id = ?').get(aid);
  if (!existing) return res.status(404).json({ error: 'Assessment not found.' });

  try {
    const out = saveAssessmentWithQuestions(req, existing);
    recordAudit({
      adminId: req.user.id,
      adminIdentity: adminIdentity(req.user),
      action: 'ASSESSMENT_UPDATED',
      entityType: 'assessment',
      entityId: aid,
      summary: `Updated assessment "${out.title}" (status: ${existing.status} -> ${out.status}).`,
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }
});

router.post('/assessments/:id/duplicate', (req, res) => {
  const aid = parseInt(req.params.id, 10);
  const src = db.prepare('SELECT * FROM assessments WHERE id = ?').get(aid);
  if (!src) return res.status(404).json({ error: 'Assessment not found.' });

  const links = db
    .prepare('SELECT * FROM assessment_questions WHERE assessment_id = ? ORDER BY sort_order ASC')
    .all(aid);

  let copyId = null;
  const tx = db.transaction(() => {
    const ins = db
      .prepare(
        `INSERT INTO assessments (
           title, instructions, project_id, project_task_ref, status,
           available_from, available_until, is_timed, time_limit_minutes,
           pause_on_disconnect, passing_percentage, selection_mode,
           random_sample_count, random_pool_project_ref, version,
           created_by, created_at, updated_at
         ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`
      )
      .run(
        `${src.title} (Copy)`,
        src.instructions,
        src.project_id,
        src.project_task_ref,
        src.available_from,
        src.available_until,
        src.is_timed,
        src.time_limit_minutes,
        src.pause_on_disconnect,
        src.passing_percentage,
        src.selection_mode,
        src.random_sample_count,
        src.random_pool_project_ref,
        req.user.id
      );
    copyId = ins.lastInsertRowid;

    const linkIns = db.prepare(
      `INSERT INTO assessment_questions (assessment_id, question_id, sort_order, marks_override)
       VALUES (?, ?, ?, ?)`
    );
    for (const l of links) {
      linkIns.run(copyId, l.question_id, l.sort_order, l.marks_override);
    }
  });
  tx();

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentity(req.user),
    action: 'ASSESSMENT_DUPLICATED',
    entityType: 'assessment',
    entityId: copyId,
    summary: `Duplicated assessment "${src.title}" -> draft #${copyId}.`,
  });

  return res.status(201).json({ success: true, assessmentId: copyId });
});

/* ============================================================================
 * PHASE 5: ATTEMPTS, MANUAL REVIEW, RESULT RELEASE & RETAKES (Sections 7.8–7.10)
 * ========================================================================== */

router.get('/attempts', (req, res) => {
  // Sync any timed in-progress attempts first
  const activeIds = db
    .prepare("SELECT id FROM assessment_attempts WHERE status = 'in_progress'")
    .all();
  for (const r of activeIds) syncAttemptTimingAndExpiry(r.id);

  const filter = String(req.query.filter || 'all');

  let sql = `
    SELECT
      att.*,
      u.employee_code AS employeeCode,
      u.full_name AS employeeName,
      u.email AS employeeEmail,
      a.title AS assessmentTitle,
      a.passing_percentage AS passingPercentage
    FROM assessment_attempts att
    JOIN users u ON u.id = att.user_id
    JOIN assessments a ON a.id = att.assessment_id
    WHERE 1=1
  `;

  if (filter === 'pending_review') {
    sql += " AND att.status != 'in_progress' AND att.review_status = 'pending' AND att.requires_manual_review = 1";
  } else if (filter === 'unreleased' || filter === 'pending_release') {
    sql += " AND att.status != 'in_progress' AND att.is_released = 0";
  } else if (filter === 'released') {
    sql += ' AND att.is_released = 1';
  } else if (filter === 'failed') {
    sql += " AND att.status != 'in_progress' AND att.passed = 0";
  } else if (filter === 'expired') {
    sql += " AND att.status = 'expired'";
  } else if (filter === 'interrupted') {
    sql += ' AND att.interruption_count > 0';
  }

  sql += ' ORDER BY att.started_at DESC, att.id DESC';

  const attempts = db.prepare(sql).all().map((r) => ({
    id: r.id,
    assessmentId: r.assessment_id,
    assessmentTitle: r.assessmentTitle,
    userId: r.user_id,
    employeeCode: r.employeeCode,
    employeeName: r.employeeName,
    fullName: r.employeeName,
    employeeEmail: r.employeeEmail,
    attemptNumber: r.attempt_number,
    status: r.status,
    statusDetail: r.status_detail,
    startedAt: r.started_at,
    submittedAt: r.submitted_at,
    durationSeconds: r.duration_seconds,
    interruptionCount: r.interruption_count,
    totalPossibleMarks: r.total_possible_marks,
    autoScore: r.auto_score,
    finalScore: r.final_score,
    percentage: r.percentage,
    passingPercentage: r.passingPercentage,
    passed: r.passed === null ? null : Boolean(r.passed),
    requiresManualReview: Boolean(r.requires_manual_review),
    reviewStatus: r.review_status,
    isReleased: Boolean(r.is_released),
    releasedByIdentity: r.released_by_identity,
    releasedAt: r.released_at,
  }));

  return res.json({ attempts });
});

router.get('/attempts/:id', (req, res) => {
  const attemptId = parseInt(req.params.id, 10);
  syncAttemptTimingAndExpiry(attemptId);

  const att = db
    .prepare(
      `SELECT
         att.*,
         u.employee_code AS employeeCode,
         u.full_name AS employeeName,
         u.email AS employeeEmail,
         a.title AS assessmentTitle,
         a.passing_percentage AS passingPercentage
       FROM assessment_attempts att
       JOIN users u ON u.id = att.user_id
       JOIN assessments a ON a.id = att.assessment_id
       WHERE att.id = ?`
    )
    .get(attemptId);

  if (!att) return res.status(404).json({ error: 'Attempt not found.' });

  const questions = db
    .prepare(
      `SELECT
         aq.*,
         aa.answer_value AS answerValue,
         aa.reasoning_text AS reasoningText,
         aa.auto_marks AS autoMarks,
         aa.awarded_marks AS awardedMarks,
         aa.is_correct AS isCorrect,
         aa.reviewer_comment AS reviewerComment
       FROM attempt_questions aq
       LEFT JOIN attempt_answers aa
         ON aa.attempt_question_id = aq.id AND aa.attempt_id = aq.attempt_id
       WHERE aq.attempt_id = ?
       ORDER BY aq.sort_order ASC`
    )
    .all(attemptId)
    .map((q) => ({
      id: q.id,
      attemptQuestionId: q.id,
      questionVersion: q.question_version,
      sortOrder: q.sort_order,
      questionType: q.question_type,
      prompt: q.prompt,
      scenarioContext: q.scenario_context,
      options: q.options_json ? JSON.parse(q.options_json) : [],
      correctAnswer: q.correct_answer,
      acceptableAnswers: q.acceptable_answers_json ? JSON.parse(q.acceptable_answers_json) : [],
      scoringRubric: q.scoring_rubric,
      marks: q.marks,
      explanation: q.explanation,
      answerValue: q.answerValue,
      employeeAnswer: q.answerValue,
      reasoningText: q.reasoningText,
      employeeReasoning: q.reasoningText,
      autoMarks: q.autoMarks,
      awardedMarks: q.awardedMarks,
      isCorrect: q.isCorrect === null || q.isCorrect === undefined ? null : Boolean(q.isCorrect),
      reviewerComment: q.reviewerComment || '',
    }));

  const events = db
    .prepare('SELECT * FROM attempt_events WHERE attempt_id = ? ORDER BY id ASC')
    .all(attemptId)
    .map((ev) => ({
      id: ev.id,
      eventType: ev.event_type,
      detail: ev.detail,
      createdAt: ev.created_at,
    }));

  const priorAttempts = db
    .prepare(
      `SELECT id, attempt_number AS attemptNumber, status, status_detail AS statusDetail,
              final_score AS finalScore, percentage, passed, is_released AS isReleased, started_at AS startedAt
       FROM assessment_attempts
       WHERE user_id = ? AND assessment_id = ? AND id != ?
       ORDER BY attempt_number DESC`
    )
    .all(att.user_id, att.assessment_id, attemptId);

  return res.json({
    attempt: {
      id: att.id,
      assessmentId: att.assessment_id,
      assessmentTitle: att.assessmentTitle,
      userId: att.user_id,
      employeeCode: att.employeeCode,
      employeeName: att.employeeName,
      fullName: att.employeeName,
      employeeEmail: att.employeeEmail,
      attemptNumber: att.attempt_number,
      status: att.status,
      statusDetail: att.status_detail,
      startedAt: att.started_at,
      submittedAt: att.submitted_at,
      durationSeconds: att.duration_seconds,
      interruptionCount: att.interruption_count,
      pausedDisconnectSeconds: att.paused_disconnect_seconds,
      totalPossibleMarks: att.total_possible_marks,
      autoScore: att.auto_score,
      finalScore: att.final_score,
      percentage: att.percentage,
      passingPercentage: att.passingPercentage,
      passed: att.passed === null ? null : Boolean(att.passed),
      requiresManualReview: Boolean(att.requires_manual_review),
      reviewStatus: att.review_status,
      isReleased: Boolean(att.is_released),
      releasedByIdentity: att.released_by_identity,
      releasedAt: att.released_at,
      reviewerOverallComment: att.reviewer_overall_comment || '',
    },
    questions,
    events,
    priorAttempts,
  });
});

function handleReviewAttempt(req, res) {
  const attemptId = parseInt(req.params.id, 10);
  const beforeAttempt = db
    .prepare('SELECT * FROM assessment_attempts WHERE id = ?')
    .get(attemptId);

  if (!beforeAttempt) return res.status(404).json({ error: 'Attempt not found.' });
  if (beforeAttempt.status === 'in_progress') {
    return res.status(400).json({ error: 'Cannot review an attempt while still in progress.' });
  }

  const grades = Array.isArray(req.body?.questionReviews)
    ? req.body.questionReviews
    : Array.isArray(req.body?.grades)
    ? req.body.grades
    : [];
  const rawComment = req.body?.overallComment ?? req.body?.reviewerOverallComment;
  const overallComment =
    rawComment !== undefined
      ? String(rawComment || '').trim()
      : beforeAttempt.reviewer_overall_comment;

  const qRows = db
    .prepare('SELECT id, marks FROM attempt_questions WHERE attempt_id = ?')
    .all(attemptId);
  const maxMarksMap = new Map(qRows.map((q) => [q.id, Number(q.marks)]));

  const upsert = db.prepare(
    `INSERT INTO attempt_answers
      (attempt_id, attempt_question_id, awarded_marks, is_correct, reviewer_comment, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(attempt_id, attempt_question_id) DO UPDATE SET
       awarded_marks = excluded.awarded_marks,
       is_correct = excluded.is_correct,
       reviewer_comment = excluded.reviewer_comment,
       updated_at = datetime('now')`
  );

  const tx = db.transaction(() => {
    for (const g of grades) {
      const aqid = Number(g.attemptQuestionId);
      if (!maxMarksMap.has(aqid)) continue;
      const maxM = maxMarksMap.get(aqid);
      const awarded = Math.min(maxM, Math.max(0, Number(g.awardedMarks ?? 0)));
      const isCorrect = awarded >= maxM ? 1 : 0;
      const comment = g.reviewerComment ? String(g.reviewerComment).trim() : null;
      upsert.run(attemptId, aqid, awarded, isCorrect, comment);
    }

    db.prepare('UPDATE assessment_attempts SET reviewer_overall_comment = ? WHERE id = ?').run(
      overallComment || null,
      attemptId
    );
  });
  tx();

  const updated = recalculateAttemptScoreAfterReview(attemptId);

  // If already released and score changed, re-evaluate project readiness
  if (updated.is_released) {
    evaluateProjectReadinessForEmployee(
      updated.user_id,
      updated.assessment_id,
      adminIdentity(req.user)
    );
  }

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentity(req.user),
    action: 'ATTEMPT_REVIEWED_OR_ADJUSTED',
    entityType: 'assessment_attempt',
    entityId: attemptId,
    summary: `Reviewed/adjusted marks on Attempt #${attemptId} (final score: ${updated.final_score ?? 'pending'} / ${updated.total_possible_marks}).`,
    before: { finalScore: beforeAttempt.final_score, percentage: beforeAttempt.percentage },
    after: { finalScore: updated.final_score, percentage: updated.percentage, reviewStatus: updated.review_status },
  });

  return res.json({
    success: true,
    attempt: updated,
    recalculated: {
      finalScore: updated.final_score,
      totalPossibleMarks: updated.total_possible_marks,
      percentage: updated.percentage,
      passed: Boolean(updated.passed),
    },
  });
}

router.patch('/attempts/:id/review', handleReviewAttempt);
router.post('/attempts/:id/review', handleReviewAttempt);

router.post('/attempts/:id/release', (req, res) => {
  const attemptId = parseInt(req.params.id, 10);
  const recalculated = recalculateAttemptScoreAfterReview(attemptId);
  if (!recalculated) return res.status(404).json({ error: 'Attempt not found.' });

  if (recalculated.status === 'in_progress') {
    return res.status(400).json({ error: 'Cannot release an active in-progress attempt.' });
  }
  if (recalculated.review_status === 'pending' || recalculated.final_score === null) {
    return res.status(400).json({
      error:
        'Manual review is incomplete. Please enter marks for all questions requiring manual review before releasing this result.',
    });
  }

  const identity = adminIdentity(req.user);

  db.prepare(
    `UPDATE assessment_attempts
     SET is_released = 1,
         released_by = ?,
         released_by_identity = ?,
         released_at = datetime('now'),
         status_detail = CASE WHEN status = 'expired' THEN 'Not Attempted — Time Expired' ELSE 'Result Released' END
     WHERE id = ?`
  ).run(req.user.id, identity, attemptId);

  const assessment = db
    .prepare('SELECT title FROM assessments WHERE id = ?')
    .get(recalculated.assessment_id);

  recordAudit({
    adminId: req.user.id,
    adminIdentity: identity,
    action: 'RESULT_RELEASED',
    entityType: 'assessment_attempt',
    entityId: attemptId,
    summary: `Released result for Attempt #${attemptId} ("${assessment?.title}") — Score: ${recalculated.final_score}/${recalculated.total_possible_marks} (${recalculated.percentage}%).`,
    after: {
      finalScore: recalculated.final_score,
      percentage: recalculated.percentage,
      passed: Boolean(recalculated.passed),
      releasedBy: identity,
    },
  });

  createNotification({
    userId: recalculated.user_id,
    type: 'RESULT_RELEASED',
    title: `Assessment Result Released: ${assessment?.title || 'Assessment'}`,
    message: `Your result for "${assessment?.title}" (Attempt #${recalculated.attempt_number}) has been reviewed and released.`,
    linkPath: '/portal/results',
  });

  evaluateProjectReadinessForEmployee(
    recalculated.user_id,
    recalculated.assessment_id,
    identity
  );

  return res.json({ success: true });
});

router.post('/retakes', (req, res) => {
  const userId = parseInt(req.body?.userId, 10);
  const assessmentId = parseInt(req.body?.assessmentId, 10);
  const conditionsNote = String(req.body?.conditionsNote || '').trim();

  const user = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'employee'").get(userId);
  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(assessmentId);
  if (!user || !assessment) {
    return res.status(404).json({ error: 'Employee or assessment not found.' });
  }

  const identity = adminIdentity(req.user);
  const ins = db
    .prepare(
      `INSERT INTO retake_authorizations
        (assessment_id, user_id, authorized_by, authorized_by_identity, conditions_note, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(assessmentId, userId, req.user.id, identity, conditionsNote || null);

  recordAudit({
    adminId: req.user.id,
    adminIdentity: identity,
    action: 'RETAKE_AUTHORIZED',
    entityType: 'retake_authorization',
    entityId: ins.lastInsertRowid,
    summary: `Authorized retake for ${user.employee_code} (${user.full_name}) on "${assessment.title}" (prior attempts preserved).`,
    after: { userId, assessmentId, conditionsNote: conditionsNote || null },
  });

  createNotification({
    userId,
    type: 'RETAKE_AUTHORIZED',
    title: `Retake Approved: ${assessment.title}`,
    message: conditionsNote
      ? `An administrator approved a retake for "${assessment.title}". Note: ${conditionsNote}`
      : `An administrator approved a retake for "${assessment.title}".`,
    linkPath: '/portal/assessments',
  });

  return res.status(201).json({ success: true, retakeAuthorizationId: ins.lastInsertRowid });
});

/* ============================================================================
 * PHASE 6: PROJECT READINESS MANAGEMENT (Section 7.11)
 * ========================================================================== */

router.get('/projects', (_req, res) => {
  const projects = db
    .prepare('SELECT * FROM projects ORDER BY created_at DESC')
    .all()
    .map((p) => {
      const reqs = db
        .prepare(
          `SELECT pa.assessment_id AS assessmentId, pa.minimum_percentage AS minimumPercentage,
                  a.title, a.passing_percentage AS defaultPassingPercentage
           FROM project_assessments pa
           JOIN assessments a ON a.id = pa.assessment_id
           WHERE pa.project_id = ?`
        )
        .all(p.id);

      const approvedCount = db
        .prepare(
          "SELECT COUNT(*) AS count FROM employee_project_readiness WHERE project_id = ? AND readiness_status = 'approved'"
        )
        .get(p.id)?.count || 0;

      return {
        id: p.id,
        code: p.code,
        name: p.name,
        domainCategory: p.domain_category,
        description: p.description,
        approvalMode: p.approval_mode,
        status: p.status,
        requiredAssessments: reqs,
        approvedEmployeesCount: approvedCount,
      };
    });

  return res.json({ projects });
});

router.post('/projects', (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const name = String(req.body?.name || '').trim();
  const domainCategory = String(req.body?.domainCategory || '').trim();
  const description = String(req.body?.description || '').trim();
  const approvalMode = req.body?.approvalMode === 'automatic' ? 'automatic' : 'manual';
  const requiredAssessments = Array.isArray(req.body?.requiredAssessments)
    ? req.body.requiredAssessments
    : [];

  if (!code || !name) {
    return res.status(400).json({ error: 'Project code and project name are required.' });
  }
  const dup = db.prepare('SELECT id FROM projects WHERE UPPER(code) = ?').get(code);
  if (dup) {
    return res.status(409).json({ error: `Project code "${code}" already exists.` });
  }

  let projectId = null;
  const tx = db.transaction(() => {
    const ins = db
      .prepare(
        `INSERT INTO projects (code, name, domain_category, description, approval_mode, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))`
      )
      .run(code, name, domainCategory || null, description || null, approvalMode, req.user.id);
    projectId = ins.lastInsertRowid;

    const reqIns = db.prepare(
      'INSERT OR IGNORE INTO project_assessments (project_id, assessment_id, minimum_percentage) VALUES (?, ?, ?)'
    );
    for (const ra of requiredAssessments) {
      const aid = parseInt(ra.assessmentId, 10);
      if (Number.isNaN(aid)) continue;
      const minPct =
        ra.minimumPercentage !== undefined && ra.minimumPercentage !== null && ra.minimumPercentage !== ''
          ? Number(ra.minimumPercentage)
          : null;
      reqIns.run(projectId, aid, minPct);
    }
  });
  tx();

  // Evaluate existing active employees against the new project configuration
  const activeEmps = db
    .prepare("SELECT id FROM users WHERE role = 'employee' AND status = 'active'")
    .all();
  for (const emp of activeEmps) {
    recomputeSingleProjectReadiness(projectId, emp.id, adminIdentity(req.user));
  }

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentity(req.user),
    action: 'PROJECT_CREATED',
    entityType: 'project',
    entityId: projectId,
    summary: `Created project ${code} ("${name}", approval mode: ${approvalMode}).`,
  });

  return res.status(201).json({ success: true, id: projectId, projectId });
});

router.put('/projects/:id', (req, res) => {
  const pid = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid);
  if (!existing) return res.status(404).json({ error: 'Project not found.' });

  const name = String(req.body?.name ?? existing.name).trim();
  const domainCategory = String(req.body?.domainCategory ?? existing.domain_category ?? '').trim();
  const description = String(req.body?.description ?? existing.description ?? '').trim();
  const approvalMode =
    req.body?.approvalMode !== undefined
      ? req.body.approvalMode === 'automatic'
        ? 'automatic'
        : 'manual'
      : existing.approval_mode;
  const status =
    req.body?.status !== undefined
      ? req.body.status === 'archived'
        ? 'archived'
        : 'active'
      : existing.status;
  const requiredAssessments = Array.isArray(req.body?.requiredAssessments)
    ? req.body.requiredAssessments
    : null;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE projects
       SET name = ?, domain_category = ?, description = ?, approval_mode = ?, status = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(name, domainCategory || null, description || null, approvalMode, status, pid);

    if (requiredAssessments !== null) {
      db.prepare('DELETE FROM project_assessments WHERE project_id = ?').run(pid);
      const reqIns = db.prepare(
        'INSERT OR IGNORE INTO project_assessments (project_id, assessment_id, minimum_percentage) VALUES (?, ?, ?)'
      );
      for (const ra of requiredAssessments) {
        const aid = parseInt(ra.assessmentId, 10);
        if (Number.isNaN(aid)) continue;
        const minPct =
          ra.minimumPercentage !== undefined && ra.minimumPercentage !== null && ra.minimumPercentage !== ''
            ? Number(ra.minimumPercentage)
            : null;
        reqIns.run(pid, aid, minPct);
      }
    }
  });
  tx();

  const activeEmps = db
    .prepare("SELECT id FROM users WHERE role = 'employee' AND status = 'active'")
    .all();
  for (const emp of activeEmps) {
    recomputeSingleProjectReadiness(pid, emp.id, adminIdentity(req.user));
  }

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentity(req.user),
    action: 'PROJECT_UPDATED',
    entityType: 'project',
    entityId: pid,
    summary: `Updated project ${existing.code} ("${name}", mode: ${approvalMode}, status: ${status}).`,
  });

  return res.json({ success: true });
});

router.get('/readiness', (_req, res) => {
  const projects = db
    .prepare(
      "SELECT id, code, name, domain_category AS domainCategory, description, approval_mode AS approvalMode, status FROM projects WHERE status = 'active' ORDER BY name ASC"
    )
    .all()
    .map((p) => ({
      ...p,
      requiredAssessments: db
        .prepare(
          `SELECT pa.assessment_id AS assessmentId, pa.minimum_percentage AS minimumPercentage,
                  a.title, a.passing_percentage AS passingPercentage
           FROM project_assessments pa
           JOIN assessments a ON a.id = pa.assessment_id
           WHERE pa.project_id = ?`
        )
        .all(p.id),
    }));
  const employees = db
    .prepare(
      "SELECT id, employee_code AS employeeCode, full_name AS fullName, email FROM users WHERE role = 'employee' AND status = 'active' ORDER BY full_name ASC"
    )
    .all();

  const records = db
    .prepare(
      `SELECT project_id AS projectId, user_id AS userId, readiness_status AS readinessStatus,
              decision_source AS decisionSource, notes, updated_by_identity AS updatedByIdentity,
              updated_at AS updatedAt
       FROM employee_project_readiness`
    )
    .all();

  const history = db
    .prepare(
      `SELECT
         h.id,
         p.code AS projectCode,
         p.name AS projectName,
         u.employee_code AS employeeCode,
         u.full_name AS employeeName,
         u.full_name AS fullName,
         h.previous_status AS previousStatus,
         h.new_status AS newStatus,
         h.decision_source AS decisionSource,
         h.actor_identity AS actorIdentity,
         h.actor_identity AS decidedByIdentity,
         h.reason,
         h.created_at AS createdAt
       FROM project_readiness_history h
       JOIN projects p ON p.id = h.project_id
       JOIN users u ON u.id = h.user_id
       ORDER BY h.created_at DESC
       LIMIT 80`
    )
    .all();

  return res.json({ projects, employees, records, matrix: records, history });
});

router.post('/readiness/decision', (req, res) => {
  const projectId = parseInt(req.body?.projectId, 10);
  const userId = parseInt(req.body?.userId, 10);
  const nextStatus = String(req.body?.status || req.body?.readinessStatus || '').trim();
  const reason = String(req.body?.reason || '').trim();

  const allowed = ['not_ready', 'in_preparation', 'pending_approval', 'approved', 'revoked'];
  if (!allowed.includes(nextStatus)) {
    return res.status(400).json({ error: 'Invalid readiness status.' });
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  const user = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'employee'").get(userId);
  if (!project || !user) {
    return res.status(404).json({ error: 'Project or employee not found.' });
  }

  const existing = db
    .prepare('SELECT * FROM employee_project_readiness WHERE project_id = ? AND user_id = ?')
    .get(projectId, userId);

  const identity = adminIdentity(req.user);

  db.prepare(
    `INSERT INTO employee_project_readiness
      (project_id, user_id, readiness_status, decision_source, notes, updated_by_identity, updated_at)
     VALUES (?, ?, ?, 'manual', ?, ?, datetime('now'))
     ON CONFLICT(project_id, user_id) DO UPDATE SET
       readiness_status = excluded.readiness_status,
       decision_source = 'manual',
       notes = excluded.notes,
       updated_by_identity = excluded.updated_by_identity,
       updated_at = datetime('now')`
  ).run(projectId, userId, nextStatus, reason || null, identity);

  db.prepare(
    `INSERT INTO project_readiness_history
      (project_id, user_id, previous_status, new_status, decision_source, actor_identity, reason, created_at)
     VALUES (?, ?, ?, ?, 'manual', ?, ?, datetime('now'))`
  ).run(
    projectId,
    userId,
    existing?.readiness_status || 'not_ready',
    nextStatus,
    identity,
    reason || 'Manual administrator readiness update'
  );

  recordAudit({
    adminId: req.user.id,
    adminIdentity: identity,
    action: 'READINESS_STATUS_CHANGED',
    entityType: 'project_readiness',
    entityId: `${projectId}:${userId}`,
    summary: `Set readiness for ${user.employee_code} on project ${project.code} to "${nextStatus}".`,
    before: { readinessStatus: existing?.readiness_status || 'not_ready' },
    after: { readinessStatus: nextStatus, reason: reason || null },
  });

  createNotification({
    userId,
    type: 'READINESS_UPDATE',
    title: `Project Readiness Updated: ${project.name}`,
    message: `Your readiness status for ${project.name} (${project.code}) is now "${nextStatus.replace('_', ' ')}".`,
    linkPath: '/portal/readiness',
  });

  return res.json({ success: true });
});

/* ============================================================================
 * PHASE 7: ANNOUNCEMENTS & EMPLOYEE FEEDBACK MANAGEMENT (Sections 7.13–7.14)
 * ========================================================================== */

router.get('/announcements', (_req, res) => {
  const announcements = db
    .prepare(
      `SELECT id, title, category, body, status, author_identity AS authorIdentity,
              published_at AS publishedAt, created_at AS createdAt, updated_at AS updatedAt
       FROM announcements
       ORDER BY created_at DESC`
    )
    .all();
  return res.json({ announcements });
});

router.post('/announcements', (req, res) => {
  const title = String(req.body?.title || '').trim();
  const category = String(req.body?.category || 'General Update').trim();
  const body = String(req.body?.body || '').trim();
  const status = ['draft', 'published', 'archived'].includes(req.body?.status)
    ? req.body.status
    : 'published';

  if (!title || title.length < 3 || !body || body.length < 5) {
    return res.status(400).json({ error: 'Announcement title and body are required.' });
  }

  const identity = adminIdentity(req.user);
  const ins = db
    .prepare(
      `INSERT INTO announcements
        (title, category, body, status, author_identity, created_by, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN datetime('now') ELSE NULL END, datetime('now'), datetime('now'))`
    )
    .run(title, category, body, status, identity, req.user.id, status);

  if (status === 'published') {
    notifyAllActiveEmployees({
      type: 'ANNOUNCEMENT',
      title: `Announcement: ${title}`,
      message: body.length > 140 ? `${body.slice(0, 140)}...` : body,
      linkPath: '/portal/announcements',
    });
  }

  recordAudit({
    adminId: req.user.id,
    adminIdentity: identity,
    action: 'ANNOUNCEMENT_CREATED',
    entityType: 'announcement',
    entityId: ins.lastInsertRowid,
    summary: `Created announcement "${title}" (${status}).`,
  });

  return res.status(201).json({ success: true, announcementId: ins.lastInsertRowid });
});

router.put('/announcements/:id', (req, res) => {
  const aid = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(aid);
  if (!existing) return res.status(404).json({ error: 'Announcement not found.' });

  const title = String(req.body?.title ?? existing.title).trim();
  const category = String(req.body?.category ?? existing.category).trim();
  const body = String(req.body?.body ?? existing.body).trim();
  const status = ['draft', 'published', 'archived'].includes(req.body?.status)
    ? req.body.status
    : existing.status;

  const newlyPublished = status === 'published' && existing.status !== 'published';

  db.prepare(
    `UPDATE announcements
     SET title = ?, category = ?, body = ?, status = ?,
         published_at = CASE WHEN ? = 1 THEN datetime('now') ELSE published_at END,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(title, category, body, status, newlyPublished ? 1 : 0, aid);

  if (newlyPublished) {
    notifyAllActiveEmployees({
      type: 'ANNOUNCEMENT',
      title: `Announcement: ${title}`,
      message: body.length > 140 ? `${body.slice(0, 140)}...` : body,
      linkPath: '/portal/announcements',
    });
  }

  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentity(req.user),
    action: 'ANNOUNCEMENT_UPDATED',
    entityType: 'announcement',
    entityId: aid,
    summary: `Updated announcement "${title}" (status: ${existing.status} -> ${status}).`,
  });

  return res.json({ success: true });
});

router.delete('/announcements/:id', (req, res) => {
  const aid = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(aid);
  if (!existing) return res.status(404).json({ error: 'Announcement not found.' });

  db.prepare('DELETE FROM announcements WHERE id = ?').run(aid);
  recordAudit({
    adminId: req.user.id,
    adminIdentity: adminIdentity(req.user),
    action: 'ANNOUNCEMENT_DELETED',
    entityType: 'announcement',
    entityId: aid,
    summary: `Deleted announcement "${existing.title}".`,
  });
  return res.json({ success: true });
});

router.get('/feedback', (req, res) => {
  const status = String(req.query.status || 'all');
  let sql = `
    SELECT id, user_id AS userId, employee_identity AS employeeIdentity,
           category, subject, message, status, admin_response AS adminResponse,
           updated_by_identity AS updatedByIdentity, created_at AS createdAt, updated_at AS updatedAt
    FROM employee_feedback
  `;
  const params = [];
  if (['New', 'Under Review', 'Addressed', 'Closed'].includes(status)) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  return res.json({ feedback: db.prepare(sql).all(...params) });
});

router.patch('/feedback/:id', (req, res) => {
  const fid = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM employee_feedback WHERE id = ?').get(fid);
  if (!existing) return res.status(404).json({ error: 'Feedback item not found.' });

  const allowed = ['New', 'Under Review', 'Addressed', 'Closed'];
  const status = allowed.includes(req.body?.status) ? req.body.status : existing.status;
  const adminResponse =
    req.body?.adminResponse !== undefined
      ? String(req.body.adminResponse || '').trim()
      : existing.admin_response;

  const identity = adminIdentity(req.user);

  db.prepare(
    `UPDATE employee_feedback
     SET status = ?, admin_response = ?, updated_by_identity = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(status, adminResponse || null, identity, fid);

  recordAudit({
    adminId: req.user.id,
    adminIdentity: identity,
    action: 'FEEDBACK_REVIEWED',
    entityType: 'employee_feedback',
    entityId: fid,
    summary: `Updated employee feedback #${fid} ("${existing.subject}") status to "${status}".`,
  });

  if (adminResponse && adminResponse !== existing.admin_response) {
    createNotification({
      userId: existing.user_id,
      type: 'FEEDBACK_RESPONSE',
      title: `Feedback Reviewed: ${existing.subject}`,
      message: `Management updated your feedback item ("${existing.subject}") to "${status}".`,
      linkPath: '/portal/feedback',
    });
  }

  return res.json({ success: true });
});

export default router;
