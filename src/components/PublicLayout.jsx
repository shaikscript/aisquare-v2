import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { MapPin, Mail, Phone, ExternalLink } from 'lucide-react';
import PublicNavbar, { CosmicBrandMark } from './PublicNavbar.jsx';
import MinimalStarfield from './MinimalStarfield.jsx';
import { WORK_DOMAINS } from './DomainVisuals.jsx';
import { apiRequest } from '../utils/api.js';
import { resolveCompanyMap } from '../utils/mapHelper.js';

export default function PublicLayout() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [publicInfo, setPublicInfo] = useState(null);

  useEffect(() => {
    const loadInfo = () => {
      apiRequest('/api/public/info')
        .then((res) => setPublicInfo(res))
        .catch(() => {});
    };
    loadInfo();
    window.addEventListener('aisquare:company-info-updated', loadInfo);
    return () => window.removeEventListener('aisquare:company-info-updated', loadInfo);
  }, []);

  const resolvedMap = resolveCompanyMap(
    publicInfo?.officeAddress,
    publicInfo?.mapLink,
    publicInfo?.mapLat,
    publicInfo?.mapLng
  );

  return (
    <div className="futuristic-public-shell">
      {/* Minimal ambient starfield across all public black backgrounds */}
      <MinimalStarfield variant="ambient" />
      <div className="vesper-grain" aria-hidden="true" />

      {/* Sticky top navbar on inner pages (on '/', PublicNavbar docks smoothly inside & past hero) */}
      {!isHome && <PublicNavbar />}

      <main style={{ flex: 1, position: 'relative', zIndex: 2 }}>
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      <footer className="public-footer" style={{ position: 'relative', zIndex: 2 }}>
        <div className="container">
          <div className="grid-4" style={{ marginBottom: 38, gap: 28 }}>
            <div>
              <CosmicBrandMark size={22} />
              <p
                style={{
                  marginTop: 14,
                  color: '#9a9a9a',
                  fontSize: '0.88rem',
                  lineHeight: 1.65,
                }}
              >
                Advancing AI reliability through structured human evaluation across generative
                media, search relevance, voice synthesis, and spatial intelligence.
              </p>

              {(resolvedMap || publicInfo?.contactEmail || publicInfo?.contactPhone) && (
                <div style={{ marginTop: 16, display: 'grid', gap: 9, fontSize: '0.84rem' }}>
                  {resolvedMap?.displayAddress && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        color: '#d8d8d8',
                      }}
                    >
                      <MapPin size={15} color="#ffffff" style={{ flexShrink: 0, marginTop: 3 }} />
                      <div>
                        <span style={{ whiteSpace: 'pre-line' }}>{resolvedMap.displayAddress}</span>
                        {resolvedMap.directionsUrl && (
                          <div style={{ marginTop: 4 }}>
                            <a
                              href={resolvedMap.directionsUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: '0.8rem',
                                color: '#ffffff',
                                fontWeight: 500,
                              }}
                            >
                              View on Google Maps <ExternalLink size={12} />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {!resolvedMap?.displayAddress && resolvedMap?.directionsUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MapPin size={15} color="#ffffff" style={{ flexShrink: 0 }} />
                      <a
                        href={resolvedMap.directionsUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          color: '#ffffff',
                          fontWeight: 500,
                        }}
                      >
                        Office Location on Google Maps <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                  {publicInfo?.contactEmail && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d8d8d8' }}>
                      <Mail size={14} color="#ffffff" style={{ flexShrink: 0 }} />
                      <a href={`mailto:${publicInfo.contactEmail}`} style={{ color: '#d8d8d8' }}>
                        {publicInfo.contactEmail}
                      </a>
                    </div>
                  )}
                  {publicInfo?.contactPhone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d8d8d8' }}>
                      <Phone size={14} color="#ffffff" style={{ flexShrink: 0 }} />
                      <a href={`tel:${publicInfo.contactPhone}`} style={{ color: '#d8d8d8' }}>
                        {publicInfo.contactPhone}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <h4
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#ffffff',
                  marginBottom: 14,
                }}
              >
                Evaluation Tracks
              </h4>
              <div style={{ display: 'grid', gap: 8, fontSize: '0.86rem' }}>
                {WORK_DOMAINS.slice(0, 5).map((d) => (
                  <Link
                    key={d.id}
                    to={`/careers?track=${encodeURIComponent(d.title)}`}
                    style={{ color: '#9a9a9a', textDecoration: 'none' }}
                  >
                    {d.title}
                  </Link>
                ))}
                <Link to="/#tracks" style={{ color: '#ffffff', fontSize: '0.82rem', marginTop: 2 }}>
                  View all 7+ tracks &rarr;
                </Link>
              </div>
            </div>

            <div>
              <h4
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#ffffff',
                  marginBottom: 14,
                }}
              >
                Company &amp; Careers
              </h4>
              <div style={{ display: 'grid', gap: 8, fontSize: '0.86rem' }}>
                <Link to="/about" style={{ color: '#9a9a9a' }}>
                  Vision &amp; Methodology
                </Link>
                <Link to="/careers" style={{ color: '#9a9a9a' }}>
                  Open Evaluator Roles
                </Link>
                <Link to="/contact" style={{ color: '#9a9a9a' }}>
                  Contact &amp; Location
                </Link>
                <Link to="/privacy" style={{ color: '#9a9a9a' }}>
                  Privacy Policy
                </Link>
                <Link to="/terms" style={{ color: '#9a9a9a' }}>
                  Terms of Service
                </Link>
              </div>
            </div>

            <div>
              <h4
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#ffffff',
                  marginBottom: 14,
                }}
              >
                Workspaces
              </h4>
              <div style={{ display: 'grid', gap: 10, fontSize: '0.86rem' }}>
                <Link to="/exam-login" style={{ color: '#ffffff', fontWeight: 500 }}>
                  Candidate Exam Portal
                </Link>
                <Link to="/login" style={{ color: '#d8d8d8' }}>
                  Employee Workforce Portal
                </Link>
                <Link to="/admin/login" style={{ color: '#9a9a9a' }}>
                  Administrator Console
                </Link>
                <div style={{ paddingTop: 6 }}>
                  <Link to="/careers" className="vesper-btn vesper-btn-solid" style={{ width: '100%' }}>
                    Apply as an Evaluator
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              paddingTop: 22,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: 12,
              fontSize: '0.8rem',
              color: '#7e7e86',
            }}
          >
            <span>&copy; {new Date().getFullYear()} AI Square IT Solutions. All rights reserved.</span>
            <span>Human-in-the-Loop AI Evaluation &bull; Evaluator Careers</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
