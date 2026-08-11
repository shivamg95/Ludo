import { describe, it, expect } from 'vitest';
import { createGame, reduce } from '../engine';
import type { GameConfig, GameState } from '../types';
import { timedRanking, addScore } from '../scoring';

function timedConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mode: 'timed',
    seats: [0, 2],
    playerNames: { 0: 'Red', 2: 'Yellow' },
    bots: { 0: false, 2: false },
    seed: 7,
    durationMs: 60_000,
    turnTimerEnabled: false,
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

describe('timed mode', () => {
  it('starts all pawns on start square (progress 0)', () => {
    const s = createGame(timedConfig());
    for (const p of s.players) {
      expect(p.pawns.every((pawn) => pawn.progress === 0)).toBe(true);
    }
  });

  it('scores +1 per step moved', () => {
    let s = createGame(timedConfig());
    s = { ...s, diceQueue: [3] };
    s = reduce(s, { type: 'ROLL' });
    s = reduce(s, { type: 'MOVE', pawnId: 'pawn-red-0' });
    expect(s.players.find((p) => p.seat === 0)!.score).toBe(3);
    expect(s.players.find((p) => p.seat === 0)!.pawns[0]!.progress).toBe(3);
  });

  it('scores +30 for capture and victim loses progress points', () => {
    let s = createGame(timedConfig());
    s = setPawn(s, 0, 0, 1);
    s = setPawn(s, 2, 0, 30); // on ring 4
    // Give yellow some score to lose
    s = {
      ...s,
      players: s.players.map((p) => (p.seat === 2 ? { ...p, score: 40 } : p)),
    };
    s = { ...s, diceQueue: [3] };
    s = reduce(s, { type: 'ROLL' });
    s = reduce(s, { type: 'MOVE', pawnId: 'pawn-red-0' });
    const red = s.players.find((p) => p.seat === 0)!;
    const yellow = s.players.find((p) => p.seat === 2)!;
    expect(red.score).toBe(3 + 30); // steps + capture
    expect(yellow.score).toBe(40 - 30); // lost victim progress
    expect(yellow.pawns[0]!.progress).toBe(-1);
  });

  it('scores +50 on HOME', () => {
    let s = createGame(timedConfig());
    s = setPawn(s, 0, 0, 55);
    s = { ...s, diceQueue: [1] };
    s = reduce(s, { type: 'ROLL' });
    s = reduce(s, { type: 'MOVE', pawnId: 'pawn-red-0' });
    expect(s.players.find((p) => p.seat === 0)!.score).toBe(1 + 50);
  });

  it('entering from yard scores 0 steps', () => {
    let s = createGame(timedConfig());
    s = setPawn(s, 0, 0, -1);
    s = { ...s, diceQueue: [6] };
    s = reduce(s, { type: 'ROLL' });
    s = reduce(s, { type: 'MOVE', pawnId: 'pawn-red-0' });
    expect(s.players.find((p) => p.seat === 0)!.score).toBe(0);
    expect(s.players.find((p) => p.seat === 0)!.pawns[0]!.progress).toBe(0);
  });

  it('floors score at 0', () => {
    const player = {
      seat: 0,
      color: 'red' as const,
      name: 'R',
      isBot: false,
      finishedRank: null,
      score: 5,
      captures: 0,
      distanceTravelled: 0,
      sixesRolled: 0,
      hasCaptured: false,
      pawns: [],
    };
    addScore(player, -10);
    expect(player.score).toBe(0);
  });

  it('respawns all pawns to yard when all four reach HOME', () => {
    let s = createGame(timedConfig());
    s = setPawn(s, 0, 0, 56);
    s = setPawn(s, 0, 1, 56);
    s = setPawn(s, 0, 2, 56);
    s = setPawn(s, 0, 3, 55);
    s = { ...s, diceQueue: [1] };
    s = reduce(s, { type: 'ROLL' });
    s = reduce(s, { type: 'MOVE', pawnId: 'pawn-red-3' });
    const red = s.players.find((p) => p.seat === 0)!;
    expect(red.pawns.every((p) => p.progress === -1)).toBe(true);
  });

  it('hard stops at 00:00 and ranks by score', () => {
    let s = createGame(timedConfig({ durationMs: 1000 }));
    s = {
      ...s,
      players: s.players.map((p) =>
        p.seat === 0 ? { ...p, score: 100 } : { ...p, score: 50 },
      ),
      gameStartMs: 0,
    };
    s = reduce(s, { type: 'TICK', nowMs: 1000 });
    expect(s.hardStopped).toBe(true);
    expect(s.phase).toBe('finished');
    expect(s.rankings[0]).toBe(0);
  });

  it('tie-breaks by captures, distance, then seat', () => {
    let s = createGame(timedConfig());
    s = {
      ...s,
      players: s.players.map((p) => {
        if (p.seat === 0) return { ...p, score: 10, captures: 1, distanceTravelled: 5 };
        return { ...p, score: 10, captures: 2, distanceTravelled: 3 };
      }),
      hardStopped: true,
    };
    expect(timedRanking(s)[0]).toBe(2);
  });
});
