import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Smartphone, CheckCircle2 } from 'lucide-react';
import PublicNavbar from '../../components/PublicNavbar.jsx';
import { WORK_DOMAINS } from '../../components/DomainVisuals.jsx';

const VESPER_HERO_VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4';

const VISION_STEPS = [
  {
    step: '01',
    title: 'iOS & Android Rubric Calibration',
    body: 'Evaluators study structured, version-controlled project guidelines inside the AI Square workspace before grading live outputs.',
  },
  {
    step: '02',
    title: 'Practical Readiness Assessments',
    body: 'Scenario-based evaluations verify analytical judgment across generative media, search, audio, ads, and mobile maps.',
  },
  {
    step: '03',
    title: 'High-Precision Human Evaluation',
    body: 'Approved evaluators shape safer, more accurate mobile AI experiences with consistent human reasoning.',
  },
];

export default function HomePage() {
  const rootRef = useRef(null);

  // Vesper one-time entrance animation cleanup + two-rAF safety fallback (never auto-cycles)
  useEffect(() => {
    const scope = rootRef.current;
    if (!scope) return undefined;

    const els = Array.from(scope.querySelectorAll('.vesper-appear'));
    const cleanups = [];

    els.forEach((el) => {
      const onEnd = () => el.classList.add('is-in');
      el.addEventListener('animationend', onEnd, { once: true });
      cleanups.push(() => el.removeEventListener('animationend', onEnd));
    });

    let raf1 = null;
    let raf2 = null;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        els.forEach((el) => {
          if (typeof el.getAnimations === 'function') {
            const anims = el.getAnimations();
            const active = anims.some(
              (a) => a.playState === 'running' || a.playState === 'finished'
            );
            if (!active) el.classList.add('is-in');
          } else {
            el.classList.add('is-in');
          }
        });
      });
    });

    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <div ref={rootRef} style={{ backgroundColor: '#000000', color: '#ffffff' }}>
      {/* =====================================================================
          1. VESPER FULL-VIEWPORT HERO STAGE (100vh / 100dvh, PURE BLACK + VIDEO)
         ===================================================================== */}
      <div className="vesper-hero-frame" id="top">
        <video
          className="vesper-hero-video"
          src={VESPER_HERO_VIDEO_URL}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />

        <div className="vesper-page-grid">
          <PublicNavbar animateEntrance />

          {/* Bottom-Centered Vesper Hero Copy */}
          <div className="vesper-hero-stage">
            <div className="vesper-hero-copy">
              {/* Metallic Sparkle Badge */}
              <div
                className="vesper-badge vesper-appear vesper-appear--pop"
                style={{ '--d': '0.22s' }}
              >
                <svg
                  className="vesper-badge-star"
                  width="18"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="#ffffff"
                  aria-hidden="true"
                >
                  <path d="M12 2.6C12.55 2.6 12.88 3.15 13.08 4.7c.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C3.15 12.88 2.6 12.55 2.6 12s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22C11.12 3.15 11.45 2.6 12 2.6Z" />
                </svg>
                <span>iOS &amp; Android AI Evaluation</span>
              </div>

              {/* Two Masked Headline Lines (Inter 500 + Instrument Serif Italic #9a9a9a) */}
              <h1 className="vesper-h1">
                <span
                  className="vesper-headline-line vesper-appear vesper-appear--mask"
                  style={{ '--d': '0.42s' }}
                >
                  Shaping <em>AI evaluation</em> across
                </span>
                <span
                  className="vesper-headline-line vesper-appear vesper-appear--mask"
                  style={{ '--d': '0.62s' }}
                >
                  iOS &amp; Android.
                </span>
              </h1>

              {/* Lede */}
              <p
                className="vesper-lede vesper-appear vesper-appear--soft"
                style={{ '--d': '0.82s', animationDuration: '1.25s' }}
              >
                Join our specialized evaluator community grading generative image &amp; video,
                mobile search, ads, media, audio, and local maps with human precision.
              </p>

              {/* Hero Actions (Career & Vision Only — Zero Client Copy) */}
              <div className="vesper-hero-actions">
                <Link
                  to="/careers"
                  className="vesper-btn vesper-btn-solid vesper-btn-hero vesper-appear vesper-appear--btn"
                  style={{ '--d': '0.96s' }}
                >
                  Explore Evaluator Careers
                </Link>
                <a
                  href="#tracks"
                  className="vesper-btn vesper-btn-hero-ghost vesper-btn-hero vesper-appear vesper-appear--side"
                  style={{ '--d': '1.10s' }}
                >
                  View Evaluation Roles
                </a>
              </div>
            </div>
          </div>

          {/* Vesper 3-Pillar Bottom Strip (Exact Custom SVGs, Truthful AI Square Pillars) */}
          <div className="vesper-stats-bar">
            <div
              className="vesper-stat vesper-appear vesper-appear--stat"
              style={{ '--d': '1.12s' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <defs>
                  <linearGradient id="vp1" x1="3" y1="2" x2="14" y2="22" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
                    <stop offset="100%" stopColor="#3a3a3a" stopOpacity="0.62" />
                  </linearGradient>
                  <linearGradient id="vp2" x1="3" y1="2" x2="14" y2="22" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#3a3a3a" stopOpacity="0.38" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.62" />
                  </linearGradient>
                </defs>
                <rect x="3.4" y="2.6" width="7.2" height="18.8" rx="3.6" fill="url(#vp1)" />
                <rect x="13.4" y="2.6" width="7.2" height="18.8" rx="3.6" fill="url(#vp2)" />
                <rect x="9.2" y="10.9" width="5.6" height="2.2" rx="1.1" fill="#4a4a4a" />
              </svg>
              <span>iOS &amp; Android Ecosystem Focus</span>
            </div>

            <div
              className="vesper-stat vesper-appear vesper-appear--stat"
              style={{ '--d': '1.28s' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="2.4" y="2.4" width="19.2" height="19.2" rx="6.2" fill="#ffffff" />
                <path
                  d="M12 7.1v7.4M8.15 12.35L12 16.2l3.85-3.85"
                  fill="none"
                  stroke="#111111"
                  strokeWidth="1.85"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Generative, Search, Ads, Audio &amp; Maps</span>
            </div>

            <div
              className="vesper-stat vesper-appear vesper-appear--stat"
              style={{ '--d': '1.44s' }}
            >
              <svg
                className="vesper-stat-wide"
                width="38"
                height="21"
                viewBox="0 0 40 22"
                aria-hidden="true"
              >
                <circle cx="10.2" cy="11" r="9.2" fill="#2b2b2b" />
                <ellipse cx="10.2" cy="12.1" rx="4.15" ry="3.7" fill="#f4f4f4" />
                <circle cx="8.8" cy="11.8" r="0.7" fill="#1a1a1a" />
                <circle cx="11.6" cy="11.8" r="0.7" fill="#1a1a1a" />
                <circle cx="20.2" cy="11" r="9.2" fill="#ffffff" />
                <circle cx="17.6" cy="9.8" r="1.4" fill="#111111" />
                <circle cx="22.8" cy="9.8" r="1.4" fill="#111111" />
                <path
                  d="M17.4 13.6c1.4 1.5 4.2 1.5 5.6 0"
                  fill="none"
                  stroke="#111111"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <circle cx="30.2" cy="11" r="9.2" fill="#f26b1d" />
                <text
                  x="30.2"
                  y="15.1"
                  fontSize="12"
                  fontWeight="700"
                  fill="#ffffff"
                  textAnchor="middle"
                  fontFamily="Inter, sans-serif"
                >
                  A
                </text>
              </svg>
              <span>Structured Evaluator Readiness Portal</span>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. CLEAN STATIC BENTO GRID — 7+ iOS & ANDROID AI EVALUATION ROLES
             (Zero auto-cycling slideshows, zero client sales copy)
         ===================================================================== */}
      <section
        id="tracks"
        style={{
          padding: '88px 0 56px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: '#000000',
        }}
      >
        <div className="container">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 20,
              marginBottom: 42,
            }}
          >
            <div style={{ maxWidth: 640 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: '#141416',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  fontSize: '0.78rem',
                  color: '#d8d8d8',
                  marginBottom: 16,
                }}
              >
                <Smartphone size={14} />
                <span>iOS &amp; Android Evaluation Tracks</span>
              </div>
              <h2
                style={{
                  fontSize: 'clamp(1.9rem, 3.4vw, 2.75rem)',
                  fontWeight: 500,
                  letterSpacing: '-0.038em',
                  lineHeight: 1.12,
                  color: '#ffffff',
                  margin: '0 0 12px',
                }}
              >
                Where Human Judgment Meets{' '}
                <em
                  style={{
                    fontFamily: "'Instrument Serif', 'Times New Roman', serif",
                    fontStyle: 'italic',
                    fontWeight: 400,
                    color: '#9a9a9a',
                    fontSize: '1.08em',
                  }}
                >
                  Mobile AI
                </em>
              </h2>
              <p style={{ margin: 0, color: '#9a9a9a', fontSize: '0.98rem', lineHeight: 1.6 }}>
                Explore the core iOS and Android AI evaluation disciplines our evaluators work on
                every day — and apply directly to join upcoming cohorts.
              </p>
            </div>

            <Link to="/careers" className="vesper-btn vesper-btn-solid">
              Apply for Open Roles
              <ArrowUpRight size={15} style={{ marginLeft: 6 }} />
            </Link>
          </div>

          {/* 8-Card Clean Monochrome Bento Grid (7 Specializations + "And More..." Career Card) */}
          <div className="vesper-bento-grid">
            {WORK_DOMAINS.map((role) => {
              const Icon = role.Icon;
              return (
                <div key={role.id} className="vesper-role-card">
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 18,
                      }}
                    >
                      <span className="vesper-role-icon">
                        <Icon size={18} strokeWidth={1.75} />
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 500,
                          color: '#9a9a9a',
                          padding: '4px 9px',
                          borderRadius: 999,
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          background: 'rgba(255, 255, 255, 0.03)',
                        }}
                      >
                        {role.platform}
                      </span>
                    </div>

                    <h3
                      style={{
                        fontSize: '1.12rem',
                        fontWeight: 500,
                        letterSpacing: '-0.02em',
                        color: '#ffffff',
                        margin: '0 0 8px',
                      }}
                    >
                      {role.title}
                    </h3>

                    <p
                      style={{
                        margin: '0 0 16px',
                        fontSize: '0.88rem',
                        color: '#9a9a9a',
                        lineHeight: 1.6,
                      }}
                    >
                      {role.summary}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gap: 7, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    {role.highlights.slice(0, 2).map((pt) => (
                      <div
                        key={pt}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: '0.8rem',
                          color: '#d8d8d8',
                        }}
                      >
                        <CheckCircle2 size={13} color="#9a9a9a" style={{ flexShrink: 0 }} />
                        <span>{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* 8th Card — "...and More Specialized Mobile AI Tracks" Career Card */}
            <Link
              to="/careers"
              className="vesper-role-card vesper-role-card--cta"
              style={{ textDecoration: 'none' }}
            >
              <div>
                <div
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#9a9a9a',
                    marginBottom: 14,
                  }}
                >
                  Open Evaluator Intake
                </div>
                <h3
                  style={{
                    fontSize: '1.32rem',
                    fontWeight: 500,
                    letterSpacing: '-0.025em',
                    color: '#ffffff',
                    margin: '0 0 10px',
                  }}
                >
                  &hellip;and more iOS &amp; Android AI roles.
                </h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#9a9a9a', lineHeight: 1.6 }}>
                  From multimodal assistant grading to regional language evaluation — submit your
                  application and resume to join AI Square.
                </p>
              </div>

              <div style={{ marginTop: 22 }}>
                <span className="vesper-btn vesper-btn-solid" style={{ width: '100%' }}>
                  View Open Positions &amp; Apply
                  <ArrowUpRight size={15} style={{ marginLeft: 6 }} />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. OUR VISION — 3 CLEAN PILLARS (HOW EVALUATORS GROW AT AI SQUARE)
         ===================================================================== */}
      <section
        style={{
          padding: '44px 0 84px',
          background: '#000000',
        }}
      >
        <div className="container">
          <div
            style={{
              padding: '38px 34px',
              borderRadius: 18,
              background: '#0a0a0c',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ maxWidth: 620, marginBottom: 30 }}>
              <span style={{ fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9a9a9a' }}>
                Our Vision
              </span>
              <h2
                style={{
                  fontSize: 'clamp(1.55rem, 2.6vw, 2.15rem)',
                  fontWeight: 500,
                  letterSpacing: '-0.03em',
                  color: '#ffffff',
                  margin: '8px 0 0',
                }}
              >
                Built for Clarity, Rubric Mastery &amp; Evaluator Growth
              </h2>
            </div>

            <div className="grid-3" style={{ gap: 22 }}>
              {VISION_STEPS.map((item) => (
                <div
                  key={item.step}
                  style={{
                    padding: '22px',
                    borderRadius: 12,
                    background: '#111114',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      color: '#9a9a9a',
                      marginBottom: 10,
                    }}
                  >
                    PHASE {item.step}
                  </div>
                  <h3
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 500,
                      color: '#ffffff',
                      margin: '0 0 8px',
                    }}
                  >
                    {item.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#9a9a9a', lineHeight: 1.6 }}>
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
