import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Search,
  History,
  FileText,
  BookOpen,
  Edit3,
  Eye,
  X,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { apiRequest, withSessionQuery } from '../../utils/api.js';

export default function AdminGuidelines() {
  const [guidelines, setGuidelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Create / Edit Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGuideline, setEditingGuideline] = useState(null);
  const [form, setForm] = useState({
    title: '',
    clientProjectTask: '',
    guidelineType: 'online',
    summary: '',
    contentBody: '',
    status: 'published',
    changeNote: '',
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // Version & Access Inspector Modal
  const [inspectorData, setInspectorData] = useState(null);
  const [previewVersion, setPreviewVersion] = useState(null);

  const loadGuidelines = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (projectFilter.trim()) params.set('project', projectFilter.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await apiRequest(`/api/admin/guidelines?${params.toString()}`);
      setGuidelines(res.guidelines || []);
    } catch (err) {
      setError(err.message || 'Unable to load guidelines.');
    } finally {
      setLoading(false);
    }
  }, [search, projectFilter, statusFilter]);

  useEffect(() => {
    loadGuidelines();
  }, [loadGuidelines]);

  const openCreateModal = () => {
    setEditingGuideline(null);
    setForm({
      title: '',
      clientProjectTask: '',
      guidelineType: 'online',
      summary: '',
      contentBody: '',
      status: 'published',
      changeNote: 'Initial version',
    });
    setPdfFile(null);
    setEditorOpen(true);
  };

  const openEditModal = async (gid) => {
    setError('');
    try {
      const res = await apiRequest(`/api/admin/guidelines/${gid}`);
      const g = res.guideline;
      setEditingGuideline(g);
      setForm({
        title: g.title,
        clientProjectTask: g.clientProjectTask,
        guidelineType: g.guidelineType,
        summary: g.summary || '',
        contentBody: g.contentBody || '',
        status: g.status,
        changeNote: '',
      });
      setPdfFile(null);
      setEditorOpen(true);
    } catch (err) {
      setError(err.message || 'Unable to load guideline details.');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('clientProjectTask', form.clientProjectTask);
      fd.append('guidelineType', form.guidelineType);
      fd.append('summary', form.summary);
      fd.append('contentBody', form.contentBody);
      fd.append('status', form.status);
      fd.append('changeNote', form.changeNote);
      if (pdfFile) fd.append('pdf', pdfFile);

      if (editingGuideline) {
        const res = await apiRequest(`/api/admin/guidelines/${editingGuideline.id}`, {
          method: 'PUT',
          body: fd,
        });
        setNotice(`Updated "${form.title}" to version v${res.currentVersion}.`);
      } else {
        await apiRequest('/api/admin/guidelines', {
          method: 'POST',
          body: fd,
        });
        setNotice(`Created guideline "${form.title}".`);
      }
      setEditorOpen(false);
      loadGuidelines();
    } catch (err) {
      setError(err.message || 'Unable to save guideline.');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (g) => {
    setError('');
    try {
      const nextStatus = g.status === 'published' ? 'unpublished' : 'published';
      await apiRequest(`/api/admin/guidelines/${g.id}/status`, {
        method: 'POST',
        body: { status: nextStatus },
      });
      setNotice(`Guideline "${g.title}" marked as ${nextStatus}.`);
      loadGuidelines();
    } catch (err) {
      setError(err.message || 'Unable to update guideline status.');
    }
  };

  const openInspector = async (gid) => {
    setError('');
    try {
      const res = await apiRequest(`/api/admin/guidelines/${gid}`);
      setInspectorData(res);
      setPreviewVersion(res.versions?.[0] || null);
    } catch (err) {
      setError(err.message || 'Unable to inspect guideline versions.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Guideline Library &amp; Versioning</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Upload PDF guidelines or author online reference docs, preserve version history, and inspect operational employee study access logs.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={16} />
          New Guideline
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="neu-card-compact" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: '1 1 220px', position: 'relative' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="search"
            className="neu-input"
            style={{ paddingLeft: 38 }}
            placeholder="Search guideline name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ flex: '1 1 220px' }}>
          <input
            type="search"
            className="neu-input"
            placeholder="Filter client / project / task..."
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          />
        </div>
        <select
          className="neu-select"
          style={{ width: 180 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="published">Published</option>
          <option value="unpublished">Unpublished</option>
        </select>
      </div>

      {/* Table */}
      <div className="neu-table-surface">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Guideline</th>
                <th>Client / Project / Task</th>
                <th>Format</th>
                <th>Version</th>
                <th>Status</th>
                <th>Employee Opens</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}>Loading guidelines...</td></tr>
              ) : guidelines.length === 0 ? (
                <tr><td colSpan={7}>No guidelines created yet.</td></tr>
              ) : (
                guidelines.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{g.title}</div>
                      {g.summary && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{g.summary}</div>}
                    </td>
                    <td><span className="badge badge-info">{g.clientProjectTask}</span></td>
                    <td>
                      {g.guidelineType === 'pdf' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><FileText size={14} /> PDF</span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><BookOpen size={14} /> Online</span>
                      )}
                    </td>
                    <td><strong>v{g.currentVersion}</strong></td>
                    <td>
                      <span className={`badge ${g.status === 'published' ? 'badge-success' : 'badge-neutral'}`}>
                        {g.status}
                      </span>
                    </td>
                    <td>{g.accessCount} opens</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openInspector(g.id)}>
                          <History size={14} /> Versions &amp; Logs
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditModal(g.id)}>
                          <Edit3 size={14} /> Edit / New Version
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => togglePublish(g)}>
                          {g.status === 'published' ? 'Unpublish' : 'Publish'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Guideline Modal */}
      {editorOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 680 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.3rem', margin: 0 }}>
                {editingGuideline ? `Update Guideline (Current v${editingGuideline.currentVersion})` : 'Create New Guideline'}
              </h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditorOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave}>
              <div className="grid-2" style={{ gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Guideline Title *</label>
                  <input
                    type="text"
                    className="neu-input"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Client / Project / Task *</label>
                  <input
                    type="text"
                    className="neu-input"
                    placeholder="e.g., Search Relevance — PRJ-101"
                    value={form.clientProjectTask}
                    onChange={(e) => setForm({ ...form, clientProjectTask: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Guideline Format *</label>
                  <select
                    className="neu-select"
                    value={form.guidelineType}
                    onChange={(e) => setForm({ ...form, guidelineType: e.target.value })}
                  >
                    <option value="online">Online Guideline Text</option>
                    <option value="pdf">PDF Document Upload</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Publication Status</label>
                  <select
                    className="neu-select"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="published">Published (Visible in Employee Library)</option>
                    <option value="unpublished">Unpublished (Hidden)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Short Summary</label>
                <input
                  type="text"
                  className="neu-input"
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                />
              </div>

              {form.guidelineType === 'online' ? (
                <div className="form-group">
                  <label className="form-label">Online Guideline Content *</label>
                  <textarea
                    className="neu-textarea"
                    style={{ minHeight: 200 }}
                    value={form.contentBody}
                    onChange={(e) => setForm({ ...form, contentBody: e.target.value })}
                    required
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">
                    {editingGuideline ? 'Upload Updated PDF (leave blank to retain current PDF)' : 'Upload PDF Guideline *'}
                  </label>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="neu-input"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    required={!editingGuideline}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Version Change Note</label>
                <input
                  type="text"
                  className="neu-input"
                  placeholder="Describe what changed in this version..."
                  value={form.changeNote}
                  onChange={(e) => setForm({ ...form, changeNote: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditorOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingGuideline ? 'Save as New Version' : 'Create Guideline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version History & Access Logs Modal */}
      {inspectorData && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 820 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', margin: 0 }}>{inspectorData.guideline.title}</h2>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  {inspectorData.guideline.clientProjectTask} &bull; Current Version v{inspectorData.guideline.currentVersion}
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setInspectorData(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="grid-2" style={{ gap: 18, marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: '0.96rem', marginBottom: 8 }}>Preserved Version History</h3>
                <div style={{ display: 'grid', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                  {inspectorData.versions.map((v) => (
                    <div
                      key={v.id}
                      className="neu-panel-inset"
                      style={{
                        padding: 10,
                        border: previewVersion?.id === v.id ? '1.5px solid var(--accent-primary)' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>Version v{v.versionNumber}</strong>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 9px', fontSize: '0.76rem' }}
                          onClick={() => setPreviewVersion(v)}
                        >
                          <Eye size={12} /> Inspect
                        </button>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {v.changeNote || 'No note'} &bull; {v.createdAt}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '0.96rem', marginBottom: 8 }}>
                  Version Content Preview {previewVersion ? `(v${previewVersion.versionNumber})` : ''}
                </h3>
                {previewVersion && (
                  <div className="neu-panel-inset" style={{ padding: 14, maxHeight: 260, overflowY: 'auto', fontSize: '0.86rem', whiteSpace: 'pre-wrap' }}>
                    {previewVersion.guidelineType === 'pdf' ? (
                      <div>
                        <p>Stored PDF: <strong>{previewVersion.pdfOriginalName}</strong></p>
                        <a
                          href={withSessionQuery(`/api/admin/guidelines/${inspectorData.guideline.id}/pdf?versionId=${previewVersion.id}`)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary btn-sm"
                        >
                          <ExternalLink size={14} /> Open Version v{previewVersion.versionNumber} PDF
                        </a>
                      </div>
                    ) : (
                      previewVersion.contentBody
                    )}
                  </div>
                )}
              </div>
            </div>

            <h3 style={{ fontSize: '0.96rem', marginBottom: 6 }}>
              Operational Employee Access &amp; Study Duration Logs
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: 10 }}>
              Note: Opening a guideline or recorded study-session duration reflects reference access only and does not prove comprehension.
            </p>
            {inspectorData.accessLogs.length === 0 ? (
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>No employee access events recorded yet.</p>
            ) : (
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'grid', gap: 6 }}>
                {inspectorData.accessLogs.map((log) => (
                  <div key={log.id} className="neu-panel-inset" style={{ padding: '8px 12px', fontSize: '0.84rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      <strong>{log.employeeCode} ({log.fullName})</strong> opened v{log.versionNumber}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Study session: {log.durationSeconds}s &bull; {log.openedAt} UTC
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
