import React, { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Shield,
  Briefcase,
  Activity,
  BookOpen,
  ClipboardList,
  Database,
  FileCheck2,
  CheckSquare,
  Megaphone,
  MapPin,
  Globe,
  KeyRound,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  Sun,
  Moon,
} from 'lucide-react';
import BrandLogo from './BrandLogo.jsx';
import { CosmicBrandMark } from './PublicNavbar.jsx';
import ChangePasswordModal from './ChangePasswordModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePortalTheme } from '../context/ThemeContext.jsx';

function getInitials(name) {
  return String(name || 'Admin')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const { portalTheme, togglePortalTheme } = usePortalTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);

  const isCosmic = portalTheme === 'cosmic';

  if (loading) {
    return (
      <div
        className={isCosmic ? 'cosmic-auth-stage' : ''}
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div className="neu-card-compact">Verifying administrator permissions...</div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  const navGroups = [
    {
      heading: 'Overview',
      items: [
        { to: '/admin', label: 'Management Overview', icon: LayoutDashboard, end: true },
      ],
    },
    {
      heading: 'Workforce & Access',
      items: [
        { to: '/admin/employees', label: 'Employees', icon: Users },
        { to: '/admin/admins', label: 'Administrators', icon: Shield },
        { to: '/admin/readiness', label: 'Project Readiness', icon: CheckSquare },
      ],
    },
    {
      heading: 'Training & Assessment',
      items: [
        { to: '/admin/guidelines', label: 'Guidelines', icon: BookOpen },
        { to: '/admin/assessments', label: 'Assessments', icon: ClipboardList },
        { to: '/admin/question-bank', label: 'Question Bank', icon: Database },
        { to: '/admin/results', label: 'Results & Review', icon: FileCheck2 },
      ],
    },
    {
      heading: 'Operations & Intake',
      items: [
        { to: '/admin/company-info', label: 'Contact, Map & Info', icon: MapPin },
        { to: '/admin/applications', label: 'Careers & Enquiries', icon: Briefcase },
        { to: '/admin/announcements', label: 'Announcements & Feedback', icon: Megaphone },
        { to: '/admin/activity', label: 'Audit & Activity Logs', icon: Activity },
      ],
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className={`portal-shell${isCosmic ? ' portal-theme-cosmic' : ''}`}>
      <aside className={`portal-sidebar${sidebarOpen ? ' open' : ''}`} aria-label="Admin portal navigation">
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
                ADMINISTRATION
              </span>
            </div>
          ) : (
            <BrandLogo subtitle="ADMINISTRATION" compact />
          )}
        </div>

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
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div
          style={{
            paddingTop: 14,
            borderTop: '1px solid rgba(148, 163, 184, 0.16)',
            display: 'grid',
            gap: 7,
          }}
        >
          <Link to="/" className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>
            <Globe size={15} />
            View Public Site
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
              aria-label="Toggle admin sidebar"
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
                {user.employeeCode} &bull; Authorized Administrator
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
            <span className="badge badge-info">Admin Workspace</span>
          </div>
        </header>

        <div className="portal-content">
          {user.mustChangePassword && (
            <div className="alert alert-warn" role="alert">
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <span>
                  Your administrator account is using a temporary password. Please update your password now.
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
            <Outlet />
          </div>
        </div>
      </div>

      <ChangePasswordModal isOpen={pwdModalOpen} onClose={() => setPwdModalOpen(false)} />
    </div>
  );
}
