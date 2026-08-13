import type { Cell, GameState, Move, Player } from './types';
import { cellOf, ringIndexOf, isSafe, SEATS, RING } from './board';
import { currentSeat, currentPlayer } from './turn';

export function getCurrentSeat(state: GameState): number {
  return currentSeat(state);
}

export function getCurrentPlayer(state: GameState): Player {
  return currentPlayer(state);
}

const YARD_SLOTS = [
  { dr: 1.5, dc: 1.5 },
  { dr: 1.5, dc: 3.5 },
  { dr: 3.5, dc: 1.5 },
  { dr: 3.5, dc: 3.5 },
] as const;

/** Yard cell for a packed slot index (0..3), re-packing remaining yard pawns tightly. */
export function getYardSlotCell(seat: number, slotIndex: number): Cell {
  const y = SEATS[seat]!.yard;
  const slot = YARD_SLOTS[Math.max(0, Math.min(3, slotIndex))]!;
  return { row: y.rowMin + slot.dr, col: y.colMin + slot.dc };
}

/**
 * Visual board cell for a pawn.
 * `yardSlot` packs remaining yard pawns into the first N slots so the yard
 * never looks sparse after unlocks.
 */
export function getPawnCell(seat: number, progress: number, pawnIndex: number, yardSlot?: number) {
  if (progress < 0) {
    return getYardSlotCell(seat, yardSlot ?? pawnIndex);
  }
  return cellOf(seat, progress)!;
}

/** Intermediate cells for hop animation from → to (exclusive of start, inclusive of end). */
export function hopWaypoints(
  seat: number,
  fromProgress: number,
  toProgress: number,
  wrappedLap = false,
): Cell[] {
  if (fromProgress < 0 && toProgress === 0) {
    return [cellOf(seat, 0)!];
  }
  if (fromProgress < 0) return [cellOf(seat, toProgress)!];
  if (toProgress < 0) {
    // Capture return — single hop back to yard (caller packs yard)
    return [];
  }

  const cells: Cell[] = [];
  if (wrappedLap) {
    // Walk to 50, then wrap to toProgress
    for (let p = fromProgress + 1; p <= 50; p++) {
      const c = cellOf(seat, p);
      if (c) cells.push(c);
    }
    for (let p = 0; p <= toProgress; p++) {
      const c = cellOf(seat, p);
      if (c) cells.push(c);
    }
    return cells;
  }

  const step = toProgress >= fromProgress ? 1 : -1;
  for (let p = fromProgress + step; step > 0 ? p <= toProgress : p >= toProgress; p += step) {
    const c = cellOf(seat, p);
    if (c) cells.push(c);
  }
  return cells;
}

export function getMovablePawnIds(state: GameState): string[] {
  return state.legalMoves.map((m) => m.pawnId);
}

export function getMoveForPawn(state: GameState, pawnId: string): Move | undefined {
  return state.legalMoves.find((m) => m.pawnId === pawnId);
}

export function isPlayerFinished(state: GameState, seat: number): boolean {
  const p = state.players.find((pl) => pl.seat === seat);
  return p?.finishedRank !== null;
}

export function formatProgress(progress: number): string {
  if (progress < 0) return 'yard';
  if (progress <= 50) return `ring:${progress}`;
  if (progress <= 55) return `home:${progress - 51}`;
  return 'HOME';
}

export function boardOccupancy(state: GameState): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const player of state.players) {
    for (const pawn of player.pawns) {
      if (pawn.progress < 0 || pawn.progress === 56) continue;
      const cell = cellOf(pawn.seat, pawn.progress);
      if (!cell) continue;
      const key = `${cell.row},${cell.col}`;
      const list = map.get(key) ?? [];
      list.push(pawn.id);
      map.set(key, list);
    }
  }
  return map;
}

export function formatEvent(
  type: string,
  detail?: Record<string, unknown>,
  playerName?: string,
): string {
  const who = playerName ?? 'Player';
  switch (type) {
    case 'roll':
      return `${who} rolled ${detail?.value ?? '?'}`;
    case 'move': {
      const caps = detail?.captures as string[] | undefined;
      if (caps?.length) return `${who} captured (${caps.length})`;
      if (detail?.to === 56) return `${who} reached home`;
      if (detail?.from === -1) return `${who} entered the board`;
      return `${who} moved`;
    }
    case 'three_sixes_forfeit':
      return `${who} forfeited (three 6s)`;
    case 'pass':
      return `${who} passed`;
    default:
      return `${who}: ${type}`;
  }
}

export { cellOf, ringIndexOf, isSafe, SEATS, RING };
