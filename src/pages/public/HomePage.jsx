import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Layers, SlidersHorizontal, ShieldCheck } from 'lucide-react';
import PublicNavbar from '../../components/PublicNavbar.jsx';
import MinimalStarfield, { useScrollReveal } from '../../components/MinimalStarfield.jsx';
import { WORK_DOMAINS } from '../../components/DomainVisuals.jsx';

const VESPER_HERO_VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4';

const VISION_STEPS = [
  {
    step: '01',
    title: 'Guideline Calibration',
    body: 'Study structured, version-controlled rubrics inside the AI Square workspace before live grading.',
  },
  {
    step: '02',
    title: 'Readiness Verification',
    body: 'Complete practical scenario assessments that measure analytical judgment and attention to detail.',
  },
  {
    step: '03',
    title: 'Precision Evaluation',
    body: 'Shape safer, more accurate AI experiences through consistent human reasoning.',
  },
];

export default function HomePage() {
  const rootRef = useRef(null);

  useScrollReveal(rootRef);

  // Vesper one-time hero entrance cleanup + two-rAF safety fallback
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
    <div ref={rootRef} style={{ color: '#ffffff' }}>
      {/* =====================================================================
          1. VESPER HERO STAGE + CRISP NIGHT-SKY STARS
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

        {/* Crisp visible stars across the dark night sky of the Hero */}
        <MinimalStarfield variant="hero" />

        {/* Sticky / Floating Top Command Bar */}
        <PublicNavbar animateEntrance />

        <div className="vesper-page-grid">
          <div aria-hidden="true" style={{ height: 74 }} />

          {/* Bottom-Centered Hero Copy */}
          <div className="vesper-hero-stage">
            <div className="vesper-hero-copy">
              <div
                className="vesper-badge vesper-appear vesper-appear--pop"
                style={{ '--d': '0.22s' }}
              >
                <svg
                  className="vesper-badge-star"
                  width="17"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="#ffffff"
                  aria-hidden="true"
                >
                  <path d="M12 2.6C12.55 2.6 12.88 3.15 13.08 4.7c.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C3.15 12.88 2.6 12.55 2.6 12s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22C11.12 3.15 11.45 2.6 12 2.6Z" />
                </svg>
                <span>Human-in-the-Loop AI Quality</span>
              </div>

              <h1 className="vesper-h1">
                <span
                  className="vesper-headline-line vesper-appear vesper-appear--mask"
                  style={{ '--d': '0.42s' }}
                >
                  Human judgment behind
                </span>
                <span
                  className="vesper-headline-line vesper-appear vesper-appear--mask"
                  style={{ '--d': '0.62s' }}
                >
                  intelligent <em>AI systems.</em>
                </span>
              </h1>

              <p
                className="vesper-lede vesper-appear vesper-appear--soft"
                style={{ '--d': '0.82s', animationDuration: '1.25s' }}
              >
                Join AI Square&rsquo;s evaluator community — grading generative media, search
                relevance, voice synthesis, and spatial data with structured clarity.
              </p>

              <div className="vesper-hero-actions">
                <Link
                  to="/careers"
                  className="vesper-btn vesper-btn-solid vesper-btn-hero vesper-appear vesper-appear--btn"
                  style={{ '--d': '0.96s' }}
                >
                  Explore Careers
                  <ArrowUpRight size={15} style={{ marginLeft: 6 }} />
                </Link>
                <a
                  href="#tracks"
                  className="vesper-btn vesper-btn-hero-ghost vesper-btn-hero vesper-appear vesper-appear--side"
                  style={{ '--d': '1.10s' }}
                >
                  Evaluation Domains
                </a>
              </div>
            </div>
          </div>

          {/* Minimal 3-Pillar Bottom Strip */}
          <div className="vesper-stats-bar">
            <div
              className="vesper-stat vesper-appear vesper-appear--stat"
              style={{ '--d': '1.12s' }}
            >
              <Layers size={17} color="#ffffff" strokeWidth={1.65} />
              <span>7+ Evaluation Domains</span>
            </div>

            <div
              className="vesper-stat vesper-appear vesper-appear--stat"
              style={{ '--d': '1.28s' }}
            >
              <SlidersHorizontal size={17} color="#ffffff" strokeWidth={1.65} />
              <span>Structured Rubrics</span>
            </div>

            <div
              className="vesper-stat vesper-appear vesper-appear--stat"
              style={{ '--d': '1.44s' }}
            >
              <ShieldCheck size={17} color="#ffffff" strokeWidth={1.65} />
              <span>Dedicated Readiness Portal</span>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. MINIMAL EVALUATION DOMAINS (ZERO BADGES, CLEAN & BREATHABLE OVER STARS)
         ===================================================================== */}
      <section
        id="tracks"
        style={{
          padding: '96px 0 64px',
          borderTop: '1px solid rgba(255, 255, 255, 0.07)',
        }}
      >
        <div className="container">
          <div
            className="scroll-reveal"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 20,
              marginBottom: 42,
            }}
          >
            <div style={{ maxWidth: 540 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '0.73rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#8a8a94',
                  marginBottom: 10,
                }}
              >
                Domains
              </span>
              <h2 className="vesper-section-h2" style={{ marginBottom: 8 }}>
                Focused roles across <em>modern AI</em>
              </h2>
              <p style={{ margin: 0, color: '#8e8e98', fontSize: '0.94rem', lineHeight: 1.6 }}>
                Select any role to apply directly with your resume.
              </p>
            </div>

            <Link to="/careers" className="vesper-btn vesper-btn-ghost">
              View All Roles
              <ArrowUpRight size={14} style={{ marginLeft: 6 }} />
            </Link>
          </div>

          {/* Ultra-Minimal 2-Column / 4-Column Hairline Grid — No Badges, No Clutter */}
          <div className="vesper-minimal-domains">
            {WORK_DOMAINS.map((role, index) => {
              const Icon = role.Icon;
              return (
                <Link
                  key={role.id}
                  to={`/careers?track=${encodeURIComponent(role.title)}`}
                  className="vesper-minimal-domain-card scroll-reveal"
                  style={{ '--reveal-delay': `${(index % 4) * 55}ms` }}
                >
                  <div className="vesper-minimal-domain-top">
                    <span className="vesper-minimal-domain-icon">
                      <Icon size={17} strokeWidth={1.65} />
                    </span>
                    <ArrowUpRight
                      size={15}
                      className="vesper-minimal-domain-arrow"
                      aria-hidden="true"
                    />
                  </div>

                  <div>
                    <h3 className="vesper-minimal-domain-title">{role.title}</h3>
                    <p className="vesper-minimal-domain-desc">{role.summary}</p>
                  </div>
                </Link>
              );
            })}

            {/* Minimal 8th Card — "...and more" */}
            <Link
              to="/careers"
              className="vesper-minimal-domain-card vesper-minimal-domain-card--more scroll-reveal"
              style={{ '--reveal-delay': '165ms' }}
            >
              <div className="vesper-minimal-domain-top">
                <span
                  style={{
                    fontSize: '0.72rem',
                    letterSpacing: '0.09em',
                    textTransform: 'uppercase',
                    color: '#9a9aa4',
                  }}
                >
                  Open Intake
                </span>
                <ArrowUpRight
                  size={15}
                  className="vesper-minimal-domain-arrow"
                  aria-hidden="true"
                />
              </div>

              <div>
                <h3 className="vesper-minimal-domain-title">And More Emerging Tracks</h3>
                <p className="vesper-minimal-domain-desc">
                  Submit a general evaluator application to be matched with upcoming multimodal and
                  language cohorts.
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. MINIMAL 3-PILLAR VISION SECTION
         ===================================================================== */}
      <section style={{ padding: '24px 0 96px' }}>
        <div className="container">
          <div className="vesper-vision-panel scroll-reveal">
            <div style={{ maxWidth: 540, marginBottom: 28 }}>
              <span
                style={{
                  fontSize: '0.73rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#8a8a94',
                }}
              >
                Vision
              </span>
              <h2
                style={{
                  fontSize: 'clamp(1.5rem, 2.5vw, 2.05rem)',
                  fontWeight: 500,
                  letterSpacing: '-0.03em',
                  color: '#ffffff',
                  margin: '8px 0 0',
                }}
              >
                Clarity, Rubric Mastery &amp; Evaluator Growth
              </h2>
            </div>

            <div className="grid-3" style={{ gap: 18 }}>
              {VISION_STEPS.map((item) => (
                <div key={item.step} className="vesper-vision-step">
                  <div
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      letterSpacing: '0.08em',
                      color: '#7c7c86',
                      marginBottom: 8,
                    }}
                  >
                    {item.step}
                  </div>
                  <h3
                    style={{
                      fontSize: '1.02rem',
                      fontWeight: 500,
                      color: '#ffffff',
                      margin: '0 0 6px',
                    }}
                  >
                    {item.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.87rem', color: '#94949e', lineHeight: 1.6 }}>
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
