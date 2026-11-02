import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Award,
  LogOut,
  KeyRound,
  Globe,
  Menu,
  X,
  AlertTriangle,
  Lock,
  Sun,
  Moon,
} from 'lucide-react';
import BrandLogo from './BrandLogo.jsx';
import { CosmicBrandMark } from './PublicNavbar.jsx';
import ChangePasswordModal from './ChangePasswordModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePortalTheme } from '../context/ThemeContext.jsx';
import { apiRequest } from '../utils/api.js';

function getInitials(name) {
  return String(name || 'CA')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export default function EmployeeLayout() {
  const { user, loading, logout } = useAuth();
  const { portalTheme, togglePortalTheme } = usePortalTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [activeAttempt, setActiveAttempt] = useState(null);

  const isCosmic = portalTheme === 'cosmic';

  const syncPortalStatus = useCallback(async () => {
    if (!user || user.role !== 'employee') return;
    try {
      const status = await apiRequest('/api/portal/status');
      setActiveAttempt(status.activeAttempt || null);
    } catch {
      // Ignore transient status fetch error while offline during an exam
    }
  }, [user]);

  useEffect(() => {
    if (user && user.role === 'employee') {
      syncPortalStatus();
      apiRequest('/api/portal/heartbeat', {
        method: 'POST',
        body: { path: location.pathname },
      }).catch(() => {});
    }
  }, [location.pathname, user, syncPortalStatus]);

  if (loading) {
    return (
      <div
        className={isCosmic ? 'cosmic-auth-stage' : ''}
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div className="neu-card-compact">Verifying candidate session...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (user.role !== 'employee') {
    return <Navigate to="/admin" replace />;
  }

  // Enforce active assessment navigation lock inside portal
  const expectedRunnerPath = activeAttempt ? `/portal/assessments/take/${activeAttempt.id}` : null;
  if (expectedRunnerPath && location.pathname !== expectedRunnerPath) {
    return <Navigate to={expectedRunnerPath} replace />;
  }

  const isExamsActive =
    location.pathname === '/portal' || location.pathname.startsWith('/portal/assessments');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={`portal-shell${isCosmic ? ' portal-theme-cosmic' : ''}`}>
      <aside className={`portal-sidebar${sidebarOpen ? ' open' : ''}`} aria-label="Candidate exam portal navigation">
        <div
          style={{
            padding: '4px 10px 18px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
            marginBottom: 8,
          }}
        >
          {isCosmic ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CosmicBrandMark size={22} />
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  color: '#9a9a9a',
                  paddingLeft: 32,
                }}
              >
                EXAM PORTAL
              </span>
            </div>
          ) : (
            <BrandLogo subtitle="EXAM PORTAL" compact />
          )}
        </div>

        {activeAttempt ? (
          <div className="neu-panel-inset" style={{ padding: 14, flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 8,
              }}
            >
              <Lock size={16} color="var(--accent-primary)" />
              Active Exam Lock
            </div>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
              Portal navigation is locked while your timed assessment is in progress. Submit your exam to return to Results.
            </p>
          </div>
        ) : (
          <nav style={{ flex: 1 }}>
            <div style={{ marginBottom: 6 }}>
              <div className="sidebar-section-label">Candidate Workspace</div>

              <Link
                to="/portal"
                onClick={() => setSidebarOpen(false)}
                className={`sidebar-nav-link${isExamsActive ? ' active' : ''}`}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <ClipboardCheck size={16} />
                  Assigned Exams
                </span>
              </Link>

              <NavLink
                to="/portal/results"
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <Award size={16} />
                  My Results
                </span>
              </NavLink>
            </div>
          </nav>
        )}

        <div
          style={{
            paddingTop: 14,
            borderTop: '1px solid rgba(148, 163, 184, 0.16)',
            display: 'grid',
            gap: 7,
          }}
        >
          {!activeAttempt && (
            <>
              <Link to="/" className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>
                <Globe size={15} />
                Public Website
              </Link>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => setPwdModalOpen(true)}
              >
                <KeyRound size={15} />
                Change Password
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn-danger btn-sm"
            style={{ justifyContent: 'flex-start' }}
            onClick={handleLogout}
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="portal-main">
        <header className="portal-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm portal-mobile-toggle"
              onClick={() => setSidebarOpen((p) => !p)}
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.96rem', color: 'var(--text-primary)' }}>
                {user.fullName}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Candidate ID: <strong>{user.employeeCode}</strong> &bull; {user.email}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="theme-switch-pill"
              onClick={togglePortalTheme}
              title={isCosmic ? 'Switch to Calm Cream Daylight Mode' : 'Switch to Obsidian Dark Mode'}
            >
              {isCosmic ? (
                <>
                  <Sun size={14} />
                  <span>Calm Cream</span>
                </>
              ) : (
                <>
                  <Moon size={14} />
                  <span>Obsidian Dark</span>
                </>
              )}
            </button>

            <div className="avatar-badge" aria-hidden="true">
              {getInitials(user.fullName)}
            </div>
          </div>
        </header>

        {user.mustChangePassword && !activeAttempt && (
          <div style={{ padding: '16px 28px 0' }}>
            <div className="alert alert-warn" style={{ marginBottom: 0, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={18} />
                <span>
                  Please update your temporary password before starting your exam.
                </span>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setPwdModalOpen(true)}>
                Update Password
              </button>
            </div>
          </div>
        )}

        <div className="portal-content">
          <div key={location.pathname} className="page-enter">
            <Outlet context={{ syncPortalStatus }} />
          </div>
        </div>
      </div>

      <ChangePasswordModal open={pwdModalOpen} onClose={() => setPwdModalOpen(false)} />
    </div>
  );
}
