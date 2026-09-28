import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { GameState, Move, SeatColor } from '../engine/types';
import { getPawnCell, hopWaypoints, getYardSlotCell } from '../engine/selectors';
import { ringIndexOf, cellOf } from '../engine/board';
import { SEAT_RAMP, boardPalette } from '../theme/seats';
import { SPRING } from '../ui/motion';
import { useAppStore } from '../store/gameStore';
import { buildWalkHop, buildEnterHop, buildReturnHop, holdThen, type Hop } from '../ui/hop';
import { PawnDefs } from './pawns/PawnDefs';
import { Token } from './pawns/Token';
import { SKIN_BADGE_Y } from './pawns/skins';

interface Props {
  game: GameState;
  movableIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  reducedMotion?: boolean;
  previewPawnId?: string | null;
}

/** Vertical gap between tokens sharing a cell — enough to read the one beneath. */
const STACK_STEP = 0.24;
/** Tighter gap for tall stacks, so the top token stays inside its own cell. */
const STACK_STEP_TALL = 0.15;

/** Horizontal slots for different seats sharing one (safe) cell. */
const GROUP_OFFSETS: Record<number, number[]> = {
  1: [0],
  2: [-0.2, 0.2],
  3: [-0.27, 0, 0.27],
  4: [-0.3, -0.1, 0.1, 0.3],
};

/** Token radius shrink when seats share a cell side by side. */
const SHARED_CELL_SCALE = 0.78;

/** Progress value meaning a token has finished. */
const HOME = 56;

/** Radius of a docked token; small enough that a 2x2 cluster never overlaps. */
const HOME_R = 0.3;

interface StackSlot {
  /** Position within this seat's pile on the cell. */
  index: number;
  count: number;
  /** Horizontal nudge when several seats share the cell. */
  dx: number;
  shared: boolean;
  step: number;
}

/**
 * Finished tokens dock inside their own hub wedge instead of piling on the exact
 * centre point. Each seat's wedge points at (7.5, 7.5) from one side; tokens sit
 * as a 2x2 cluster, the first pair in the wider outer row.
 */
function homeDock(seat: number, slot: number): { x: number; y: number } {
  const depth = slot < 2 ? 1.16 : 0.7;
  const spread = slot % 2 === 0 ? -0.3 : 0.3;
  switch (seat) {
    case 0:
      return { x: 7.5 - depth, y: 7.5 + spread };
    case 1:
      return { x: 7.5 + spread, y: 7.5 - depth };
    case 2:
      return { x: 7.5 + depth, y: 7.5 + spread };
    default:
      return { x: 7.5 + spread, y: 7.5 + depth };
  }
}

const SOLO: StackSlot = { index: 0, count: 1, dx: 0, shared: false, step: STACK_STEP };

type Burst = {
  key: string;
  x: number;
  y: number;
  kind: 'capture' | 'home';
  color: SeatColor;
  delay?: number;
};

