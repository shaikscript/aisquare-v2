import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Circle, Eye, EyeOff, AlertCircle, HelpCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const AURORA_VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4';

function AuroraStepItem({ number, text, active = false, delay = '0.25s' }) {
  return (
    <div
      className={`aurora-step-pill aurora-stagger-item${active ? ' active' : ''}`}
      style={{ '--ad': delay }}
    >
      <span className="aurora-step-num">{number}</span>
      <span className="aurora-step-label">{text}</span>
    </div>
  );
}

export default function EmployeeLoginPage() {
  const { user, loading, loginEmployee } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  if (!loading && user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/portal'} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError('Please enter both your email/username and password.');
      return;
    }

    setSubmitting(true);
    try {
      await loginEmployee(identifier.trim(), password);
      navigate('/portal', { replace: true });
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="aurora-auth-main">
      {/* Left Column — Pure Unfiltered Video + 3 Evaluator Workflow Steps (52% on lg) */}
      <section className="aurora-left-hero" aria-label="Evaluator workspace overview">
        <video
          className="aurora-bg-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          <source src={AURORA_VIDEO_URL} type="video/mp4" />
        </video>

        <div className="aurora-hero-inner">
          <Link
            to="/"
            className="aurora-brand-row aurora-stagger-item"
            style={{ '--ad': '0.18s', textDecoration: 'none' }}
          >
            <Circle size={18} fill="#ffffff" color="#ffffff" />
            <span>AI Square</span>
          </Link>

          <div className="aurora-stagger-item" style={{ '--ad': '0.30s', textAlign: 'center' }}>
            <h2 className="aurora-hero-title">Evaluator Space</h2>
            <p className="aurora-hero-desc">
              Follow these 3 structured phases inside your iOS &amp; Android AI workspace.
            </p>
          </div>

          <div className="aurora-steps-stack">
            <AuroraStepItem
              number="1"
              text="Sign in with your evaluator identity"
              active
              delay="0.42s"
            />
            <AuroraStepItem
              number="2"
              text="Calibrate on guidelines & rubrics"
              delay="0.54s"
            />
            <AuroraStepItem
              number="3"
              text="Complete assessments & readiness"
              delay="0.66s"
            />
          </div>
        </div>
      </section>

      {/* Right Column — Clean Black Sign-In Form */}
      <section className="aurora-right-form">
        <div className="aurora-form-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <Link to="/" className="aurora-top-back">
              &larr; Back to AI Square
            </Link>
            <Link to="/careers" className="aurora-top-back">
              Evaluator Careers &rarr;
            </Link>
          </div>

          <div style={{ marginBottom: 28 }}>
            <h1 className="aurora-form-heading">Employee Sign In</h1>
            <p className="aurora-form-sub">
              Input your administrator-issued evaluator details to enter your workspace.
            </p>
          </div>

          {error && (
            <div className="aurora-alert aurora-alert-error" role="alert">
              <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="aurora-fields">
            <div className="aurora-input-group">
              <label htmlFor="emp-id">Email or Username</label>
              <input
                id="emp-id"
                type="text"
                className="aurora-input"
                placeholder="evaluator@aisquare.it or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="aurora-input-group">
              <label htmlFor="emp-pwd">Password</label>
              <div className="aurora-pwd-wrap">
                <input
                  id="emp-pwd"
                  type={showPwd ? 'text' : 'password'}
                  className="aurora-input"
                  style={{ paddingRight: 44 }}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="aurora-eye-btn"
                  onClick={() => setShowPwd((p) => !p)}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <span className="aurora-helper-text">
                Accounts are provisioned privately by AI Square administrators.
              </span>
            </div>

            <button
              type="submit"
              className="aurora-submit-btn"
              disabled={submitting}
            >
              {submitting ? 'Signing In...' : 'Enter Evaluator Portal'}
            </button>
          </form>

          <div className="aurora-divider">
            <span>Workspace Access</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() => setShowHelp((prev) => !prev)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'rgba(255,255,255,0.55)',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <HelpCircle size={14} />
              Need password assistance?
            </button>

            <Link
              to="/admin/login"
              style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem' }}
            >
              Administrator Sign In &rarr;
            </Link>
          </div>

          {showHelp && (
            <div
              style={{
                marginTop: 14,
                padding: '12px 14px',
                borderRadius: 12,
                background: '#141416',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: '0.82rem',
                color: 'rgba(255,255,255,0.68)',
                lineHeight: 1.55,
              }}
            >
              Contact your AI Square Team Lead or Administrator to issue a temporary password reset.
              Looking to join? Apply on our <Link to="/careers" style={{ color: '#ffffff', textDecoration: 'underline' }}>Careers page</Link>.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
