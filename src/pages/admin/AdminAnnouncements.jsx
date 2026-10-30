import React, { useCallback, useEffect, useState } from 'react';
import {
  Megaphone,
  MessageSquare,
  Plus,
  Edit3,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

export default function AdminAnnouncements() {
  const [tab, setTab] = useState('announcements');
  const [announcements, setAnnouncements] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [fbFilter, setFbFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Announcement Modal
  const [annModal, setAnnModal] = useState(false);
  const [editingAnn, setEditingAnn] = useState(null);
  const [annForm, setAnnForm] = useState({
    title: '',
    category: 'General Update',
    body: '',
    status: 'published',
  });

  // Feedback Review Modal
  const [activeFb, setActiveFb] = useState(null);
  const [fbStatus, setFbStatus] = useState('Under Review');
  const [fbResponse, setFbResponse] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const fbQuery = fbFilter !== 'all' ? `?status=${encodeURIComponent(fbFilter)}` : '';
      const [annRes, fbRes] = await Promise.all([
        apiRequest('/api/admin/announcements'),
        apiRequest(`/api/admin/feedback${fbQuery}`),
      ]);
      setAnnouncements(annRes.announcements || []);
      setFeedback(fbRes.feedback || []);
    } catch (err) {
      setError(err.message || 'Unable to load announcements & feedback.');
    } finally {
      setLoading(false);
    }
  }, [fbFilter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSaveAnnouncement = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingAnn) {
        await apiRequest(`/api/admin/announcements/${editingAnn.id}`, {
          method: 'PUT',
          body: annForm,
        });
        setNotice('Announcement updated.');
      } else {
        await apiRequest('/api/admin/announcements', {
          method: 'POST',
          body: annForm,
        });
        setNotice('Announcement saved.');
      }
      setAnnModal(false);
      loadAll();
    } catch (err) {
      setError(err.message || 'Unable to save announcement.');
    }
  };

  const handleDeleteAnn = async (id) => {
    setError('');
    try {
      await apiRequest(`/api/admin/announcements/${id}`, { method: 'DELETE' });
      setNotice('Announcement deleted.');
      loadAll();
    } catch (err) {
      setError(err.message || 'Unable to delete announcement.');
    }
  };

  const handleUpdateFeedback = async (e) => {
    e.preventDefault();
    if (!activeFb) return;
    try {
      await apiRequest(`/api/admin/feedback/${activeFb.id}`, {
        method: 'PATCH',
        body: { status: fbStatus, adminResponse: fbResponse },
      });
      setNotice(`Updated feedback #${activeFb.id} status to "${fbStatus}".`);
      setActiveFb(null);
      loadAll();
    } catch (err) {
      setError(err.message || 'Unable to update feedback.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Announcements &amp; Employee Feedback</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Publish company-wide employee notices and review identified employee feedback (strictly separate from assessment scores and readiness).
          </p>
        </div>
        {tab === 'announcements' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingAnn(null);
              setAnnForm({ title: '', category: 'General Update', body: '', status: 'published' });
              setAnnModal(true);
            }}
          >
            <Plus size={16} /> New Announcement
          </button>
        )}
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={18} /><span>{error}</span></div>}
      {notice && <div className="alert alert-success"><CheckCircle2 size={18} /><span>{notice}</span></div>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'announcements' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('announcements')}
        >
          <Megaphone size={15} /> Company Announcements ({announcements.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'feedback' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('feedback')}
        >
          <MessageSquare size={15} /> Identified Employee Feedback ({feedback.length})
        </button>
      </div>

      {loading ? (
        <div className="neu-card">Loading records...</div>
      ) : tab === 'announcements' ? (
        <div style={{ display: 'grid', gap: 14 }}>
          {announcements.length === 0 ? (
            <div className="neu-card" style={{ color: 'var(--text-muted)' }}>No announcements created yet.</div>
          ) : (
            announcements.map((a) => (
              <div key={a.id} className="neu-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span className="badge badge-info">{a.category}</span>
                    <span className={`badge ${a.status === 'published' ? 'badge-success' : 'badge-neutral'}`}>{a.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditingAnn(a);
                        setAnnForm({ title: a.title, category: a.category, body: a.body, status: a.status });
                        setAnnModal(true);
                      }}
                    >
                      <Edit3 size={14} /> Edit
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteAnn(a.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <h2 style={{ fontSize: '1.22rem', marginBottom: 6 }}>{a.title}</h2>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem' }}>{a.body}</div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 14, display: 'flex', gap: 8 }}>
            {['all', 'New', 'Under Review', 'Addressed', 'Closed'].map((st) => (
              <button
                key={st}
                type="button"
                className={`btn btn-sm ${fbFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFbFilter(st)}
              >
                {st === 'all' ? 'All Statuses' : st}
              </button>
            ))}
          </div>

          <div className="neu-table-surface">
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Category</th>
                    <th>Subject &amp; Details</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {feedback.length === 0 ? (
                    <tr><td colSpan={6}>No employee feedback items found.</td></tr>
                  ) : (
                    feedback.map((fb) => (
                      <tr key={fb.id}>
                        <td><strong>{fb.employeeIdentity}</strong></td>
                        <td><span className="badge badge-info">{fb.category}</span></td>
                        <td style={{ maxWidth: 420 }}>
                          <div style={{ fontWeight: 700 }}>{fb.subject}</div>
                          <div style={{ fontSize: '0.84rem', color: 'var(--text-body)' }}>{fb.message}</div>
                          {fb.adminResponse && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: 4 }}>
                              Response: {fb.adminResponse}
                            </div>
                          )}
                        </td>
                        <td><span className="badge badge-neutral">{fb.status}</span></td>
                        <td style={{ fontSize: '0.82rem' }}>{fb.createdAt}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setActiveFb(fb);
                              setFbStatus(fb.status);
                              setFbResponse(fb.adminResponse || '');
                            }}
                          >
                            Review / Respond
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Announcement Modal */}
      {annModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 580 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
                {editingAnn ? 'Edit Announcement' : 'Create Company Announcement'}
              </h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAnnModal(false)}>
                <X size={16} />
              </button>
            </div>
            {error && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            <form onSubmit={handleSaveAnnouncement}>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="neu-select"
                    value={annForm.category}
                    onChange={(e) => setAnnForm({ ...annForm, category: e.target.value })}
                  >
                    <option value="General Update">General Update</option>
                    <option value="Guideline Notice">Guideline Notice</option>
                    <option value="Assessment Notice">Assessment Notice</option>
                    <option value="Project Operations">Project Operations</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Publication Status</label>
                  <select
                    className="neu-select"
                    value={annForm.status}
                    onChange={(e) => setAnnForm({ ...annForm, status: e.target.value })}
                  >
                    <option value="published">Published (Notify Active Employees)</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  type="text"
                  className="neu-input"
                  value={annForm.title}
                  onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Announcement Message *</label>
                <textarea
                  className="neu-textarea"
                  value={annForm.body}
                  onChange={(e) => setAnnForm({ ...annForm, body: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAnnModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Announcement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {activeFb && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 540 }}>
            <h2 style={{ fontSize: '1.22rem', marginBottom: 8 }}>Review Employee Feedback</h2>
            {error && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
              Submitted by <strong>{activeFb.employeeIdentity}</strong> ({activeFb.category})
            </p>
            <div className="neu-panel-inset" style={{ padding: 12, marginBottom: 14, fontSize: '0.9rem' }}>
              <strong>{activeFb.subject}</strong>
              <p style={{ margin: '6px 0 0', whiteSpace: 'pre-line' }}>{activeFb.message}</p>
            </div>
            <form onSubmit={handleUpdateFeedback}>
              <div className="form-group">
                <label className="form-label">Workflow Status</label>
                <select
                  className="neu-select"
                  value={fbStatus}
                  onChange={(e) => setFbStatus(e.target.value)}
                >
                  <option value="New">New</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Addressed">Addressed</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Management Response (Visible to Employee)</label>
                <textarea
                  className="neu-textarea"
                  value={fbResponse}
                  onChange={(e) => setFbResponse(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveFb(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Status &amp; Response</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
