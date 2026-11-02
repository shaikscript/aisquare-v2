import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { VesperMarkSvg } from './BrandLogo.jsx';

export function CosmicBrandMark({ size = 22 }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        fontSize: '15.5px',
        fontWeight: 600,
        letterSpacing: '-0.03em',
        color: '#ffffff',
      }}
    >
      <VesperMarkSvg size={size} color="#ffffff" />
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
        <span>AI Square</span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#8a8a92',
          }}
        >
          IT Solutions
        </span>
      </span>
    </span>
  );
}

export default function PublicNavbar({ animateEntrance = false }) {
  const { user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.classList.add('vesper-menu-open');
    } else {
      document.body.classList.remove('vesper-menu-open');
    }
    return () => document.body.classList.remove('vesper-menu-open');
  }, [menuOpen]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 901) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);
  const isTracksHash = location.pathname === '/' && location.hash === '#tracks';

  return (
    <>
      <div
        className={`vesper-menu-backdrop${menuOpen ? ' open' : ''}`}
        onClick={closeMenu}
        aria-hidden="true"
      />
      <header className={`vesper-header${scrolled ? ' vesper-header--scrolled' : ''}`}>
        {/* Left — Clean Brand Mark + Wordmark (No '.it') */}
        <Link
          to="/"
          onClick={closeMenu}
          aria-label="AI Square IT Solutions Home"
          className={`vesper-logo${animateEntrance ? ' vesper-appear vesper-appear--scale' : ''}`}
          style={{ '--d': '0.08s' }}
        >
          <span className="vesper-logo-emblem">
            <VesperMarkSvg size={18} color="#ffffff" />
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
            <span>AI Square</span>
            <span className="vesper-logo-tag">IT Solutions</span>
          </span>
        </Link>

        {/* Center — Unified Frosted Metallic Navigation Dock */}
        <nav
          id="site-nav"
          aria-label="Primary"
          className={`vesper-nav${menuOpen ? ' open' : ''}`}
        >
          <div className="vesper-nav-dock">
            <NavLink
              to="/"
              end
              onClick={closeMenu}
              className={({ isActive }) =>
                `vesper-nav-pill${isActive && !isTracksHash ? ' active' : ''}${
                  animateEntrance ? ' vesper-appear vesper-appear--scale' : ''
                }`
              }
              style={{ '--d': '0.14s' }}
            >
              Overview
            </NavLink>

            <NavLink
              to="/about"
              onClick={closeMenu}
              className={({ isActive }) =>
                `vesper-nav-pill${isActive ? ' active' : ''}${
                  animateEntrance ? ' vesper-appear vesper-appear--scale' : ''
                }`
              }
              style={{ '--d': '0.22s' }}
            >
              Vision
            </NavLink>

            <Link
              to="/#tracks"
              onClick={closeMenu}
              className={`vesper-nav-pill${isTracksHash ? ' active' : ''}${
                animateEntrance ? ' vesper-appear vesper-appear--soft' : ''
              }`}
              style={{ '--d': '0.30s' }}
            >
              Evaluation Roles
            </Link>

            <NavLink
              to="/careers"
              onClick={closeMenu}
              className={({ isActive }) =>
                `vesper-nav-pill${isActive ? ' active' : ''}${
                  animateEntrance ? ' vesper-appear vesper-appear--scale' : ''
                }`
              }
              style={{ '--d': '0.38s' }}
            >
              Careers
            </NavLink>

            <NavLink
              to="/contact"
              onClick={closeMenu}
              className={({ isActive }) =>
                `vesper-nav-pill${isActive ? ' active' : ''}${
                  animateEntrance ? ' vesper-appear vesper-appear--scale' : ''
                }`
              }
              style={{ '--d': '0.46s' }}
            >
              Contact
            </NavLink>
          </div>

          <Link
            to={user ? (user.role === 'admin' ? '/admin' : '/portal') : '/login'}
            onClick={closeMenu}
            className="vesper-nav-pill vesper-mobile-only-link"
          >
            {user ? (user.role === 'admin' ? 'Admin Console' : 'Exam Portal') : 'Exam Portal'}
          </Link>
        </nav>

        {/* Right — Portal Sign-In + Apply CTA */}
        <div className="vesper-header-right">
          {user ? (
            <Link
              to={user.role === 'admin' ? '/admin' : '/portal'}
              className={`vesper-btn vesper-btn-ghost${
                animateEntrance ? ' vesper-appear vesper-appear--soft' : ''
              }`}
              style={{ '--d': '0.54s' }}
            >
              {user.role === 'admin' ? 'Admin Console' : 'Exam Portal'}
            </Link>
          ) : (
            <Link
              to="/login"
              className={`vesper-btn vesper-btn-ghost${
                animateEntrance ? ' vesper-appear vesper-appear--soft' : ''
              }`}
              style={{ '--d': '0.54s' }}
            >
              Exam Portal
            </Link>
          )}

          <Link
            to="/careers"
            className={`vesper-btn vesper-btn-solid${
              animateEntrance ? ' vesper-appear vesper-appear--scale' : ''
            }`}
            style={{ '--d': '0.64s' }}
          >
            <span>Apply Now</span>
            <ArrowUpRight size={14} style={{ marginLeft: 5 }} />
          </Link>

          <button
            type="button"
            className={`vesper-burger${menuOpen ? ' open' : ''}`}
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="site-nav"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>
    </>
  );
}
