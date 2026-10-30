/**
 * Secure CLI Account Provisioning Tool (Zero hardcoded passwords in application code).
 * Usage:
 *   node server/scripts/provision.js --role=admin --name="System Administrator" --email="admin@aisquare.local" --username="admin" --password="..."
 */
import db, { ensureBootstrapState, nextAccountCode, recordAudit } from '../db/database.js';
import { hashPassword } from '../utils/crypto.js';

function parseArgs(argv) {
  const out = {};
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--')) {
      const idx = arg.indexOf('=');
      if (idx > -1) {
        out[arg.slice(2, idx)] = arg.slice(idx + 1);
      } else {
        out[arg.slice(2)] = 'true';
      }
    }
  }
  return out;
}

async function run() {
  const args = parseArgs(process.argv);
  const role = args.role === 'admin' ? 'admin' : 'employee';
  const fullName = String(args.name || '').trim();
  const email = String(args.email || '').trim().toLowerCase();
  const username = String(args.username || '').trim().toLowerCase();
  const password = String(args.password || '');

  if (!fullName || !email || !username || !password) {
    console.error(
      'Usage: node server/scripts/provision.js --role=admin|employee --name="Full Name" --email="email" --username="username" --password="StrongPassword1"'
    );
    process.exit(1);
  }

  const existing = db
    .prepare('SELECT id, employee_code FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?')
    .get(email, username);

  const passwordHash = await hashPassword(password);

  if (existing) {
    db.prepare(
      "UPDATE users SET full_name = ?, password_hash = ?, status = 'active', updated_at = datetime('now') WHERE id = ?"
    ).run(fullName, passwordHash, existing.id);
    ensureBootstrapState();
    console.log(`Updated ${role} account ${existing.employee_code} (${email}).`);
    return;
  }

  const code = nextAccountCode(role);
  const res = db
    .prepare(
      `INSERT INTO users
        (employee_code, full_name, email, username, password_hash, role, status, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', 0, datetime('now'), datetime('now'))`
    )
    .run(code, fullName, email, username, passwordHash, role);

  ensureBootstrapState();

  recordAudit({
    adminId: role === 'admin' ? res.lastInsertRowid : null,
    adminIdentity: 'CLI Provisioner',
    action: role === 'admin' ? 'ADMIN_PROVISIONED_CLI' : 'EMPLOYEE_PROVISIONED_CLI',
    entityType: role,
    entityId: res.lastInsertRowid,
    summary: `Provisioned ${role} account ${code} (${email}) via secure CLI script.`,
  });

  console.log(`Provisioned ${role} account ${code} (${email} / username: ${username}).`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
