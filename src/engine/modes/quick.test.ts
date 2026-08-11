import { describe, it, expect } from 'vitest';
import { createGame, reduce } from '../engine';
import type { GameConfig, GameState } from '../types';
import { legalMoves } from '../rules';
import { getModeHooks } from './index';

function quickConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mode: 'quick',
    seats: [0, 2],
    playerNames: { 0: 'Red', 2: 'Yellow' },
    bots: { 0: false, 2: false },
    seed: 11,
    ...overrides,
  };
}

function setPawn(state: GameState, seat: number, index: number, progress: number): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.seat !== seat
        ? p
        : {
            ...p,
            pawns: p.pawns.map((pawn) =>
              pawn.index === index ? { ...pawn, progress } : pawn,
            ),
          },
    ),
  };
}

describe('quick mode', () => {
  it('locks home entrance until player has captured', () => {
    let s = createGame(quickConfig());
    s = setPawn(s, 0, 0, 50);
    s = { ...s, diceValue: 1 };
    const hooks = getModeHooks('quick');
    const moves = legalMoves(s, hooks);
    // Should wrap, not enter home
    const m = moves.find((x) => x.pawnId === 'pawn-red-0')!;
    expect(m.wrappedLap).toBe(true);
    expect(m.toProgress).toBe(0); // 51 - 51 = 0
  });

  it('wraps lap: progress -= 51, laps += 1', () => {
    let s = createGame(quickConfig());
    s = setPawn(s, 0, 0, 48);
    s = { ...s, diceQueue: [5] };
    s = reduce(s, { type: 'ROLL' });
    s = reduce(s, { type: 'MOVE', pawnId: 'pawn-red-0' });
    const pawn = s.players.find((p) => p.seat === 0)!.pawns[0]!;
    // 48+5=53 → wrap to 53-51=2
    expect(pawn.progress).toBe(2);
    expect(pawn.laps).toBe(1);
  });

  it('unlocks home for all four pawns after one capture', () => {
    let s = createGame(quickConfig());
    s = setPawn(s, 0, 0, 1);
    s = setPawn(s, 2, 0, 30);
    s = { ...s, diceQueue: [3] };
    s = reduce(s, { type: 'ROLL' });
    s = reduce(s, { type: 'MOVE', pawnId: 'pawn-red-0' });
    const red = s.players.find((p) => p.seat === 0)!;
    expect(red.hasCaptured).toBe(true);

    // Now home should be enterable
    s = setPawn(s, 0, 1, 50);
    s = { ...s, phase: 'waiting_roll', diceQueue: [1], currentSeatIndex: 0 };
    s = reduce(s, { type: 'ROLL' });
    const move = s.legalMoves.find((m) => m.pawnId === 'pawn-red-1')!;
    expect(move.toProgress).toBe(51);
    expect(move.wrappedLap).toBe(false);
  });

  it('first pawn HOME ends the game immediately', () => {
    let s = createGame(quickConfig());
    s = {
      ...s,
      players: s.players.map((p) =>
        p.seat === 0 ? { ...p, hasCaptured: true } : p,
      ),
    };
    s = setPawn(s, 0, 0, 55);
    s = { ...s, diceQueue: [1] };
    s = reduce(s, { type: 'ROLL' });
    s = reduce(s, { type: 'MOVE', pawnId: 'pawn-red-0' });
    expect(s.phase).toBe('finished');
    expect(s.rankings[0]).toBe(0);
  });
});
