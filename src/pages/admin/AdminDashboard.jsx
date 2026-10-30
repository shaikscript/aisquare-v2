import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  BookOpen,
  ClipboardList,
  FileCheck2,
  CheckSquare,
  Briefcase,
  Mail,
  Megaphone,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  MapPin,
} from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest('/api/admin/overview');
      setData(res);
    } catch (err) {
      setError(err.message || 'Unable to load management overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  if (loading) return <div className="neu-card">Loading live management metrics...</div>;
  if (error) {
    return (
      <div className="alert alert-error" role="alert">
        <AlertCircle size={18} />
        <span>{error}</span>
      </div>
    );
  }

  const {
    employees,
    guidelines,
    assessments,
    readiness,
    careers,
    enquiries,
    recentFeedback = [],
    recentAnnouncements = [],
    recentAudit = [],
    recentEmployeeActivity = [],
  } = data;

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>Management Overview</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Real-time operational metrics calculated strictly from live database records across workforce, guidelines, assessments, readiness, recruitment, and feedback.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/admin/company-info" className="btn btn-primary btn-sm">
            <MapPin size={15} />
            Contact, Email &amp; Map Settings
          </Link>
          <Link to="/admin/admins" className="btn btn-secondary btn-sm">
            Manage Administrators ({data.admins?.active || 1})
          </Link>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadOverview}>
            <RefreshCw size={15} />
            Refresh Metrics
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (8 Live Cards across all modules) */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="neu-card-compact kpi-card animate-fade-up stagger-1">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>ACTIVE EMPLOYEES</span>
            <div className="kpi-icon-box"><Users size={17} /></div>
          </div>
          <div style={{ fontSize: '1.95rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{employees.active}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '6px 0 8px' }}>
            {employees.recentlyConnected} connected (15m) &bull; {employees.deactivated} deactivated
          </div>
          <Link to="/admin/employees" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Manage Workforce &rarr;</Link>
        </div>

        <div className="neu-card-compact kpi-card animate-fade-up stagger-2">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>PUBLISHED GUIDELINES</span>
            <div className="kpi-icon-box"><BookOpen size={17} /></div>
          </div>
          <div style={{ fontSize: '1.95rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{guidelines.published}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '6px 0 8px' }}>
            {guidelines.total} total guidelines stored
          </div>
          <Link to="/admin/guidelines" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Manage Library &rarr;</Link>
        </div>

        <div className="neu-card-compact kpi-card animate-fade-up stagger-3">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>ASSESSMENTS &amp; BANK</span>
            <div className="kpi-icon-box"><ClipboardList size={17} /></div>
          </div>
          <div style={{ fontSize: '1.95rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{assessments.published}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '6px 0 8px' }}>
            {assessments.reusableQuestions} reusable bank questions
          </div>
          <Link to="/admin/assessments" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Configure Assessments &rarr;</Link>
        </div>

        <div className="neu-card-compact kpi-card animate-fade-up stagger-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted)' }}>PENDING REVIEWS / RELEASE</span>
            <div className="kpi-icon-box"><FileCheck2 size={17} /></div>
          </div>
          <div style={{ fontSize: '1.95rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {assessments.pendingManualReviews} / {assessments.pendingRelease}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '6px 0 8px' }}>
            Manual grading / Unreleased results
          </div>
          <Link to="/admin/results" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Review &amp; Release &rarr;</Link>
        </div>
      </div>

      {/* Secondary Operational Row */}
      <div className="grid-4" style={{ marginBottom: 26 }}>
        <div className="neu-card-compact">
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
            ATTEMPT PERFORMANCE
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800 }}>
            {assessments.avgReleasedPercentage !== null ? `${assessments.avgReleasedPercentage}%` : '—'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {assessments.failedAttempts} failed &bull; {assessments.expiredAttempts} expired &bull; {assessments.interruptedAttempts} interrupted
          </div>
        </div>

        <div className="neu-card-compact">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>PROJECT READINESS</span>
            <CheckSquare size={17} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800 }}>{readiness.approvedAssignments}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Approved across {readiness.activeProjects} active projects ({readiness.pendingApprovals} pending)
          </div>
        </div>

        <div className="neu-card-compact">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>RECRUITMENT INTAKE</span>
            <Briefcase size={17} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800 }}>{careers.totalApplications}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {careers.newApplications} unreviewed &bull; {careers.publishedJobs} open roles
          </div>
        </div>

        <div className="neu-card-compact">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>PUBLIC ENQUIRIES</span>
            <Mail size={17} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800 }}>{enquiries.totalMessages}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {enquiries.unreadMessages} unread messages
          </div>
        </div>
      </div>

      {/* Announcements & Employee Feedback */}
      <div className="grid-2" style={{ marginBottom: 26 }}>
        <div className="neu-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: '1.12rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Megaphone size={18} color="var(--accent-primary)" />
              Recent Announcements
            </h2>
            <Link to="/admin/announcements" style={{ fontSize: '0.84rem', fontWeight: 600 }}>Manage &rarr;</Link>
          </div>
          {recentAnnouncements.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>No announcements posted yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {recentAnnouncements.map((a) => (
                <div key={a.id} className="neu-panel-inset" style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.86rem' }}>
                  <div>
                    <strong>{a.title}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.category}</div>
                  </div>
                  <span className={`badge ${a.status === 'published' ? 'badge-success' : 'badge-neutral'}`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="neu-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: '1.12rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={18} color="var(--accent-primary)" />
              Recent Employee Feedback
            </h2>
            <Link to="/admin/announcements" style={{ fontSize: '0.84rem', fontWeight: 600 }}>Review All &rarr;</Link>
          </div>
          {recentFeedback.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>No employee feedback submitted yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {recentFeedback.map((fb) => (
                <div key={fb.id} className="neu-panel-inset" style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.86rem' }}>
                  <div>
                    <strong>{fb.subject}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fb.employeeIdentity} &bull; {fb.category}</div>
                  </div>
                  <span className="badge badge-info">{fb.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Audit Logs & Employee Activity */}
      <div className="grid-2">
        <div className="neu-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: '1.12rem', margin: 0 }}>Recent Administrative Actions</h2>
            <Link to="/admin/activity" style={{ fontSize: '0.84rem', fontWeight: 600 }}>Full Audit Trail &rarr;</Link>
          </div>
          {recentAudit.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>No administrative actions recorded yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {recentAudit.map((item) => (
                <div key={item.id} className="neu-panel-inset" style={{ padding: '10px 12px', fontSize: '0.84rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{item.action}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{item.createdAt}</span>
                  </div>
                  <div style={{ color: 'var(--text-body)', marginTop: 2 }}>{item.summary}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="neu-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: '1.12rem', margin: 0 }}>Recent Employee Portal Events</h2>
            <Link to="/admin/activity" style={{ fontSize: '0.84rem', fontWeight: 600 }}>Activity Logs &rarr;</Link>
          </div>
          {recentEmployeeActivity.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>No employee portal events recorded yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {recentEmployeeActivity.map((ev) => (
                <div key={ev.id} className="neu-panel-inset" style={{ padding: '10px 12px', fontSize: '0.84rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{ev.userIdentity}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{ev.createdAt}</span>
                  </div>
                  <div style={{ color: 'var(--text-body)', marginTop: 2 }}>
                    <span className="badge badge-neutral" style={{ marginRight: 6 }}>{ev.eventType}</span>
                    {ev.detail}
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
