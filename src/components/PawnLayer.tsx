import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { GameState, Move, SeatColor } from '../engine/types';
import { getPawnCell, hopWaypoints, getYardSlotCell } from '../engine/selectors';
import { ringIndexOf, cellOf } from '../engine/board';

const COLOR: Record<SeatColor, string> = {
  red: '#e23d3d',
  green: '#2f9e5c',
  yellow: '#e2b93d',
  blue: '#3d7ee2',
};

const COLOR_MID: Record<SeatColor, string> = {
  red: '#c42929',
  green: '#268a4d',
  yellow: '#c9a028',
  blue: '#2f6bc9',
};

const COLOR_DEEP: Record<SeatColor, string> = {
  red: '#7a1515',
  green: '#124d2a',
  yellow: '#7a5c10',
  blue: '#163f7a',
};

interface Props {
  game: GameState;
  movableIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  reducedMotion?: boolean;
  previewPawnId?: string | null;
}

type Hop = { cx: number[]; cy: number[]; duration: number };

/** Classic Ludo token: shadow + base + body + crown + specular. */
function Token3D({
  color,
  cx,
  cy,
  r,
  selected,
  movable,
}: {
  color: SeatColor;
  cx: number;
  cy: number;
  r: number;
  selected: boolean;
  movable: boolean;
}) {
  const baseR = r * 0.92;
  const bodyR = r * 0.78;
  const crownR = r * 0.34;
  const bodyCy = cy - r * 0.12;
  const crownCy = cy - r * 0.55;

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Contact shadow */}
      <ellipse
        cx={cx + 0.02}
        cy={cy + r * 0.55}
        rx={baseR * 0.95}
        ry={baseR * 0.28}
        fill="rgba(0,0,0,0.35)"
        filter="url(#pawn-blur)"
      />
      {/* Base disc rim */}
      <ellipse
        cx={cx}
        cy={cy + r * 0.28}
        rx={baseR}
        ry={baseR * 0.42}
        fill={`url(#pawn-base-${color})`}
        stroke={COLOR_DEEP[color]}
        strokeWidth={0.035}
      />
      <ellipse
        cx={cx}
        cy={cy + r * 0.22}
        rx={baseR * 0.72}
        ry={baseR * 0.28}
        fill={`url(#pawn-base-inner-${color})`}
      />
      {/* Body sphere */}
      <circle
        cx={cx}
        cy={bodyCy}
        r={bodyR}
        fill={`url(#pawn-body-${color})`}
        stroke={selected ? '#fff' : movable ? 'rgba(255,255,255,0.55)' : COLOR_DEEP[color]}
        strokeWidth={selected ? 0.09 : movable ? 0.07 : 0.04}
      />
      {/* Equator band for volume */}
      <ellipse
        cx={cx}
        cy={bodyCy + bodyR * 0.15}
        rx={bodyR * 0.86}
        ry={bodyR * 0.22}
        fill={`url(#pawn-band-${color})`}
        opacity={0.55}
      />
      {/* Crown / head knob */}
      <circle
        cx={cx}
        cy={crownCy}
        r={crownR}
        fill={`url(#pawn-crown-${color})`}
        stroke={COLOR_DEEP[color]}
        strokeWidth={0.03}
      />
      {/* Specular highlights */}
      <ellipse
        cx={cx - bodyR * 0.28}
        cy={bodyCy - bodyR * 0.32}
        rx={bodyR * 0.28}
        ry={bodyR * 0.18}
        fill="rgba(255,255,255,0.55)"
      />
      <circle
        cx={cx - crownR * 0.25}
        cy={crownCy - crownR * 0.28}
        r={crownR * 0.28}
        fill="rgba(255,255,255,0.65)"
      />
      {/* Rim light */}
      <path
        d={`M ${cx + bodyR * 0.55} ${bodyCy - bodyR * 0.55}
            A ${bodyR} ${bodyR} 0 0 1 ${cx + bodyR * 0.7} ${bodyCy + bodyR * 0.2}`}
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth={0.045}
        strokeLinecap="round"
      />
    </g>
  );
}

