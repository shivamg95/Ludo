import { useEffect, useRef } from 'react';
import { useReducedMotion } from './motion';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vrot: number;
  /** Phase offset so pieces flutter out of sync. */
  phase: number;
  color: string;
}

const GRAVITY = 1500;
const DRAG = 0.86;
const LIFE_MS = 4200;

/**
 * Full-viewport confetti burst — two corner cannons plus a light shower.
 * Canvas rather than DOM nodes: ~180 pieces at 60fps without layout churn.
 */
export function Confetti({
  colors,
  count = 180,
  delayMs = 0,
}: {
  colors: string[];
  count?: number;
  delayMs?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Pieces are flat foil rectangles, so 1.5x is indistinguishable from 2x and costs far less fill
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    /** Board-space transform: CSS pixels, scaled to the backing store. */
    const base = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      base();
    };
    resize();
    window.addEventListener('resize', resize);

    const pick = () => colors[Math.floor(Math.random() * colors.length)] ?? '#fff';
    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    const cannon = (originX: number, aim: number, n: number): Particle[] =>
      Array.from({ length: n }, () => {
        const angle = aim + rand(-0.42, 0.42);
        const speed = rand(760, 1450);
        return {
          x: originX,
          y: h + 8,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          w: rand(6, 12),
          h: rand(8, 16),
          rot: rand(0, Math.PI * 2),
          vrot: rand(-9, 9),
          phase: rand(0, Math.PI * 2),
          color: pick(),
        };
      });

    const shower = (n: number): Particle[] =>
      Array.from({ length: n }, () => ({
        x: rand(0, w),
        y: rand(-h * 0.6, -10),
        vx: rand(-60, 60),
        vy: rand(60, 200),
        w: rand(5, 10),
        h: rand(7, 14),
        rot: rand(0, Math.PI * 2),
        vrot: rand(-6, 6),
        phase: rand(0, Math.PI * 2),
        color: pick(),
      }));

    const half = Math.round(count * 0.36);
    let particles: Particle[] = [];
    let raf = 0;
    let start = 0;
    let last = 0;

    const frame = (now: number) => {
      if (!start) start = now;
      const dt = Math.min(0.032, last ? (now - last) / 1000 : 0.016);
      last = now;
      const age = now - start;

      base();
      ctx.clearRect(0, 0, w, h);
      // Compact in place: pieces that have fallen off screen are dropped without a new array
      let alive = 0;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        p.vy += GRAVITY * dt;
        p.vx *= 1 - (1 - DRAG) * dt * 4;
        p.x += (p.vx + Math.sin(age / 420 + p.phase) * 34) * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;

        // One transform per piece: base scale, then translate, rotate and flip. The flip
        // (scaleY through zero) makes pieces read as tumbling foil.
        const c = Math.cos(p.rot);
        const s = Math.sin(p.rot);
        const flip = Math.cos(age / 260 + p.phase);
        ctx.setTransform(dpr * c, dpr * s, -dpr * s * flip, dpr * c * flip, dpr * p.x, dpr * p.y);
        ctx.globalAlpha = age > LIFE_MS - 700 ? Math.max(0, (LIFE_MS - age) / 700) : 1;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);

        if (p.y < h + 60) particles[alive++] = p;
      }
      particles.length = alive;

      if (age < LIFE_MS && particles.length) {
        raf = requestAnimationFrame(frame);
      } else {
        base();
        ctx.clearRect(0, 0, w, h);
      }
    };

    const launch = window.setTimeout(() => {
      particles = [
        ...cannon(w * 0.06, -Math.PI / 2.6, half),
        ...cannon(w * 0.94, -Math.PI + Math.PI / 2.6, half),
        ...shower(count - half * 2),
      ];
      raf = requestAnimationFrame(frame);
    }, delayMs);

    return () => {
      window.clearTimeout(launch);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [colors, count, delayMs, reduced]);

  if (reduced) return null;
  return <canvas ref={canvasRef} className="confetti-canvas" aria-hidden />;
}
