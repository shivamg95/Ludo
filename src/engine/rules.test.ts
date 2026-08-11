import { describe, it, expect } from 'vitest';
import { createGame, reduce } from './engine';
import type { GameConfig, GameState } from './types';
import { legalMoves } from './rules';
import { getModeHooks } from './modes';
import { SEAT_COLORS } from './board';

function baseConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    mode: 'classic',
    seats: [0, 2],
    playerNames: { 0: 'Red', 2: 'Yellow' },
    bots: { 0: false, 2: false },
    seed: 42,
    ...overrides,
  };
}

function withDice(state: GameState, ...dice: number[]): GameState {
  return { ...state, diceQueue: [...dice] };
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

function rollAndMove(state: GameState, pawnId?: string): GameState {
  let s = reduce(state, { type: 'ROLL' });
  if (s.phase === 'waiting_move') {
    const id = pawnId ?? s.legalMoves[0]?.pawnId;
    if (id) s = reduce(s, { type: 'MOVE', pawnId: id });
  }
  return s;
}

describe('shared rules', () => {
  it('unlocks a pawn on roll of 1', () => {
    let s = createGame(baseConfig());
    s = withDice(s, 1);
    s = reduce(s, { type: 'ROLL' });
    expect(s.legalMoves.every((m) => m.unlocked)).toBe(true);
    expect(s.legalMoves).toHaveLength(4);
    s = reduce(s, { type: 'MOVE', pawnId: s.legalMoves[0]!.pawnId });
    const pawn = s.players[0]!.pawns.find((p) => p.progress === 0);
    expect(pawn).toBeTruthy();
  });

  it('unlocks a pawn on roll of 6', () => {
    let s = createGame(baseConfig());
    s = withDice(s, 6);
    s = reduce(s, { type: 'ROLL' });
    expect(s.legalMoves.some((m) => m.unlocked)).toBe(true);
    expect(s.phase).toBe('waiting_move');
  });

  it('grants extra roll on 6', () => {
    let s = createGame(baseConfig());
    s = setPawn(s, 0, 0, 0);
    s = withDice(s, 6);
    s = reduce(s, { type: 'ROLL' });
    const move = s.legalMoves.find((m) => m.pawnId === `pawn-red-0`)!;
    s = reduce(s, { type: 'MOVE', pawnId: move.pawnId });
    expect(s.phase).toBe('waiting_roll');
    expect(s.currentSeatIndex).toBe(0);
  });

  it('grants extra roll on unlock', () => {
    let s = createGame(baseConfig());
    s = withDice(s, 1);
    s = rollAndMove(s, `pawn-${SEAT_COLORS[0]}-0`);
    expect(s.phase).toBe('waiting_roll');
    expect(s.config.seats[s.currentSeatIndex]).toBe(0);
  });

  it('grants extra roll on capture', () => {
    let s = createGame(baseConfig());
    // Red at progress 0, Yellow at red's progress 5 cell → ring index 5
    s = setPawn(s, 0, 0, 0);
    // Yellow entry 26; we need yellow on ring index 5
    // ringIndex = (26 + progress) % 52 = 5 → progress = (5 - 26 + 52) % 52 = 31
    s = setPawn(s, 2, 0, 31);
    s = withDice(s, 5);
    s = reduce(s, { type: 'ROLL' });
    const move = s.legalMoves.find((m) => m.pawnId === 'pawn-red-0')!;
    expect(move.captures).toContain('pawn-yellow-0');
    s = reduce(s, { type: 'MOVE', pawnId: 'pawn-red-0' });
    expect(s.players.find((p) => p.seat === 2)!.pawns[0]!.progress).toBe(-1);
    expect(s.phase).toBe('waiting_roll');
    expect(s.config.seats[s.currentSeatIndex]).toBe(0);
  });

  it('grants extra roll on HOME', () => {
    let s = createGame(baseConfig());
    s = setPawn(s, 0, 0, 55);
    s = withDice(s, 1);
    s = reduce(s, { type: 'ROLL' });
    s = reduce(s, { type: 'MOVE', pawnId: 'pawn-red-0' });
    expect(s.players[0]!.pawns[0]!.progress).toBe(56);
    expect(s.phase).toBe('waiting_roll');
  });

  it('three consecutive 6s rolls back the turn', () => {
    let s = createGame(baseConfig());
    s = setPawn(s, 0, 0, 0);
    s = setPawn(s, 0, 1, 10);
    // Put a yellow pawn where red can capture on first 6
    // red progress 0 + 6 = 6; yellow at ring 6: (26+p)%52=6 → p=32
    s = setPawn(s, 2, 0, 32);
    s = withDice(s, 6, 6, 6);

    const before = structuredClone(s.players);
    s = reduce(s, { type: 'ROLL' });
    expect(s.legalMoves.length).toBeGreaterThan(0);
    s = reduce(s, { type: 'MOVE', pawnId: 'pawn-red-0' });
    expect(s.phase).toBe('waiting_roll');
    expect(s.players.find((p) => p.seat === 0)!.pawns[0]!.progress).toBe(6);
    expect(s.players.find((p) => p.seat === 2)!.pawns[0]!.progress).toBe(-1);

    s = reduce(s, { type: 'ROLL' });
    s = reduce(s, { type: 'MOVE', pawnId: s.legalMoves[0]!.pawnId });

    s = reduce(s, { type: 'ROLL' });
    // Third 6 → forfeit and rollback
    expect(s.events.some((e) => e.type === 'three_sixes_forfeit')).toBe(true);
    // Players restored to turn-start snapshot (before any of the three 6s)
    expect(s.players.find((p) => p.seat === 0)!.pawns[0]!.progress).toBe(
      before.find((p) => p.seat === 0)!.pawns[0]!.progress,
    );
    expect(s.players.find((p) => p.seat === 2)!.pawns[0]!.progress).toBe(
      before.find((p) => p.seat === 2)!.pawns[0]!.progress,
    );
    // Turn advanced to other player
    expect(s.config.seats[s.currentSeatIndex]).toBe(2);
    // Lifetime sixes still counted
    expect(s.players.find((p) => p.seat === 0)!.sixesRolled).toBeGreaterThanOrEqual(3);
  });

  it('ends turn immediately when no legal move (even on 6)', () => {
    let s = createGame(baseConfig());
    // All pawns near home where 6 overshoots
    s = setPawn(s, 0, 0, 54);
    s = setPawn(s, 0, 1, 54);
    s = setPawn(s, 0, 2, 54);
    s = setPawn(s, 0, 3, 54);
    s = withDice(s, 6);
    s = reduce(s, { type: 'ROLL' });
    expect(s.phase).toBe('waiting_roll');
    expect(s.config.seats[s.currentSeatIndex]).toBe(2);
  });

  it('requires exact count for HOME and rejects overshoot', () => {
    let s = createGame(baseConfig());
    s = setPawn(s, 0, 0, 54);
    s = withDice(s, 3);
    s = reduce(s, { type: 'ROLL' });
    expect(s.legalMoves.filter((m) => m.pawnId === 'pawn-red-0')).toHaveLength(0);
    // Turn ends
    expect(s.config.seats[s.currentSeatIndex]).toBe(2);

    s = createGame(baseConfig());
    s = setPawn(s, 0, 0, 54);
    s = withDice(s, 2);
    s = reduce(s, { type: 'ROLL' });
    expect(s.legalMoves.some((m) => m.pawnId === 'pawn-red-0' && m.toProgress === 56)).toBe(
      true,
    );
  });

  it('captures a single opponent pawn on a non-safe cell', () => {
    let s = createGame(baseConfig());
    s = setPawn(s, 0, 0, 1);
    // ring index of red progress 4 = 4; yellow: (26+p)%52=4 → p=30
    s = setPawn(s, 2, 0, 30);
    s = withDice(s, 3);
    s = reduce(s, { type: 'ROLL' });
    const move = s.legalMoves.find((m) => m.pawnId === 'pawn-red-0')!;
    expect(move.captures).toEqual(['pawn-yellow-0']);
    s = reduce(s, { type: 'MOVE', pawnId: 'pawn-red-0' });
    expect(s.players.find((p) => p.seat === 2)!.pawns[0]!.progress).toBe(-1);
  });

  it('does not capture a 2-stack of the same color', () => {
    let s = createGame(baseConfig());
    s = setPawn(s, 0, 0, 1);
    s = setPawn(s, 2, 0, 30);
    s = setPawn(s, 2, 1, 30);
    s = withDice(s, 3);
    s = reduce(s, { type: 'ROLL' });
    const move = s.legalMoves.find((m) => m.pawnId === 'pawn-red-0')!;
    expect(move.captures).toHaveLength(0);
  });

  it('captures multiple singleton colors on one cell', () => {
    let s = createGame({
      ...baseConfig(),
      seats: [0, 1, 2],
      playerNames: { 0: 'R', 1: 'G', 2: 'Y' },
      bots: { 0: false, 1: false, 2: false },
    });
    s = setPawn(s, 0, 0, 1);
    // ring 4: green entry 13 → (13+p)%52=4 → p=43; yellow p=30
    s = setPawn(s, 1, 0, 43);
    s = setPawn(s, 2, 0, 30);
    s = withDice(s, 3);
    s = reduce(s, { type: 'ROLL' });
    const move = s.legalMoves.find((m) => m.pawnId === 'pawn-red-0')!;
    expect(move.captures.sort()).toEqual(['pawn-green-0', 'pawn-yellow-0'].sort());
  });

  it('does not capture on safe squares', () => {
    let s = createGame(baseConfig());
    // Star at ring 8 — red progress 8
    s = setPawn(s, 0, 0, 2);
    // yellow on ring 8: (26+p)%52=8 → p=34
    s = setPawn(s, 2, 0, 34);
    s = withDice(s, 6);
    s = reduce(s, { type: 'ROLL' });
    const move = s.legalMoves.find((m) => m.pawnId === 'pawn-red-0' && m.toProgress === 8);
    expect(move?.captures ?? []).toHaveLength(0);
  });

  it('only owner may enter home column', () => {
    const hooks = getModeHooks('classic');
    let s = createGame(baseConfig());
    s = setPawn(s, 0, 0, 50);
    s = { ...s, diceValue: 1 };
    const moves = legalMoves(s, hooks);
    expect(moves.some((m) => m.toProgress === 51)).toBe(true);
  });
});

describe('classic mode', () => {
  it('wins when all 4 pawns are HOME and continues for rankings (3+ players)', () => {
    let s = createGame({
      ...baseConfig(),
      seats: [0, 1, 2],
      playerNames: { 0: 'R', 1: 'G', 2: 'Y' },
      bots: { 0: false, 1: false, 2: false },
    });
    s = setPawn(s, 0, 0, 56);
    s = setPawn(s, 0, 1, 56);
    s = setPawn(s, 0, 2, 56);
    s = setPawn(s, 0, 3, 55);
    s = withDice(s, 1);
    s = reduce(s, { type: 'ROLL' });
    s = reduce(s, { type: 'MOVE', pawnId: 'pawn-red-3' });
    expect(s.players.find((p) => p.seat === 0)!.finishedRank).toBe(1);
    expect(s.winnerBannerSeat).toBe(0);
    expect(s.phase).not.toBe('finished');
    // Next unfinished player (green or yellow)
    expect([1, 2]).toContain(s.config.seats[s.currentSeatIndex]);
  });

  it('ends when only one unfinished player remains', () => {
    let s = createGame({
      ...baseConfig(),
      seats: [0, 1, 2],
      playerNames: { 0: 'R', 1: 'G', 2: 'Y' },
      bots: { 0: false, 1: false, 2: false },
    });
    // Mark red finished
    s = {
      ...s,
      players: s.players.map((p) =>
        p.seat === 0
          ? {
              ...p,
              finishedRank: 1,
              pawns: p.pawns.map((pawn) => ({ ...pawn, progress: 56 })),
            }
          : p,
      ),
      rankings: [0],
      winnerBannerSeat: 0,
    };
    s = setPawn(s, 1, 0, 56);
    s = setPawn(s, 1, 1, 56);
    s = setPawn(s, 1, 2, 56);
    s = setPawn(s, 1, 3, 55);
    s = { ...s, currentSeatIndex: 1 };
    s = withDice(s, 1);
    s = reduce(s, { type: 'ROLL' });
    s = reduce(s, { type: 'MOVE', pawnId: 'pawn-green-3' });
    expect(s.phase).toBe('finished');
    expect(s.rankings[0]).toBe(0);
    expect(s.rankings[1]).toBe(1);
    expect(s.rankings[2]).toBe(2);
  });
});
