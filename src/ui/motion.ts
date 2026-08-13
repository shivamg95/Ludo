export const DICE_TUMBLE_S = 0.7;
export const DICE_SETTLE_S = 0.25;
export const DICE_TUMBLE_MS = 700;
export const DICE_SETTLE_MS = 250;
export const NO_MOVE_HOLD_MS = 600;
export const BOT_FACE_READ_MS = 500;
export const HOP_PER_CELL_S = 0.13;
export const HOP_MIN_S = 0.22;
export const HOP_MAX_S = 1.1;
export const UNLOCK_ARC_S = 0.38;
export const CAPTURE_ARC_S = 0.55;
export const IMPACT_GAP_S = 0.08;
export const SCREEN_FADE_S = 0.28;

export function prefersReducedMotion(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.dataset.reducedMotion === 'true') {
    return true;
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return true;
  }
  return false;
}
