import type { GameState, Move, Player } from './types';
import { cellOf, ringIndexOf, isSafe, SEATS } from './board';
import { currentSeat, currentPlayer } from './turn';

export function getCurrentSeat(state: GameState): number {
  return currentSeat(state);
}

export function getCurrentPlayer(state: GameState): Player {
  return currentPlayer(state);
}

export function getPawnCell(seat: number, progress: number, pawnIndex: number) {
  if (progress < 0) {
    const y = SEATS[seat]!.yard;
    const positions = [
      { row: y.rowMin + 1.5, col: y.colMin + 1.5 },
      { row: y.rowMin + 1.5, col: y.colMax - 1.5 },
      { row: y.rowMax - 1.5, col: y.colMin + 1.5 },
      { row: y.rowMax - 1.5, col: y.colMax - 1.5 },
    ];
    return positions[pawnIndex]!;
  }
  return cellOf(seat, progress)!;
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

export { cellOf, ringIndexOf, isSafe, SEATS };
