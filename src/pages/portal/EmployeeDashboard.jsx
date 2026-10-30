import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ClipboardCheck,
  Award,
  CheckSquare,
  Megaphone,
  Bell,
  MessageSquarePlus,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

function readinessBadge(status) {
  if (status === 'approved') return <span className="badge badge-success">Approved / Ready</span>;
  if (status === 'pending_approval') return <span className="badge badge-info">Pending Sign-Off</span>;
  if (status === 'in_preparation') return <span className="badge badge-warn">In Preparation</span>;
  if (status === 'revoked') return <span className="badge badge-danger">Needs Recalibration</span>;
  return <span className="badge badge-neutral">Not Yet Approved</span>;
}

export default function EmployeeDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    apiRequest('/api/portal/overview')
      .then((res) => {
        setData(res);
        setError('');
      })
      .catch((err) => setError(err.message || 'Unable to load portal overview.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="neu-card">Loading your employee workspace...</div>;
  if (error) {
    return (
      <div className="alert alert-error" role="alert">
        <AlertCircle size={18} />
        <span>{error}</span>
      </div>
    );
  }

  const {
    profile,
    availableAssessments = [],
    recentReleasedResults = [],
    projectReadiness = [],
    recentAnnouncements = [],
    notifications = [],
    recentActivity = [],
    publishedGuidelinesCount = 0,
  } = data || {};

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Welcome, {profile?.fullName}</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            {profile?.employeeCode} &bull; {profile?.departmentNote || 'AI Evaluation Workforce'}
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Link to="/portal/guidelines" className="btn btn-secondary btn-sm">
            <BookOpen size={15} />
            Guideline Library ({publishedGuidelinesCount})
          </Link>
          <Link to="/portal/feedback" className="btn btn-secondary btn-sm">
            <MessageSquarePlus size={15} />
            Submit Feedback
          </Link>
        </div>
      </div>

      {/* Top Summary Row */}
      <div className="grid-4" style={{ marginBottom: 26 }}>
        <div className="neu-card-compact kpi-card animate-fade-up stagger-1">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>AVAILABLE ASSESSMENTS</span>
            <div className="kpi-icon-box"><ClipboardCheck size={17} /></div>
          </div>
          <div style={{ fontSize: '1.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 8px' }}>{availableAssessments.length}</div>
          <Link to="/portal/assessments" style={{ fontSize: '0.84rem', fontWeight: 600 }}>Open Assessments &rarr;</Link>
        </div>

        <div className="neu-card-compact kpi-card animate-fade-up stagger-2">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>RELEASED RESULTS</span>
            <div className="kpi-icon-box"><Award size={17} /></div>
          </div>
          <div style={{ fontSize: '1.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 8px' }}>{recentReleasedResults.length}</div>
          <Link to="/portal/results" style={{ fontSize: '0.84rem', fontWeight: 600 }}>View History &rarr;</Link>
        </div>

        <div className="neu-card-compact kpi-card animate-fade-up stagger-3">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>APPROVED PROJECTS</span>
            <div className="kpi-icon-box"><CheckSquare size={17} /></div>
          </div>
          <div style={{ fontSize: '1.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 8px' }}>
            {projectReadiness.filter((p) => p.readinessStatus === 'approved').length}
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}> / {projectReadiness.length}</span>
          </div>
          <Link to="/portal/readiness" style={{ fontSize: '0.84rem', fontWeight: 600 }}>Check Readiness &rarr;</Link>
        </div>

        <div className="neu-card-compact kpi-card animate-fade-up stagger-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>GUIDELINE LIBRARY</span>
            <div className="kpi-icon-box"><BookOpen size={17} /></div>
          </div>
          <div style={{ fontSize: '1.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 8px' }}>{publishedGuidelinesCount}</div>
          <Link to="/portal/guidelines" style={{ fontSize: '0.84rem', fontWeight: 600 }}>Browse Library &rarr;</Link>
        </div>
      </div>

      {/* Assessments & Released Results */}
      <div className="grid-2" style={{ marginBottom: 26 }}>
        <div className="neu-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Available Assessments</h2>
            <Link to="/portal/assessments" style={{ fontSize: '0.85rem', fontWeight: 600 }}>View All &rarr;</Link>
          </div>
          {availableAssessments.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No assessments are currently published for immediate taking.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {availableAssessments.map((a) => (
                <div key={a.id} className="neu-panel-inset" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{a.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {a.projectName || a.projectTaskRef || 'General'} &bull;{' '}
                      {a.isTimed ? `${a.timeLimitMinutes} min timed` : 'Untimed'}
                    </div>
                  </div>
                  <Link to="/portal/assessments" className="btn btn-primary btn-sm">
                    Open
                    <ArrowRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="neu-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Recent Released Results</h2>
            <Link to="/portal/results" style={{ fontSize: '0.85rem', fontWeight: 600 }}>All Results &rarr;</Link>
          </div>
          {recentReleasedResults.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No assessment results have been released yet. Submitted attempts appear here only after administrator review and release.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {recentReleasedResults.map((r) => (
                <div key={r.id} className="neu-panel-inset" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {r.assessmentTitle} (Attempt #{r.attemptNumber})
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Score: {r.finalScore}/{r.totalPossibleMarks} ({r.percentage}%)
                    </div>
                  </div>
                  {r.status === 'expired' ? (
                    <span className="badge badge-danger">Time Expired</span>
                  ) : r.passed ? (
                    <span className="badge badge-success">Passed</span>
                  ) : (
                    <span className="badge badge-warn">Did Not Pass</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project Readiness & Announcements */}
      <div className="grid-2" style={{ marginBottom: 26 }}>
        <div className="neu-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Project-Specific Readiness</h2>
            <Link to="/portal/readiness" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Details &rarr;</Link>
          </div>
          {projectReadiness.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No active client projects configured yet.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {projectReadiness.map((proj) => (
                <div key={proj.projectId} className="neu-panel-inset" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {proj.projectCode} &mdash; {proj.projectName}
                    </div>
                    {proj.domainCategory && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{proj.domainCategory}</div>
                    )}
                  </div>
                  {readinessBadge(proj.readinessStatus)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="neu-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Megaphone size={18} color="var(--accent-primary)" />
              Recent Announcements
            </h2>
            <Link to="/portal/announcements" style={{ fontSize: '0.85rem', fontWeight: 600 }}>All &rarr;</Link>
          </div>
          {recentAnnouncements.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No company-wide announcements published yet.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {recentAnnouncements.map((ann) => (
                <div key={ann.id} className="neu-panel-inset" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span className="badge badge-info">{ann.category}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{ann.publishedAt || ann.createdAt}</span>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{ann.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notifications & Recent Activity */}
      <div className="grid-2">
        <div className="neu-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: '1.12rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={18} color="var(--accent-primary)" />
              Notifications
            </h2>
            <Link to="/portal/notifications" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Open Center &rarr;</Link>
          </div>
          {notifications.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>No notifications yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {notifications.map((n) => (
                <div key={n.id} className="neu-panel-inset" style={{ padding: '10px 12px', fontSize: '0.86rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {!n.isRead && <span style={{ color: 'var(--accent-primary)', marginRight: 6 }}>&bull;</span>}
                    {n.title}
                  </div>
                  <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{n.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="neu-card">
          <h2 style={{ fontSize: '1.12rem', marginBottom: 12 }}>Your Recent Portal Activity</h2>
          {recentActivity.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>No recent events.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {recentActivity.slice(0, 5).map((ev) => (
                <div key={ev.id} className="neu-panel-inset" style={{ padding: '10px 12px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span><strong>{ev.eventType}</strong> &mdash; {ev.detail}</span>
                  <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{ev.createdAt}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
