import { useEffect, useState } from 'react';
import type { Transition } from 'motion/react';

/** Durations in seconds. One rhythm for the whole app. */
export const DUR = {
  instant: 0.09,
  fast: 0.16,
  base: 0.26,
  slow: 0.42,
  hop: 0.13,
  roll: 0.62,
  celebrate: 1.1,
} as const;

export const EASE = {
  out: [0.22, 1, 0.36, 1],
  in: [0.55, 0, 1, 0.45],
  inOut: [0.65, 0, 0.35, 1],
  /** Overshoots slightly — for things that land. */
  land: [0.2, 1.35, 0.4, 1],
} as const satisfies Record<string, [number, number, number, number]>;

export const SPRING = {
  /** Tokens settling onto a cell. */
  token: { type: 'spring', stiffness: 420, damping: 28, mass: 0.7 },
  /** UI chrome — panels, pods, toasts. */
  ui: { type: 'spring', stiffness: 320, damping: 30 },
  /** Snappy, minimal overshoot. */
  tight: { type: 'spring', stiffness: 560, damping: 38 },
} as const satisfies Record<string, Transition>;

/** Pacing for game beats, in milliseconds. */
export const BEAT = {
  diceSettle: 520,
  readRoll: 650,
  autoMove: 340,
  toast: 1600,
  /** How long a roll with no legal move stays with its roller before the turn passes. */
  noMove: 1300,
  /** Gap between a capture landing and the extra-turn cue, so each reads on its own. */
  afterCapture: 420,
  forfeit: 2400,
} as const;

const QUERY = '(prefers-reduced-motion: reduce)';

/** True when the OS asks for reduced motion, or a test forces it via `?anim=0`. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.dataset.reducedMotion === 'true') return true;
  return window.matchMedia(QUERY).matches;
}

/**
 * Single source of truth for motion suppression. Every animated surface reads
 * this so `?anim=0` and the OS setting always agree.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const sync = () => setReduced(prefersReducedMotion());
    mq.addEventListener('change', sync);

    // `?anim=0` sets a data attribute rather than the media query
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-reduced-motion'],
    });

    sync();
    return () => {
      mq.removeEventListener('change', sync);
      observer.disconnect();
    };
  }, []);

  return reduced;
}

/** Collapses any transition to instant when motion is reduced. */
export function withReducedMotion(transition: Transition, reduced: boolean): Transition {
  return reduced ? { duration: 0 } : transition;
}
