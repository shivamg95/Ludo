import type { Cell } from '../engine/types';
import { DUR } from './motion';

export type HopKind = 'walk' | 'enter' | 'return';

export interface Hop {
  x: number[];
  y: number[];
  scaleY: number[];
  times: number[];
  duration: number;
  kind: HopKind;
}

const center = (cell: Cell) => ({ x: cell.col + 0.5, y: cell.row + 0.5 });

/** Beyond this many steps a per-cell hop reads as jitter, so we glide instead. */
const MAX_HOP_STEPS = 8;

const ENTER_HOP_SECONDS = 0.56;

function evenTimes(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i / Math.max(1, count - 1));
}

function walkHopDuration(stepCount: number): number {
  if (stepCount > MAX_HOP_STEPS) return DUR.slow;
  return Math.min(1, stepCount * DUR.hop + 0.08);
}

/**
 * How long the capturer spends travelling before impact. Used to freeze the
 * victim, delay the burst/SFX, and then send the victim home.
 */
export function capturerApproachSeconds(fromProgress: number, toProgress: number): number {
  if (fromProgress < 0) return ENTER_HOP_SECONDS;
  const wrapped = fromProgress > 40 && toProgress < 20 && fromProgress <= 50;
  const steps = wrapped
    ? 50 - fromProgress + toProgress + 1
    : Math.max(1, toProgress - fromProgress);
  return walkHopDuration(steps);
}

/** Freeze a hop at its start cell, then play it — used so a capture waits for impact. */
export function holdThen(hop: Hop, holdSeconds: number): Hop {
  if (holdSeconds <= 0.001) return hop;
  const total = holdSeconds + hop.duration;
  const holdT = holdSeconds / total;
  const startX = hop.x[0]!;
  const startY = hop.y[0]!;
  return {
    ...hop,
    x: [startX, ...hop.x],
    y: [startY, ...hop.y],
    scaleY: [1, ...hop.scaleY],
    times: [0, ...hop.times.map((t) => holdT + t * (1 - holdT))],
    duration: total,
  };
}

/**
 * A token that walks N cells should visibly bounce N times. Each step gets an
 * apex keyframe plus a landing keyframe carrying a squash, so the motion reads
 * as hopping rather than sliding.
 */
export function buildWalkHop(from: Cell, waypoints: Cell[]): Hop | null {
  if (waypoints.length === 0) return null;

  const start = center(from);

  if (waypoints.length > MAX_HOP_STEPS) {
    const last = center(waypoints[waypoints.length - 1]!);
    return {
      x: [start.x, last.x],
      y: [start.y, last.y],
      scaleY: [1, 1],
      times: [0, 1],
      duration: walkHopDuration(waypoints.length),
      kind: 'walk',
    };
  }

  const x = [start.x];
  const y = [start.y];
  const scaleY = [1];
  let prev = start;

  for (const cell of waypoints) {
    const next = center(cell);
    x.push((prev.x + next.x) / 2, next.x);
    y.push((prev.y + next.y) / 2 - 0.36, next.y);
    scaleY.push(1.1, 0.88);
    prev = next;
  }

  // Recover from the final squash so the token rests at its true size
  x.push(prev.x);
  y.push(prev.y);
  scaleY.push(1);

  return {
    x,
    y,
    scaleY,
    times: evenTimes(x.length),
    duration: walkHopDuration(waypoints.length),
    kind: 'walk',
  };
}

/** Launching out of the yard onto the start pad — one tall, confident arc. */
export function buildEnterHop(from: Cell, to: Cell): Hop {
  const a = center(from);
  const b = center(to);
  return {
    x: [a.x, (a.x + b.x) / 2, b.x, b.x],
    y: [a.y, (a.y + b.y) / 2 - 1.3, b.y, b.y],
    scaleY: [1, 1.16, 0.84, 1],
    times: [0, 0.55, 0.86, 1],
    duration: ENTER_HOP_SECONDS,
    kind: 'enter',
  };
}

/** Knocked back to the yard after a capture — flatter, faster, defeated. */
export function buildReturnHop(from: Cell, to: Cell): Hop {
  const a = center(from);
  const b = center(to);
  return {
    x: [a.x, a.x + (b.x - a.x) * 0.55, b.x, b.x],
    y: [a.y, (a.y + b.y) / 2 - 1.8, b.y, b.y],
    scaleY: [1, 1.2, 0.78, 1],
    times: [0, 0.45, 0.84, 1],
    duration: 0.62,
    kind: 'return',
  };
}
