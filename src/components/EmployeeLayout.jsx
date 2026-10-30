import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  Award,
  CheckSquare,
  Megaphone,
  Bell,
  MessageSquarePlus,
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
  return String(name || 'EV')
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
  const [unreadCount, setUnreadCount] = useState(0);

  const isCosmic = portalTheme === 'cosmic';

  const syncPortalStatus = useCallback(async () => {
    if (!user || user.role !== 'employee') return;
    try {
      const status = await apiRequest('/api/portal/status');
      setActiveAttempt(status.activeAttempt || null);
      setUnreadCount(status.unreadNotifications || 0);
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
        <div className="neu-card-compact">Verifying employee session...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (user.role !== 'employee') {
    return <Navigate to="/admin" replace />;
  }

  // Enforce active assessment navigation lock inside portal (Section 6.5)
  const expectedRunnerPath = activeAttempt ? `/portal/assessments/take/${activeAttempt.id}` : null;
  if (expectedRunnerPath && location.pathname !== expectedRunnerPath) {
    return <Navigate to={expectedRunnerPath} replace />;
  }

  const navGroups = [
    {
      heading: 'Workspace',
      items: [
        { to: '/portal', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/portal/readiness', label: 'Project Readiness', icon: CheckSquare },
      ],
    },
    {
      heading: 'Preparation & Exams',
      items: [
        { to: '/portal/guidelines', label: 'Guideline Library', icon: BookOpen },
        { to: '/portal/assessments', label: 'Assessments', icon: ClipboardCheck },
        { to: '/portal/results', label: 'Released Results', icon: Award },
      ],
    },
    {
      heading: 'Updates & Support',
      items: [
        { to: '/portal/announcements', label: 'Announcements', icon: Megaphone },
        {
          to: '/portal/notifications',
          label: 'Notifications',
          icon: Bell,
          badge: unreadCount > 0 ? unreadCount : null,
        },
        { to: '/portal/feedback', label: 'Feedback', icon: MessageSquarePlus },
      ],
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={`portal-shell${isCosmic ? ' portal-theme-cosmic' : ''}`}>
      <aside className={`portal-sidebar${sidebarOpen ? ' open' : ''}`} aria-label="Employee portal navigation">
        <div
          style={{
            padding: '4px 10px 18px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
            marginBottom: 6,
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
                  paddingLeft: 31,
                }}
              >
                EMPLOYEE PORTAL
              </span>
            </div>
          ) : (
            <BrandLogo subtitle="EMPLOYEE PORTAL" compact />
          )}
        </div>

        {activeAttempt ? (
          <div className="neu-panel-inset" style={{ padding: 14, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              <Lock size={16} color="var(--accent-primary)" />
              Active Assessment Lock
            </div>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Normal portal navigation (including the Guideline Library) is restricted until you submit or complete your active assessment attempt.
            </p>
          </div>
        ) : (
          <nav style={{ flex: 1 }}>
            {navGroups.map((group) => (
              <div key={group.heading} style={{ marginBottom: 6 }}>
                <div className="sidebar-section-label">{group.heading}</div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                        <Icon size={16} />
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '2px 7px' }}>
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
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
              aria-label="Toggle employee sidebar"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="user-avatar-chip" aria-hidden="true">
              {getInitials(user.fullName)}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.94rem', lineHeight: 1.25 }}>
                {user.fullName}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {user.employeeCode} &bull; {user.email}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="theme-toggle-pill"
              onClick={togglePortalTheme}
              title={isCosmic ? 'Switch to Calm Cream Daylight mode' : 'Switch to Obsidian Dark mode'}
            >
              {isCosmic ? <Sun size={14} /> : <Moon size={14} />}
              <span>{isCosmic ? 'Calm Cream' : 'Obsidian Dark'}</span>
            </button>
            {activeAttempt ? (
              <span className="badge badge-warn">Assessment In Progress</span>
            ) : (
              <span className="badge badge-success">Active Evaluator</span>
            )}
          </div>
        </header>

        <div className="portal-content">
          {user.mustChangePassword && !activeAttempt && (
            <div className="alert alert-warn" role="alert">
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <span>
                  Your account is using an administrator-issued temporary password. Please update your password for account security.
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPwdModalOpen(true)}
                >
                  Set New Password
                </button>
              </div>
            </div>
          )}
          <div key={location.pathname} className="page-enter">
            <Outlet context={{ syncPortalStatus }} />
          </div>
        </div>
      </div>

      <ChangePasswordModal isOpen={pwdModalOpen} onClose={() => setPwdModalOpen(false)} />
    </div>
  );
}
