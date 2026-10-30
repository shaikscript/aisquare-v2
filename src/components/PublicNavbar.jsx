import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { VesperMarkSvg } from './BrandLogo.jsx';

export function CosmicBrandMark({ size = 22 }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        fontSize: '15.5px',
        fontWeight: 600,
        letterSpacing: '-0.03em',
        color: '#ffffff',
      }}
    >
      <VesperMarkSvg size={size} color="#ffffff" />
      <span>
        AI Square<span style={{ fontWeight: 400, color: '#9a9a9a' }}>.it</span>
      </span>
    </span>
  );
}

export default function PublicNavbar({ animateEntrance = false }) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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

  return (
    <>
      <div
        className={`vesper-menu-backdrop${menuOpen ? ' open' : ''}`}
        onClick={closeMenu}
        aria-hidden="true"
      />
      <header className="vesper-header">
        {/* Left — Vesper Mark + Wordmark */}
        <Link
          to="/"
          onClick={closeMenu}
          aria-label="AI Square Home"
          className={`vesper-logo${animateEntrance ? ' vesper-appear vesper-appear--scale' : ''}`}
          style={{ '--d': '0.08s' }}
        >
          <VesperMarkSvg size={22} color="currentColor" />
          <span>
            AI Square<span className="vesper-logo-suffix">.it</span>
          </span>
        </Link>

        {/* Center — Liquid-Metal Navigation Pills */}
        <nav
          id="site-nav"
          aria-label="Primary"
          className={`vesper-nav${menuOpen ? ' open' : ''}`}
        >
          <NavLink
            to="/about"
            onClick={closeMenu}
            className={({ isActive }) =>
              `vesper-nav-pill${isActive ? ' active' : ''}${
                animateEntrance ? ' vesper-appear vesper-appear--scale' : ''
              }`
            }
            style={{ '--d': '0.16s' }}
          >
            Vision
          </NavLink>

          <Link
            to="/#tracks"
            onClick={closeMenu}
            className={`vesper-nav-pill${animateEntrance ? ' vesper-appear vesper-appear--soft' : ''}`}
            style={{ '--d': '0.28s' }}
          >
            iOS &amp; Android Roles
          </Link>

          <NavLink
            to="/careers"
            onClick={closeMenu}
            className={({ isActive }) =>
              `vesper-nav-pill${isActive ? ' active' : ''}${
                animateEntrance ? ' vesper-appear vesper-appear--scale' : ''
              }`
            }
            style={{ '--d': '0.40s' }}
          >
            Careers
          </NavLink>

          <NavLink
            to="/contact"
            onClick={closeMenu}
            className={({ isActive }) =>
              `vesper-nav-pill${isActive ? ' active' : ''}${
                animateEntrance ? ' vesper-appear vesper-appear--soft' : ''
              }`
            }
            style={{ '--d': '0.52s' }}
          >
            Location &amp; Contact
          </NavLink>

          {!user && (
            <Link
              to="/login"
              onClick={closeMenu}
              className="vesper-nav-pill vesper-mobile-only-link"
            >
              Employee Sign In
            </Link>
          )}
        </nav>

        {/* Right — Metallic Ghost Login + Solid White Apply CTA + Burger */}
        <div
          className={`vesper-header-right${animateEntrance ? ' vesper-appear vesper-appear--scale' : ''}`}
          style={{ '--d': '0.34s' }}
        >
          {user ? (
            <Link
              to={user.role === 'admin' ? '/admin' : '/portal'}
              onClick={closeMenu}
              className="vesper-btn vesper-btn-solid"
            >
              {user.role === 'admin' ? 'Admin Console' : 'Evaluator Portal'}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                onClick={closeMenu}
                className="vesper-btn vesper-btn-ghost vesper-desktop-login"
              >
                Employee Login
              </Link>
              <Link
                to="/careers"
                onClick={closeMenu}
                className="vesper-btn vesper-btn-solid"
              >
                Apply Now
              </Link>
            </>
          )}

          <button
            type="button"
            className={`vesper-burger${menuOpen ? ' open' : ''}`}
            aria-controls="site-nav"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
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
