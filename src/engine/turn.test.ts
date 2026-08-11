import { describe, it, expect } from 'vitest';
import { createGame, reduce } from './engine';
import { autoplay, tick, rollDice, doMove, pass } from './turn';
import type { GameState } from './types';

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

describe('turn machine coverage', () => {
  it('autoplay finishes a hard-stopped timed game', () => {
    let s = createGame({
      mode: 'timed',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: true, 2: true },
      seed: 3,
      durationMs: 1000,
      turnTimerEnabled: false,
    });
    s = { ...s, hardStopped: true, phase: 'waiting_roll', gameStartMs: 0, clockMsRemaining: 0 };
    s = autoplay(s);
    expect(s.phase).toBe('finished');
  });

  it('autoplay rolls and moves for bots', () => {
    let s = createGame({
      mode: 'classic',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: true, 2: true },
      seed: 42,
    });
    s = { ...s, diceQueue: [6] };
    s = autoplay(s);
    // After autoplay from waiting_roll with 6, should unlock or advance
    expect(s.version).toBeGreaterThan(0);
  });

  it('rollDice hard-stops when clock already elapsed', () => {
    let s = createGame({
      mode: 'timed',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: false, 2: false },
      seed: 1,
      durationMs: 1000,
    });
    s = { ...s, clockMsRemaining: 0, gameStartMs: 0 };
    s = rollDice(s);
    expect(s.phase).toBe('finished');
    expect(s.hardStopped).toBe(true);
  });

  it('tick ignores finished games and non-timed', () => {
    let s = createGame({
      mode: 'timed',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: false, 2: false },
      seed: 1,
      durationMs: 5000,
    });
    s = { ...s, phase: 'finished', rankings: [0, 2], gameStartMs: 0 };
    expect(tick(s, 100).phase).toBe('finished');
  });

  it('doMove no-ops when not waiting_move', () => {
    const s = createGame({
      mode: 'classic',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: false, 2: false },
      seed: 1,
    });
    expect(doMove(s, 'pawn-red-0')).toEqual(s);
  });

  it('pass from waiting_roll advances', () => {
    const s = createGame({
      mode: 'classic',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: false, 2: false },
      seed: 1,
    });
    const next = pass(s);
    expect(next.config.seats[next.currentSeatIndex]).toBe(2);
  });

  it('extra roll resets consecutive sixes when bonus is not from a 6', () => {
    let s = createGame({
      mode: 'classic',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: false, 2: false },
      seed: 1,
    });
    s = setPawn(s, 0, 0, 55);
    s = { ...s, diceQueue: [1], consecutiveSixes: 2 };
    s = reduce(s, { type: 'ROLL' });
    s = reduce(s, { type: 'MOVE', pawnId: 'pawn-red-0' });
    expect(s.phase).toBe('waiting_roll');
    expect(s.consecutiveSixes).toBe(0);
  });

  it('autoplay returns early when finished', () => {
    let s = createGame({
      mode: 'classic',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: false, 2: false },
      seed: 1,
    });
    s = { ...s, phase: 'finished', rankings: [0, 2] };
    expect(autoplay(s).phase).toBe('finished');
  });
});
