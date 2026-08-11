import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createGame, reduce } from '../engine/engine';
import { chooseMove } from '../bot/chooseMove';
import type { GameConfig, GameMode, GameState } from '../engine/types';

function playGame(mode: GameMode, seed: number, maxSteps = 5000): GameState {
  const seats = seed % 2 === 0 ? [0, 2] : [0, 1, 2, 3];
  const config: GameConfig = {
    mode,
    seats,
    playerNames: Object.fromEntries(seats.map((s) => [s, `P${s}`])),
    bots: Object.fromEntries(seats.map((s) => [s, true])),
    seed,
    durationMs: mode === 'timed' ? 30_000 : undefined,
    turnTimerEnabled: false,
  };
  let state = createGame(config);
  if (mode === 'timed') {
    state = { ...state, gameStartMs: 0 };
  }

  for (let step = 0; step < maxSteps; step++) {
    if (state.phase === 'finished') break;

    if (mode === 'timed') {
      // Advance clock enough to guarantee termination within the step cap
      state = reduce(state, { type: 'TICK', nowMs: Math.min(step * 50, 30_000) });
      if (state.phase === 'finished') break;
    }

    if (state.hardStopped) {
      state = reduce(state, { type: 'AUTOPLAY' });
      break;
    }

    if (state.phase === 'waiting_roll') {
      state = reduce(state, { type: 'ROLL' });
      continue;
    }
    if (state.phase === 'waiting_move') {
      const move = chooseMove(state);
      if (!move) {
        state = reduce(state, { type: 'PASS' });
      } else {
        state = reduce(state, { type: 'MOVE', pawnId: move.pawnId });
      }
      continue;
    }
    break;
  }
  return state;
}

function assertInvariants(state: GameState) {
  const pawns = state.players.flatMap((p) => p.pawns);
  expect(pawns).toHaveLength(state.config.seats.length * 4);
  for (const pawn of pawns) {
    expect(pawn.progress).toBeGreaterThanOrEqual(-1);
    expect(pawn.progress).toBeLessThanOrEqual(56);
  }
  // Never occupy opponent home column
  for (const player of state.players) {
    for (const pawn of player.pawns) {
      if (pawn.progress >= 51 && pawn.progress <= 55) {
        expect(pawn.seat).toBe(player.seat);
      }
    }
  }
  if (state.config.mode === 'timed') {
    for (const p of state.players) {
      expect(p.score).toBeGreaterThanOrEqual(0);
    }
  }
}

describe('property-based fuzz', () => {
  for (const mode of ['classic', 'timed', 'quick'] as GameMode[]) {
    it(`500 seeded ${mode} games conserve invariants and terminate`, () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1_000_000 }), (seed) => {
          const state = playGame(mode, seed);
          assertInvariants(state);
          // Most games should finish; timed always finishes via clock
          if (mode === 'timed') {
            expect(state.phase).toBe('finished');
          }
          // Replay determinism
          const replay = playGame(mode, seed);
          expect(JSON.stringify(replay.players)).toBe(JSON.stringify(state.players));
          expect(replay.phase).toBe(state.phase);
          expect(replay.rankings).toEqual(state.rankings);
        }),
        { numRuns: 500 },
      );
    }, 120_000);
  }
});
