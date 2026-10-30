import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Circle, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiRequest } from '../../utils/api.js';

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

export default function AdminLoginPage() {
  const { user, loading, loginAdmin, bootstrapInitialAdmin } = useAuth();
  const navigate = useNavigate();

  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsInitialAdmin, setNeedsInitialAdmin] = useState(false);

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);

  // First-run bootstrap fields (shown ONLY when 0 admin accounts exist in database)
  const [bootstrapToken, setBootstrapToken] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [confirmSetupPassword, setConfirmSetupPassword] = useState('');
  const [showSetupPwd, setShowSetupPwd] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/api/auth/setup-status')
      .then((res) => setNeedsInitialAdmin(Boolean(res.needsInitialAdmin)))
      .catch(() => setNeedsInitialAdmin(false))
      .finally(() => setCheckingSetup(false));
  }, []);

  if (!loading && user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await loginAdmin(identifier.trim(), password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message || 'Administrator authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBootstrap = async (e) => {
    e.preventDefault();
    setError('');

    if (setupPassword !== confirmSetupPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await bootstrapInitialAdmin({
        bootstrapToken: bootstrapToken.trim(),
        fullName: fullName.trim(),
        email: email.trim(),
        username: username.trim().toLowerCase(),
        password: setupPassword,
      });
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message || 'Initial administrator setup failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="aurora-auth-main">
      {/* Left Column — Pure Unfiltered Video + 3 Admin Control Phases */}
      <section className="aurora-left-hero" aria-label="Administrator control overview">
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
            <h2 className="aurora-hero-title">
              {needsInitialAdmin ? 'Activate Admin' : 'Admin Console'}
            </h2>
            <p className="aurora-hero-desc">
              {needsInitialAdmin
                ? 'Follow these 3 quick steps to initialize your primary administrator.'
                : 'Restricted workforce, rubric, assessment & career management.'}
            </p>
          </div>

          <div className="aurora-steps-stack">
            <AuroraStepItem
              number="1"
              text={needsInitialAdmin ? 'Verify server bootstrap token' : 'Authenticate admin identity'}
              active
              delay="0.42s"
            />
            <AuroraStepItem
              number="2"
              text={needsInitialAdmin ? 'Create primary admin profile' : 'Manage evaluators & guidelines'}
              delay="0.54s"
            />
            <AuroraStepItem
              number="3"
              text={needsInitialAdmin ? 'Launch management console' : 'Review assessments & careers'}
              delay="0.66s"
            />
          </div>
        </div>
      </section>

      {/* Right Column — Clean Black Sign-In / First-Run Setup Form */}
      <section className="aurora-right-form">
        <div className="aurora-form-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Link to="/" className="aurora-top-back">
              &larr; Public Website
            </Link>
            <Link to="/login" className="aurora-top-back">
              Employee Sign In &rarr;
            </Link>
          </div>

          {checkingSetup ? (
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.92rem' }}>
              Checking server authorization state...
            </div>
          ) : needsInitialAdmin ? (
            <>
              <div style={{ marginBottom: 22 }}>
                <h1 className="aurora-form-heading">Initialize Administrator</h1>
                <p className="aurora-form-sub">
                  One-time setup. Once created, this initialization screen locks permanently.
                </p>
              </div>

              {error && (
                <div className="aurora-alert aurora-alert-error" role="alert">
                  <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleBootstrap} className="aurora-fields" style={{ gap: 14 }}>
                <div className="aurora-input-group">
                  <label htmlFor="boot-token">One-Time Server Setup Token *</label>
                  <input
                    id="boot-token"
                    type="password"
                    className="aurora-input"
                    placeholder="Enter ADMIN_BOOTSTRAP_TOKEN"
                    value={bootstrapToken}
                    onChange={(e) => setBootstrapToken(e.target.value)}
                    required
                  />
                </div>

                <div className="aurora-grid-2">
                  <div className="aurora-input-group">
                    <label htmlFor="boot-name">Full Name *</label>
                    <input
                      id="boot-name"
                      type="text"
                      className="aurora-input"
                      placeholder="Shaik Kazim"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="aurora-input-group">
                    <label htmlFor="boot-user">Username (no @ or spaces) *</label>
                    <input
                      id="boot-user"
                      type="text"
                      className="aurora-input"
                      placeholder="aisquare.admin"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="aurora-input-group">
                  <label htmlFor="boot-email">Admin Email *</label>
                  <input
                    id="boot-email"
                    type="email"
                    className="aurora-input"
                    placeholder="admin@aisquare.it"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="aurora-grid-2">
                  <div className="aurora-input-group">
                    <label htmlFor="boot-pwd">Password *</label>
                    <div className="aurora-pwd-wrap">
                      <input
                        id="boot-pwd"
                        type={showSetupPwd ? 'text' : 'password'}
                        className="aurora-input"
                        style={{ paddingRight: 40 }}
                        placeholder="8+ chars (letters & numbers)"
                        value={setupPassword}
                        onChange={(e) => setSetupPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="aurora-eye-btn"
                        onClick={() => setShowSetupPwd((p) => !p)}
                        aria-label={showSetupPwd ? 'Hide password' : 'Show password'}
                      >
                        {showSetupPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="aurora-input-group">
                    <label htmlFor="boot-confirm">Confirm Password *</label>
                    <input
                      id="boot-confirm"
                      type={showSetupPwd ? 'text' : 'password'}
                      className="aurora-input"
                      placeholder="Re-enter password"
                      value={confirmSetupPassword}
                      onChange={(e) => setConfirmSetupPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="aurora-submit-btn"
                  disabled={submitting}
                >
                  {submitting ? 'Initializing...' : 'Create Primary Administrator & Sign In'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 26 }}>
                <h1 className="aurora-form-heading">Administrator Sign In</h1>
                <p className="aurora-form-sub">
                  Authorized management access only. Employee accounts sign in at the Evaluator Portal.
                </p>
              </div>

              {user && user.role === 'employee' && (
                <div className="aurora-alert aurora-alert-error" role="alert">
                  <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    You are currently signed in as an Employee ({user.employeeCode}). Sign in with
                    administrator credentials below to switch accounts.
                  </span>
                </div>
              )}

              {error && (
                <div className="aurora-alert aurora-alert-error" role="alert">
                  <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="aurora-fields">
                <div className="aurora-input-group">
                  <label htmlFor="adm-id">Admin Email or Username</label>
                  <input
                    id="adm-id"
                    type="text"
                    className="aurora-input"
                    placeholder="aisquare.admin or email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="aurora-input-group">
                  <label htmlFor="adm-pwd">Password</label>
                  <div className="aurora-pwd-wrap">
                    <input
                      id="adm-pwd"
                      type={showLoginPwd ? 'text' : 'password'}
                      className="aurora-input"
                      style={{ paddingRight: 44 }}
                      placeholder="Enter administrator password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="aurora-eye-btn"
                      onClick={() => setShowLoginPwd((p) => !p)}
                      aria-label={showLoginPwd ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  <span className="aurora-helper-text">
                    Requires authorized administrator privileges.
                  </span>
                </div>

                <button
                  type="submit"
                  className="aurora-submit-btn"
                  disabled={submitting}
                >
                  {submitting ? 'Verifying Credentials...' : 'Sign In to Admin Console'}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
