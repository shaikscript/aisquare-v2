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

export default function CandidateLoginPage() {
  const { user, loading, loginCandidate } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  if (!loading && user) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.accountType === 'candidate') return <Navigate to="/exam-portal" replace />;
    return <Navigate to="/portal" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError('Please enter both your candidate username/email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await loginCandidate(identifier.trim(), password);
      navigate('/exam-portal', { replace: true });
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please verify the candidate credentials issued by Admin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="aurora-auth-main">
      {/* Left Column — Pure Unfiltered Video + 3 Candidate Screening Steps */}
      <section className="aurora-left-hero" aria-label="Candidate exam portal overview">
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
            <h2 className="aurora-hero-title">Candidate Exam Portal</h2>
            <p className="aurora-hero-desc">
              Complete your Admin-assigned aptitude &amp; AI evaluation screening exam.
            </p>
          </div>

          <div className="aurora-steps-stack">
            <AuroraStepItem
              number="1"
              text="Sign in with Admin-issued login"
              active
              delay="0.42s"
            />
            <AuroraStepItem
              number="2"
              text="Complete your assigned timed exam"
              delay="0.54s"
            />
            <AuroraStepItem
              number="3"
              text="View results released by Admin"
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
              Apply on Careers &rarr;
            </Link>
          </div>

          <div style={{ marginBottom: 28 }}>
            <h1 className="aurora-form-heading">Candidate Exam Sign In</h1>
            <p className="aurora-form-sub">
              Enter the exam credentials (<code>CND-xxxx</code>) issued by AI Square Administration to start your assigned exam or check released results.
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
              <label htmlFor="cand-id">Username or Email</label>
              <input
                id="cand-id"
                type="text"
                className="aurora-input"
                placeholder="candidate.username or email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="aurora-input-group">
              <label htmlFor="cand-pwd">Exam Password</label>
              <div className="aurora-pwd-wrap">
                <input
                  id="cand-pwd"
                  type={showPwd ? 'text' : 'password'}
                  className="aurora-input"
                  style={{ paddingRight: 44 }}
                  placeholder="Enter your issued password"
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
                Candidate logins and exam assignments are controlled exclusively by AI Square Administration.
              </span>
            </div>

            <button
              type="submit"
              className="aurora-submit-btn"
              disabled={submitting}
            >
              {submitting ? 'Signing In...' : 'Enter Exam Portal'}
            </button>
          </form>

          <div className="aurora-divider">
            <span>Other Portals</span>
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
              How do I get exam credentials?
            </button>

            <div style={{ display: 'flex', gap: 14 }}>
              <Link
                to="/login"
                style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}
              >
                Employee Portal &rarr;
              </Link>
              <Link
                to="/admin/login"
                style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem' }}
              >
                Admin &rarr;
              </Link>
            </div>
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
              Submit an application on our <Link to="/careers" style={{ color: '#ffffff', textDecoration: 'underline' }}>Careers page</Link>, or contact the AI Square recruitment team if you were invited directly.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
