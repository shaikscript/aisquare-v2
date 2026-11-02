import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const TEST_PORT = 4512;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class Client {
  constructor() {
    this.token = null;
  }

  async req(urlPath, { method = 'GET', body } = {}) {
    const headers = {};
    if (this.token) headers['X-AISquare-Session'] = this.token;
    const opts = { method, headers };
    if (body !== undefined) {
      if (body instanceof FormData) {
        opts.body = body;
      } else {
        headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
    }
    const res = await fetch(`${BASE_URL}${urlPath}`, opts);
    const data = await res.json();
    if (data && data.sessionToken) this.token = data.sessionToken;
    return { status: res.status, data };
  }
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisquare-exam-e2e-'));
  const dataDir = path.join(tmpDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const proc = spawn('node', ['server/index.js'], {
    cwd: '/home/user',
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
      AISQUARE_DATA_DIR: dataDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let ready = false;
  for (let i = 0; i < 40; i += 1) {
    try {
      const r = await fetch(`${BASE_URL}/api/health`);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {
      // wait
    }
    await sleep(150);
  }
  assert.ok(ready, 'Server failed to boot');

  try {
    const bootstrapToken = fs.readFileSync(path.join(dataDir, '.bootstrap_token'), 'utf8').trim();
    const admin = new Client();

    // 1. Bootstrap Admin
    const boot = await admin.req('/api/auth/bootstrap-admin', {
      method: 'POST',
      body: {
        bootstrapToken,
        fullName: 'Exam Admin',
        email: 'exam.admin@aisquare.local',
        username: 'exam.admin',
        password: 'AdminPassword99!',
      },
    });
    assert.equal(boot.status, 201);

    // 2. Seed the 3 Real AI Evaluation & Aptitude Screening Exams
    const seedRes = await admin.req('/api/admin/assessments/seed-templates', { method: 'POST' });
    assert.equal(seedRes.status, 201);
    assert.equal(seedRes.data.createdExams, 3);
    assert.ok(seedRes.data.createdQuestions >= 15);

    const examsList = await admin.req('/api/admin/assessments');
    assert.equal(examsList.data.assessments.length, 3);
    const [exam1, exam2, exam3] = examsList.data.assessments;
    assert.equal(exam1.assignmentMode, 'assigned_only');

    // 3. PATH 1: Candidate Applies via Website -> Admin Issues Login & Assigns Exam #1 ONLY
    const pub = new Client();
    const fd = new FormData();
    fd.append('jobSelection', 'general');
    fd.append('fullName', 'Ananya Rao');
    fd.append('email', 'ananya.rao@example.com');
    fd.append('phone', '+91 9888877777');
    fd.append('educationExperience', 'B.Sc Mathematics & 1 year Search Evaluation');
    fd.append('resume', new Blob(['%PDF-1.4\nResume'], { type: 'application/pdf' }), 'ananya_cv.pdf');
    const applyRes = await pub.req('/api/public/applications', { method: 'POST', body: fd });
    assert.equal(applyRes.status, 201);

    const appsRes = await admin.req('/api/admin/applications?status=all');
    const appRow = appsRes.data.applications[0];
    assert.ok(appRow, 'Website application missing');

    const issueRes = await admin.req(`/api/admin/applications/${appRow.id}/issue-exam-login`, {
      method: 'POST',
      body: {
        password: 'TempExamPass22!',
        mustChangePassword: false,
        assessmentIds: [exam1.id],
      },
    });
    assert.equal(issueRes.status, 201);
    assert.equal(issueRes.data.isNewAccount, true);
    assert.match(issueRes.data.credentials.employeeCode, /^CND-/);
    assert.equal(issueRes.data.credentials.assignedExams.length, 1);

    // Candidate 1 MUST be blocked from Employee Portal login (/login)
    const cand1 = new Client();
    const wrongPortalLogin = await cand1.req('/api/auth/employee/login', {
      method: 'POST',
      body: { identifier: issueRes.data.credentials.username, password: 'TempExamPass22!' },
    });
    assert.equal(wrongPortalLogin.status, 403, 'Candidate must not log into Employee Portal');

    // Candidate 1 logs in cleanly at Candidate Exam Portal (/exam-login)
    const login1 = await cand1.req('/api/auth/candidate/login', {
      method: 'POST',
      body: { identifier: issueRes.data.credentials.username, password: 'TempExamPass22!' },
    });
    assert.equal(login1.status, 200);
    assert.equal(login1.data.user.accountType, 'candidate');

    // Candidate 1 MUST be blocked from Employee-only modules (Overview, Guidelines, Readiness, Announcements)
    assert.equal((await cand1.req('/api/portal/overview')).status, 403);
    assert.equal((await cand1.req('/api/portal/guidelines')).status, 403);
    assert.equal((await cand1.req('/api/portal/readiness')).status, 403);
    assert.equal((await cand1.req('/api/portal/announcements')).status, 403);

    const cand1Exams = await cand1.req('/api/portal/assessments');
    assert.equal(cand1Exams.status, 200);
    assert.equal(cand1Exams.data.assessments.length, 1, 'Candidate 1 must ONLY see Exam #1');
    assert.equal(cand1Exams.data.assessments[0].id, exam1.id);

    // Unassigned Exam #2 start attempt MUST be rejected with 403
    const forbiddenStart = await cand1.req(`/api/portal/assessments/${exam2.id}/start`, { method: 'POST' });
    assert.equal(forbiddenStart.status, 403, 'Unassigned exam must be blocked by backend');

    // Start Exam #1, log TAB_SWITCH, answer questions, submit
    const start1 = await cand1.req(`/api/portal/assessments/${exam1.id}/start`, { method: 'POST' });
    assert.equal(start1.status, 201);
    const attemptId = start1.data.attemptId;

    const tabLog = await cand1.req(`/api/portal/attempts/${attemptId}/interruption`, {
      method: 'POST',
      body: { eventType: 'TAB_SWITCH' },
    });
    assert.equal(tabLog.status, 200);
    assert.equal(tabLog.data.interruptionCount, 1);

    const runner = await cand1.req(`/api/portal/attempts/${attemptId}`);
    const answers = runner.data.questions.map((q) => ({
      attemptQuestionId: q.id,
      answerValue:
        q.questionType === 'multi_select'
          ? JSON.stringify(q.options.slice(0, 3))
          : q.questionType === 'short_answer'
          ? 'Model A wins because 150 km/h divided by 3.6 equals 41.67 m/s, whereas Model B inverted the formula.'
          : q.options[0],
      reasoningText: '',
    }));
    await cand1.req(`/api/portal/attempts/${attemptId}/answers`, {
      method: 'PUT',
      body: { answers },
    });
    const sub1 = await cand1.req(`/api/portal/attempts/${attemptId}/submit`, { method: 'POST' });
    assert.equal(sub1.status, 200);

    // Before Admin Release: Result MUST hide score, pass/fail, and breakdown
    const preRel = await cand1.req('/api/portal/results');
    assert.equal(preRel.data.results[0].isReleased, false);
    assert.equal(preRel.data.results[0].finalScore ?? null, null);
    assert.equal(preRel.data.results[0].passed ?? null, null);
    assert.equal((preRel.data.results[0].questionBreakdown || []).length, 0);

    // Admin grades manual question & releases WITH showAnswers: false
    const detailAdmin = await admin.req(`/api/admin/attempts/${attemptId}`);
    const manualQuestions = detailAdmin.data.questions
      .filter((q) => q.requiresManualReview)
      .map((q) => ({ attemptQuestionId: q.id, awardedMarks: q.allocatedMarks, reviewerNotes: 'Accurate math justification.' }));

    await admin.req(`/api/admin/attempts/${attemptId}/review`, {
      method: 'POST',
      body: { overallComment: 'Strong analytical screening.', gradedQuestions: manualQuestions, releaseImmediately: false },
    });

    const relRes = await admin.req(`/api/admin/attempts/${attemptId}/release`, {
      method: 'POST',
      body: {
        showScore: true,
        showPassFail: true,
        showAnswers: false,
        overallComment: 'Congratulations on completing Stage 1 Screening.',
      },
    });
    assert.equal(relRes.status, 200);

    const postRel = await cand1.req('/api/portal/results');
    assert.equal(postRel.data.results[0].isReleased, true);
    assert.notEqual(postRel.data.results[0].finalScore, null);
    assert.notEqual(postRel.data.results[0].passed, null);
    assert.equal(postRel.data.results[0].questions.length, 0, 'Answer breakdown must remain confidential when showAnswers=false');

    // Admin Unreleases (Hides) Result
    const unrelRes = await admin.req(`/api/admin/attempts/${attemptId}/unrelease`, { method: 'POST' });
    assert.equal(unrelRes.status, 200);

    const afterHide = await cand1.req('/api/portal/results');
    assert.equal(afterHide.data.results[0].isReleased, false);
    assert.equal(afterHide.data.results[0].finalScore ?? null, null);

    // Admin Re-Releases WITH showAnswers: true -> Candidate sees all 6 questions!
    await admin.req(`/api/admin/attempts/${attemptId}/release`, {
      method: 'POST',
      body: { showScore: true, showPassFail: true, showAnswers: true },
    });
    const fullRel = await cand1.req('/api/portal/results');
    assert.equal(fullRel.data.results[0].questions.length, runner.data.questions.length);

    // 4. PATH 2: Direct Off-Website Candidate Created Manually by Admin + Assigned Exam #2
    const directRes = await admin.req('/api/admin/employees', {
      method: 'POST',
      body: {
        accountType: 'candidate',
        fullName: 'Vikram Menon',
        email: 'vikram.menon@example.com',
        username: 'vikram.menon',
        password: 'DirectPass44!',
        departmentNote: 'Direct Referral — Search Track',
        mustChangePassword: false,
        restrictToAssignedExams: true,
        assessmentIds: [exam2.id],
      },
    });
    assert.equal(directRes.status, 201);
    assert.match(directRes.data.employee.employeeCode, /^CND-/);
    assert.equal(directRes.data.employee.assignedExams.length, 1);

    const cand2 = new Client();
    const cand2Login = await cand2.req('/api/auth/candidate/login', {
      method: 'POST',
      body: { identifier: 'vikram.menon', password: 'DirectPass44!' },
    });
    assert.equal(cand2Login.status, 200);
    const cand2Exams = await cand2.req('/api/portal/assessments');
    assert.equal(cand2Exams.data.assessments.length, 1);
    assert.equal(cand2Exams.data.assessments[0].id, exam2.id);

    // Admin adds Exam #3 via PUT /api/admin/employees/:id/exams
    await admin.req(`/api/admin/employees/${directRes.data.employee.id}/exams`, {
      method: 'PUT',
      body: { assessmentIds: [exam2.id, exam3.id] },
    });
    const cand2ExamsUpdated = await cand2.req('/api/portal/assessments');
    assert.equal(cand2ExamsUpdated.data.assessments.length, 2);

    // 5. 1-CLICK PROMOTE CANDIDATE TO FULL EMPLOYEE WORKFORCE PORTAL
    const promRes = await admin.req(
      `/api/admin/employees/${issueRes.data.credentials.userId}/promote-to-employee`,
      { method: 'POST' }
    );
    assert.equal(promRes.status, 200);
    assert.match(promRes.data.employeeCode, /^EMP-/);

    // Promoted Employee now signs into Employee Portal (/login) and accesses Overview & Guidelines!
    const promotedEmp = new Client();
    const empPortalLogin = await promotedEmp.req('/api/auth/employee/login', {
      method: 'POST',
      body: { identifier: issueRes.data.credentials.username, password: 'TempExamPass22!' },
    });
    assert.equal(empPortalLogin.status, 200);
    assert.equal(empPortalLogin.data.user.accountType, 'employee');
    assert.equal((await promotedEmp.req('/api/portal/overview')).status, 200);
    assert.equal((await promotedEmp.req('/api/portal/guidelines')).status, 200);
    assert.equal((await promotedEmp.req('/api/portal/readiness')).status, 200);

    console.log('✅ ALL 3 PORTALS (CANDIDATE EXAM + EMPLOYEE WORKFORCE + ADMIN) E2E CHECKS PASSED!');
  } finally {
    proc.kill('SIGTERM');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('❌ Exam Portal E2E failed:', err);
  process.exit(1);
});
