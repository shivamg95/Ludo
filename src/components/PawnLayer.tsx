import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { GameState, Move, SeatColor } from '../engine/types';
import { getPawnCell, hopWaypoints, getYardSlotCell } from '../engine/selectors';
import { ringIndexOf, cellOf, SEATS } from '../engine/board';
import { SEAT_DEEP, SEAT_HEX, SEAT_MID, ACCENT } from '../theme/seats';
import { bounceHop, captureHop, type HopTrack } from '../ui/hop';
import { IMPACT_GAP_S } from '../ui/motion';

interface Props {
  game: GameState;
  movableIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDest: (id: string) => void;
  reducedMotion?: boolean;
  previewPawnId?: string | null;
  onHopsScheduled?: (ms: number) => void;
  onHopComplete?: () => void;
  onImpact?: (x: number, y: number) => void;
  onHopSfx?: (kind: 'land' | 'capture' | 'home') => void;
}

type Hop = HopTrack;

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
      <ellipse
        cx={cx + 0.02}
        cy={cy + r * 0.55}
        rx={baseR * 0.95}
        ry={baseR * 0.28}
        fill="rgba(0,0,0,0.35)"
        filter="url(#pawn-blur)"
      />
      <ellipse
        cx={cx}
        cy={cy + r * 0.28}
        rx={baseR}
        ry={baseR * 0.42}
        fill={`url(#pawn-base-${color})`}
        stroke={SEAT_DEEP[color]}
        strokeWidth={0.035}
      />
      <ellipse
        cx={cx}
        cy={cy + r * 0.22}
        rx={baseR * 0.72}
        ry={baseR * 0.28}
        fill={`url(#pawn-base-inner-${color})`}
      />
      <circle
        cx={cx}
        cy={bodyCy}
        r={bodyR}
        fill={`url(#pawn-body-${color})`}
        stroke={selected ? '#fff' : movable ? 'rgba(255,255,255,0.55)' : SEAT_DEEP[color]}
        strokeWidth={selected ? 0.09 : movable ? 0.07 : 0.04}
      />
      <ellipse
        cx={cx}
        cy={bodyCy + bodyR * 0.08}
        rx={bodyR * 0.82}
        ry={bodyR * 0.16}
        fill="none"
        stroke={SEAT_HEX[color]}
        strokeWidth={0.045}
        opacity={0.85}
      />
      <ellipse
        cx={cx}
        cy={bodyCy + bodyR * 0.15}
        rx={bodyR * 0.86}
        ry={bodyR * 0.22}
        fill={`url(#pawn-band-${color})`}
        opacity={0.55}
      />
      <circle
        cx={cx}
        cy={crownCy}
        r={crownR}
        fill={`url(#pawn-crown-${color})`}
        stroke={SEAT_DEEP[color]}
        strokeWidth={0.03}
      />
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
  onDest,
  reducedMotion,
  previewPawnId,
  onHopsScheduled,
  onHopComplete,
  onImpact,
  onHopSfx,
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
  const [impact, setImpact] = useState<{ x: number; y: number; key: number } | null>(null);
  const [homeBurst, setHomeBurst] = useState<{ x: number; y: number; color: SeatColor; key: number } | null>(
    null,
  );
  const [lingerPreviews, setLingerPreviews] = useState<
    { move: Move; cell: { row: number; col: number }; strong: boolean; color: SeatColor }[]
  >([]);
  const hopGen = useRef(0);

  const progressSig = game.players
    .map((p) => p.pawns.map((x) => `${x.id}:${x.progress}`).join(','))
    .join('|');

  useEffect(() => {
    const nextHops: Record<string, Hop> = {};
    const captures: {
      id: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
    }[] = [];
    let moverDuration = 0;
    let homeAt: { x: number; y: number; color: SeatColor } | null = null;
    let impactAt: { x: number; y: number } | null = null;
    let sawChange = false;

    for (const player of game.players) {
      for (const pawn of player.pawns) {
        const prev = prevProgress.current.get(pawn.id);
        if (prev === undefined) {
          prevProgress.current.set(pawn.id, pawn.progress);
          continue;
        }
        if (prev === pawn.progress) continue;
        sawChange = true;

        const slot = yardSlots.get(pawn.id);
        const toCell = getPawnCell(pawn.seat, pawn.progress, pawn.index, slot);
        const fromCell =
          prev < 0
            ? getYardSlotCell(pawn.seat, yardSlots.get(pawn.id) ?? 0)
            : getPawnCell(pawn.seat, prev, pawn.index, 0);

        prevProgress.current.set(pawn.id, pawn.progress);
        if (reducedMotion) continue;

        const from = { x: fromCell.col + 0.5, y: fromCell.row + 0.5 };
        const to = { x: toCell.col + 0.5, y: toCell.row + 0.5 };

        if (pawn.progress < 0 && prev >= 0) {
          captures.push({ id: pawn.id, from, to });
          impactAt = from;
          continue;
        }

        const wrapped = prev > 40 && pawn.progress < 20 && prev <= 50;
        const waypoints = hopWaypoints(pawn.seat, prev, pawn.progress, wrapped);
        const points = [
          from,
          ...waypoints.map((c) => ({ x: c.col + 0.5, y: c.row + 0.5 })),
        ];
        const hop = bounceHop(points, { arc: prev < 0 });
        if (!hop) continue;
        nextHops[pawn.id] = hop;
        moverDuration = Math.max(moverDuration, hop.duration);
        if (pawn.progress === 56) {
          const hub = SEATS[pawn.seat]!;
          const cx = hub.color === 'red' || hub.color === 'blue' ? 6.7 : 8.3;
          const cy = hub.color === 'red' || hub.color === 'green' ? 6.7 : 8.3;
          homeAt = { x: cx, y: cy, color: player.color };
        }
      }
    }

    for (const cap of captures) {
      nextHops[cap.id] = captureHop(cap.from, cap.to, moverDuration + IMPACT_GAP_S);
    }

    if (!sawChange) return;
    const gen = ++hopGen.current;

    const maxMs =
      Object.keys(nextHops).length === 0
        ? 0
        : Math.max(...Object.values(nextHops).map((h) => (h.delay + h.duration) * 1000));

    onHopsScheduled?.(maxMs);

    if (maxMs === 0) return;

    setHops((h) => ({ ...h, ...nextHops }));

    if (impactAt) {
      window.setTimeout(() => {
        if (hopGen.current !== gen) return;
        setImpact({ x: impactAt!.x, y: impactAt!.y, key: gen });
        onImpact?.(impactAt!.x, impactAt!.y);
        onHopSfx?.('capture');
      }, moverDuration * 1000);
    }

    if (homeAt) {
      window.setTimeout(() => {
        if (hopGen.current !== gen) return;
        setHomeBurst({ ...homeAt!, key: gen });
        onHopSfx?.('home');
      }, moverDuration * 1000);
    } else if (!impactAt) {
      window.setTimeout(() => onHopSfx?.('land'), Math.min(180, maxMs));
    }

    const timers = Object.entries(nextHops).map(([id, hop]) =>
      window.setTimeout(
        () => {
          if (hopGen.current !== gen) return;
          setHops((h) => {
            const copy = { ...h };
            delete copy[id];
            return copy;
          });
        },
        (hop.delay + hop.duration) * 1000 + 40,
      ),
    );

    const done = window.setTimeout(() => {
      if (hopGen.current !== gen) return;
      setLingerPreviews([]);
      onHopComplete?.();
    }, maxMs + 50);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressSig, reducedMotion]);

  const livePreviews = useMemo(() => {
    if (game.phase !== 'waiting_move') {
      return [] as { move: Move; cell: { row: number; col: number }; strong: boolean; color: SeatColor }[];
    }
    return game.legalMoves.map((move) => {
      const pawn = game.players.flatMap((p) => p.pawns).find((p) => p.id === move.pawnId)!;
      const player = game.players.find((p) => p.pawns.some((x) => x.id === move.pawnId))!;
      const cell =
        move.toProgress < 0
          ? getYardSlotCell(pawn.seat, 0)
          : cellOf(pawn.seat, move.toProgress)!;
      return {
        move,
        cell,
        strong: previewPawnId === move.pawnId || selectedId === move.pawnId,
        color: player.color,
      };
    });
  }, [game.phase, game.legalMoves, game.players, previewPawnId, selectedId]);

  useEffect(() => {
    if (livePreviews.length > 0) setLingerPreviews(livePreviews);
  }, [livePreviews]);

  const previews = livePreviews.length > 0 ? livePreviews : lingerPreviews;

  const paths = useMemo(() => {
    if (game.phase !== 'waiting_move') return [];
    return game.legalMoves.map((move) => {
      const pawn = game.players.flatMap((p) => p.pawns).find((p) => p.id === move.pawnId)!;
      const player = game.players.find((p) => p.pawns.some((x) => x.id === move.pawnId))!;
      const slot = yardSlots.get(pawn.id);
      const fromCell = getPawnCell(pawn.seat, pawn.progress, pawn.index, slot);
      const waypoints = hopWaypoints(pawn.seat, pawn.progress, move.toProgress, move.wrappedLap);
      const pts = [
        `${fromCell.col + 0.5},${fromCell.row + 0.5}`,
        ...waypoints.map((c) => `${c.col + 0.5},${c.row + 0.5}`),
      ].join(' ');
      return {
        id: move.pawnId,
        pts,
        color: player.color,
        strong: previewPawnId === move.pawnId || selectedId === move.pawnId,
        dest: waypoints[waypoints.length - 1] ?? fromCell,
        steps: waypoints.length,
      };
    });
  }, [game.phase, game.legalMoves, game.players, previewPawnId, selectedId, yardSlots]);

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
          {(Object.keys(SEAT_HEX) as SeatColor[]).map((c) => (
            <g key={c}>
              <radialGradient id={`pawn-body-${c}`} cx="32%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
                <stop offset="28%" stopColor={SEAT_HEX[c]} />
                <stop offset="72%" stopColor={SEAT_MID[c]} />
                <stop offset="100%" stopColor={SEAT_DEEP[c]} />
              </radialGradient>
              <radialGradient id={`pawn-crown-${c}`} cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.75" />
                <stop offset="40%" stopColor={SEAT_HEX[c]} />
                <stop offset="100%" stopColor={SEAT_DEEP[c]} />
              </radialGradient>
              <linearGradient id={`pawn-base-${c}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={SEAT_HEX[c]} />
                <stop offset="100%" stopColor={SEAT_DEEP[c]} />
              </linearGradient>
              <radialGradient id={`pawn-base-inner-${c}`} cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor={SEAT_HEX[c]} stopOpacity="0.9" />
                <stop offset="100%" stopColor={SEAT_DEEP[c]} />
              </radialGradient>
              <linearGradient id={`pawn-band-${c}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={SEAT_DEEP[c]} stopOpacity="0" />
                <stop offset="50%" stopColor={SEAT_DEEP[c]} stopOpacity="0.45" />
                <stop offset="100%" stopColor={SEAT_DEEP[c]} stopOpacity="0" />
              </linearGradient>
            </g>
          ))}
        </defs>

        {paths.map((p) => (
          <g key={`path-${p.id}`}>
            <polyline
              points={p.pts}
              fill="none"
              stroke={p.strong ? SEAT_HEX[p.color] : SEAT_HEX[p.color]}
              strokeWidth={p.strong ? 0.1 : 0.045}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={p.strong ? 0.85 : 0.28}
            />
            {p.strong && p.dest && (
              <text
                x={p.dest.col + 0.5}
                y={p.dest.row + 0.18}
                textAnchor="middle"
                fontSize={0.32}
                fill={ACCENT}
                fontWeight={700}
              >
                {p.steps}
              </text>
            )}
          </g>
        ))}

        {previews.map(({ move, cell, strong }) => (
          <g key={`dest-${move.pawnId}`} data-testid={`dest-${move.pawnId}`}>
            <motion.circle
              cx={cell.col + 0.5}
              cy={cell.row + 0.5}
              r={strong ? 0.4 : 0.3}
              fill="none"
              stroke={strong ? ACCENT : 'rgba(94,194,160,0.55)'}
              strokeWidth={strong ? 0.1 : 0.06}
              strokeDasharray={strong ? undefined : '0.12 0.1'}
              className="pointer-events-auto cursor-pointer dest-ring"
              style={{ pointerEvents: 'auto' }}
              animate={{ opacity: strong ? [0.7, 1, 0.7] : [0.45, 0.75, 0.45] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              onClick={(e) => {
                e.stopPropagation();
                onDest(move.pawnId);
              }}
            />
            {strong && (
              <circle
                cx={cell.col + 0.5}
                cy={cell.row + 0.5}
                r={0.14}
                fill="rgba(94,194,160,0.45)"
                className="pointer-events-auto cursor-pointer"
                style={{ pointerEvents: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDest(move.pawnId);
                }}
              />
            )}
          </g>
        ))}

        {impact && (
          <motion.circle
            key={`impact-${impact.key}`}
            cx={impact.x}
            cy={impact.y}
            r={0.2}
            fill="rgba(255,255,255,0.9)"
            initial={{ r: 0.15, opacity: 0.95 }}
            animate={{ r: 0.7, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          />
        )}

        {homeBurst &&
          Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <motion.circle
                key={`burst-${homeBurst.key}-${i}`}
                cx={homeBurst.x}
                cy={homeBurst.y}
                r={0.08}
                fill={SEAT_HEX[homeBurst.color]}
                initial={{ cx: homeBurst.x, cy: homeBurst.y, opacity: 1, r: 0.1 }}
                animate={{
                  cx: homeBurst.x + Math.cos(a) * 0.85,
                  cy: homeBurst.y + Math.sin(a) * 0.85,
                  opacity: 0,
                  r: 0.04,
                }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
              />
            );
          })}

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

          const hopTransition = hop
            ? {
                duration: hop.duration,
                delay: hop.delay,
                ease: 'easeInOut' as const,
                times: hop.times,
              }
            : null;

          const transition = reducedMotion
            ? { duration: 0 }
            : hopTransition
              ? hopTransition
              : { type: 'spring' as const, stiffness: 380, damping: 26 };

          return (
            <g key={pawn.id}>
              <motion.circle
                r={0.85}
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
                animate={hop ? { cx: hop.x, cy: hop.y } : { cx, cy }}
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
                        x: hop.x,
                        y: hop.y,
                        scaleY: hop.scaleY,
                        scale: hop.scale,
                        rotate: hop.rotate,
                      }
                    : {
                        x: cx,
                        y: cy,
                        scaleY: 1,
                        scale: selected ? 1.1 : movable ? [1, 1.06, 1] : 1,
                        rotate: 0,
                      }
                }
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : hop
                      ? hopTransition!
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