export function PawnLayer({
  game,
  movableIds,
  selectedId,
  onSelect,
  reducedMotion,
  previewPawnId,
}: Props) {
  const yardSlots = useMemo(() => {
    const map = new Map<string, number>();
    for (const player of game.players) {
      const inYard = player.pawns.filter((p) => p.progress < 0);
      inYard.forEach((p, i) => map.set(p.id, i));
    }
    return map;
  }, [game.players]);

  const occupancy = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const player of game.players) {
      for (const pawn of player.pawns) {
        const slot = yardSlots.get(pawn.id);
        const cell = getPawnCell(pawn.seat, pawn.progress, pawn.index, slot);
        const key = `${cell.row.toFixed(2)},${cell.col.toFixed(2)}`;
        const list = map.get(key) ?? [];
        list.push(pawn.id);
        map.set(key, list);
      }
    }
    return map;
  }, [game.players, yardSlots]);

  const fanOffset = (id: string, key: string) => {
    const list = occupancy.get(key) ?? [id];
    const i = list.indexOf(id);
    const n = list.length;
    if (n <= 1) return { dx: 0, dy: 0 };
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const radius = n === 2 ? 0.18 : 0.22;
    return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
  };

  const prevProgress = useRef(new Map<string, number>());
  const [hops, setHops] = useState<Record<string, Hop>>({});

  const progressSig = game.players
    .map((p) => p.pawns.map((x) => `${x.id}:${x.progress}`).join(','))
    .join('|');

  useEffect(() => {
    const nextHops: Record<string, Hop> = {};
    for (const player of game.players) {
      for (const pawn of player.pawns) {
        const prev = prevProgress.current.get(pawn.id);
        if (prev === undefined) {
          prevProgress.current.set(pawn.id, pawn.progress);
          continue;
        }
        if (prev === pawn.progress) continue;

        const slot = yardSlots.get(pawn.id);
        const toCell = getPawnCell(pawn.seat, pawn.progress, pawn.index, slot);
        const fromCell =
          prev < 0
            ? getYardSlotCell(pawn.seat, yardSlots.get(pawn.id) ?? 0)
            : getPawnCell(pawn.seat, prev, pawn.index, 0);

        prevProgress.current.set(pawn.id, pawn.progress);

        if (reducedMotion) continue;

        if (pawn.progress < 0 && prev >= 0) {
          const mid = {
            row: (fromCell.row + toCell.row) / 2 - 1.2,
            col: (fromCell.col + toCell.col) / 2,
          };
          nextHops[pawn.id] = {
            cx: [fromCell.col + 0.5, mid.col + 0.5, toCell.col + 0.5],
            cy: [fromCell.row + 0.5, mid.row + 0.5, toCell.row + 0.5],
            duration: 0.55,
          };
          continue;
        }

        const wrapped = prev > 40 && pawn.progress < 20 && prev <= 50;
        const waypoints = hopWaypoints(pawn.seat, prev, pawn.progress, wrapped);
        if (waypoints.length === 0) continue;

        nextHops[pawn.id] = {
          cx: [fromCell.col + 0.5, ...waypoints.map((c) => c.col + 0.5)],
          cy: [fromCell.row + 0.5, ...waypoints.map((c) => c.row + 0.5)],
          duration: Math.min(0.9, 0.1 + waypoints.length * 0.09),
        };
      }
    }

    if (Object.keys(nextHops).length === 0) return;

    setHops((h) => ({ ...h, ...nextHops }));
    const timers = Object.entries(nextHops).map(([id, hop]) =>
      window.setTimeout(() => {
        setHops((h) => {
          const copy = { ...h };
          delete copy[id];
          return copy;
        });
      }, hop.duration * 1000 + 40),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressSig, reducedMotion, yardSlots]);

  const previews = useMemo(() => {
    if (game.phase !== 'waiting_move') {
      return [] as { move: Move; cell: { row: number; col: number }; strong: boolean }[];
    }
    return game.legalMoves.map((move) => {
      const pawn = game.players.flatMap((p) => p.pawns).find((p) => p.id === move.pawnId)!;
      const cell =
        move.toProgress < 0
          ? getYardSlotCell(pawn.seat, 0)
          : cellOf(pawn.seat, move.toProgress)!;
      return {
        move,
        cell,
        strong: previewPawnId === move.pawnId || selectedId === move.pawnId,
      };
    });
  }, [game.phase, game.legalMoves, game.players, previewPawnId, selectedId]);

  const allPawns = useMemo(
    () =>
      game.players
        .flatMap((player) => player.pawns.map((pawn) => ({ pawn, player })))
        .sort((a, b) => {
          const am = movableIds.has(a.pawn.id) ? 1 : 0;
          const bm = movableIds.has(b.pawn.id) ? 1 : 0;
          return am - bm;
        }),
    [game.players, movableIds],
  );

  return (
    <div className="pointer-events-none absolute inset-0" data-testid="pawn-layer">
      <svg viewBox="0 0 15 15" className="h-full w-full overflow-visible">
        <defs>
          <filter id="pawn-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.06" />
          </filter>
          {(Object.keys(COLOR) as SeatColor[]).map((c) => (
            <g key={c}>
              <radialGradient id={`pawn-body-${c}`} cx="32%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
                <stop offset="28%" stopColor={COLOR[c]} />
                <stop offset="72%" stopColor={COLOR_MID[c]} />
                <stop offset="100%" stopColor={COLOR_DEEP[c]} />
              </radialGradient>
              <radialGradient id={`pawn-crown-${c}`} cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.75" />
                <stop offset="40%" stopColor={COLOR[c]} />
                <stop offset="100%" stopColor={COLOR_DEEP[c]} />
              </radialGradient>
              <linearGradient id={`pawn-base-${c}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={COLOR[c]} />
                <stop offset="100%" stopColor={COLOR_DEEP[c]} />
              </linearGradient>
              <radialGradient id={`pawn-base-inner-${c}`} cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor={COLOR[c]} stopOpacity="0.9" />
                <stop offset="100%" stopColor={COLOR_DEEP[c]} />
              </radialGradient>
              <linearGradient id={`pawn-band-${c}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={COLOR_DEEP[c]} stopOpacity="0" />
                <stop offset="50%" stopColor={COLOR_DEEP[c]} stopOpacity="0.45" />
                <stop offset="100%" stopColor={COLOR_DEEP[c]} stopOpacity="0" />
              </linearGradient>
            </g>
          ))}
        </defs>

        {previews.map(({ move, cell, strong }) => (
          <g key={`dest-${move.pawnId}`} data-testid={`dest-${move.pawnId}`}>
            <circle
              cx={cell.col + 0.5}
              cy={cell.row + 0.5}
              r={strong ? 0.38 : 0.28}
              fill="none"
              stroke={strong ? '#5ec2a0' : 'rgba(94,194,160,0.55)'}
              strokeWidth={strong ? 0.1 : 0.06}
              strokeDasharray={strong ? undefined : '0.12 0.1'}
              opacity={strong ? 1 : 0.75}
            />
            {strong && (
              <circle
                cx={cell.col + 0.5}
                cy={cell.row + 0.5}
                r={0.14}
                fill="rgba(94,194,160,0.45)"
              />
            )}
          </g>
        ))}

        {allPawns.map(({ pawn, player }) => {
          const slot = yardSlots.get(pawn.id);
          const cell = getPawnCell(pawn.seat, pawn.progress, pawn.index, slot);
          const key = `${cell.row.toFixed(2)},${cell.col.toFixed(2)}`;
          const { dx, dy } = fanOffset(pawn.id, key);
          const movable = movableIds.has(pawn.id);
          const selected = selectedId === pawn.id;
          const cx = cell.col + 0.5 + dx;
          const cy = cell.row + 0.5 + dy;
          const rIdx = ringIndexOf(pawn.seat, pawn.progress);
          const hop = hops[pawn.id];
          const visualR = movable ? 0.42 : 0.36;

          const transition = reducedMotion
            ? { duration: 0 }
            : hop
              ? {
                  duration: hop.duration,
                  ease: 'easeInOut' as const,
                  times: hop.cx.map((_, i) => i / Math.max(1, hop.cx.length - 1)),
                }
              : { type: 'spring' as const, stiffness: 380, damping: 26 };

          return (
            <g key={pawn.id}>
              {/* Invisible hit target — carries testids / a11y */}
              <motion.circle
                r={0.55}
                fill="transparent"
                className="pointer-events-auto cursor-pointer"
                style={{ pointerEvents: 'auto', outline: 'none' }}
                onPointerDown={(e) => {
                  e.currentTarget.blur();
                }}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSelect(pawn.id);
                }}
                initial={false}
                animate={hop ? { cx: hop.cx, cy: hop.cy } : { cx, cy }}
                transition={transition}
                data-testid={pawn.id}
                data-progress={pawn.progress}
                data-ring-index={rIdx !== null ? String(rIdx) : undefined}
                role="button"
                tabIndex={movable ? 0 : -1}
                aria-label={`${player.color} pawn ${pawn.index + 1}`}
              />
              <motion.g
                initial={false}
                animate={
                  hop
                    ? {
                        x: hop.cx,
                        y: hop.cy,
                        scale: selected ? 1.1 : movable ? [1, 1.06, 1] : 1,
                      }
                    : {
                        x: cx,
                        y: cy,
                        scale: selected ? 1.1 : movable ? [1, 1.06, 1] : 1,
                      }
                }
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : hop
                      ? transition
                      : movable
                        ? {
                            scale: { duration: 1.15, repeat: Infinity, ease: 'easeInOut' },
                            x: { type: 'spring', stiffness: 380, damping: 26 },
                            y: { type: 'spring', stiffness: 380, damping: 26 },
                          }
                        : transition
                }
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              >
                <Token3D
                  color={player.color}
                  cx={0}
                  cy={0}
                  r={visualR}
                  selected={selected}
                  movable={movable}
                />
              </motion.g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
