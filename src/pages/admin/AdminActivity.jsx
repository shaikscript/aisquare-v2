import React, { useEffect, useState } from 'react';
import { ShieldCheck, Activity, Users, BookOpen, ClipboardCheck, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

export default function AdminActivity() {
  const [tab, setTab] = useState('audit');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/admin/activity');
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Audit Trail &amp; Honest Activity Monitoring</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Strictly distinguishes between administrative audit history, recent session connectivity, guideline reference sessions, and assessment attempt events without invasive surveillance.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={loadData}>
          <RefreshCw size={15} />
          Refresh Logs
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('audit')}
        >
          <ShieldCheck size={15} /> Admin Audit Trail
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'presence' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('presence')}
        >
          <Users size={15} /> Online / Portal Presence
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'guidelines' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('guidelines')}
        >
          <BookOpen size={15} /> Guideline Study Sessions
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'assessments' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('assessments')}
        >
          <ClipboardCheck size={15} /> Assessment &amp; Connection Events
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'events' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('events')}
        >
          <Activity size={15} /> General Portal Events
        </button>
      </div>

      {loading ? (
        <div className="neu-card">Loading logs...</div>
      ) : tab === 'audit' ? (
        <div className="neu-table-surface">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>Administrator</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Summary &amp; Before/After Snapshot</th>
                </tr>
              </thead>
              <tbody>
                {data?.auditLogs?.length ? (
                  data.auditLogs.map((l) => (
                    <tr key={l.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{l.createdAt}</td>
                      <td>{l.adminIdentity}</td>
                      <td><span className="badge badge-info">{l.action}</span></td>
                      <td>{l.entityType} #{l.entityId}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{l.summary}</div>
                        {(l.before || l.after) && (
                          <details style={{ marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            <summary style={{ cursor: 'pointer' }}>Inspect Before / After Values</summary>
                            <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>
                              {JSON.stringify({ before: l.before, after: l.after }, null, 2)}
                            </pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5}>No administrative actions recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'presence' ? (
        <div className="neu-table-surface">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Account Status</th>
                  <th>Connectivity (Last 15m)</th>
                  <th>Last Login (UTC)</th>
                  <th>Last Portal Interaction (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {data?.employeePresence?.length ? (
                  data.employeePresence.map((emp) => (
                    <tr key={emp.id}>
                      <td><strong>{emp.employeeCode}</strong> &mdash; {emp.fullName}</td>
                      <td><span className="badge badge-neutral">{emp.status}</span></td>
                      <td>
                        {emp.recentlyConnectedAt ? (
                          <span className="badge badge-success">Connected / Active Session</span>
                        ) : (
                          <span className="badge badge-neutral">Idle / Offline</span>
                        )}
                      </td>
                      <td>{emp.lastLoginAt || 'Never'}</td>
                      <td>{emp.lastActiveAt || 'Never'}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5}>No employee accounts registered yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'guidelines' ? (
        <div className="neu-table-surface">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Opened At (UTC)</th>
                  <th>Employee</th>
                  <th>Guideline</th>
                  <th>Version</th>
                  <th>Study Session Duration</th>
                </tr>
              </thead>
              <tbody>
                {data?.guidelineStudyLogs?.length ? (
                  data.guidelineStudyLogs.map((gl) => (
                    <tr key={gl.id}>
                      <td>{gl.openedAt}</td>
                      <td><strong>{gl.employeeCode}</strong> &mdash; {gl.fullName}</td>
                      <td>{gl.guidelineTitle}</td>
                      <td>v{gl.versionNumber}</td>
                      <td>{gl.durationSeconds}s (reference access only)</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5}>No guideline study sessions recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'assessments' ? (
        <div className="neu-table-surface">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>Employee</th>
                  <th>Assessment</th>
                  <th>Event</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {data?.assessmentActivityLogs?.length ? (
                  data.assessmentActivityLogs.map((ev) => (
                    <tr key={ev.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{ev.createdAt}</td>
                      <td><strong>{ev.employeeCode}</strong> &mdash; {ev.fullName}</td>
                      <td>{ev.assessmentTitle} (Attempt #{ev.attemptId})</td>
                      <td><span className="badge badge-info">{ev.eventType}</span></td>
                      <td>{ev.detail}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5}>No assessment events recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="neu-table-surface">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Event Type</th>
                  <th>Area</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {data?.portalActivity?.length ? (
                  data.portalActivity.map((ev) => (
                    <tr key={ev.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>{ev.createdAt}</td>
                      <td>{ev.userIdentity}</td>
                      <td><span className="badge badge-neutral">{ev.role}</span></td>
                      <td><span className="badge badge-info">{ev.eventType}</span></td>
                      <td>{ev.area}</td>
                      <td>{ev.detail}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6}>No portal events recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
