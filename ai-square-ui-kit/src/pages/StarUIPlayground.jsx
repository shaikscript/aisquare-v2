import React from 'react';
import MinimalStarfield from '../components/MinimalStarfield.jsx';
import { AccordionVariant } from '../components/AccordionVariant.jsx';
import { BorderTrailCard1 } from '../components/BorderTrailCard1.jsx';
import { AppleStyleDock } from '../components/AppleStyleDock.jsx';
import { ScrollProgressBasic3 } from '../components/ScrollProgressBasic3.jsx';

/**
 * StarUIPlayground — demo page combining the minimal star background
 * with all UI-kit components. Optional: use it to preview the kit,
 * e.g. add a route  <Route path="/ui-kit" element={<StarUIPlayground />} />
 * Safe to delete when not needed.
 */
export default function StarUIPlayground() {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: '#000000',
        color: '#ffffff',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <MinimalStarfield variant="ambient" />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 860,
          margin: '0 auto',
          padding: '48px 20px 140px',
          display: 'grid',
          gap: 36,
        }}
      >
        <header>
          <p style={{ letterSpacing: '0.18em', fontSize: 12, color: '#9a9a9a', margin: 0 }}>
            AI SQUARE • UI KIT
          </p>
          <h1 style={{ fontSize: 34, margin: '10px 0 6px' }}>Star Background + UI Components</h1>
          <p style={{ color: '#bdbdbd', margin: 0 }}>
            Minimal starfield with the Accordion, BorderTrail, ScrollProgress and Dock components.
          </p>
        </header>

        <section
          style={{
            background: 'rgba(255,255,255,0.94)',
            borderRadius: 16,
            padding: '18px 20px',
          }}
        >
          <AccordionVariant />
        </section>

        <section style={{ display: 'flex', justifyContent: 'center' }}>
          <BorderTrailCard1 />
        </section>

        <section
          style={{
            background: 'rgba(255,255,255,0.94)',
            borderRadius: 16,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <ScrollProgressBasic3 />
        </section>
      </div>

      <div style={{ position: 'fixed', inset: 0, zIndex: 3, pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto', position: 'absolute', inset: 0 }}>
          <AppleStyleDock />
        </div>
      </div>
    </div>
  );
}
