import React, { useEffect, useRef } from 'react';

/**
 * MinimalStarfield
 * Crisp, clearly visible deep-space starfield on pure #000000.
 * Three balanced depth tiers:
 *  - Fine silver starlight pinpoints (0.42–0.72 alpha)
 *  - Bright stars with subtle radial glow (0.72–0.95 alpha)
 *  - Delicate 4-point sparkle stars with calm, slow breathing twinkle
 */
export default function MinimalStarfield({ variant = 'ambient' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let rafId = null;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let stars = [];

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const createStars = (w, h) => {
      const area = w * h;
      const density = variant === 'hero' ? 9500 : 8200;
      const count = Math.max(85, Math.min(220, Math.round(area / density)));
      const list = [];

      for (let i = 0; i < count; i += 1) {
        const isSparkle = i < 12;
        const isBright = !isSparkle && i < Math.round(count * 0.26);
        const isTwinkle = isSparkle || i % 3 === 0;

        // Concentrate hero stars slightly more in the upper/mid dark sky
        const yPos = variant === 'hero' ? Math.pow(Math.random(), 1.25) * h : Math.random() * h;

        const tintRoll = i % 6;
        let rgb = '255, 255, 255';
        if (tintRoll === 1) rgb = '210, 228, 255';
        else if (tintRoll === 4) rgb = '255, 246, 232';

        let radius = 0.75 + Math.random() * 0.65;
        let baseAlpha = 0.42 + Math.random() * 0.30;

        if (isBright) {
          radius = 1.25 + Math.random() * 0.65;
          baseAlpha = 0.68 + Math.random() * 0.24;
        } else if (isSparkle) {
          radius = 1.45 + Math.random() * 0.55;
          baseAlpha = 0.80 + Math.random() * 0.18;
        }

        list.push({
          x: Math.random() * w,
          y: yPos,
          r: radius,
          baseAlpha,
          twinkleAmp: isTwinkle ? 0.18 + Math.random() * 0.24 : 0,
          speed: 0.0006 + Math.random() * 0.0011,
          phase: Math.random() * Math.PI * 2,
          isBright,
          isSparkle,
          rgb,
        });
      }
      return list;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width || window.innerWidth));
      height = Math.max(1, Math.floor(rect.height || window.innerHeight));
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = createStars(width, height);
    };

    const renderFrame = (time) => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        const wave = s.twinkleAmp > 0 ? Math.sin(time * s.speed + s.phase) * s.twinkleAmp : 0;
        const alpha = Math.max(0.16, Math.min(1, s.baseAlpha + wave));

        // Soft halo on bright & sparkle stars so they read crisply on #000000
        if (s.isBright || s.isSparkle) {
          const glowRadius = s.r * (s.isSparkle ? 4.4 : 3.2);
          const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowRadius);
          grad.addColorStop(0, `rgba(${s.rgb}, ${(alpha * 0.34).toFixed(3)})`);
          grad.addColorStop(1, `rgba(${s.rgb}, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(s.x, s.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        // Crisp star core
        ctx.beginPath();
        ctx.fillStyle = `rgba(${s.rgb}, ${alpha.toFixed(3)})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();

        // Delicate 4-point starlight cross on signature sparkle stars
        if (s.isSparkle) {
          const arm = s.r * 4.8;
          ctx.strokeStyle = `rgba(${s.rgb}, ${(alpha * 0.52).toFixed(3)})`;
          ctx.lineWidth = 0.75;
          ctx.beginPath();
          ctx.moveTo(s.x - arm, s.y);
          ctx.lineTo(s.x + arm, s.y);
          ctx.moveTo(s.x, s.y - arm);
          ctx.lineTo(s.x, s.y + arm);
          ctx.stroke();
        }
      }

      if (!prefersReduced) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    resize();
    renderFrame(performance.now());

    const onResize = () => {
      resize();
      if (prefersReduced) renderFrame(performance.now());
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [variant]);

  if (variant === 'hero') {
    return (
      <canvas
        ref={canvasRef}
        className="minimal-starfield minimal-starfield--hero"
        aria-hidden="true"
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="minimal-starfield minimal-starfield--ambient"
      aria-hidden="true"
    />
  );
}

/**
 * useScrollReveal
 * Smooth one-time IntersectionObserver entrance reveal for public sections & cards.
 */
export function useScrollReveal(rootRef) {
  useEffect(() => {
    const scope = rootRef?.current || document;
    const items = Array.from(scope.querySelectorAll('.scroll-reveal'));
    if (!items.length) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      items.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }
    );

    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [rootRef]);
}