export function PawnLayer({
  game,
  movableIds,
  selectedId,
  onSelect,
  reducedMotion,
  previewPawnId,
}: Props) {
  const theme = useAppStore((s) => s.theme);
  const pawnSkin = useAppStore((s) => s.pawnSkin);
  const { surface, accent } = boardPalette(theme);
  const yardSlots = useMemo(() => {
    const map = new Map<string, number>();
    for (const player of game.players) {
      const inYard = player.pawns.filter((p) => p.progress < 0);
      inYard.forEach((p, i) => map.set(p.id, i));
    }
    return map;
  }, [game.players]);

  /**
   * Tokens sharing a cell stack upward with a count badge, rather than fanning
   * out in a circle and bleeding into neighbouring cells. Different seats on the
   * same safe cell stand side by side, each with its own pile, so a count never
   * reads as belonging to the wrong player.
   */
  const stacks = useMemo(() => {
    const byCell = new Map<string, Map<number, string[]>>();
    for (const player of game.players) {
      for (const pawn of player.pawns) {
        if (pawn.progress === HOME) continue;
        const cell = getPawnCell(pawn.seat, pawn.progress, pawn.index, yardSlots.get(pawn.id));
        const key = `${cell.row.toFixed(2)},${cell.col.toFixed(2)}`;
        const bySeat = byCell.get(key) ?? new Map<number, string[]>();
        const list = bySeat.get(pawn.seat) ?? [];
        list.push(pawn.id);
        bySeat.set(pawn.seat, list);
        byCell.set(key, bySeat);
      }
    }
    const map = new Map<string, StackSlot>();
    for (const bySeat of byCell.values()) {
      const seats = [...bySeat.keys()].sort((a, b) => a - b);
      const offsets = GROUP_OFFSETS[seats.length] ?? GROUP_OFFSETS[4]!;
      seats.forEach((seat, g) => {
        const ids = bySeat.get(seat)!.sort();
        const step = ids.length > 2 ? STACK_STEP_TALL : STACK_STEP;
        ids.forEach((id, index) =>
          map.set(id, {
            index,
            count: ids.length,
            dx: offsets[g] ?? 0,
            shared: seats.length > 1,
            step,
          }),
        );
      });
    }
    return map;
  }, [game.players, yardSlots]);

  /** Docking slot per finished token, in arrival order. */
  const homeSlots = useMemo(() => {
    const map = new Map<string, number>();
    for (const player of game.players) {
      let slot = 0;
      for (const pawn of player.pawns) {
        if (pawn.progress === HOME) map.set(pawn.id, slot++);
      }
    }
    return map;
  }, [game.players]);

  const prevProgress = useRef(new Map<string, number>());
  const [hops, setHops] = useState<Record<string, Hop>>({});
  const [bursts, setBursts] = useState<Burst[]>([]);

  const progressSig = game.players
    .map((p) => p.pawns.map((x) => `${x.id}:${x.progress}`).join(','))
    .join('|');

  useEffect(() => {
    const nextHops: Record<string, Hop> = {};
    const returnHops: Record<string, Hop> = {};
    const nextBursts: Burst[] = [];

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
            ? getYardSlotCell(pawn.seat, slot ?? 0)
            : getPawnCell(pawn.seat, prev, pawn.index, 0);

        prevProgress.current.set(pawn.id, pawn.progress);
        if (reducedMotion) continue;

        if (prev < 0 && pawn.progress >= 0) {
          nextHops[pawn.id] = buildEnterHop(fromCell, toCell);
          continue;
        }

        // Knocked back to the yard — hold on the square until the capturer lands
        if (prev >= 0 && pawn.progress < 0) {
          returnHops[pawn.id] = buildReturnHop(fromCell, toCell);
          nextBursts.push({
            key: `cap-${pawn.id}-${game.version}`,
            x: fromCell.col + 0.5,
            y: fromCell.row + 0.5,
            kind: 'capture',
            color: player.color,
          });
          continue;
        }

        if (pawn.progress === HOME) {
          const dock = homeDock(pawn.seat, homeSlots.get(pawn.id) ?? 0);
          nextBursts.push({
            key: `home-${pawn.id}-${game.version}`,
            x: dock.x,
            y: dock.y,
            kind: 'home',
            color: player.color,
          });
        }

        const wrapped = prev > 40 && pawn.progress < 20 && prev <= 50;
        const hop = buildWalkHop(fromCell, hopWaypoints(pawn.seat, prev, pawn.progress, wrapped));
        if (hop) nextHops[pawn.id] = hop;
      }
    }

    const approach = Math.max(
      0,
      ...Object.values(nextHops)
        .filter((h) => h.kind === 'walk' || h.kind === 'enter')
        .map((h) => h.duration),
    );
    for (const [id, hop] of Object.entries(returnHops)) {
      nextHops[id] = holdThen(hop, approach);
    }
    for (const burst of nextBursts) {
      if (burst.kind === 'capture') burst.delay = approach;
    }

    if (Object.keys(nextHops).length === 0 && nextBursts.length === 0) return;

    const timers: number[] = [];

    if (Object.keys(nextHops).length > 0) {
      setHops((h) => ({ ...h, ...nextHops }));
      for (const [id, hop] of Object.entries(nextHops)) {
        timers.push(
          window.setTimeout(
            () => {
              setHops((h) => {
                const copy = { ...h };
                delete copy[id];
                return copy;
              });
            },
            hop.duration * 1000 + 40,
          ),
        );
      }
    }

    if (nextBursts.length > 0) {
      setBursts((b) => [...b, ...nextBursts]);
      const keys = new Set(nextBursts.map((b) => b.key));
      timers.push(
        window.setTimeout(
          () => {
            setBursts((b) => b.filter((x) => !keys.has(x.key)));
          },
          900 + Math.max(0, ...nextBursts.map((b) => (b.delay ?? 0) * 1000)),
        ),
      );
    }

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressSig, reducedMotion, yardSlots, homeSlots]);

  const previews = useMemo(() => {
    if (game.phase !== 'waiting_move') {
      return [] as { move: Move; cell: { row: number; col: number }; strong: boolean }[];
    }
    return game.legalMoves.map((move) => {
      const pawn = game.players.flatMap((p) => p.pawns).find((p) => p.id === move.pawnId)!;
      const cell =
        move.toProgress < 0 ? getYardSlotCell(pawn.seat, 0) : cellOf(pawn.seat, move.toProgress)!;
      return {
        move,
        cell,
        strong: previewPawnId === move.pawnId || selectedId === move.pawnId,
      };
    });
  }, [game.phase, game.legalMoves, game.players, previewPawnId, selectedId]);

  /** Tokens that the highlighted move would knock back to the yard. */
  const doomedIds = useMemo(() => {
    if (game.phase !== 'waiting_move') return new Set<string>();
    const focus = previewPawnId ?? selectedId;
    const relevant = focus ? game.legalMoves.filter((m) => m.pawnId === focus) : game.legalMoves;
    return new Set(relevant.flatMap((m) => m.captures));
  }, [game.phase, game.legalMoves, previewPawnId, selectedId]);

  const placed = useMemo(
    () =>
      game.players.flatMap((player) =>
        player.pawns.map((pawn) => {
          if (pawn.progress === HOME) {
            const dock = homeDock(pawn.seat, homeSlots.get(pawn.id) ?? 0);
            return {
              pawn,
              player,
              stack: SOLO,
              home: true,
              x: dock.x,
              y: dock.y,
            };
          }
          const stack = stacks.get(pawn.id) ?? SOLO;
          const prev = prevProgress.current.get(pawn.id);
          const cell =
            pawn.progress < 0 && prev !== undefined && prev >= 0 && !hops[pawn.id]
              ? getPawnCell(pawn.seat, prev, pawn.index, 0)
              : getPawnCell(pawn.seat, pawn.progress, pawn.index, yardSlots.get(pawn.id));
          return {
            pawn,
            player,
            stack,
            home: false,
            x: cell.col + 0.5 + stack.dx,
            y: cell.row + 0.5 - stack.index * stack.step,
          };
        }),
      ),
    [game.players, stacks, yardSlots, homeSlots, hops],
  );

  // Painter's order: higher on screen draws first so stacks occlude correctly
  const drawOrder = useMemo(() => [...placed].sort((a, b) => a.y - b.y), [placed]);
  // Hit targets live in their own pass so a movable token is never blocked
  const hitOrder = useMemo(
    () =>
      [...placed].sort(
        (a, b) => Number(movableIds.has(a.pawn.id)) - Number(movableIds.has(b.pawn.id)),
      ),
    [placed, movableIds],
  );

  return (
    <div className="pointer-events-none absolute inset-0" data-testid="pawn-layer">
      <svg viewBox="0 0 15 15" className="h-full w-full overflow-visible">
        <PawnDefs />

        {/* Destination markers */}
        {previews.map(({ move, cell, strong }) => (
          <g key={`dest-${move.pawnId}`} data-testid={`dest-${move.pawnId}`}>
            <motion.circle
              cx={cell.col + 0.5}
              cy={cell.row + 0.5}
              r={strong ? 0.4 : 0.3}
              fill="none"
              stroke={accent.core}
              strokeWidth={strong ? 0.09 : 0.055}
              strokeDasharray={strong ? undefined : '0.13 0.11'}
              opacity={strong ? 1 : 0.6}
              initial={false}
              animate={reducedMotion || !strong ? { scale: 1 } : { scale: [1, 1.12, 1] }}
              transition={
                reducedMotion || !strong
                  ? { duration: 0 }
                  : { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }
              }
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            />
            {strong && (
              <circle cx={cell.col + 0.5} cy={cell.row + 0.5} r={0.13} fill={accent.core} />
            )}
          </g>
        ))}

        {/* Tokens */}
        {drawOrder.map(({ pawn, player, stack, home, x, y }) => {
          const movable = movableIds.has(pawn.id);
          const selected = selectedId === pawn.id;
          const doomed = doomedIds.has(pawn.id);
          const hop = hops[pawn.id];
          const r = (home ? HOME_R : movable ? 0.56 : 0.5) * (stack.shared ? SHARED_CELL_SCALE : 1);
          const isStackTop = stack.count > 1 && stack.index === stack.count - 1;

          const positionAnimate = hop ? { x: hop.x, y: hop.y } : { x, y };
          const positionTransition = reducedMotion
            ? { duration: 0 }
            : hop
              ? { duration: hop.duration, times: hop.times, ease: 'easeInOut' as const }
              : SPRING.token;

          const scaleAnimate = hop
            ? { scaleY: hop.scaleY, scale: 1 }
            : selected
              ? { scale: 1.12, scaleY: 1 }
              : movable
                ? { scale: [1, 1.07, 1], scaleY: 1 }
                : { scale: 1, scaleY: 1 };

          const scaleTransition = reducedMotion
            ? { duration: 0 }
            : hop
              ? { duration: hop.duration, times: hop.times, ease: 'easeInOut' as const }
              : movable && !selected
                ? { scale: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' as const } }
                : SPRING.tight;

          return (
            <motion.g
              key={pawn.id}
              initial={false}
              animate={positionAnimate}
              transition={positionTransition}
            >
              <motion.g
                initial={false}
                animate={scaleAnimate}
                transition={scaleTransition}
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              >
                <Token
                  skin={pawnSkin}
                  color={player.color}
                  r={r}
                  selected={selected}
                  movable={movable}
                  doomed={doomed}
                  collar={surface.collar}
                  gold={accent.gold}
                />
              </motion.g>
              {isStackTop && (
                <g
                  style={{ pointerEvents: 'none' }}
                  transform={
                    stack.shared
                      ? `scale(${SHARED_CELL_SCALE})`
                      : undefined
                  }
                >
                  <circle
                    cx={0.32}
                    cy={SKIN_BADGE_Y[pawnSkin]}
                    r={0.19}
                    fill="#05080f"
                    stroke={SEAT_RAMP[player.color].core}
                    strokeWidth={0.035}
                  />
                  <text
                    x={0.32}
                    y={SKIN_BADGE_Y[pawnSkin] + 0.065}
                    textAnchor="middle"
                    fontSize={0.26}
                    fontWeight={700}
                    fill={SEAT_RAMP[player.color].rim}
                    fontFamily="var(--font-body)"
                  >
                    {stack.count}
                  </text>
                </g>
              )}
            </motion.g>
          );
        })}

        {/* Impact effects sit above tokens so a capture reads instantly */}
        {bursts.map((burst) => {
          const ramp = SEAT_RAMP[burst.color];
          const delay = burst.delay ?? 0;
          if (burst.kind === 'capture') {
            return (
              <g key={burst.key} style={{ pointerEvents: 'none' }}>
                <motion.circle
                  cx={burst.x}
                  cy={burst.y}
                  fill="none"
                  stroke={accent.gold}
                  initial={{ r: 0.18, opacity: 0.95, strokeWidth: 0.14 }}
                  animate={{ r: 1.5, opacity: 0, strokeWidth: 0.02 }}
                  transition={{ duration: 0.62, ease: 'easeOut', delay }}
                />
                <motion.circle
                  cx={burst.x}
                  cy={burst.y}
                  fill="none"
                  stroke={ramp.core}
                  initial={{ r: 0.1, opacity: 0.8, strokeWidth: 0.1 }}
                  animate={{ r: 1.05, opacity: 0, strokeWidth: 0.02 }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: delay + 0.06 }}
                />
                <motion.circle
                  cx={burst.x}
                  cy={burst.y}
                  fill="#fff"
                  initial={{ r: 0.42, opacity: 0.85 }}
                  animate={{ r: 0.08, opacity: 0 }}
                  transition={{ duration: 0.28, ease: 'easeOut', delay }}
                />
              </g>
            );
          }
          return (
            <g key={burst.key} style={{ pointerEvents: 'none' }}>
              <motion.circle
                cx={burst.x}
                cy={burst.y}
                fill="none"
                stroke={ramp.rim}
                initial={{ r: 0.1, opacity: 1, strokeWidth: 0.12 }}
                animate={{ r: 1.2, opacity: 0, strokeWidth: 0.02 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
              {[0, 60, 120, 180, 240, 300].map((angle) => (
                <motion.line
                  key={angle}
                  x1={burst.x}
                  y1={burst.y}
                  x2={burst.x + Math.cos((angle * Math.PI) / 180) * 0.9}
                  y2={burst.y + Math.sin((angle * Math.PI) / 180) * 0.9}
                  stroke={ramp.core}
                  strokeWidth={0.06}
                  strokeLinecap="round"
                  initial={{ opacity: 0.9, pathLength: 0 }}
                  animate={{ opacity: 0, pathLength: 1 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              ))}
            </g>
          );
        })}

        {/* Hit targets — separate pass so movable tokens are always reachable */}
        {hitOrder.map(({ pawn, player, x, y }) => {
          const movable = movableIds.has(pawn.id);
          const hop = hops[pawn.id];
          const rIdx = ringIndexOf(pawn.seat, pawn.progress);
          return (
            <motion.circle
              key={`hit-${pawn.id}`}
              r={0.55}
              fill="transparent"
              className="pointer-events-auto cursor-pointer"
              style={{ pointerEvents: 'auto', outline: 'none' }}
              onPointerDown={(e) => e.currentTarget.blur()}
              onClick={(e) => {
                e.currentTarget.blur();
                onSelect(pawn.id);
              }}
              initial={false}
              animate={hop ? { cx: hop.x, cy: hop.y } : { cx: x, cy: y }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : hop
                    ? { duration: hop.duration, times: hop.times, ease: 'easeInOut' }
                    : SPRING.token
              }
              data-testid={pawn.id}
              data-progress={pawn.progress}
              data-ring-index={rIdx !== null ? String(rIdx) : undefined}
              role="button"
              tabIndex={movable ? 0 : -1}
              aria-label={`${player.color} pawn ${pawn.index + 1}`}
            />
          );
        })}
      </svg>
    </div>
  );
}
