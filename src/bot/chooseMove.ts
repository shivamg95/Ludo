import type { GameState, Move, Pawn, Player } from '../engine/types';
import { ringIndexOf, isSafe } from '../engine/board';
import { randomInt } from '../engine/rng';

function enemiesWithin(state: GameState, seat: number, progress: number, window: number): number {
  if (progress < 0 || progress > 50) return 0;
  const myRing = ringIndexOf(seat, progress)!;
  let count = 0;
  for (const player of state.players) {
    if (player.seat === seat) continue;
    for (const pawn of player.pawns) {
      if (pawn.progress < 0 || pawn.progress > 50) continue;
      const theirRing = ringIndexOf(pawn.seat, pawn.progress)!;
      for (let d = 1; d <= window; d++) {
        if ((theirRing + d) % 52 === myRing) {
          count += 1;
          break;
        }
      }
    }
  }
  return count;
}

function stackSizeAt(state: GameState, seat: number, progress: number): number {
  if (progress < 0 || progress > 50) return 0;
  const ring = ringIndexOf(seat, progress)!;
  let n = 0;
  for (const player of state.players) {
    for (const pawn of player.pawns) {
      if (pawn.progress < 0 || pawn.progress > 50) continue;
      if (ringIndexOf(pawn.seat, pawn.progress) === ring) n += 1;
    }
  }
  return n;
}

function findPawn(state: GameState, id: string): Pawn | undefined {
  for (const p of state.players) {
    const pawn = p.pawns.find((x) => x.id === id);
    if (pawn) return pawn;
  }
  return undefined;
}

function currentPlayer(state: GameState): Player {
  const seat = state.config.seats[state.currentSeatIndex]!;
  return state.players.find((p) => p.seat === seat)!;
}

function scoreMove(state: GameState, move: Move): number {
  const player = currentPlayer(state);
  const mode = state.config.mode;
  let score = 0;

  // Captures
  if (move.captures.length > 0) {
    for (const capId of move.captures) {
      const victim = findPawn(state, capId);
      const vp = victim?.progress ?? 0;
      score += 100 + vp * 2;
      if (mode === 'quick' && !player.hasCaptured) {
        score += 500; // huge bonus to unlock home
      }
    }
  }

  // Exact HOME
  if (move.enteredHome) {
    score += 200;
    if (mode === 'quick') score += 300;
  }

  // Enter home column
  if (move.toProgress >= 51 && move.toProgress <= 55 && move.fromProgress <= 50) {
    score += 80;
  }

  // Unlock
  if (move.unlocked) {
    const onBoard = player.pawns.filter((p) => p.progress >= 0 && p.progress < 56).length;
    const inYard = player.pawns.filter((p) => p.progress < 0).length;
    if (inYard > 0 && onBoard < 2) score += 60;
    else score += 25;
  }

  // Safe square / stack
  if (move.toProgress >= 0 && move.toProgress <= 50) {
    if (isSafe(player.seat, move.toProgress)) score += 40;
    const stack = stackSizeAt(state, player.seat, move.toProgress);
    // After landing we'll have +1 of ours; check if forming 2-stack of ours
    const oursThere = state.players
      .find((p) => p.seat === player.seat)!
      .pawns.filter(
        (p) =>
          p.id !== move.pawnId &&
          p.progress >= 0 &&
          p.progress <= 50 &&
          ringIndexOf(p.seat, p.progress) === ringIndexOf(player.seat, move.toProgress),
      ).length;
    if (oursThere >= 1 || stack >= 1) score += 35;
  }

  // Escape threat
  if (move.fromProgress >= 0 && move.fromProgress <= 50) {
    const threats = enemiesWithin(state, player.seat, move.fromProgress, 6);
    if (threats > 0) score += 55 * threats;
  }

  // Penalty for landing in danger
  if (move.toProgress >= 0 && move.toProgress <= 50 && !isSafe(player.seat, move.toProgress)) {
    const threats = enemiesWithin(state, player.seat, move.toProgress, 6);
    score -= 20 * threats;
  }

  // Advance lead pawn
  const pawn = findPawn(state, move.pawnId);
  if (pawn) {
    const maxProg = Math.max(...player.pawns.map((p) => p.progress));
    if (pawn.progress === maxProg) score += 10;
    score += move.toProgress * 0.5;
  }

  // Timed mode: weight immediate points
  if (mode === 'timed') {
    const steps =
      move.unlocked || move.fromProgress === -1
        ? 0
        : move.wrappedLap
          ? move.roll
          : move.toProgress - move.fromProgress;
    score += steps * 5;
    score += move.captures.length * 30 * 5;
    if (move.enteredHome) score += 50 * 5;
  }

  return score;
}

/**
 * Choose the best legal move. Ties broken by seeded RNG for determinism.
 */
export function chooseMove(state: GameState): Move | null {
  const moves = state.legalMoves;
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0]!;

  const scored = moves.map((m) => ({ move: m, score: scoreMove(state, m) }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!.score;
  const tied = scored.filter((s) => s.score === best);

  if (tied.length === 1) return tied[0]!.move;

  const { value } = randomInt(state.rng, tied.length);
  return tied[value]!.move;
}
