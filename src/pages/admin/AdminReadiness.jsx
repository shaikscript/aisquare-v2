import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Edit3,
  CheckSquare,
  History,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

export default function AdminReadiness() {
  const [tab, setTab] = useState('matrix');
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [matrix, setMatrix] = useState([]);
  const [history, setHistory] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Project Modal
  const [projModalOpen, setProjModalOpen] = useState(false);
  const [editingProj, setEditingProj] = useState(null);
  const [projForm, setProjForm] = useState({
    code: '',
    name: '',
    domainCategory: 'AI evaluation',
    description: '',
    approvalMode: 'manual',
    status: 'active',
    requiredAssessments: [],
  });

  // Manual Readiness Decision Modal
  const [decisionModal, setDecisionModal] = useState(null);
  const [decisionStatus, setDecisionStatus] = useState('approved');
  const [decisionReason, setDecisionReason] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [readRes, assRes] = await Promise.all([
        apiRequest('/api/admin/readiness'),
        apiRequest('/api/admin/assessments'),
      ]);
      setProjects(readRes.projects || []);
      setEmployees(readRes.employees || []);
      setMatrix(readRes.matrix || []);
      setHistory(readRes.history || []);
      setAssessments(assRes.assessments || []);
    } catch (err) {
      setError(err.message || 'Unable to load project readiness.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openCreateProject = () => {
    setEditingProj(null);
    setProjForm({
      code: '',
      name: '',
      domainCategory: 'AI evaluation',
      description: '',
      approvalMode: 'manual',
      status: 'active',
      requiredAssessments: [],
    });
    setProjModalOpen(true);
  };

  const openEditProject = (p) => {
    setEditingProj(p);
    setProjForm({
      code: p.code,
      name: p.name,
      domainCategory: p.domainCategory || 'AI evaluation',
      description: p.description || '',
      approvalMode: p.approvalMode || 'manual',
      status: p.status || 'active',
      requiredAssessments: (p.requiredAssessments || []).map((ra) => ({
        assessmentId: ra.assessmentId,
        minimumPercentage: ra.minimumPercentage ?? ra.passingPercentage,
      })),
    });
    setProjModalOpen(true);
  };

  const toggleRequiredAssessment = (a) => {
    setProjForm((prev) => {
      const exists = prev.requiredAssessments.some((x) => x.assessmentId === a.id);
      if (exists) {
        return {
          ...prev,
          requiredAssessments: prev.requiredAssessments.filter((x) => x.assessmentId !== a.id),
        };
      }
      return {
        ...prev,
        requiredAssessments: [
          ...prev.requiredAssessments,
          { assessmentId: a.id, minimumPercentage: a.passingPercentage || 80 },
        ],
      };
    });
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      if (editingProj) {
        await apiRequest(`/api/admin/projects/${editingProj.id}`, {
          method: 'PUT',
          body: projForm,
        });
        setNotice(`Project ${projForm.code} updated.`);
      } else {
        await apiRequest('/api/admin/projects', {
          method: 'POST',
          body: projForm,
        });
        setNotice(`Project ${projForm.code} created.`);
      }
      setProjModalOpen(false);
      loadAll();
    } catch (err) {
      setError(err.message || 'Unable to save project.');
    }
  };

  const handleSaveDecision = async (e) => {
    e.preventDefault();
    if (!decisionModal) return;
    setError('');
    try {
      await apiRequest('/api/admin/readiness/decision', {
        method: 'POST',
        body: {
          userId: decisionModal.userId,
          projectId: decisionModal.projectId,
          status: decisionStatus,
          reason: decisionReason,
        },
      });
      setNotice(`Updated readiness for ${decisionModal.fullName} on ${decisionModal.projectCode}.`);
      setDecisionModal(null);
      setDecisionReason('');
      loadAll();
    } catch (err) {
      setError(err.message || 'Unable to update readiness.');
    }
  };

  const getCellRecord = (userId, projectId) =>
    matrix.find((m) => m.userId === userId && m.projectId === projectId);

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Project-Specific Readiness Management</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Configure client projects, link required assessment thresholds, choose automatic vs. manual readiness approval per project, and manage per-employee readiness states.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateProject}>
          <Plus size={16} />
          Configure Project
        </button>
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={18} /><span>{error}</span></div>}
      {notice && <div className="alert alert-success"><CheckCircle2 size={18} /><span>{notice}</span></div>}

      {/* Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'matrix' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('matrix')}
        >
          <CheckSquare size={15} /> Employee &times; Project Matrix
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'projects' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('projects')}
        >
          Projects &amp; Approval Policies ({projects.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('history')}
        >
          <History size={15} /> Readiness Decision History ({history.length})
        </button>
      </div>

      {loading ? (
        <div className="neu-card">Loading project readiness...</div>
      ) : tab === 'matrix' ? (
        <div className="neu-table-surface">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  {projects.map((p) => (
                    <th key={p.id}>
                      <div>{p.code}</div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 500, textTransform: 'none' }}>
                        {p.approvalMode === 'automatic' ? 'Auto Policy' : 'Manual Sign-Off'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 || projects.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(2, projects.length + 1)}>
                      Configure at least one active project and active employee to populate the readiness matrix.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <strong>{emp.fullName}</strong>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{emp.employeeCode}</div>
                      </td>
                      {projects.map((proj) => {
                        const cell = getCellRecord(emp.id, proj.id);
                        const st = cell?.readinessStatus || 'not_ready';
                        return (
                          <td key={proj.id}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                              <span
                                className={`badge ${
                                  st === 'approved'
                                    ? 'badge-success'
                                    : st === 'pending_approval'
                                    ? 'badge-info'
                                    : st === 'in_preparation'
                                    ? 'badge-warn'
                                    : st === 'revoked'
                                    ? 'badge-danger'
                                    : 'badge-neutral'
                                }`}
                              >
                                {st}
                              </span>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                                onClick={() => {
                                  setDecisionModal({
                                    userId: emp.id,
                                    fullName: emp.fullName,
                                    projectId: proj.id,
                                    projectCode: proj.code,
                                  });
                                  setDecisionStatus(st === 'approved' ? 'revoked' : 'approved');
                                  setDecisionReason('');
                                }}
                              >
                                Set Status
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'projects' ? (
        <div className="grid-2">
          {projects.map((p) => (
            <div key={p.id} className="neu-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="badge badge-info">{p.code}</span>
                  <h2 style={{ fontSize: '1.22rem', margin: '6px 0 4px' }}>{p.name}</h2>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {p.domainCategory} &bull; Approval Policy:{' '}
                    <strong>{p.approvalMode === 'automatic' ? 'Automatic on Assessment Pass' : 'Manual Admin Approval'}</strong>
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditProject(p)}>
                  <Edit3 size={14} /> Edit
                </button>
              </div>
              {p.description && <p style={{ fontSize: '0.88rem', marginTop: 10 }}>{p.description}</p>}
              <div className="neu-panel-inset" style={{ marginTop: 12, padding: 12, fontSize: '0.84rem' }}>
                <strong>Required Assessments:</strong>
                {p.requiredAssessments?.length ? (
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {p.requiredAssessments.map((ra) => (
                      <li key={ra.assessmentId}>
                        {ra.title} (&ge; {ra.minimumPercentage ?? ra.passingPercentage}%)
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>No linked assessments (manual review only).</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="neu-table-surface">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>Employee</th>
                  <th>Project</th>
                  <th>Status Change</th>
                  <th>Decision Source</th>
                  <th>Actor</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={7}>No readiness decisions logged yet.</td></tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{h.createdAt}</td>
                      <td><strong>{h.employeeCode}</strong> &mdash; {h.fullName}</td>
                      <td>{h.projectCode}</td>
                      <td><code>{h.previousStatus}</code> &rarr; <strong>{h.newStatus}</strong></td>
                      <td><span className="badge badge-neutral">{h.decisionSource}</span></td>
                      <td>{h.decidedByIdentity}</td>
                      <td>{h.reason || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Project Modal */}
      {projModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
                {editingProj ? `Edit Project ${editingProj.code}` : 'Configure Client Project'}
              </h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setProjModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSaveProject}>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Project Code *</label>
                  <input
                    type="text"
                    className="neu-input"
                    placeholder="e.g., PRJ-101"
                    value={projForm.code}
                    onChange={(e) => setProjForm({ ...projForm, code: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Project / Workflow Name *</label>
                  <input
                    type="text"
                    className="neu-input"
                    placeholder="e.g., Search Relevance Calibration"
                    value={projForm.name}
                    onChange={(e) => setProjForm({ ...projForm, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Domain</label>
                  <select
                    className="neu-select"
                    value={projForm.domainCategory}
                    onChange={(e) => setProjForm({ ...projForm, domainCategory: e.target.value })}
                  >
                    <option value="AI evaluation">AI evaluation</option>
                    <option value="search quality evaluation">search quality evaluation</option>
                    <option value="AI response evaluation">AI response evaluation</option>
                    <option value="data annotation">data annotation</option>
                    <option value="content evaluation">content evaluation</option>
                    <option value="AI quality assurance">AI quality assurance</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Readiness Approval Mode *</label>
                  <select
                    className="neu-select"
                    value={projForm.approvalMode}
                    onChange={(e) => setProjForm({ ...projForm, approvalMode: e.target.value })}
                  >
                    <option value="manual">Manual Administrator Sign-Off</option>
                    <option value="automatic">Automatic Approval on Passing Required Assessments</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="neu-textarea"
                  style={{ minHeight: 70 }}
                  value={projForm.description}
                  onChange={(e) => setProjForm({ ...projForm, description: e.target.value })}
                />
              </div>

              <div className="neu-panel-inset" style={{ padding: 14, marginBottom: 16 }}>
                <strong style={{ fontSize: '0.88rem', display: 'block', marginBottom: 8 }}>
                  Required Assessments for Readiness:
                </strong>
                {assessments.length === 0 ? (
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>No assessments created yet.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 8, maxHeight: 160, overflowY: 'auto' }}>
                    {assessments.map((a) => {
                      const reqItem = projForm.requiredAssessments.find((x) => x.assessmentId === a.id);
                      return (
                        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={Boolean(reqItem)}
                              onChange={() => toggleRequiredAssessment(a)}
                            />
                            <span>{a.title}</span>
                          </label>
                          {reqItem && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>Min %:</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                className="neu-input"
                                style={{ width: 68, padding: '4px 8px' }}
                                value={reqItem.minimumPercentage}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setProjForm((prev) => ({
                                    ...prev,
                                    requiredAssessments: prev.requiredAssessments.map((item) =>
                                      item.assessmentId === a.id ? { ...item, minimumPercentage: val } : item
                                    ),
                                  }));
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setProjModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Project</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Readiness Decision Modal */}
      {decisionModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <h2 style={{ fontSize: '1.22rem', marginBottom: 10 }}>
              Set Project Readiness: {decisionModal.projectCode}
            </h2>
            {error && (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Employee: <strong>{decisionModal.fullName}</strong>. Applies strictly to{' '}
              <strong>{decisionModal.projectCode}</strong> and never affects other projects.
            </p>
            <form onSubmit={handleSaveDecision}>
              <div className="form-group">
                <label className="form-label">Readiness Status *</label>
                <select
                  className="neu-select"
                  value={decisionStatus}
                  onChange={(e) => setDecisionStatus(e.target.value)}
                >
                  <option value="approved">Approved (Project Ready)</option>
                  <option value="in_preparation">In Preparation</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="not_ready">Not Ready</option>
                  <option value="revoked">Revoked / Recalibration Required</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Decision Note / Reason *</label>
                <textarea
                  className="neu-textarea"
                  placeholder="Document rationale for audit and readiness history..."
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setDecisionModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Save Readiness Decision</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
