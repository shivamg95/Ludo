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

const COLOR_DEEP: Record<SeatColor, string> = {
  red: '#a01f1f',
  green: '#1a6b3a',
  yellow: '#a07a18',
  blue: '#1f4fa0',
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

  const progressSig = game.players.map((p) => p.pawns.map((x) => `${x.id}:${x.progress}`).join(',')).join('|');

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
            : (() => {
                // approximate previous cell without old yard slot
                if (prev < 0) return getYardSlotCell(pawn.seat, 0);
                return getPawnCell(pawn.seat, prev, pawn.index, 0);
              })();

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
          {(Object.keys(COLOR) as SeatColor[]).map((c) => (
            <radialGradient key={c} id={`pawn-grad-${c}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="45%" stopColor={COLOR[c]} />
              <stop offset="100%" stopColor={COLOR_DEEP[c]} />
            </radialGradient>
          ))}
          <filter id="pawn-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0.06" stdDeviation="0.05" floodOpacity="0.45" />
          </filter>
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
          const visualR = movable ? 0.4 : 0.34;

          const animatePos = hop
            ? { cx: hop.cx, cy: hop.cy }
            : { cx, cy };

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
              <motion.circle
                r={0.55}
                fill="transparent"
                className="pointer-events-auto cursor-pointer"
                style={{ pointerEvents: 'auto', outline: 'none' }}
                onPointerDown={(e) => {
                  // Prevent the giant SVG focus ring from appearing on click
                  e.currentTarget.blur();
                }}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSelect(pawn.id);
                }}
                initial={false}
                animate={animatePos}
                transition={transition}
                data-testid={pawn.id}
                data-progress={pawn.progress}
                data-ring-index={rIdx !== null ? String(rIdx) : undefined}
                role="button"
                tabIndex={movable ? 0 : -1}
                aria-label={`${player.color} pawn ${pawn.index + 1}`}
              />
              <motion.circle
                r={visualR}
                fill={`url(#pawn-grad-${player.color})`}
                stroke={selected ? '#fff' : movable ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.35)'}
                strokeWidth={selected ? 0.1 : movable ? 0.08 : 0.045}
                filter="url(#pawn-shadow)"
                style={{ pointerEvents: 'none' }}
                initial={false}
                animate={{
                  ...animatePos,
                  scale: selected ? 1.12 : movable ? [1, 1.08, 1] : 1,
                }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : hop
                      ? transition
                      : movable
                        ? {
                            scale: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' },
                            cx: { type: 'spring', stiffness: 380, damping: 26 },
                            cy: { type: 'spring', stiffness: 380, damping: 26 },
                          }
                        : transition
                }
              />
              <motion.circle
                r={0.1}
                fill="rgba(255,255,255,0.55)"
                style={{ pointerEvents: 'none' }}
                initial={false}
                animate={
                  hop
                    ? {
                        cx: hop.cx.map((v) => v - 0.1),
                        cy: hop.cy.map((v) => v - 0.12),
                      }
                    : { cx: cx - 0.1, cy: cy - 0.12 }
                }
                transition={transition}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
