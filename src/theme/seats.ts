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

export type BoardTheme = 'dark' | 'light';

/** Board substrate plus the extra paints the SVG used to hardcode. */
export interface BoardSurface {
  board: string;
  boardEdge: string;
  /** Raised plus-shaped road the ring runs along. */
  track: string;
  tile: string;
  tileEdge: string;
  tileSafe: string;
  dormant: string;
  dormantEdge: string;
  hub: string;
  plateStart: string;
  plateEnd: string;
  well: string;
  socket: string;
  vignette: string;
  vignetteOpacity: number;
  jewel: string;
  chevron: string;
  sheen: string;
  sheenOpacity: number;
  innerStroke: string;
  trackStroke: string;
  lockPlate: string;
  safePlate: string;
  safePlateOpacity: number;
  yardDeep: string;
  yardDeepOpacity: number;
  hubWell: string;
  hubWellOpacity: number;
  hubDeepOpacity: number;
  homeFillStart: number;
  homeFillSpan: number;
  bloom: boolean;
  /** Token selection collar — must read on both night tiles and paper tiles. */
  collar: string;
}

export interface BoardAccent {
  core: string;
  glow: string;
  gold: string;
}

/** Board substrate — unlit surfaces the neon sits on. */
export const SURFACE: BoardSurface = {
  board: '#070b13',
  boardEdge: '#0d1421',
  track: '#121a29',
  tile: '#1d2739',
  tileEdge: 'rgba(150,190,255,0.2)',
  tileSafe: '#25324a',
  dormant: '#101725',
  dormantEdge: 'rgba(140,180,255,0.09)',
  hub: '#070c16',
  plateStart: '#0d1421',
  plateEnd: '#04070d',
  well: 'rgba(3,6,12,0.5)',
  socket: 'rgba(0,0,0,0.34)',
  vignette: '#000',
  vignetteOpacity: 0.6,
  jewel: '#04070d',
  chevron: '#fff',
  sheen: '#fff',
  sheenOpacity: 0.07,
  innerStroke: 'rgba(140,180,255,0.1)',
  trackStroke: 'rgba(150,190,255,0.12)',
  lockPlate: 'rgba(4,7,13,0.82)',
  safePlate: '#000',
  safePlateOpacity: 0.35,
  yardDeep: '#05080f',
  yardDeepOpacity: 0.9,
  hubWell: '#05080f',
  hubWellOpacity: 0.95,
  hubDeepOpacity: 0.8,
  homeFillStart: 0.46,
  homeFillSpan: 0.5,
  bloom: true,
  collar: '#fff',
};

export const SURFACE_LIGHT: BoardSurface = {
  board: '#e8eef8',
  boardEdge: '#c5d0e0',
  track: '#d4deec',
  tile: '#f7f9fd',
  tileEdge: 'rgba(15,30,60,0.18)',
  tileSafe: '#e4ecf8',
  dormant: '#c3ccdb',
  dormantEdge: 'rgba(15,30,60,0.14)',
  hub: '#eef2f9',
  plateStart: '#f3f6fb',
  plateEnd: '#dfe6f2',
  well: 'rgba(20,32,56,0.22)',
  socket: 'rgba(15,30,60,0.28)',
  vignette: '#152038',
  vignetteOpacity: 0.12,
  jewel: '#e8eef8',
  chevron: '#0d1626',
  sheen: '#ffffff',
  sheenOpacity: 0.55,
  innerStroke: 'rgba(15,30,60,0.12)',
  trackStroke: 'rgba(15,30,60,0.16)',
  lockPlate: 'rgba(13,22,38,0.78)',
  safePlate: '#0d1626',
  safePlateOpacity: 0.22,
  yardDeep: '#dfe6f2',
  yardDeepOpacity: 0.92,
  hubWell: '#eef2f9',
  hubWellOpacity: 0.92,
  hubDeepOpacity: 0.28,
  homeFillStart: 0.22,
  homeFillSpan: 0.18,
  bloom: false,
  collar: '#0d1626',
};

export const ACCENT: BoardAccent = {
  core: '#00e0ff',
  glow: '#00b8d4',
  gold: '#ffd23d',
};

export const ACCENT_LIGHT: BoardAccent = {
  core: '#007a99',
  glow: '#00a8cc',
  gold: '#c79200',
};

export function boardPalette(theme: BoardTheme): { surface: BoardSurface; accent: BoardAccent } {
  return theme === 'light'
    ? { surface: SURFACE_LIGHT, accent: ACCENT_LIGHT }
    : { surface: SURFACE, accent: ACCENT };
}
