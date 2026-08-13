import { useEffect, useState } from 'react';
import { useReducedMotion } from './motion';

/** Eases a number up from zero. Returns the target immediately under reduced motion. */
export function useCountUp(target: number, { durationMs = 900, delayMs = 0 } = {}): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);

  useEffect(() => {
    if (reduced || target === 0) {
      setValue(target);
      return;
    }

    let raf = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — fast commit, soft landing on the real number
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };

    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(step);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, durationMs, delayMs, reduced]);

  return value;
}
