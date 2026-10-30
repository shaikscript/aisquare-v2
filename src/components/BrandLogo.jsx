import React from 'react';

export function VesperMarkSvg({ size = 22, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <g transform="rotate(-30 12 12)">
        <circle cx="7.3" cy="3.2" r="1.45" />
        <rect x="5.5" y="4.7" width="3.6" height="14.6" rx="1.8" />
        <rect x="14.9" y="4.7" width="3.6" height="14.6" rx="1.8" />
        <circle cx="16.7" cy="20.8" r="1.45" />
      </g>
    </svg>
  );
}

export default function BrandLogo({ subtitle = 'EVALUATION WORKSPACE', compact = false }) {
  const boxSize = compact ? 34 : 40;

  return (
    <div
      className="brand-logo-wrap"
      style={{ display: 'inline-flex', alignItems: 'center', gap: compact ? 10 : 12 }}
    >
      <div
        className="brand-emblem-shell"
        aria-hidden="true"
        style={{
          width: boxSize,
          height: boxSize,
          borderRadius: compact ? 9 : 11,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0D0D0C',
          color: '#FFFFFF',
          border: '1px solid rgba(13, 13, 12, 0.14)',
          flexShrink: 0,
        }}
      >
        <VesperMarkSvg size={compact ? 19 : 22} color="#FFFFFF" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span
            style={{
              fontWeight: 600,
              fontSize: compact ? '0.98rem' : '1.08rem',
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em',
            }}
          >
            AI Square
          </span>
          <span
            style={{
              fontSize: compact ? '0.82rem' : '0.88rem',
              fontWeight: 400,
              color: 'var(--text-muted)',
              letterSpacing: '-0.02em',
            }}
          >
            .it
          </span>
        </div>
        {subtitle && (
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 600,
              letterSpacing: '0.13em',
              color: 'var(--text-muted)',
              marginTop: 2,
              textTransform: 'uppercase',
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
