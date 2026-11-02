import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Users, CheckCircle, ArrowUpRight, Sparkles } from 'lucide-react';
import { apiRequest } from '../../utils/api.js';
import { WORK_DOMAINS, DomainEmblem } from '../../components/DomainVisuals.jsx';
import { useScrollReveal } from '../../components/MinimalStarfield.jsx';

export default function AboutPage() {
  const rootRef = useRef(null);
  const [companyInfo, setCompanyInfo] = useState(null);

  useScrollReveal(rootRef);

  useEffect(() => {
    apiRequest('/api/public/info')
      .then((data) => setCompanyInfo(data))
      .catch(() => setCompanyInfo(null));
  }, []);

  return (
    <div ref={rootRef} style={{ padding: '44px 0 68px' }}>
      <div className="container">
        {/* Clean Editorial Vision Header */}
        <div
          className="neu-card scroll-reveal"
          style={{
            padding: '44px 38px',
            marginBottom: 32,
          }}
        >
          <div style={{ maxWidth: 740 }}>
            <div className="vesper-eyebrow-pill" style={{ marginBottom: 18 }}>
              <Sparkles size={13} />
              <span>Vision &amp; Methodology</span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(2.1rem, 3.8vw, 3.1rem)',
                fontWeight: 500,
                letterSpacing: '-0.04em',
                lineHeight: 1.1,
                marginBottom: 18,
                color: '#ffffff',
              }}
            >
              Human Precision for{' '}
              <em
                style={{
                  fontFamily: "'Instrument Serif', 'Times New Roman', serif",
                  fontStyle: 'italic',
                  fontWeight: 400,
                  color: '#9a9a9a',
                  fontSize: '1.08em',
                }}
              >
                Modern AI
              </em>{' '}
              Quality.
            </h1>

            <p style={{ fontSize: '1.02rem', color: '#d8d8d8', lineHeight: 1.68, marginBottom: 14 }}>
              AI Square IT Solutions builds and trains a focused community of human AI evaluators
              working across generative image and video grading, search relevance, online ads
              assessment, media discovery, speech transcription, and geospatial validation.
            </p>
            <p style={{ fontSize: '0.94rem', color: '#9a9a9a', lineHeight: 1.65, margin: 0 }}>
              Every evaluator prepares inside our dedicated workspace with version-controlled
              guidelines, scenario-based readiness assessments, and structured calibration across
              both desktop and mobile surfaces.
            </p>
          </div>
        </div>

        {/* Dynamic Mission & Vision (From Admin Company Info) */}
        {(companyInfo?.mission || companyInfo?.vision) && (
          <div className="grid-2 scroll-reveal" style={{ marginBottom: 30 }}>
            {companyInfo.mission && (
              <div className="neu-card">
                <span
                  style={{
                    fontSize: '0.74rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#9a9a9a',
                  }}
                >
                  Mission
                </span>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 500, margin: '6px 0 10px' }}>
                  Our Mission
                </h2>
                <p style={{ margin: 0, color: '#d8d8d8', lineHeight: 1.65 }}>
                  {companyInfo.mission}
                </p>
              </div>
            )}
            {companyInfo.vision && (
              <div className="neu-card">
                <span
                  style={{
                    fontSize: '0.74rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#9a9a9a',
                  }}
                >
                  Vision
                </span>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 500, margin: '6px 0 10px' }}>
                  Our Vision
                </h2>
                <p style={{ margin: 0, color: '#d8d8d8', lineHeight: 1.65 }}>
                  {companyInfo.vision}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Core Values (From Admin Company Info) */}
        {companyInfo?.values?.length > 0 && (
          <div className="neu-card scroll-reveal" style={{ marginBottom: 30 }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 500, marginBottom: 16 }}>
              Core Principles
            </h2>
            <div className="grid-2">
              {companyInfo.values.map((val, idx) => (
                <div
                  key={idx}
                  className="neu-panel-inset"
                  style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
                >
                  <CheckCircle size={17} color="#ffffff" style={{ flexShrink: 0, marginTop: 3 }} />
                  <span style={{ color: '#d8d8d8' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All 7 Evaluation Disciplines */}
        <div className="neu-card scroll-reveal" style={{ marginBottom: 30 }}>
          <div style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 500, marginBottom: 6 }}>
              Core Evaluation Disciplines
            </h2>
            <p style={{ margin: 0, color: '#9a9a9a', fontSize: '0.92rem' }}>
              Specialized human-in-the-loop roles spanning multimodal generation, search intent,
              speech prosody, and real-world spatial data.
            </p>
          </div>

          <div className="grid-2" style={{ gap: 16 }}>
            {WORK_DOMAINS.map((d) => (
              <div
                key={d.id}
                className="neu-panel-inset"
                style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px' }}
              >
                <DomainEmblem id={d.id} size={40} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: '#ffffff', fontSize: '0.98rem', marginBottom: 4 }}>
                    {d.title}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#9a9a9a', lineHeight: 1.55 }}>
                    {d.summary}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evaluator Experience Cards */}
        <div className="grid-2 scroll-reveal" style={{ marginBottom: 30 }}>
          <div className="neu-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Users size={20} color="#ffffff" />
              <h2 style={{ fontSize: '1.22rem', fontWeight: 500, margin: 0 }}>
                Dedicated Evaluator Workspace
              </h2>
            </div>
            <p style={{ color: '#9a9a9a', lineHeight: 1.65, margin: 0 }}>
              Onboarded evaluators access an organized portal containing project guidelines,
              practice scenarios, timed readiness assessments, and transparent progress tracking.
            </p>
          </div>

          <div className="neu-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <ShieldCheck size={20} color="#ffffff" />
              <h2 style={{ fontSize: '1.22rem', fontWeight: 500, margin: 0 }}>
                Rubric-First Calibration
              </h2>
            </div>
            <p style={{ color: '#9a9a9a', lineHeight: 1.65, margin: 0 }}>
              Reliable AI evaluation comes from objective adherence to well-crafted guidelines
              rather than guesswork — empowering detail-oriented contributors to deliver high-trust
              judgment.
            </p>
          </div>
        </div>

        {/* Career Invitation Banner */}
        <div
          className="neu-card scroll-reveal"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 18,
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 500 }}>
              Interested in Joining AI Square?
            </h3>
            <p style={{ margin: 0, color: '#9a9a9a', fontSize: '0.93rem' }}>
              Explore open evaluator positions or submit a general application with your resume.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link to="/careers" className="vesper-btn vesper-btn-solid">
              Explore Evaluator Careers
              <ArrowUpRight size={15} style={{ marginLeft: 6 }} />
            </Link>
            <Link to="/login" className="vesper-btn vesper-btn-ghost">
              Evaluator Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
