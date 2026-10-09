import { useEffect, useRef } from 'react';

/** Above this, motion reads as smooth. */
const GOOD_FPS = 55;
/** Above this, motion is watchable but uneven. Below it, it stutters. */
const OK_FPS = 30;
/** How often the number refreshes. Frequent enough to follow a hitch, slow enough to read. */
const WINDOW_MS = 500;

/**
 * Frame-rate meter pinned to the top-left corner. The number is written straight into the
 * DOM from a rAF loop, so the meter never re-renders React and never adds to the frame cost
 * it is measuring. The loop stops when the meter unmounts, and rAF pauses in background tabs.
 */
export function FpsCounter() {
  const pillRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let windowStart = performance.now();

    const tick = (now: number) => {
      frames += 1;
      const elapsed = now - windowStart;
      if (elapsed >= WINDOW_MS) {
        const fps = Math.round((frames * 1000) / elapsed);
        if (valueRef.current) valueRef.current.textContent = String(fps);
        if (pillRef.current) {
          pillRef.current.dataset.level = fps >= GOOD_FPS ? 'good' : fps >= OK_FPS ? 'ok' : 'bad';
        }
        frames = 0;
        windowStart = now;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={pillRef}
      className="fps-counter"
      data-level="good"
      data-testid="fps-counter"
      aria-hidden="true"
    >
      <span ref={valueRef} className="fps-counter-value">
        --
      </span>
      <span className="fps-counter-unit">FPS</span>
    </div>
  );
}
