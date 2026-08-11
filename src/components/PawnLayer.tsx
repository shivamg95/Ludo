import { motion, AnimatePresence } from 'motion/react';
import type { GameState, SeatColor } from '../engine/types';
import { getPawnCell } from '../engine/selectors';
import { ringIndexOf } from '../engine/board';

const COLOR: Record<SeatColor, string> = {
  red: '#e23d3d',
  green: '#2f9e5c',
  yellow: '#e2b93d',
  blue: '#3d7ee2',
};

interface Props {
  game: GameState;
  movableIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  reducedMotion?: boolean;
}

export function PawnLayer({ game, movableIds, selectedId, onSelect, reducedMotion }: Props) {
  const occupancy = new Map<string, string[]>();
  for (const player of game.players) {
    for (const pawn of player.pawns) {
      const cell = getPawnCell(pawn.seat, pawn.progress, pawn.index);
      const key = `${cell.row.toFixed(2)},${cell.col.toFixed(2)},${pawn.progress}`;
      const list = occupancy.get(key) ?? [];
      list.push(pawn.id);
      occupancy.set(key, list);
    }
  }

  const fanOffset = (id: string, key: string) => {
    const list = occupancy.get(key) ?? [id];
    const i = list.indexOf(id);
    const n = list.length;
    if (n <= 1) return { dx: 0, dy: 0 };
    const angle = (i / n) * Math.PI * 2;
    return { dx: Math.cos(angle) * 0.22, dy: Math.sin(angle) * 0.22 };
  };

  return (
    <div className="pointer-events-none absolute inset-0" data-testid="pawn-layer">
      <svg viewBox="0 0 15 15" className="h-full w-full">
        <AnimatePresence>
          {game.players.flatMap((player) =>
            player.pawns.map((pawn) => {
              const cell = getPawnCell(pawn.seat, pawn.progress, pawn.index);
              const key = `${cell.row.toFixed(2)},${cell.col.toFixed(2)},${pawn.progress}`;
              const { dx, dy } = fanOffset(pawn.id, key);
              const movable = movableIds.has(pawn.id);
              const selected = selectedId === pawn.id;
              const cx = cell.col + 0.5 + dx;
              const cy = cell.row + 0.5 + dy;
              const rIdx = ringIndexOf(pawn.seat, pawn.progress);

              return (
                <motion.circle
                  key={pawn.id}
                  cx={cx}
                  cy={cy}
                  r={movable ? 0.48 : 0.34}
                  fill={COLOR[player.color]}
                  stroke={selected ? '#fff' : 'rgba(0,0,0,0.35)'}
                  strokeWidth={selected ? 0.1 : 0.05}
                  initial={false}
                  animate={{ cx, cy, scale: selected ? 1.12 : 1 }}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 320, damping: 22 }
                  }
                  className="pointer-events-auto cursor-pointer"
                  style={{ pointerEvents: 'auto' }}
                  onClick={() => onSelect(pawn.id)}
                  data-testid={pawn.id}
                  data-progress={pawn.progress}
                  data-ring-index={rIdx !== null ? String(rIdx) : undefined}
                  role="button"
                  tabIndex={movable ? 0 : -1}
                  aria-label={`${player.color} pawn ${pawn.index + 1}`}
                />
              );
            }),
          )}
        </AnimatePresence>
      </svg>
    </div>
  );
}
