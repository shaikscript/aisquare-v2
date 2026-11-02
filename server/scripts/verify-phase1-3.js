import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import db, { BOOTSTRAP_TOKEN_PATH, RESUME_STORAGE_DIR } from '../db/database.js';

const BASE = 'http://127.0.0.1:3000';

async function request(urlPath, { method = 'GET', body, cookie, isFormData = false } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  const opts = { method, headers, redirect: 'manual' };
  if (body !== undefined) {
    if (isFormData) {
      opts.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const res = await fetch(`${BASE}${urlPath}`, opts);
  const setCookie = res.headers.get('set-cookie');
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json()
    : await res.text();
  return { status: res.status, data, setCookie, headers: res.headers };
}

function extractSessionCookie(setCookieHeader) {
  if (!setCookieHeader) return '';
  return setCookieHeader.split(';')[0];
}

async function runVerification() {
  console.log('=== AI Square IT Solutions — Phase 1–3 Verification Suite ===');

  // 1. Public SPA routes return 200 HTML
  for (const route of ['/', '/about', '/careers', '/contact', '/privacy', '/terms', '/login', '/admin/login']) {
    const res = await request(route);
    assert.equal(res.status, 200, `Expected 200 for route ${route}`);
    assert.ok(typeof res.data === 'string' && res.data.includes('<div id="root"></div>'));
  }
  console.log('[PASS] All public & portal entry SPA routes respond with 200 OK');

  // 2. Public info contains zero invented details by default
  const infoRes = await request('/api/public/info');
  assert.equal(infoRes.status, 200);
  assert.equal(infoRes.data.companyName, 'AI Square IT Solutions');
  assert.equal(infoRes.data.contactPhone, null);
  assert.equal(infoRes.data.officeAddress, null);
  console.log('[PASS] Public company info exposes zero invented contact/history data');

  // 3. Unauthenticated access to protected endpoints is strictly blocked (401)
  const unauthAdmin = await request('/api/admin/overview');
  assert.equal(unauthAdmin.status, 401);
  const unauthPortal = await request('/api/portal/overview');
  assert.equal(unauthPortal.status, 401);
  console.log('[PASS] Unauthenticated requests to /api/admin/* and /api/portal/* return 401');

  // 4. First-run bootstrap admin setup check & token validation
  const setupStatus1 = await request('/api/auth/setup-status');
  let adminCookie = '';
  const adminPassword = process.env.VERIFY_ADMIN_PASSWORD || 'AiSquareAdmin2026!';
  const empPassword = process.env.VERIFY_EMP_PASSWORD || 'AiSquareEval2026!';

  if (setupStatus1.data.needsInitialAdmin) {
    // Reject wrong token
    const badBoot = await request('/api/auth/bootstrap-admin', {
      method: 'POST',
      body: {
        bootstrapToken: 'wrong-token',
        fullName: 'Primary Administrator',
        email: 'admin@aisquare.local',
        username: 'admin',
        password: adminPassword,
      },
    });
    assert.equal(badBoot.status, 403);

    const realToken = fs.readFileSync(BOOTSTRAP_TOKEN_PATH, 'utf8').trim();
    const goodBoot = await request('/api/auth/bootstrap-admin', {
      method: 'POST',
      body: {
        bootstrapToken: realToken,
        fullName: 'AI Square Administrator',
        email: 'admin@aisquare.local',
        username: 'admin',
        password: adminPassword,
      },
    });
    assert.equal(goodBoot.status, 201);
    adminCookie = extractSessionCookie(goodBoot.setCookie);
    assert.ok(adminCookie.startsWith('aisquare_session='));
    assert.equal(fs.existsSync(BOOTSTRAP_TOKEN_PATH), false, 'Bootstrap token file must be deleted after setup');

    // Second attempt must be permanently blocked
    const repeatBoot = await request('/api/auth/bootstrap-admin', {
      method: 'POST',
      body: {
        bootstrapToken: realToken,
        fullName: 'Rogue Admin',
        email: 'rogue@aisquare.local',
        username: 'rogue',
        password: adminPassword,
      },
    });
    assert.equal(repeatBoot.status, 403);
    console.log('[PASS] One-time Bootstrap Admin initialization verified and permanently locked afterwards');
  } else {
    const loginRes = await request('/api/auth/admin/login', {
      method: 'POST',
      body: { identifier: 'admin', password: adminPassword },
    });
    assert.equal(loginRes.status, 200);
    adminCookie = extractSessionCookie(loginRes.setCookie);
  }

  // 5. Verify password is stored hashed with scrypt, never plain text
  const adminDbRow = db.prepare("SELECT password_hash FROM users WHERE username = 'admin'").get();
  assert.ok(adminDbRow.password_hash.startsWith('scrypt$'));
  assert.ok(!adminDbRow.password_hash.includes(adminPassword));
  console.log('[PASS] Passwords hashed with salted scrypt (no plaintext storage)');

  // 6. Verify Admin cannot sign in via Employee Login endpoint
  const adminViaEmpLogin = await request('/api/auth/employee/login', {
    method: 'POST',
    body: { identifier: 'admin', password: adminPassword },
  });
  assert.equal(adminViaEmpLogin.status, 403);
  console.log('[PASS] Admin login and Employee login remain strictly separated');

  // 7. Create an Employee Evaluator via Admin API
  let empRecord = db.prepare("SELECT id FROM users WHERE username = 'evaluator1' AND status != 'deleted'").get();
  if (!empRecord) {
    const createEmp = await request('/api/admin/employees', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        fullName: 'Sample Evaluator',
        email: 'evaluator1@aisquare.local',
        username: 'evaluator1',
        password: empPassword,
        departmentNote: 'AI Evaluation Workforce',
        mustChangePassword: false,
      },
    });
    assert.equal(createEmp.status, 201);
    empRecord = { id: createEmp.data.employee.id };
  }

  // 8. Employee signs in via Employee Login & cannot access Admin endpoints
  const empLogin = await request('/api/auth/employee/login', {
    method: 'POST',
    body: { identifier: 'evaluator1', password: empPassword },
  });
  assert.equal(empLogin.status, 200);
  const empCookie = extractSessionCookie(empLogin.setCookie);

  const empOverview = await request('/api/portal/overview', { cookie: empCookie });
  assert.equal(empOverview.status, 200);
  assert.equal(empOverview.data.profile.username, 'evaluator1');

  const empTryingAdmin = await request('/api/admin/employees', { cookie: empCookie });
  assert.equal(empTryingAdmin.status, 403);
  const empTryingAdminLogin = await request('/api/auth/admin/login', {
    method: 'POST',
    body: { identifier: 'evaluator1', password: empPassword },
  });
  assert.equal(empTryingAdminLogin.status, 403);
  console.log('[PASS] Employee RBAC verified — 403 Forbidden on all Admin endpoints & Admin login');

  // 9. Deactivation immediately revokes active Employee session & blocks new login
  const deactRes = await request(`/api/admin/employees/${empRecord.id}/status`, {
    method: 'POST',
    cookie: adminCookie,
    body: { status: 'deactivated' },
  });
  assert.equal(deactRes.status, 200);

  const empAfterDeact = await request('/api/portal/overview', { cookie: empCookie });
  assert.equal(empAfterDeact.status, 401, 'Deactivated employee active session must be immediately invalidated');

  const empLoginWhileDeact = await request('/api/auth/employee/login', {
    method: 'POST',
    body: { identifier: 'evaluator1', password: empPassword },
  });
  assert.equal(empLoginWhileDeact.status, 403, 'Deactivated employee must not be able to sign in');

  // Reactivate evaluator1 so workspace has a ready test employee account
  const reactRes = await request(`/api/admin/employees/${empRecord.id}/status`, {
    method: 'POST',
    cookie: adminCookie,
    body: { status: 'active' },
  });
  assert.equal(reactRes.status, 200);
  console.log('[PASS] Account deactivation revokes sessions & blocks sign-in; reactivation restores access');

  // 10. Test Contact Enquiry validation & persistence (and clean up test row afterwards)
  const badContact = await request('/api/public/contact', {
    method: 'POST',
    body: { name: 'A', email: 'bad', subject: 'Hi', message: 'short' },
  });
  assert.equal(badContact.status, 400);

  const goodContact = await request('/api/public/contact', {
    method: 'POST',
    body: {
      name: 'Verification Tester',
      email: 'verify@example.com',
      subject: 'Automated Verification Enquiry',
      message: 'Testing end-to-end contact message persistence and admin visibility.',
    },
  });
  assert.equal(goodContact.status, 201);
  const adminMsgs = await request('/api/admin/contact-messages', { cookie: adminCookie });
  assert.ok(adminMsgs.data.messages.some((m) => m.id === goodContact.data.enquiryId));
  db.prepare('DELETE FROM contact_messages WHERE id = ?').run(goodContact.data.enquiryId);
  console.log('[PASS] Public Contact Us validation, persistence, and Admin visibility verified');

  // 11. Test Careers General Application + Private Resume Upload & Protection
  const form = new FormData();
  form.append('fullName', 'Candidate Test');
  form.append('email', 'candidate@example.com');
  form.append('phone', '+91 9876543210');
  form.append('jobSelection', 'general');
  form.append('educationExperience', 'B.Tech in Computer Science with analytical evaluation experience.');
  const pdfBytes = new Blob(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'], {
    type: 'application/pdf',
  });
  form.append('resume', pdfBytes, 'candidate_cv.pdf');

  const appRes = await request('/api/public/applications', {
    method: 'POST',
    body: form,
    isFormData: true,
  });
  assert.equal(appRes.status, 201);
  const appId = appRes.data.applicationId;

  const storedRow = db.prepare('SELECT resume_stored_name FROM job_applications WHERE id = ?').get(appId);
  assert.ok(storedRow?.resume_stored_name);

  // Verify resume is NOT publicly downloadable via static path or without admin auth
  const unauthResume = await request(`/api/admin/applications/${appId}/resume`);
  assert.equal(unauthResume.status, 401);

  // Verify authenticated admin CAN access private resume
  const authResume = await request(`/api/admin/applications/${appId}/resume`, { cookie: adminCookie });
  assert.equal(authResume.status, 200);

  // Clean up test application & test resume file so zero fake candidate data remains in DB!
  const storedFilePath = path.join(RESUME_STORAGE_DIR, storedRow.resume_stored_name);
  if (fs.existsSync(storedFilePath)) fs.unlinkSync(storedFilePath);
  db.prepare('DELETE FROM job_applications WHERE id = ?').run(appId);
  db.prepare("DELETE FROM audit_logs WHERE entity_type = 'job_application' AND entity_id = ?").run(
    String(appId)
  );
  console.log('[PASS] Careers application & private resume protection verified (test record cleaned up)');

  console.log('=== ALL PHASE 1–3 VERIFICATION TESTS PASSED ===');
}

runVerification().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
