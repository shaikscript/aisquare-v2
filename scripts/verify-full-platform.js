import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DATA_DIR = '/tmp/aisquare-e2e-data';
const TEST_STORAGE_DIR = '/tmp/aisquare-e2e-storage';
const PORT = 4199;
const BASE = `http://127.0.0.1:${PORT}`;

// Clean isolated temp dirs (never touches /home/user/data/aisquare.db)
fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });

process.env.AISQUARE_DATA_DIR = TEST_DATA_DIR;
process.env.AISQUARE_STORAGE_DIR = TEST_STORAGE_DIR;
process.env.PORT = String(PORT);
process.env.NODE_ENV = 'production';

// Dynamically import database & app after env vars are set
const db = (await import('../server/db/database.js')).default;
const { attachSessionUser } = await import('../server/middleware/auth.js');
const express = (await import('express')).default;
const cookieParser = (await import('cookie-parser')).default;
const publicRouter = (await import('../server/routes/public.js')).default;
const authRouter = (await import('../server/routes/auth.js')).default;
const portalRouter = (await import('../server/routes/portal.js')).default;
const adminRouter = (await import('../server/routes/admin.js')).default;
const adminPlatformRouter = (await import('../server/routes/adminPlatform.js')).default;

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(attachSessionUser);
app.use('/api/public', publicRouter);
app.use('/api/auth', authRouter);
app.use('/api/portal', portalRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin', adminPlatformRouter);

const server = await new Promise((resolve) => {
  const s = app.listen(PORT, '127.0.0.1', () => resolve(s));
});

class CookieClient {
  constructor() {
    this.cookie = '';
  }
  async req(urlPath, { method = 'GET', body, formData } = {}) {
    const headers = {};
    if (this.cookie) headers.Cookie = this.cookie;
    let payloadBody;
    if (formData) {
      payloadBody = formData;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payloadBody = JSON.stringify(body);
    }
    const res = await fetch(`${BASE}${urlPath}`, {
      method,
      headers,
      body: payloadBody,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      this.cookie = setCookie.split(';')[0];
    }
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.arrayBuffer();
    return { status: res.status, headers: res.headers, data };
  }
}

const anon = new CookieClient();
const admin = new CookieClient();
const emp = new CookieClient();

try {
  console.log('=== PHASE 1–3: Bootstrap, Auth, RBAC, Public Careers & Enquiries ===');
  const setupStatus = await anon.req('/api/auth/setup-status');
  assert.equal(setupStatus.data.needsInitialAdmin, true);

  const bootstrapToken = fs.readFileSync(path.join(TEST_DATA_DIR, '.bootstrap_token'), 'utf8').trim();
  const bootRes = await admin.req('/api/auth/bootstrap-admin', {
    method: 'POST',
    body: {
      bootstrapToken,
      fullName: 'Test Primary Admin',
      email: 'admin@e2e.test',
      username: 'e2eadmin',
      password: 'StrongAdminPass!2026',
    },
  });
  assert.equal(bootRes.status, 201);
  assert.equal(bootRes.data.user.role, 'admin');

  // Verify Authorized Admin can add additional Admins + self-lockout protection
  const selfDeact = await admin.req(`/api/admin/admins/${bootRes.data.user.id}/status`, {
    method: 'POST',
    body: { status: 'deactivated' },
  });
  assert.equal(selfDeact.status, 400); // Cannot lock out own admin account

  const addAdmin2 = await admin.req('/api/admin/admins', {
    method: 'POST',
    body: {
      fullName: 'Secondary Operations Admin',
      email: 'ops.admin@e2e.test',
      username: 'ops.admin',
      password: 'OpsAdminPass!2026',
      departmentNote: 'QA Operations Lead',
    },
  });
  assert.equal(addAdmin2.status, 201);
  assert.equal(addAdmin2.data.admin.employeeCode, 'ADM-0002');
  const adminList = await admin.req('/api/admin/admins');
  assert.equal(adminList.data.admins.length, 2);

  // Create published vacancy & draft vacancy
  const jobPub = await admin.req('/api/admin/jobs', {
    method: 'POST',
    body: {
      title: 'AI Search Evaluator',
      locationNote: 'Remote',
      employmentType: 'Full-Time',
      description: 'Apply structured search relevance rubrics and provide clear justification.',
      status: 'published',
    },
  });
  assert.equal(jobPub.status, 201);

  await admin.req('/api/admin/jobs', {
    method: 'POST',
    body: {
      title: 'Internal Draft Role',
      locationNote: 'Remote',
      employmentType: 'Contract',
      description: 'Draft role description not visible to public candidates.',
      status: 'draft',
    },
  });

  const pubJobs = await anon.req('/api/public/jobs');
  assert.equal(pubJobs.data.jobs.length, 1);

  // Submit application with valid PDF
  const appFd = new FormData();
  appFd.append('jobSelection', String(jobPub.data.jobId));
  appFd.append('fullName', 'Priya Sharma');
  appFd.append('email', 'priya@example.com');
  appFd.append('phone', '+91 9876543210');
  appFd.append('educationExperience', 'B.Tech CS with 2 years of LLM and search quality evaluation.');
  appFd.append('coverLetter', 'Experienced AI rater.');
  appFd.append('resume', new Blob(['%PDF-1.4 sample resume content'], { type: 'application/pdf' }), 'priya-cv.pdf');
  const appRes = await anon.req('/api/public/applications', { method: 'POST', formData: appFd });
  assert.equal(appRes.status, 201);

  // Anonymous cannot download private resume
  const unauthResume = await anon.req('/api/admin/applications/1/resume');
  assert.equal(unauthResume.status, 401);

  // Contact enquiry
  const contactRes = await anon.req('/api/public/contact', {
    method: 'POST',
    body: { name: 'Client Lead', email: 'lead@client.org', subject: 'QA Enquiry', message: 'Hello AI Square evaluation team.' },
  });
  assert.equal(contactRes.status, 201);

  // Create Employee account via Admin
  const empCreate = await admin.req('/api/admin/employees', {
    method: 'POST',
    body: {
      fullName: 'Rohan Verma',
      email: 'rohan@aisquare.test',
      username: 'rohan.verma',
      password: 'TempPass!2026',
      departmentNote: 'LLM Evaluation',
    },
  });
  assert.equal(empCreate.status, 201);
  const empUserId = empCreate.data.employee.id;

  // Cross-portal login rejection: Employee cannot use /admin/login
  const badAdminLogin = await emp.req('/api/auth/admin/login', {
    method: 'POST',
    body: { identifier: 'rohan.verma', password: 'TempPass!2026' },
  });
  assert.equal(badAdminLogin.status, 403);

  // Valid Employee login
  const okEmpLogin = await emp.req('/api/auth/employee/login', {
    method: 'POST',
    body: { identifier: 'rohan.verma', password: 'TempPass!2026' },
  });
  assert.equal(okEmpLogin.status, 200);

  // Employee cannot access /api/admin/*
  const rbacCheck = await emp.req('/api/admin/overview');
  assert.equal(rbacCheck.status, 403);

  console.log('=== PHASE 4: Central Guideline Library, Versioning, PDF & Study Logs ===');
  const g1Fd = new FormData();
  g1Fd.append('title', 'Search Relevance Core Rubric');
  g1Fd.append('clientProjectTask', 'PRJ-AUTO Search Ranking');
  g1Fd.append('guidelineType', 'online');
  g1Fd.append('summary', 'Core rating scale definitions');
  g1Fd.append('contentBody', 'Version 1: Rate Fully Meets when intent is 100% satisfied.');
  g1Fd.append('status', 'published');
  const g1Create = await admin.req('/api/admin/guidelines', { method: 'POST', formData: g1Fd });
  assert.equal(g1Create.status, 201);
  const g1Id = g1Create.data.id;

  // Update guideline to v2 and verify v1 is preserved
  const g1Upd = new FormData();
  g1Upd.append('title', 'Search Relevance Core Rubric');
  g1Upd.append('clientProjectTask', 'PRJ-AUTO Search Ranking');
  g1Upd.append('guidelineType', 'online');
  g1Upd.append('contentBody', 'Version 2: Updated freshness clause added.');
  g1Upd.append('changeNote', 'Added freshness rule');
  const g1UpdRes = await admin.req(`/api/admin/guidelines/${g1Id}`, { method: 'PUT', formData: g1Upd });
  assert.equal(g1UpdRes.data.currentVersion, 2);

  const g1AdminInspect = await admin.req(`/api/admin/guidelines/${g1Id}`);
  assert.equal(g1AdminInspect.data.versions.length, 2);

  // Upload PDF guideline
  const g2Fd = new FormData();
  g2Fd.append('title', 'Safety Escalation Handbook');
  g2Fd.append('clientProjectTask', 'PRJ-MAN Safety QA');
  g2Fd.append('guidelineType', 'pdf');
  g2Fd.append('status', 'published');
  g2Fd.append('pdf', new Blob(['%PDF-1.4 safety handbook'], { type: 'application/pdf' }), 'safety.pdf');
  const g2Create = await admin.req('/api/admin/guidelines', { method: 'POST', formData: g2Fd });
  assert.equal(g2Create.status, 201);

  // Employee searches by name & by project/task
  const searchByName = await emp.req('/api/portal/guidelines?q=Safety');
  assert.equal(searchByName.data.guidelines.length, 1);
  const searchByProj = await emp.req('/api/portal/guidelines?project=PRJ-AUTO');
  assert.equal(searchByProj.data.guidelines.length, 1);

  // Employee opens guideline + pings study duration + streams PDF
  const empOpenG1 = await emp.req(`/api/portal/guidelines/${g1Id}`);
  assert.equal(empOpenG1.status, 200);
  await emp.req(`/api/portal/guidelines/access/${empOpenG1.data.accessLogId}/ping`, {
    method: 'POST',
    body: { seconds: 15 },
  });
  const pdfStream = await emp.req(`/api/portal/guidelines/${g2Create.data.id}/pdf`);
  assert.equal(pdfStream.status, 200);

  console.log('=== PHASE 5 & 6: Question Bank, Bulk Import, Assessments, Lock, Scoring, Release & Readiness ===');
  // Reject malformed CSV import cleanly
  const badCsv = await admin.req('/api/admin/question-bank/bulk-import', {
    method: 'POST',
    body: {
      format: 'csv',
      payload: `project_tag,question_type,prompt,options,correct_answer,marks\nPRJ-AUTO,invalid_type,"Bad question","A|B","A",2`,
    },
  });
  assert.equal(badCsv.status, 400);
  assert.ok(badCsv.data.rowErrors.length > 0);

  // Valid CSV bulk import across all 4 question types
  const validCsvPayload = [
    'project_tag,question_type,prompt,scenario_context,options,correct_answer,marks,scoring_rubric,explanation',
    'PRJ-AUTO,mcq,"Which label applies to verified accurate answers?","","Fully Meets|Fails to Meet","Fully Meets",2,"","Verified answers fully meet intent."',
    'PRJ-AUTO,true_false,"Should fabricated citations be downgraded?","","True|False","True",2,"","Hallucinations must be downgraded."',
    'PRJ-AUTO,short_answer,"Type the word PASS to confirm short answer auto-match.","","","PASS",1,"","Case-insensitive exact match."',
    'PRJ-AUTO,practical_scenario,"Rate and justify the assistant output.","User asks capital of India; assistant says New Delhi with accurate context.","Fully Meets|Partially Meets|Fails to Meet","",5,"3 marks rating + 2 marks reasoning","Accurate response."',
  ].join('\n');

  const okCsv = await admin.req('/api/admin/question-bank/bulk-import', {
    method: 'POST',
    body: { format: 'csv', payload: validCsvPayload },
  });
  assert.equal(okCsv.status, 201);
  assert.equal(okCsv.data.importedCount, 4);

  const bankList = await admin.req('/api/admin/question-bank');
  const qIds = bankList.data.questions.map((q) => q.id).reverse();

  // Create two distinct projects: PRJ-AUTO (automatic readiness) and PRJ-MAN (manual readiness)
  const projAuto = await admin.req('/api/admin/projects', {
    method: 'POST',
    body: {
      code: 'PRJ-AUTO',
      name: 'Search Ranking Project',
      domainCategory: 'search quality evaluation',
      approvalMode: 'automatic',
    },
  });
  assert.equal(projAuto.status, 201);

  const projMan = await admin.req('/api/admin/projects', {
    method: 'POST',
    body: {
      code: 'PRJ-MAN',
      name: 'Safety Escalation Project',
      domainCategory: 'AI quality assurance',
      approvalMode: 'manual',
    },
  });
  assert.equal(projMan.status, 201);

  // Create & publish Assessment linked to PRJ-AUTO
  const assCreate = await admin.req('/api/admin/assessments', {
    method: 'POST',
    body: {
      title: 'Search Ranking Qualification Exam',
      projectId: projAuto.data.id,
      instructions: 'Answer all 4 questions carefully.',
      isTimed: true,
      timeLimitMinutes: 20,
      pauseOnDisconnect: true,
      passingPercentage: 80,
      selectionMode: 'fixed',
      status: 'published',
      questions: qIds.map((id) => ({ questionId: id })),
    },
  });
  assert.equal(assCreate.status, 201);
  const assId = assCreate.data.id;

  // Link assId as required assessment for PRJ-AUTO
  await admin.req(`/api/admin/projects/${projAuto.data.id}`, {
    method: 'PUT',
    body: {
      requiredAssessments: [{ assessmentId: assId, minimumPercentage: 80 }],
    },
  });

  // Duplicate assessment test
  const dupRes = await admin.req(`/api/admin/assessments/${assId}/duplicate`, { method: 'POST' });
  assert.equal(dupRes.status, 201);

  // Employee starts assessment
  const startRes = await emp.req(`/api/portal/assessments/${assId}/start`, { method: 'POST' });
  assert.equal(startRes.status, 201);
  const attemptId = startRes.data.attemptId;

  // Verify Active Assessment Lock blocks Guideline Library!
  const lockedGuidelines = await emp.req('/api/portal/guidelines');
  assert.equal(lockedGuidelines.status, 409);
  assert.equal(lockedGuidelines.data.code, 'ACTIVE_ASSESSMENT_LOCK');

  // Verify starting again resumes same attempt without creating duplicate
  const resumeRes = await emp.req(`/api/portal/assessments/${assId}/start`, { method: 'POST' });
  assert.equal(resumeRes.status, 200);
  assert.equal(resumeRes.data.attemptId, attemptId);
  assert.equal(resumeRes.data.resumed, true);

  // Fetch sanitized attempt runner questions (ensure correct_answer is NOT leaked)
  const runnerData = await emp.req(`/api/portal/attempts/${attemptId}`);
  assert.equal(runnerData.data.questions.length, 4);
  assert.equal(runnerData.data.questions[0].correctAnswer, undefined);

  // Simulate temporary disconnection & reconnection
  const intRes = await emp.req(`/api/portal/attempts/${attemptId}/interruption`, {
    method: 'POST',
    body: { eventType: 'RECONNECTED', offlineSeconds: 25 },
  });
  assert.equal(intRes.status, 200);

  // Auto-save answers then submit (intentionally answer 1 wrong to verify incorrect-answer review later, while still >= 80%)
  // Total marks = 2 + 2 + 1 + 5 = 10. Let's get MCQ (2/2), TF (2/2), Short Answer wrong (0/1), Scenario (5/5) => 9/10 = 90% PASS!
  const aq = runnerData.data.questions;
  const answerPayload = [
    { attemptQuestionId: aq.find((q) => q.questionType === 'mcq').id, answerValue: 'Fully Meets' },
    { attemptQuestionId: aq.find((q) => q.questionType === 'true_false').id, answerValue: 'True' },
    { attemptQuestionId: aq.find((q) => q.questionType === 'short_answer').id, answerValue: 'WRONG_WORD' },
    {
      attemptQuestionId: aq.find((q) => q.questionType === 'practical_scenario').id,
      answerValue: 'Fully Meets',
      reasoningText: 'New Delhi is factually verified and directly answers the user prompt.',
    },
  ];
  await emp.req(`/api/portal/attempts/${attemptId}/answers`, {
    method: 'PUT',
    body: { answers: answerPayload },
  });

  // Edit Question Bank item BEFORE submission/review to verify attempt snapshot isolation
  await admin.req(`/api/admin/question-bank/${qIds[0]}`, {
    method: 'PUT',
    body: { prompt: 'EDITED BANK PROMPT V2 — must not alter active/completed attempt!' },
  });

  const submitRes = await emp.req(`/api/portal/attempts/${attemptId}/submit`, {
    method: 'POST',
    body: { answers: answerPayload },
  });
  assert.equal(submitRes.status, 200);
  assert.equal(submitRes.data.finalScore, undefined); // No score leak!

  // Guideline lock lifted immediately after submission
  const unlockedGuidelines = await emp.req('/api/portal/guidelines');
  assert.equal(unlockedGuidelines.status, 200);

  // Employee cannot see score before release
  const preReleaseResults = await emp.req('/api/portal/results');
  assert.equal(preReleaseResults.data.results[0].isReleased, false);
  assert.equal(preReleaseResults.data.results[0].finalScore, undefined);

  // Unauthorized retake blocked
  const blockedRetake = await emp.req(`/api/portal/assessments/${assId}/start`, { method: 'POST' });
  assert.equal(blockedRetake.status, 403);
  assert.equal(blockedRetake.data.code, 'RETAKE_NOT_AUTHORIZED');

  // Premature release before manual grading blocked
  const prematureRelease = await admin.req(`/api/admin/attempts/${attemptId}/release`, { method: 'POST' });
  assert.equal(prematureRelease.status, 400);

  // Admin inspects attempt, verifies snapshot prompt wasn't mutated by bank edit, and grades practical scenario
  const adminAttDetail = await admin.req(`/api/admin/attempts/${attemptId}`);
  assert.ok(!adminAttDetail.data.questions[0].prompt.includes('EDITED BANK PROMPT V2'));

  const scenarioAq = adminAttDetail.data.questions.find((q) => q.questionType === 'practical_scenario');
  const reviewRes = await admin.req(`/api/admin/attempts/${attemptId}/review`, {
    method: 'POST',
    body: {
      questionReviews: [
        { attemptQuestionId: scenarioAq.id, awardedMarks: 5, reviewerComment: 'Strong rubric reasoning.' },
      ],
      overallComment: 'Well prepared on search ranking guidelines.',
    },
  });
  assert.equal(reviewRes.status, 200);
  assert.equal(reviewRes.data.recalculated.percentage, 90);
  assert.equal(reviewRes.data.recalculated.passed, true);

  // Admin releases result -> triggers automatic readiness on PRJ-AUTO ONLY!
  const releaseRes = await admin.req(`/api/admin/attempts/${attemptId}/release`, { method: 'POST' });
  assert.equal(releaseRes.status, 200);

  // Employee now sees released score, incorrect answer + correct answer + explanation!
  const postReleaseResults = await emp.req('/api/portal/results');
  const rel = postReleaseResults.data.results[0];
  assert.equal(rel.isReleased, true);
  assert.equal(rel.percentage, 90);
  assert.equal(rel.passed, true);
  const wrongSa = rel.questions.find((q) => q.questionType === 'short_answer');
  assert.equal(wrongSa.isCorrect, false);
  assert.equal(wrongSa.correctAnswer, 'PASS');

  // Verify Project-Specific Readiness Isolation: PRJ-AUTO is 'approved', PRJ-MAN is still 'not_ready'!
  const empReadiness = await emp.req('/api/portal/readiness');
  const rAuto = empReadiness.data.projects.find((p) => p.projectCode === 'PRJ-AUTO');
  const rMan = empReadiness.data.projects.find((p) => p.projectCode === 'PRJ-MAN');
  assert.equal(rAuto.readinessStatus, 'approved');
  assert.equal(rMan.readinessStatus, 'not_ready');

  // Admin manually approves PRJ-MAN
  const manApprove = await admin.req('/api/admin/readiness/decision', {
    method: 'POST',
    body: {
      userId: empUserId,
      projectId: projMan.data.id,
      status: 'approved',
      reason: 'Passed live safety calibration workshop.',
    },
  });
  assert.equal(manApprove.status, 200);

  // Authorize Retake & verify prior attempt is preserved
  await admin.req('/api/admin/retakes', {
    method: 'POST',
    body: { userId: empUserId, assessmentId: assId, conditionsNote: 'Optional practice retake' },
  });
  const retakeStart = await emp.req(`/api/portal/assessments/${assId}/start`, { method: 'POST' });
  assert.equal(retakeStart.status, 201);
  assert.equal(retakeStart.data.attemptNumber, 2);

  // Test Timer Expiration ("Not Attempted — Time Expired") by backdating started_at beyond 20m limit
  db.prepare(`UPDATE assessment_attempts SET started_at = datetime('now', '-30 minutes') WHERE id = ?`)
    .run(retakeStart.data.attemptId);

  const expiredCheck = await emp.req(`/api/portal/attempts/${retakeStart.data.attemptId}`);
  assert.equal(expiredCheck.data.attempt.status, 'expired');
  assert.equal(expiredCheck.data.attempt.statusDetail, 'Not Attempted — Time Expired');

  // Verify BOTH Attempt #1 and Attempt #2 exist in history
  const twoAttempts = await emp.req('/api/portal/results');
  assert.equal(twoAttempts.data.results.length, 2);

  console.log('=== PHASE 7: Announcements, Notifications, Identified Feedback & Overview ===');
  const annCreate = await admin.req('/api/admin/announcements', {
    method: 'POST',
    body: {
      title: 'Q4 Search Calibration Update',
      category: 'Guideline Notice',
      body: 'Please review Search Relevance Core Rubric v2 before Friday.',
      status: 'published',
    },
  });
  assert.equal(annCreate.status, 201);

  const empNotifs = await emp.req('/api/portal/notifications');
  assert.ok(empNotifs.data.notifications.length >= 3); // release + readiness + announcement

  // Submit identified employee feedback & verify scores/readiness unaffected
  const fbSubmit = await emp.req('/api/portal/feedback', {
    method: 'POST',
    body: {
      category: 'Guideline Problem',
      subject: 'Example 4 formatting',
      message: 'Table 2 in v2 could use an extra example.',
    },
  });
  assert.equal(fbSubmit.status, 201);

  const adminFbList = await admin.req('/api/admin/feedback');
  assert.equal(adminFbList.data.feedback.length, 1);
  assert.ok(adminFbList.data.feedback[0].employeeIdentity.includes('Rohan Verma'));

  await admin.req(`/api/admin/feedback/${adminFbList.data.feedback[0].id}`, {
    method: 'PATCH',
    body: { status: 'Addressed', adminResponse: 'Thank you, added to v3 queue.' },
  });

  // Verify Deactivation immediately invalidates employee session
  await admin.req(`/api/admin/employees/${empUserId}/status`, {
    method: 'POST',
    body: { status: 'deactivated' },
  });
  const deactCheck = await emp.req('/api/portal/overview');
  assert.ok([401, 403].includes(deactCheck.status));
  const deactLoginAttempt = await emp.req('/api/auth/employee/login', {
    method: 'POST',
    body: { identifier: 'rohan.verma', password: 'TempPass!2026' },
  });
  assert.equal(deactLoginAttempt.status, 403);

  // Verify Admin Overview & Activity return live metrics
  const ov = await admin.req('/api/admin/overview');
  assert.equal(ov.status, 200);
  assert.equal(ov.data.guidelines.published, 2);
  assert.equal(ov.data.assessments.reusableQuestions, 4);
  assert.equal(ov.data.assessments.expiredAttempts, 1);
  assert.equal(ov.data.assessments.interruptedAttempts, 1);
  assert.equal(ov.data.readiness.approvedAssignments, 2);

  const act = await admin.req('/api/admin/activity');
  assert.equal(act.status, 200);
  assert.ok(act.data.guidelineStudyLogs.length >= 1);
  assert.ok(act.data.assessmentActivityLogs.length >= 3);

  // Verify Bulk Employee Onboarding (auto-username deduplication, duplicate-email skip, temp-password login)
  const bulkRes = await admin.req('/api/admin/employees/bulk', {
    method: 'POST',
    body: {
      defaultDepartmentNote: 'Search Quality Cohort',
      rows: [
        { fullName: 'Meera Krishnan', email: 'meera.k@aisquare.local' },
        { fullName: 'Meera K Two', email: 'meera.k@corp.local' }, // colliding email prefix -> meera.k2
        { fullName: 'Duplicate Meera', email: 'meera.k@aisquare.local' }, // duplicate email -> skipped
      ],
    },
  });
  assert.equal(bulkRes.status, 201);
  assert.equal(bulkRes.data.createdCount, 2);
  assert.equal(bulkRes.data.skippedCount, 1);
  assert.equal(bulkRes.data.created[0].username, 'meera.k');
  assert.equal(bulkRes.data.created[1].username, 'meera.k2');

  const bulkEmpLogin = await emp.req('/api/auth/employee/login', {
    method: 'POST',
    body: {
      identifier: bulkRes.data.created[0].email,
      password: bulkRes.data.created[0].temporaryPassword,
    },
  });
  assert.equal(bulkEmpLogin.status, 200);
  assert.equal(bulkEmpLogin.data.user.mustChangePassword, true);

  console.log('\n✅ ALL PHASES 1–8 END-TO-END VERIFICATION CHECKS PASSED 100%!');
} finally {
  server.close();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
}
