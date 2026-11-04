'use client';

import React from 'react';
import { motion } from 'motion/react';
import '../../styles/border-trail.css';

/**
 * BorderTrail (Motion-Primitives style API), adapted for AI Square.
 *
 * Renders a glowing segment that continuously travels around the border
 * of its nearest positioned parent (parent needs position: relative and
 * a border-radius; the trail inherits that radius via rounded-[inherit]).
 *
 * Props:
 *  - className           extra classes for the moving trail element
 *  - size                trail length in px (default 60)
 *  - transition          motion transition overrides (default: infinite 5s linear loop)
 *  - delay               start delay in seconds
 *  - onAnimationComplete callback fired on each loop completion
 *  - style               extra styles for the trail (e.g. boxShadow glow)
 */
export function BorderTrail({
  className = '',
  size = 60,
  transition,
  delay,
  onAnimationComplete,
  style,
}) {
  const baseTransition = {
    repeat: Infinity,
    duration: 5,
    ease: 'linear',
  };

  return (
    <div
      className="mp-border-trail"
      aria-hidden="true"
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        border: '1px solid transparent',
        WebkitMaskClip: 'padding-box, border-box',
        maskClip: 'padding-box, border-box',
        WebkitMaskComposite: 'source-in',
        maskComposite: 'intersect',
        WebkitMaskImage:
          'linear-gradient(transparent, transparent), linear-gradient(#000, #000)',
        maskImage:
          'linear-gradient(transparent, transparent), linear-gradient(#000, #000)',
      }}
    >
      <motion.div
        className={className}
        style={{
          position: 'absolute',
          aspectRatio: '1 / 1',
          width: size,
          background: '#71717a',
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          ...style,
        }}
        animate={{ offsetDistance: ['0%', '100%'] }}
        transition={{ ...baseTransition, ...(delay ? { delay } : {}), ...transition }}
        onAnimationComplete={onAnimationComplete}
      />
    </div>
  );
}

export default BorderTrail;
