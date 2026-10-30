import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

function statusBadge(status) {
  if (status === 'approved') return <span className="badge badge-success">Approved &mdash; Project Ready</span>;
  if (status === 'pending_approval') return <span className="badge badge-info">Pending Manual Approval</span>;
  if (status === 'in_preparation') return <span className="badge badge-warn">In Preparation</span>;
  if (status === 'revoked') return <span className="badge badge-danger">Revoked / Needs Recalibration</span>;
  return <span className="badge badge-neutral">Not Yet Approved</span>;
}

export default function EmployeeReadiness() {
  const [projects, setProjects] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/api/portal/readiness')
      .then((res) => {
        setProjects(res.projects || []);
        setHistory(res.history || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Project-Specific Readiness</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Readiness is managed independently for each client project or workflow. Approval for one project does not automatically apply to other projects.
        </p>
      </div>

      {loading ? (
        <div className="neu-card">Loading project readiness...</div>
      ) : projects.length === 0 ? (
        <div className="neu-card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          No active client projects have been configured yet.
        </div>
      ) : (
        <div className="grid-2" style={{ marginBottom: 28 }}>
          {projects.map((p) => (
            <div key={p.projectId} className="neu-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                    {p.projectCode} {p.domainCategory ? `• ${p.domainCategory}` : ''}
                  </span>
                  <h2 style={{ fontSize: '1.22rem', margin: '4px 0 0' }}>{p.projectName}</h2>
                </div>
                {statusBadge(p.readinessStatus)}
              </div>

              {p.description && (
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                  {p.description}
                </p>
              )}

              <div className="neu-panel-inset" style={{ padding: 14 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                  Linked Assessment Requirements ({p.approvalMode === 'automatic' ? 'Auto-Approval Policy' : 'Manual Sign-Off Policy'})
                </div>
                {p.requiredAssessments.length === 0 ? (
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    Managed via direct administrator verification.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 6 }}>
                    {p.requiredAssessments.map((ra) => (
                      <div key={ra.assessmentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                        <span>{ra.title} (&ge; {ra.requiredPercentage}%)</span>
                        {ra.metRequirement ? (
                          <span style={{ color: 'var(--text-success-strong)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={14} /> Met ({ra.bestReleasedPercentage}%)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={14} /> Pending
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {p.notes && (
                <div style={{ marginTop: 12, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  <strong>Note:</strong> {p.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Personal Readiness Decision History */}
      <div className="neu-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <ShieldCheck size={19} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Your Readiness Decision History</h2>
        </div>
        {history.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No readiness status changes recorded yet.
          </p>
        ) : (
          <div className="neu-table-surface">
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date (UTC)</th>
                    <th>Project</th>
                    <th>Transition</th>
                    <th>Source</th>
                    <th>Reason / Note</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.84rem' }}>{h.createdAt}</td>
                      <td><strong>{h.projectCode}</strong> &mdash; {h.projectName}</td>
                      <td>
                        <code>{h.previousStatus}</code> &rarr; <strong>{h.newStatus}</strong>
                      </td>
                      <td><span className="badge badge-neutral">{h.decisionSource}</span></td>
                      <td>{h.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
