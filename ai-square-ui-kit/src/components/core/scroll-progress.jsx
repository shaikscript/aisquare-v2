'use client';

import React from 'react';
import { motion, useScroll, useSpring } from 'motion/react';
import '../../styles/scroll-progress.css';

/**
 * ScrollProgress (Motion-Primitives style API), adapted for AI Square.
 *
 * A progress bar whose scaleX tracks scroll progress:
 *  - with `containerRef`: progress of that scrollable element
 *  - without: progress of the whole page
 * Motion is smoothed with a spring (override via `springOptions`).
 */
export function ScrollProgress({
  className = '',
  springOptions,
  containerRef,
  ...props
}) {
  const { scrollYProgress } = useScroll(
    containerRef ? { container: containerRef } : undefined
  );

  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 25,
    mass: 0.3,
    ...(springOptions || {}),
  });

  return (
    <motion.div
      className={`mp-scroll-progress ${className}`.trim()}
      style={{ scaleX, transformOrigin: '0% 50%' }}
      {...props}
    />
  );
}

export default ScrollProgress;
