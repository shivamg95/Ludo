import { CAPTURE_ARC_S, HOP_MAX_S, HOP_MIN_S, HOP_PER_CELL_S, UNLOCK_ARC_S } from './motion';

export type HopTrack = {
  x: number[];
  y: number[];
  scaleY: number[];
  scale: number[];
  rotate: number[];
  times: number[];
  duration: number;
  delay: number;
};

function push(
  track: HopTrack,
  x: number,
  y: number,
  t: number,
  extra?: { scaleY?: number; scale?: number; rotate?: number },
) {
  track.x.push(x);
  track.y.push(y);
  track.times.push(t);
  track.scaleY.push(extra?.scaleY ?? 1);
  track.scale.push(extra?.scale ?? 1);
  track.rotate.push(extra?.rotate ?? 0);
}

/** Per-cell bounce along board waypoints. `points` includes the start cell. */
export function bounceHop(
  points: { x: number; y: number }[],
  opts?: { arc?: boolean },
): HopTrack | null {
  if (points.length < 2) return null;
  const hops = points.length - 1;
  const arc = opts?.arc === true;
  const duration = arc
    ? UNLOCK_ARC_S
    : Math.min(HOP_MAX_S, Math.max(HOP_MIN_S, hops * HOP_PER_CELL_S));

  const track: HopTrack = {
    x: [],
    y: [],
    scaleY: [],
    scale: [],
    rotate: [],
    times: [],
    duration,
    delay: 0,
  };

  for (let i = 0; i < hops; i++) {
    const from = points[i]!;
    const to = points[i + 1]!;
    const t0 = i / hops;
    const tMid = (i + 0.42) / hops;
    const tSquash = (i + 0.88) / hops;
    const tLand = (i + 1) / hops;
    const lift = arc && i === 0 ? 0.58 : 0.3;

    if (i === 0) push(track, from.x, from.y, t0);
    push(track, (from.x + to.x) / 2, (from.y + to.y) / 2 - lift, tMid, { scaleY: 1.08 });
    push(track, to.x, to.y, tSquash, { scaleY: 0.86 });
    push(track, to.x, to.y, tLand, { scaleY: 1 });
  }

  return track;
}

export function captureHop(
  from: { x: number; y: number },
  to: { x: number; y: number },
  delay: number,
): HopTrack {
  const mid = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2 - 1.25,
  };
  return {
    x: [from.x, mid.x, to.x],
    y: [from.y, mid.y, to.y],
    scaleY: [1, 1, 0.92],
    scale: [1, 0.9, 0.78],
    rotate: [0, 110, 210],
    times: [0, 0.45, 1],
    duration: CAPTURE_ARC_S,
    delay,
  };
}
