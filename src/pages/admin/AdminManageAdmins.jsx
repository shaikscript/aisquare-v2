import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Search,
  Edit3,
  KeyRound,
  UserX,
  UserCheck,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { apiRequest } from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

function generateRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
  let out = 'Adm9!';
  for (let i = 0; i < 9; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function AdminManageAdmins() {
  const { user: currentUser } = useAuth();

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('non_deleted');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Create Admin Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    username: '',
    password: '',
    departmentNote: 'Platform Administrator',
    mustChangePassword: true,
  });
  const [showPwd, setShowPwd] = useState(false);
  const [creating, setCreating] = useState(false);
  const [issuedCredentials, setIssuedCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  // Edit Admin Modal
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    username: '',
    departmentNote: '',
  });

  // Reset Password Modal
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPwd, setResetPwd] = useState('');

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      if (search.trim()) params.set('q', search.trim());
      const res = await apiRequest(`/api/admin/admins?${params.toString()}`);
      setAdmins(res.admins || []);
    } catch (err) {
      setError(err.message || 'Unable to load administrator accounts.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const openCreateModal = () => {
    setForm({
      fullName: '',
      email: '',
      username: '',
      password: generateRandomPassword(),
      departmentNote: 'Platform Administrator',
      mustChangePassword: true,
    });
    setShowPwd(true);
    setError('');
    setCreateOpen(true);
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await apiRequest('/api/admin/admins', {
        method: 'POST',
        body: form,
      });
      setIssuedCredentials({
        adminCode: res.admin.employeeCode,
        fullName: res.admin.fullName,
        email: res.admin.email,
        username: res.admin.username,
        password: form.password,
      });
      setCreateOpen(false);
      setNotice(`Provisioned authorized administrator ${res.admin.employeeCode} (${res.admin.fullName}).`);
      loadAdmins();
    } catch (err) {
      setError(err.message || 'Unable to create administrator account.');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editTarget) return;
    setError('');
    try {
      await apiRequest(`/api/admin/admins/${editTarget.id}`, {
        method: 'PATCH',
        body: editForm,
      });
      setNotice(`Updated administrator profile ${editTarget.employeeCode}.`);
      setEditTarget(null);
      loadAdmins();
    } catch (err) {
      setError(err.message || 'Unable to update administrator profile.');
    }
  };

  const handleToggleStatus = async (adm) => {
    const nextStatus = adm.status === 'active' ? 'deactivated' : 'active';
    setError('');
    try {
      await apiRequest(`/api/admin/admins/${adm.id}/status`, {
        method: 'POST',
        body: { status: nextStatus },
      });
      setNotice(`Administrator ${adm.employeeCode} is now ${nextStatus}.`);
      loadAdmins();
    } catch (err) {
      setError(err.message || 'Unable to change administrator status.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetTarget) return;
    setError('');
    try {
      await apiRequest(`/api/admin/admins/${resetTarget.id}/reset-password`, {
        method: 'POST',
        body: { newPassword: resetPwd },
      });
      setIssuedCredentials({
        adminCode: resetTarget.employeeCode,
        fullName: resetTarget.fullName,
        email: resetTarget.email,
        username: resetTarget.username,
        password: resetPwd,
      });
      setResetTarget(null);
      setNotice(`Password reset for administrator ${resetTarget.employeeCode}.`);
    } catch (err) {
      setError(err.message || 'Unable to reset password.');
    }
  };

  const handleDeleteAdmin = async () => {
    if (!deleteTarget) return;
    setError('');
    try {
      await apiRequest(`/api/admin/admins/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setNotice(`Removed administrator ${deleteTarget.employeeCode} while preserving audit history.`);
      setDeleteTarget(null);
      loadAdmins();
    } catch (err) {
      setError(err.message || 'Unable to remove administrator.');
    }
  };

  const copyCredentials = () => {
    if (!issuedCredentials) return;
    const text = `AI Square IT Solutions — Admin Portal Credentials\nLogin URL: ${window.location.origin}/admin/login\nAdmin ID: ${issuedCredentials.adminCode}\nUsername: ${issuedCredentials.username}\nEmail: ${issuedCredentials.email}\nTemporary Password: ${issuedCredentials.password}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Authorized Administrators</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Provision additional Administrator accounts for `/admin/login`, manage active access, or rotate temporary passwords. Self-deactivation and removing the last active administrator are blocked to prevent lockout.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          <UserPlus size={16} />
          Add Administrator
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="alert alert-success" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* One-time Issued Credentials Banner */}
      {issuedCredentials && (
        <div className="neu-card" style={{ marginBottom: 22, border: '1.5px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} />
              Administrator Credentials Ready ({issuedCredentials.adminCode})
            </strong>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIssuedCredentials(null)}>
              Dismiss
            </button>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: 0 }}>
            Share these credentials privately with the authorized administrator. Passwords are stored salted and hashed and cannot be viewed again once dismissed:
          </p>
          <div className="neu-panel-inset" style={{ padding: 14, fontFamily: 'monospace', fontSize: '0.88rem', marginBottom: 12 }}>
            <div><strong>Admin Login URL:</strong> /admin/login</div>
            <div><strong>Name:</strong> {issuedCredentials.fullName} ({issuedCredentials.adminCode})</div>
            <div><strong>Username:</strong> {issuedCredentials.username}</div>
            <div><strong>Email:</strong> {issuedCredentials.email}</div>
            <div><strong>Temporary Password:</strong> {issuedCredentials.password}</div>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={copyCredentials}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied to Clipboard' : 'Copy Admin Credentials'}
          </button>
        </div>
      )}

      {/* Search & Status Filter */}
      <div className="neu-card-compact" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: '1 1 260px', position: 'relative' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="search"
            className="neu-input"
            style={{ paddingLeft: 38 }}
            placeholder="Search by admin name, email, username, or ADM code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="neu-select"
          style={{ width: 210 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="non_deleted">Active &amp; Deactivated</option>
          <option value="active">Active Only</option>
          <option value="deactivated">Deactivated Only</option>
          <option value="deleted">Archived / Deleted</option>
        </select>
      </div>

      {/* Administrators Table */}
      <div className="neu-table-surface">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Admin ID</th>
                <th>Administrator</th>
                <th>Username</th>
                <th>Role / Note</th>
                <th>Status</th>
                <th>Last Login (UTC)</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}>Loading administrators...</td></tr>
              ) : admins.length === 0 ? (
                <tr><td colSpan={7}>No administrator records match this filter.</td></tr>
              ) : (
                admins.map((adm) => {
                  const isSelf = adm.id === currentUser?.id;
                  return (
                    <tr key={adm.id}>
                      <td>
                        <strong>{adm.employeeCode}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {adm.fullName}
                          {isSelf && <span className="badge badge-info">You</span>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{adm.email}</div>
                      </td>
                      <td><code>{adm.username}</code></td>
                      <td>{adm.departmentNote || 'Administrator'}</td>
                      <td>
                        <span
                          className={`badge ${
                            adm.status === 'active'
                              ? 'badge-success'
                              : adm.status === 'deactivated'
                              ? 'badge-warn'
                              : 'badge-neutral'
                          }`}
                        >
                          {adm.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.84rem' }}>{adm.lastLoginAt || 'Never signed in'}</td>
                      <td style={{ textAlign: 'right' }}>
                        {adm.status !== 'deleted' && (
                          <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setEditTarget(adm);
                                setEditForm({
                                  fullName: adm.fullName,
                                  email: adm.email,
                                  username: adm.username,
                                  departmentNote: adm.departmentNote || '',
                                });
                              }}
                            >
                              <Edit3 size={14} /> Edit
                            </button>

                            {!isSelf && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    setResetTarget(adm);
                                    setResetPwd(generateRandomPassword());
                                  }}
                                >
                                  <KeyRound size={14} /> Reset Password
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleToggleStatus(adm)}
                                >
                                  {adm.status === 'active' ? (
                                    <><UserX size={14} /> Deactivate</>
                                  ) : (
                                    <><UserCheck size={14} /> Reactivate</>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => setDeleteTarget(adm)}
                                >
                                  <Trash2 size={14} /> Remove
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Administrator Modal */}
      {createOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: '1.28rem', margin: 0 }}>Add Authorized Administrator</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCreateOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateAdmin}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="neu-input"
                  placeholder="e.g., Ananya Rao"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    className="neu-input"
                    placeholder="admin2@aisquare.com"
                    value={form.email}
                    onChange={(e) => {
                      const nextEmail = e.target.value;
                      const suggestedUser =
                        !form.username && nextEmail.includes('@')
                          ? nextEmail
                              .split('@')[0]
                              .toLowerCase()
                              .replace(/[^a-z0-9._-]/g, '.')
                              .slice(0, 40)
                          : form.username;
                      setForm({ ...form, email: nextEmail, username: suggestedUser });
                    }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Username *</label>
                  <input
                    type="text"
                    className="neu-input"
                    placeholder="ananya.admin"
                    value={form.username}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        username: e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, '.')
                          .replace(/[^a-z0-9._-]/g, ''),
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Role / Responsibility Note</label>
                <input
                  type="text"
                  className="neu-input"
                  placeholder="e.g., Operations Admin / QA Lead"
                  value={form.departmentNote}
                  onChange={(e) => setForm({ ...form, departmentNote: e.target.value })}
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0 }}>Initial Temporary Password *</label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 9px', fontSize: '0.76rem' }}
                    onClick={() => setForm({ ...form, password: generateRandomPassword() })}
                  >
                    Generate Strong Password
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className="neu-input"
                    style={{ paddingRight: 42 }}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                    }}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', marginBottom: 18, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.mustChangePassword}
                  onChange={(e) => setForm({ ...form, mustChangePassword: e.target.checked })}
                />
                <span>Prompt this administrator to set a new password upon first sign-in</span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Provisioning...' : 'Create Administrator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Administrator Modal */}
      {editTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: '1.22rem', margin: 0 }}>Edit {editTarget.employeeCode}</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditTarget(null)}>
                <X size={16} />
              </button>
            </div>
            {error && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="neu-input"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    className="neu-input"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Username *</label>
                  <input
                    type="text"
                    className="neu-input"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value.toLowerCase() })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Role / Responsibility Note</label>
                <input
                  type="text"
                  className="neu-input"
                  value={editForm.departmentNote}
                  onChange={(e) => setEditForm({ ...editForm, departmentNote: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Admin Password Modal */}
      {resetTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <h2 style={{ fontSize: '1.22rem', marginBottom: 8 }}>
              Reset Password &mdash; {resetTarget.employeeCode}
            </h2>
            {error && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Active sessions for <strong>{resetTarget.fullName}</strong> will be immediately signed out.
            </p>
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">New Temporary Password *</label>
                <input
                  type="text"
                  className="neu-input"
                  value={resetPwd}
                  onChange={(e) => setResetPwd(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setResetTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Admin Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <h2 style={{ fontSize: '1.22rem', marginBottom: 8 }}>
              Remove Administrator &mdash; {deleteTarget.employeeCode}
            </h2>
            {error && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            <p style={{ fontSize: '0.9rem', color: 'var(--text-body)' }}>
              This revokes administrator access for <strong>{deleteTarget.fullName}</strong> immediately while preserving all historical audit logs.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDeleteAdmin}>
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
