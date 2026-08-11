import type { GameState, Move, Pawn, Player } from './types';
import { isSafe, ringIndexOf } from './board';
import type { ModeHooks } from './modes/types';

function clonePlayers(players: Player[]): Player[] {
  return players.map((p) => ({
    ...p,
    pawns: p.pawns.map((pawn) => ({ ...pawn })),
  }));
}

function findPawn(players: Player[], pawnId: string): { player: Player; pawn: Pawn } | null {
  for (const player of players) {
    const pawn = player.pawns.find((p) => p.id === pawnId);
    if (pawn) return { player, pawn };
  }
  return null;
}

function pawnsAtRing(players: Player[], ringIndex: number): Pawn[] {
  const result: Pawn[] = [];
  for (const player of players) {
    for (const pawn of player.pawns) {
      if (pawn.progress >= 0 && pawn.progress <= 50) {
        const idx = ringIndexOf(pawn.seat, pawn.progress);
        if (idx === ringIndex) result.push(pawn);
      }
    }
  }
  return result;
}

function captureTargets(
  players: Player[],
  moverSeat: number,
  ringIndex: number,
): string[] {
  const onCell = pawnsAtRing(players, ringIndex);
  const bySeat = new Map<number, Pawn[]>();
  for (const p of onCell) {
    if (p.seat === moverSeat) continue;
    const list = bySeat.get(p.seat) ?? [];
    list.push(p);
    bySeat.set(p.seat, list);
  }
  const captured: string[] = [];
  for (const [, group] of bySeat) {
    if (group.length === 1) {
      captured.push(group[0]!.id);
    }
  }
  return captured;
}

/**
 * Compute destination progress for a pawn given a roll.
 * Returns null if the move is illegal (overshoot, locked home without wrap, etc.).
 */
export function computeDestination(
  pawn: Pawn,
  roll: number,
  canEnterHome: boolean,
  mode: GameState['config']['mode'],
): { toProgress: number; wrappedLap: boolean } | null {
  if (pawn.progress === 56) return null;

  // Unlock from yard
  if (pawn.progress === -1) {
    if (roll === 1 || roll === 6) {
      return { toProgress: 0, wrappedLap: false };
    }
    return null;
  }

  const next = pawn.progress + roll;

  // Still on ring (0..50)
  if (pawn.progress <= 50) {
    if (next <= 50) {
      return { toProgress: next, wrappedLap: false };
    }
    // Would enter home column (progress 51+)
    if (!canEnterHome) {
      if (mode === 'quick') {
        // Lap wrap: progress -= 51 while locked
        const wrapped = next - 51;
        if (wrapped < 0 || wrapped > 50) return null;
        return { toProgress: wrapped, wrappedLap: true };
      }
      return null;
    }
    // Can enter home — need exact or land in column / HOME
    if (next > 56) return null; // overshoot HOME
    return { toProgress: next, wrappedLap: false };
  }

  // Already in home column (51..55)
  if (pawn.progress >= 51 && pawn.progress <= 55) {
    if (!canEnterHome) return null;
    if (next > 56) return null;
    return { toProgress: next, wrappedLap: false };
  }

  return null;
}

export function legalMoves(state: GameState, hooks: ModeHooks): Move[] {
  if (state.diceValue === null) return [];
  const roll = state.diceValue;
  const activeSeat = state.config.seats[state.currentSeatIndex]!;
  const player = state.players.find((p) => p.seat === activeSeat)!;
  const canEnter = hooks.canEnterHome(state, player);
  const moves: Move[] = [];

  for (const pawn of player.pawns) {
    const dest = computeDestination(pawn, roll, canEnter, state.config.mode);
    if (!dest) continue;

    const unlocked = pawn.progress === -1 && dest.toProgress === 0;
    const enteredHome = dest.toProgress === 56;
    let captures: string[] = [];

    if (!unlocked && dest.toProgress >= 0 && dest.toProgress <= 50 && !dest.wrappedLap) {
      const ringIdx = ringIndexOf(pawn.seat, dest.toProgress)!;
      if (!isSafe(pawn.seat, dest.toProgress)) {
        captures = captureTargets(state.players, pawn.seat, ringIdx);
      }
    }

    // When wrapping in quick mode, destination is still on ring — check capture
    if (dest.wrappedLap && dest.toProgress >= 0 && dest.toProgress <= 50) {
      const ringIdx = ringIndexOf(pawn.seat, dest.toProgress)!;
      if (!isSafe(pawn.seat, dest.toProgress)) {
        captures = captureTargets(state.players, pawn.seat, ringIdx);
      }
    }

    moves.push({
      pawnId: pawn.id,
      fromProgress: pawn.progress,
      toProgress: dest.toProgress,
      roll,
      captures,
      enteredHome,
      unlocked,
      wrappedLap: dest.wrappedLap,
    });
  }

  return moves;
}

export function applyMove(state: GameState, move: Move, hooks: ModeHooks): GameState {
  const players = clonePlayers(state.players);
  const found = findPawn(players, move.pawnId);
  if (!found) return state;

  const { player, pawn } = found;
  const steps =
    move.unlocked || move.fromProgress === -1
      ? 0
      : move.wrappedLap
        ? move.roll
        : move.toProgress - move.fromProgress;

  pawn.progress = move.toProgress;
  if (move.wrappedLap) {
    pawn.laps += 1;
  }

  player.distanceTravelled += Math.max(0, steps);

  // Apply captures
  const capturedPawns: Pawn[] = [];
  for (const capId of move.captures) {
    const cap = findPawn(players, capId);
    if (!cap) continue;
    const victimProgress = cap.pawn.progress;
    cap.pawn.progress = -1;
    capturedPawns.push(cap.pawn);
    player.captures += 1;
    player.hasCaptured = true;
    hooks.onCapture?.(state, player, cap.player, victimProgress, players);
  }

  if (move.enteredHome) {
    hooks.onPawnHome?.(state, player, pawn, players);
  }

  let next: GameState = {
    ...state,
    players,
    legalMoves: [],
    selectedPawnId: null,
    version: state.version + 1,
  };

  // Mode-specific post-home (e.g. timed respawn)
  if (move.enteredHome) {
    next = hooks.afterPawnHome?.(next, player.seat) ?? next;
  }

  return next;
}

export { clonePlayers, findPawn };
