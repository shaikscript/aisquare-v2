import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';

import PublicLayout from './components/PublicLayout.jsx';
import EmployeeLayout from './components/EmployeeLayout.jsx';
import AdminLayout from './components/AdminLayout.jsx';

import HomePage from './pages/public/HomePage.jsx';
import AboutPage from './pages/public/AboutPage.jsx';
import CareersPage from './pages/public/CareersPage.jsx';
import ContactPage from './pages/public/ContactPage.jsx';
import PrivacyPage from './pages/public/PrivacyPage.jsx';
import TermsPage from './pages/public/TermsPage.jsx';
import EmployeeLoginPage from './pages/public/EmployeeLoginPage.jsx';
import NotFoundPage from './pages/public/NotFoundPage.jsx';

import EmployeeDashboard from './pages/portal/EmployeeDashboard.jsx';
import EmployeeGuidelines from './pages/portal/EmployeeGuidelines.jsx';
import EmployeeAssessments from './pages/portal/EmployeeAssessments.jsx';
import EmployeeAssessmentRunner from './pages/portal/EmployeeAssessmentRunner.jsx';
import EmployeeResults from './pages/portal/EmployeeResults.jsx';
import EmployeeReadiness from './pages/portal/EmployeeReadiness.jsx';
import EmployeeAnnouncements from './pages/portal/EmployeeAnnouncements.jsx';
import EmployeeNotifications from './pages/portal/EmployeeNotifications.jsx';
import EmployeeFeedback from './pages/portal/EmployeeFeedback.jsx';

import AdminLoginPage from './pages/admin/AdminLoginPage.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminEmployees from './pages/admin/AdminEmployees.jsx';
import AdminManageAdmins from './pages/admin/AdminManageAdmins.jsx';
import AdminGuidelines from './pages/admin/AdminGuidelines.jsx';
import AdminAssessments from './pages/admin/AdminAssessments.jsx';
import AdminQuestionBank from './pages/admin/AdminQuestionBank.jsx';
import AdminResults from './pages/admin/AdminResults.jsx';
import AdminReadiness from './pages/admin/AdminReadiness.jsx';
import AdminApplications from './pages/admin/AdminApplications.jsx';
import AdminCompanyInfo from './pages/admin/AdminCompanyInfo.jsx';
import AdminAnnouncements from './pages/admin/AdminAnnouncements.jsx';
import AdminActivity from './pages/admin/AdminActivity.jsx';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Unexpected rendering error.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="neu-card" style={{ maxWidth: 540 }}>
            <h1 style={{ fontSize: '1.35rem', marginBottom: 8 }}>Interface Recovery Notice</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ScrollAndHashManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const targetId = hash.replace('#', '');
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}

/**
 * Zero-re-render 60fps cursor-tracking spotlight controller.
 * Updates --spot-x and --spot-y CSS custom properties on interactive cards & buttons.
 */
function GlobalSpotlightTracker() {
  useEffect(() => {
    let rafId = null;
    let lastEvent = null;

    const SELECTOR =
      '.neu-card, .neu-card-compact, .showcase-card-btn, .domain-stage-graphic, .btn-primary, .btn-hero-secondary, .btn-secondary';

    const updateSpotlight = () => {
      rafId = null;
      if (!lastEvent) return;
      const { clientX, clientY, target } = lastEvent;
      if (!target || typeof target.closest !== 'function') return;

      // Update closest interactive card and/or button under cursor
      const matchedCard = target.closest(
        '.neu-card, .neu-card-compact, .showcase-card-btn, .domain-stage-graphic'
      );
      if (matchedCard) {
        const rect = matchedCard.getBoundingClientRect();
        matchedCard.style.setProperty('--spot-x', `${Math.round(clientX - rect.left)}px`);
        matchedCard.style.setProperty('--spot-y', `${Math.round(clientY - rect.top)}px`);
      }

      const matchedBtn = target.closest('.btn-primary, .btn-hero-secondary, .btn-secondary');
      if (matchedBtn) {
        const bRect = matchedBtn.getBoundingClientRect();
        matchedBtn.style.setProperty('--spot-x', `${Math.round(clientX - bRect.left)}px`);
        matchedBtn.style.setProperty('--spot-y', `${Math.round(clientY - bRect.top)}px`);
      }
    };

    const onPointerMove = (e) => {
      lastEvent = e;
      if (rafId === null) {
        rafId = requestAnimationFrame(updateSpotlight);
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <ScrollAndHashManager />
            <GlobalSpotlightTracker />
            <Routes>
            {/* 1. Public Website Shell */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/services" element={<Navigate to="/#tracks" replace />} />
              <Route path="/careers" element={<CareersPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* 2. Standalone Aurora Split-Screen Auth Gateways */}
            <Route path="/login" element={<EmployeeLoginPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* 3. Protected Employee Portal (Employee Role Only) */}
            <Route path="/portal" element={<EmployeeLayout />}>
              <Route index element={<EmployeeDashboard />} />
              <Route path="guidelines" element={<EmployeeGuidelines />} />
              <Route path="assessments" element={<EmployeeAssessments />} />
              <Route path="assessments/take/:attemptId" element={<EmployeeAssessmentRunner />} />
              <Route path="results" element={<EmployeeResults />} />
              <Route path="readiness" element={<EmployeeReadiness />} />
              <Route path="announcements" element={<EmployeeAnnouncements />} />
              <Route path="notifications" element={<EmployeeNotifications />} />
              <Route path="feedback" element={<EmployeeFeedback />} />
            </Route>

            {/* 4. Protected Admin Portal (Admin Role Only) */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="employees" element={<AdminEmployees />} />
              <Route path="admins" element={<AdminManageAdmins />} />
              <Route path="guidelines" element={<AdminGuidelines />} />
              <Route path="assessments" element={<AdminAssessments />} />
              <Route path="question-bank" element={<AdminQuestionBank />} />
              <Route path="results" element={<AdminResults />} />
              <Route path="readiness" element={<AdminReadiness />} />
              <Route path="company-info" element={<AdminCompanyInfo />} />
              <Route path="applications" element={<AdminApplications />} />
              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="activity" element={<AdminActivity />} />
            </Route>
          </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
