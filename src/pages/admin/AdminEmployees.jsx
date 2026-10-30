import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus,
  Users,
  Upload,
  Download,
  Copy,
  Check,
  Shield,
  Search,
  KeyRound,
  UserX,
  UserCheck,
  Trash2,
  Eye,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

function generateRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = 'AiSq';
  for (let i = 0; i < 8; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${out}9!`;
}

function escapeCsvCell(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsvFile(filename, headers, rows) {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function splitDelimitedLine(line, delimiter) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

/**
 * Parses pasted CSV or Excel TSV text into structured employee objects.
 * Supports:
 *   Full Name, Email, [Team/Cohort Note], [Username], [Password]
 * or header-mapped columns (fullName/name, email, username, department/team/note, password).
 */
function parseBulkEmployeeText(rawText) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const firstCells = splitDelimitedLine(lines[0], delimiter).map((c) => c.toLowerCase());

  const looksLikeHeader =
    firstCells.some((c) => c.includes('email') || c.includes('mail')) ||
    (firstCells[0] && (firstCells[0].includes('name') || firstCells[0] === 'full_name'));

  let startIdx = 0;
  let colMap = { name: 0, email: 1, note: 2, username: 3, password: 4 };

  if (looksLikeHeader) {
    startIdx = 1;
    const findCol = (pred, fallback) => {
      const idx = firstCells.findIndex(pred);
      return idx >= 0 ? idx : fallback;
    };
    colMap = {
      name: findCol((c) => c.includes('name'), 0),
      email: findCol((c) => c.includes('mail'), 1),
      note: findCol((c) => c.includes('dept') || c.includes('team') || c.includes('cohort') || c.includes('note'), -1),
      username: findCol((c) => c.includes('user'), -1),
      password: findCol((c) => c.includes('pass') || c.includes('pwd'), -1),
    };
  }

  const parsed = [];
  for (let i = startIdx; i < lines.length; i += 1) {
    const cells = splitDelimitedLine(lines[i], delimiter);
    if (cells.every((c) => !c)) continue;

    // Smart 2-column detection if user pasted "email, Full Name" reversed
    let fullName = cells[colMap.name] || '';
    let email = cells[colMap.email] || '';
    if (!looksLikeHeader && fullName.includes('@') && !email.includes('@')) {
      const tmp = fullName;
      fullName = email;
      email = tmp;
    }

    parsed.push({
      fullName,
      email,
      departmentNote: colMap.note >= 0 ? cells[colMap.note] || '' : '',
      username: colMap.username >= 0 ? cells[colMap.username] || '' : '',
      password: colMap.password >= 0 ? cells[colMap.password] || '' : '',
    });
  }

  return parsed;
}

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('non_deleted');
  const [searchQuery, setSearchQuery] = useState('');
  const [banner, setBanner] = useState(null);

  // One-time provisioned credentials banner (single or bulk)
  const [provisionedBatch, setProvisionedBatch] = useState(null);
  const [copiedBatch, setCopiedBatch] = useState(false);

  // Single Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDeptNote, setNewDeptNote] = useState('');
  const [mustChangePwd, setMustChangePwd] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Bulk Onboarding Modal
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkDefaultNote, setBulkDefaultNote] = useState('');
  const [bulkMustChangePwd, setBulkMustChangePwd] = useState(true);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const csvFileInputRef = useRef(null);

  // Inspect / Edit Modal
  const [inspectData, setInspectData] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editDept, setEditDept] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Reset Password Modal
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetting, setResetting] = useState(false);

  // Delete Confirm Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const parsedBulkRows = useMemo(() => parseBulkEmployeeText(bulkText), [bulkText]);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      const res = await apiRequest(`/api/admin/employees?${params.toString()}`);
      setEmployees(res.employees || []);
    } catch (err) {
      setBanner({ type: 'error', text: err.message || 'Unable to load employee accounts.' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleOpenCreate = () => {
    setNewFullName('');
    setNewEmail('');
    setNewUsername('');
    setNewPassword(generateRandomPassword());
    setNewDeptNote('');
    setMustChangePwd(true);
    setCreateError('');
    setCreateOpen(true);
  };

  const handleOpenBulk = () => {
    setBulkText('');
    setBulkDefaultNote('');
    setBulkMustChangePwd(true);
    setBulkError('');
    setBulkOpen(true);
  };

  const handleCsvFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkError('');
    const reader = new FileReader();
    reader.onload = () => {
      setBulkText(String(reader.result || ''));
    };
    reader.onerror = () => {
      setBulkError('Unable to read the selected CSV file.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadSampleTemplate = () => {
    downloadCsvFile(
      'aisquare-employee-import-template.csv',
      ['Full Name', 'Email', 'Team / Cohort Note', 'Username (Optional)'],
      [
        ['Priya Sharma', 'priya.sharma@aisquare.com', 'Search Quality Evaluation', 'priya.sharma'],
        ['Rohan Verma', 'rohan.verma@aisquare.com', 'AI Response Review', ''],
      ]
    );
  };

  const handleExportRosterCsv = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadCsvFile(
      `aisquare-employee-roster-${dateStamp}.csv`,
      [
        'Employee Code',
        'Full Name',
        'Email',
        'Username',
        'Status',
        'Team / Assignment Note',
        'Last Sign-In (UTC)',
      ],
      employees.map((emp) => [
        emp.employeeCode,
        emp.fullName,
        emp.email,
        emp.username,
        emp.status,
        emp.departmentNote || '',
        emp.lastLoginAt || 'Never signed in',
      ])
    );
  };

  const handleDownloadCredentialsCsv = () => {
    if (!provisionedBatch?.created?.length) return;
    const dateStamp = new Date().toISOString().slice(0, 10);
    const portalUrl = `${window.location.origin}/login`;
    downloadCsvFile(
      `aisquare-provisioned-credentials-${dateStamp}.csv`,
      [
        'Employee Code',
        'Full Name',
        'Email',
        'Username',
        'Temporary Password',
        'Team / Cohort Note',
        'Employee Login URL',
      ],
      provisionedBatch.created.map((c) => [
        c.employeeCode,
        c.fullName,
        c.email,
        c.username,
        c.temporaryPassword,
        c.departmentNote || '',
        portalUrl,
      ])
    );
  };

  const handleCopyCredentials = async () => {
    if (!provisionedBatch?.created?.length) return;
    const portalUrl = `${window.location.origin}/login`;
    const text = provisionedBatch.created
      .map(
        (c) =>
          `${c.employeeCode} | ${c.fullName} | Email: ${c.email} | Username: ${c.username} | Temp Password: ${c.temporaryPassword} | Login: ${portalUrl}`
      )
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBatch(true);
      setTimeout(() => setCopiedBatch(false), 2400);
    } catch {
      // Ignore clipboard block
    }
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    const pwdUsed = newPassword;
    try {
      const res = await apiRequest('/api/admin/employees', {
        method: 'POST',
        body: {
          fullName: newFullName,
          email: newEmail,
          username: newUsername,
          password: pwdUsed,
          departmentNote: newDeptNote,
          mustChangePassword: mustChangePwd,
        },
      });
      setCreateOpen(false);
      setProvisionedBatch({
        createdCount: 1,
        skippedCount: 0,
        created: [
          {
            ...res.employee,
            temporaryPassword: pwdUsed,
          },
        ],
        skipped: [],
      });
      loadEmployees();
    } catch (err) {
      setCreateError(err.message || 'Failed to create employee account.');
    } finally {
      setCreating(false);
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setBulkError('');
    if (parsedBulkRows.length === 0) {
      setBulkError('Please paste at least one employee row or upload a CSV file.');
      return;
    }

    setBulkSubmitting(true);
    try {
      const res = await apiRequest('/api/admin/employees/bulk', {
        method: 'POST',
        body: {
          rows: parsedBulkRows,
          defaultDepartmentNote: bulkDefaultNote,
          mustChangePassword: bulkMustChangePwd,
        },
      });

      setBulkOpen(false);
      setProvisionedBatch(res);
      setBanner({
        type: res.createdCount > 0 ? 'success' : 'error',
        text:
          res.createdCount > 0
            ? `Provisioned ${res.createdCount} employee account(s)${
                res.skippedCount > 0 ? ` (${res.skippedCount} duplicate/invalid row(s) skipped)` : ''
              }. Download or copy the one-time credentials sheet below.`
            : `No accounts were created (${res.skippedCount} row(s) skipped). Check the skip reasons below.`,
      });
      loadEmployees();
    } catch (err) {
      setBulkError(err.message || 'Bulk employee import failed.');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleToggleStatus = async (emp) => {
    const nextStatus = emp.status === 'active' ? 'deactivated' : 'active';
    try {
      await apiRequest(`/api/admin/employees/${emp.id}/status`, {
        method: 'POST',
        body: { status: nextStatus },
      });
      setBanner({
        type: 'success',
        text:
          nextStatus === 'deactivated'
            ? `Deactivated ${emp.employeeCode} (${emp.fullName}) and revoked any active portal sessions.`
            : `Reactivated ${emp.employeeCode} (${emp.fullName}).`,
      });
      loadEmployees();
    } catch (err) {
      setBanner({ type: 'error', text: err.message || 'Unable to update employee status.' });
    }
  };

  const handleInspect = async (empId) => {
    setEditError('');
    try {
      const res = await apiRequest(`/api/admin/employees/${empId}`);
      setInspectData(res);
      setEditName(res.employee.fullName);
      setEditEmail(res.employee.email);
      setEditUsername(res.employee.username);
      setEditDept(res.employee.departmentNote || '');
    } catch (err) {
      setBanner({ type: 'error', text: err.message || 'Failed to load employee details.' });
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!inspectData) return;
    setEditError('');
    setSavingEdit(true);
    try {
      await apiRequest(`/api/admin/employees/${inspectData.employee.id}`, {
        method: 'PATCH',
        body: {
          fullName: editName,
          email: editEmail,
          username: editUsername,
          departmentNote: editDept,
        },
      });
      setBanner({ type: 'success', text: `Updated profile for ${inspectData.employee.employeeCode}.` });
      setInspectData(null);
      loadEmployees();
    } catch (err) {
      setEditError(err.message || 'Failed to update employee.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetting(true);
    try {
      const res = await apiRequest(`/api/admin/employees/${resetTarget.id}/reset-password`, {
        method: 'POST',
        body: { newPassword: resetPasswordValue },
      });
      setProvisionedBatch({
        createdCount: 1,
        skippedCount: 0,
        created: [
          {
            employeeCode: resetTarget.employeeCode,
            fullName: resetTarget.fullName,
            email: resetTarget.email,
            username: resetTarget.username,
            temporaryPassword: resetPasswordValue,
            departmentNote: resetTarget.departmentNote || '',
          },
        ],
        skipped: [],
      });
      setBanner({ type: 'success', text: res.message });
      setResetTarget(null);
      setResetPasswordValue('');
      loadEmployees();
    } catch (err) {
      setBanner({ type: 'error', text: err.message || 'Password reset failed.' });
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/admin/employees/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setBanner({
        type: 'success',
        text: `Deleted account ${deleteTarget.employeeCode} (${deleteTarget.fullName}). Historical audit records are preserved.`,
      });
      setDeleteTarget(null);
      loadEmployees();
    } catch (err) {
      setBanner({ type: 'error', text: err.message || 'Unable to delete employee account.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 14,
          marginBottom: 22,
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Employee Account Management</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Onboard evaluators individually or in bulk, manage access, reset credentials, and export roster sheets.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {employees.length > 0 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportRosterCsv}>
              <Download size={15} />
              Export Roster CSV
            </button>
          )}
          <Link to="/admin/admins" className="btn btn-secondary btn-sm">
            <Shield size={15} />
            Manage Admins
          </Link>
          <button type="button" className="btn btn-secondary" onClick={handleOpenBulk}>
            <Users size={16} />
            Bulk Onboard (CSV / Paste)
          </button>
          <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
            <UserPlus size={17} />
            Create Employee
          </button>
        </div>
      </div>

      {banner && (
        <div className={`alert ${banner.type === 'error' ? 'alert-error' : 'alert-success'}`} role="status">
          {banner.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span style={{ flex: 1 }}>{banner.text}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBanner(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* One-Time Provisioned Credentials Sheet (Single, Bulk, or Reset) */}
      {provisionedBatch && (
        <div className="neu-card animate-fade-up" style={{ marginBottom: 22 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <span className="badge badge-success" style={{ marginBottom: 6 }}>
                One-Time Credentials Summary
              </span>
              <h2 style={{ fontSize: '1.18rem', margin: 0 }}>
                {provisionedBatch.created?.length || 0} Account(s) Ready to Share
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Save or download this sheet now — passwords are stored scrypt-hashed and cannot be displayed again once dismissed.
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {provisionedBatch.created?.length > 0 && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleDownloadCredentialsCsv}
                  >
                    <Download size={14} />
                    Download Credentials CSV
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCopyCredentials}
                  >
                    {copiedBatch ? <Check size={14} /> : <Copy size={14} />}
                    {copiedBatch ? 'Copied!' : 'Copy All'}
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setProvisionedBatch(null)}
              >
                <X size={14} />
                Close Sheet
              </button>
            </div>
          </div>

          {provisionedBatch.created?.length > 0 && (
            <div className="neu-table-surface" style={{ maxHeight: 260, overflowY: 'auto', marginBottom: provisionedBatch.skipped?.length ? 14 : 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Username</th>
                    <th>Temporary Password</th>
                    <th>Cohort / Note</th>
                  </tr>
                </thead>
                <tbody>
                  {provisionedBatch.created.map((c) => (
                    <tr key={c.employeeCode}>
                      <td style={{ fontWeight: 700 }}>{c.employeeCode}</td>
                      <td>{c.fullName}</td>
                      <td>{c.email}</td>
                      <td><code>{c.username}</code></td>
                      <td><code>{c.temporaryPassword}</code></td>
                      <td>{c.departmentNote || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {provisionedBatch.skipped?.length > 0 && (
            <div className="alert alert-warn" style={{ marginBottom: 0 }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>{provisionedBatch.skipped.length} row(s) skipped:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.84rem' }}>
                  {provisionedBatch.skipped.map((sk, idx) => (
                    <li key={idx}>
                      Row #{sk.rowNumber} ({sk.fullName} / {sk.email}): {sk.reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search & Status Filters */}
      <div
        className="neu-card-compact"
        style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}
      >
        <div style={{ flex: '1 1 280px', position: 'relative' }}>
          <Search
            size={17}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="search"
            className="neu-input"
            style={{ paddingLeft: 38 }}
            placeholder="Search by employee code, full name, email, or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search employee accounts"
          />
        </div>

        <div style={{ minWidth: 220 }}>
          <select
            className="neu-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by account status"
          >
            <option value="non_deleted">Active &amp; Deactivated</option>
            <option value="active">Active Only</option>
            <option value="deactivated">Deactivated Only</option>
            <option value="deleted">Deleted / Archived</option>
          </select>
        </div>
      </div>

      {/* Employee Data Table */}
      <div className="neu-table-surface">
        {loading ? (
          <div style={{ padding: 28 }}>Loading employee accounts...</div>
        ) : employees.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
            No employee accounts match the selected filter. Use{' '}
            <strong>Bulk Onboard (CSV / Paste)</strong> to add your team at once or click{' '}
            <strong>Create Employee</strong>.
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Employee</th>
                  <th>Username</th>
                  <th>Status</th>
                  <th>Portal Presence</th>
                  <th>Last Sign-In (UTC)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{emp.employeeCode}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.fullName}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{emp.email}</div>
                      {emp.departmentNote && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--accent-primary)' }}>
                          {emp.departmentNote}
                        </div>
                      )}
                    </td>
                    <td><code>{emp.username}</code></td>
                    <td>
                      {emp.status === 'active' && <span className="badge badge-success">Active</span>}
                      {emp.status === 'deactivated' && <span className="badge badge-warn">Deactivated</span>}
                      {emp.status === 'deleted' && <span className="badge badge-danger">Deleted</span>}
                    </td>
                    <td>
                      {emp.recentlyConnected ? (
                        <span className="badge badge-info">Recently Connected</span>
                      ) : (
                        <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>Offline / Idle</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
                      {emp.lastLoginAt || 'Never signed in'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleInspect(emp.id)}
                          title="Inspect or edit employee record"
                        >
                          <Eye size={14} />
                          Details
                        </button>

                        {emp.status !== 'deleted' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleToggleStatus(emp)}
                            >
                              {emp.status === 'active' ? (
                                <>
                                  <UserX size={14} />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck size={14} />
                                  Reactivate
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setResetTarget(emp);
                                setResetPasswordValue(generateRandomPassword());
                              }}
                            >
                              <KeyRound size={14} />
                              Reset Password
                            </button>

                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => setDeleteTarget(emp)}
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Employee Onboarding Modal */}
      {bulkOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="bulk-emp-title">
          <div className="modal-card" style={{ maxWidth: 660 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h2 id="bulk-emp-title" style={{ fontSize: '1.3rem', margin: 0 }}>
                  Bulk Employee Onboarding
                </h2>
                <span style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                  Upload a CSV or paste rows straight from Excel / Google Sheets — usernames &amp; temporary passwords are generated automatically.
                </span>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBulkOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {bulkError && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{bulkError}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <input
                ref={csvFileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                style={{ display: 'none' }}
                onChange={handleCsvFileUpload}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => csvFileInputRef.current?.click()}
              >
                <Upload size={14} />
                Upload CSV File
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDownloadSampleTemplate}
              >
                <FileSpreadsheet size={14} />
                Download Sample CSV Template
              </button>
            </div>

            <form onSubmit={handleBulkSubmit}>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="bulk-rows">
                    Employee Rows (One per line: Full Name, Email, [Optional Cohort/Note]) *
                  </label>
                  <span className="badge badge-info">
                    {parsedBulkRows.length} row(s) detected
                  </span>
                </div>
                <textarea
                  id="bulk-rows"
                  className="neu-textarea"
                  style={{ minHeight: 165, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.86rem' }}
                  placeholder={`Priya Sharma, priya@aisquare.com, Search Quality\nRohan Verma, rohan@aisquare.com, AI Response Review\nAnanya Nair, ananya@aisquare.com`}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  required
                />
                <span className="form-hint">
                  Accepts comma-separated or tab-separated lines copied directly from Excel or Google Sheets. Duplicate emails are safely skipped.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="bulk-note">
                  Default Team / Cohort Note (Applied when a row has no note)
                </label>
                <input
                  id="bulk-note"
                  type="text"
                  className="neu-input"
                  placeholder="e.g., AI Evaluation Workforce"
                  value={bulkDefaultNote}
                  onChange={(e) => setBulkDefaultNote(e.target.value)}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.89rem',
                  marginBottom: 18,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={bulkMustChangePwd}
                  onChange={(e) => setBulkMustChangePwd(e.target.checked)}
                />
                Require employees to choose their own password on first sign-in
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setBulkOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={bulkSubmitting}>
                  {bulkSubmitting
                    ? 'Provisioning Accounts...'
                    : `Provision ${parsedBulkRows.length || ''} Employee Account(s)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Create Employee Modal */}
      {createOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-emp-title">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 id="create-emp-title" style={{ fontSize: '1.3rem', margin: 0 }}>Create Employee Account</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCreateOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {createError && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateEmployee}>
              <div className="form-group">
                <label className="form-label" htmlFor="ce-name">Full Name *</label>
                <input
                  id="ce-name"
                  type="text"
                  className="neu-input"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  required
                />
              </div>

              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="ce-email">Email Address *</label>
                  <input
                    id="ce-email"
                    type="email"
                    className="neu-input"
                    value={newEmail}
                    onChange={(e) => {
                      const nextMail = e.target.value;
                      if (!newUsername && nextMail.includes('@')) {
                        setNewUsername(
                          nextMail
                            .split('@')[0]
                            .toLowerCase()
                            .replace(/[^a-z0-9._-]/g, '.')
                            .slice(0, 40)
                        );
                      }
                      setNewEmail(nextMail);
                    }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="ce-username">Username *</label>
                  <input
                    id="ce-username"
                    type="text"
                    className="neu-input"
                    placeholder="e.g., priya.sharma"
                    value={newUsername}
                    onChange={(e) =>
                      setNewUsername(
                        e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, '.')
                          .replace(/[^a-z0-9._-]/g, '')
                      )
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ce-dept">Team / Assignment Note (Optional)</label>
                <input
                  id="ce-dept"
                  type="text"
                  className="neu-input"
                  placeholder="e.g., Search & Response Evaluation Cohort"
                  value={newDeptNote}
                  onChange={(e) => setNewDeptNote(e.target.value)}
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="ce-pwd">Initial / Temporary Password *</label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setNewPassword(generateRandomPassword())}
                  >
                    <Sparkles size={13} />
                    Regenerate
                  </button>
                </div>
                <input
                  id="ce-pwd"
                  type="text"
                  className="neu-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <span className="form-hint">
                  Passwords are stored scrypt-hashed and shown once in the credentials summary card upon creation.
                </span>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', marginBottom: 18, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={mustChangePwd}
                  onChange={(e) => setMustChangePwd(e.target.checked)}
                />
                Prompt employee to set a new password upon sign-in
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect / Edit Employee Modal */}
      {inspectData && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 680 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', margin: 0 }}>
                  {inspectData.employee.employeeCode} &mdash; {inspectData.employee.fullName}
                </h2>
                <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Created {inspectData.employee.createdAt} UTC
                </span>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setInspectData(null)}>
                <X size={16} />
              </button>
            </div>

            {editError && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{editError}</span>
              </div>
            )}

            {inspectData.employee.status !== 'deleted' && (
              <form
                onSubmit={handleSaveEdit}
                style={{
                  marginBottom: 22,
                  paddingBottom: 18,
                  borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
                }}
              >
                <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Profile Details</h3>
                <div className="grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="neu-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input
                      type="text"
                      className="neu-input"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="neu-input"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Team / Note</label>
                    <input
                      type="text"
                      className="neu-input"
                      value={editDept}
                      onChange={(e) => setEditDept(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-sm" disabled={savingEdit}>
                  {savingEdit ? 'Saving...' : 'Save Profile Updates'}
                </button>
              </form>
            )}

            <div className="grid-2" style={{ gap: 12, marginBottom: 18 }}>
              <div className="neu-panel-inset" style={{ padding: 12 }}>
                <strong style={{ fontSize: '0.86rem', display: 'block', marginBottom: 6 }}>
                  Assessment History
                </strong>
                {inspectData.assessmentHistory?.length ? (
                  <div style={{ display: 'grid', gap: 4, maxHeight: 130, overflowY: 'auto', fontSize: '0.8rem' }}>
                    {inspectData.assessmentHistory.map((ah) => (
                      <div key={ah.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                        <span>{ah.assessmentTitle} (#{ah.attemptNumber})</span>
                        <strong>{ah.percentage !== null ? `${ah.percentage}%` : ah.status}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    No assessment attempts recorded yet.
                  </div>
                )}
              </div>
              <div className="neu-panel-inset" style={{ padding: 12 }}>
                <strong style={{ fontSize: '0.86rem', display: 'block', marginBottom: 6 }}>
                  Project Readiness
                </strong>
                {inspectData.projectReadiness?.length ? (
                  <div style={{ display: 'grid', gap: 4, maxHeight: 130, overflowY: 'auto', fontSize: '0.8rem' }}>
                    {inspectData.projectReadiness.map((pr, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                        <span>{pr.projectCode} &mdash; {pr.projectName}</span>
                        <strong>{pr.readinessStatus}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    No project readiness assignments yet.
                  </div>
                )}
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>Recent Portal Activity</h3>
            {inspectData.activity.length === 0 ? (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>No portal sessions recorded yet.</p>
            ) : (
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'grid', gap: 6 }}>
                {inspectData.activity.map((ev) => (
                  <div
                    key={ev.id}
                    className="neu-panel-inset"
                    style={{ padding: '8px 12px', fontSize: '0.83rem', display: 'flex', justifyContent: 'space-between' }}
                  >
                    <span><strong>{ev.eventType}</strong> &mdash; {ev.detail}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{ev.createdAt}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: 8 }}>
              Reset Password &mdash; {resetTarget.employeeCode}
            </h2>
            {banner?.type === 'error' && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{banner.text}</span>
              </div>
            )}
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Setting a new temporary password for <strong>{resetTarget.fullName}</strong> will immediately sign out any active sessions and prompt them to update their password.
            </p>
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">New Temporary Password</label>
                <input
                  type="text"
                  className="neu-input"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setResetTarget(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={resetting}>
                  {resetting ? 'Resetting...' : 'Confirm Password Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: 8, color: 'var(--status-danger-text)' }}>
              Delete Employee Account ({deleteTarget.employeeCode})?
            </h2>
            {banner?.type === 'error' && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{banner.text}</span>
              </div>
            )}
            <p style={{ fontSize: '0.92rem', color: 'var(--text-body)', marginBottom: 18 }}>
              Deleting <strong>{deleteTarget.fullName}</strong> permanently disables login and revokes active sessions while preserving historical audit logs in accordance with platform data retention rules.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDeleteEmployee} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Employee Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
