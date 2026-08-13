import type { SeatColor } from '../engine/types';

/**
 * Seat palette for SVG surfaces. Mirrors the `--{color}-*` custom properties in
 * `index.css`; SVG attributes can't reliably consume CSS vars across all engines,
 * so the values live here once and are imported by every canvas that draws seats.
 */
export interface SeatRamp {
  /** Saturated fill. */
  core: string;
  /** Emissive — used for bloom and rims. */
  glow: string;
  /** Light highlight. */
  rim: string;
  /** Shadow / recessed edge. */
  deep: string;
}

export const SEAT_RAMP: Record<SeatColor, SeatRamp> = {
  red: { core: '#ff3d63', glow: '#ff2d55', rim: '#ffa8bb', deep: '#5c0a1d' },
  green: { core: '#22e06a', glow: '#00e05a', rim: '#9df3bf', deep: '#054a24' },
  yellow: { core: '#ffd23d', glow: '#ffc400', rim: '#ffeda8', deep: '#5c4300' },
  blue: { core: '#3d8bff', glow: '#2f7bff', rim: '#a8caff', deep: '#0b2f66' },
};

export const SEAT_COLORS = Object.keys(SEAT_RAMP) as SeatColor[];

/** Board substrate — unlit surfaces the neon sits on. */
export const SURFACE = {
  board: '#070b13',
  boardEdge: '#0d1421',
  /** Raised plus-shaped road the ring runs along. */
  track: '#121a29',
  tile: '#1d2739',
  tileEdge: 'rgba(150,190,255,0.2)',
  tileSafe: '#25324a',
  dormant: '#101725',
  dormantEdge: 'rgba(140,180,255,0.09)',
  hub: '#070c16',
} as const;

export const ACCENT = {
  core: '#00e0ff',
  glow: '#00b8d4',
  gold: '#ffd23d',
} as const;
