import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { MapPin, Mail, Phone, ExternalLink } from 'lucide-react';
import PublicNavbar, { CosmicBrandMark } from './PublicNavbar.jsx';
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
      <div className="vesper-grain" aria-hidden="true" />

      {/* On '/', PublicNavbar sits inside the 100vh Vesper hero frame */}
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
                Advancing iOS &amp; Android AI quality through structured human evaluation across
                generative media, search, ads, audio, and local maps.
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
                      <span>{publicInfo.contactPhone}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <h4
                style={{
                  fontSize: '0.73rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#9a9a9a',
                  marginBottom: 14,
                }}
              >
                iOS &amp; Android Tracks
              </h4>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'grid',
                  gap: 8,
                  fontSize: '0.86rem',
                }}
              >
                {WORK_DOMAINS.slice(0, 6).map((d) => (
                  <li key={d.id}>
                    <Link to="/#tracks" style={{ color: '#d8d8d8' }}>
                      {d.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4
                style={{
                  fontSize: '0.73rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#9a9a9a',
                  marginBottom: 14,
                }}
              >
                Explore
              </h4>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'grid',
                  gap: 8,
                  fontSize: '0.88rem',
                }}
              >
                <li>
                  <Link to="/" style={{ color: '#d8d8d8' }}>Home</Link>
                </li>
                <li>
                  <Link to="/about" style={{ color: '#d8d8d8' }}>Our Vision &amp; Roles</Link>
                </li>
                <li>
                  <Link to="/careers" style={{ color: '#d8d8d8' }}>Evaluator Careers</Link>
                </li>
                <li>
                  <Link to="/contact" style={{ color: '#d8d8d8' }}>Location &amp; Contact</Link>
                </li>
              </ul>
            </div>

            <div>
              <h4
                style={{
                  fontSize: '0.73rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#9a9a9a',
                  marginBottom: 14,
                }}
              >
                Portals &amp; Legal
              </h4>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'grid',
                  gap: 8,
                  fontSize: '0.88rem',
                }}
              >
                <li>
                  <Link to="/login" style={{ color: '#ffffff', fontWeight: 500 }}>
                    Employee Evaluator Login &rarr;
                  </Link>
                </li>
                <li>
                  <Link to="/admin/login" style={{ color: '#9a9a9a' }}>
                    Administrator Sign In
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" style={{ color: '#9a9a9a' }}>Privacy Policy</Link>
                </li>
                <li>
                  <Link to="/terms" style={{ color: '#9a9a9a' }}>Terms of Use</Link>
                </li>
              </ul>
            </div>
          </div>

          <div
            style={{
              paddingTop: 22,
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: 12,
              fontSize: '0.82rem',
              color: '#9a9a9a',
            }}
          >
            <span>&copy; {new Date().getFullYear()} AI Square IT Solutions. All rights reserved.</span>
            <span>iOS &amp; Android AI Evaluation &bull; Evaluator Careers</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
