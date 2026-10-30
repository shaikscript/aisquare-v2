import React, { useCallback, useEffect, useState } from 'react';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const CATEGORIES = [
  'Guideline Problem',
  'Assessment Concern',
  'Portal Usability Issue',
  'Work-Preparation Difficulty',
  'Suggestion for Improvement',
];

export default function EmployeeFeedback() {
  const { user } = useAuth();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiRequest('/api/portal/feedback');
      setHistory(res.feedback || []);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const res = await apiRequest('/api/portal/feedback', {
        method: 'POST',
        body: { category, subject, message },
      });
      setSuccess(res.message);
      setSubject('');
      setMessage('');
      loadHistory();
    } catch (err) {
      setError(err.message || 'Unable to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Employee Feedback</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Report guideline clarifications, assessment concerns, or portal usability suggestions. Submissions are identified with your account ({user?.employeeCode}) and never affect your assessment scores or project readiness.
        </p>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="neu-card">
          <h2 style={{ fontSize: '1.22rem', marginBottom: 16 }}>Submit Identified Feedback</h2>

          {error && (
            <div className="alert alert-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="alert alert-success" role="status">
              <CheckCircle2 size={18} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="fb-cat">Category *</label>
              <select
                id="fb-cat"
                className="neu-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fb-subj">Subject *</label>
              <input
                id="fb-subj"
                type="text"
                className="neu-input"
                placeholder="Brief summary of the issue or suggestion"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="fb-msg">Details *</label>
              <textarea
                id="fb-msg"
                className="neu-textarea"
                placeholder="Provide clear context (e.g., guideline title, question number, or suggestion)..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <Send size={15} />
              {submitting ? 'Saving Feedback...' : 'Submit Feedback'}
            </button>
          </form>
        </div>

        {/* Employee's Own Feedback History */}
        <div className="neu-card">
          <h2 style={{ fontSize: '1.22rem', marginBottom: 14 }}>Your Submitted Feedback</h2>
          {history.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              You have not submitted any feedback items yet.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {history.map((item) => (
                <div key={item.id} className="neu-panel-inset" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <span className="badge badge-info">{item.category}</span>
                    <span className="badge badge-neutral">{item.status}</span>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.subject}</div>
                  <p style={{ margin: '6px 0', fontSize: '0.88rem', whiteSpace: 'pre-line' }}>
                    {item.message}
                  </p>
                  {item.adminResponse && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(148, 163, 184, 0.2)', fontSize: '0.85rem', color: 'var(--accent-primary)' }}>
                      <strong>Admin Response:</strong> {item.adminResponse}
                    </div>
                  )}
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Submitted {item.createdAt} UTC
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
