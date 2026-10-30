import React, { useState } from 'react';
import { KeyRound, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiRequest } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ChangePasswordModal({ isOpen, onClose }) {
  const { refreshSession } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setSuccess(res.message || 'Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await refreshSession();
    } catch (err) {
      setError(err.message || 'Unable to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pwd-modal-title">
      <div className="modal-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 id="pwd-modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyRound size={20} color="var(--accent-primary)" />
            Update Account Password
          </h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success" role="status">
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="curr-pwd">Current Password</label>
            <input
              id="curr-pwd"
              type="password"
              className="neu-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="new-pwd">New Password</label>
            <input
              id="new-pwd"
              type="password"
              className="neu-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <span className="form-hint">Minimum 8 characters, including at least one letter and one number.</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="conf-pwd">Confirm New Password</label>
            <input
              id="conf-pwd"
              type="password"
              className="neu-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
