import { describe, it, expect } from 'vitest';
import {
  createGame,
  reduce,
  reduceAll,
  getCurrentSeat,
  getCurrentPlayer,
  getPawnCell,
  getMovablePawnIds,
  getMoveForPawn,
  isPlayerFinished,
  formatProgress,
  formatEvent,
  hopWaypoints,
  boardOccupancy,
  autoplay,
  pass,
  selectPawn,
  tick,
} from './index';
import { applyTimedMoveScores, timedRanking } from './scoring';
import { yardCell, seatsForPlayerCount, isSafe } from './board';

describe('engine entry + selectors', () => {
  it('reduce handles all action types', () => {
    let s = createGame({
      mode: 'classic',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: false, 2: true },
      seed: 123,
    });
    s = reduce(s, { type: 'SET_DICE_QUEUE', queue: [6, 2] });
    expect(s.diceQueue).toEqual([6, 2]);
    s = reduce(s, { type: 'ROLL' });
    expect(s.phase).toBe('waiting_move');
    s = reduce(s, { type: 'SELECT_PAWN', pawnId: 'pawn-red-0' });
    expect(s.selectedPawnId).toBe('pawn-red-0');
    s = reduce(s, { type: 'MOVE', pawnId: 'pawn-red-0' });
    expect(getCurrentSeat(s)).toBe(0); // extra roll
    s = reduceAll(s, [{ type: 'PASS' }]);
    expect(getCurrentSeat(s)).toBe(2);
  });

  it('selectors expose derived UI data', () => {
    let s = createGame({
      mode: 'classic',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: false, 2: false },
      seed: 1,
    });
    s = {
      ...s,
      players: s.players.map((p) =>
        p.seat === 0
          ? {
              ...p,
              pawns: p.pawns.map((pawn, i) =>
                i === 0 ? { ...pawn, progress: 5 } : pawn,
              ),
            }
          : p,
      ),
    };
    expect(getCurrentPlayer(s).seat).toBe(0);
    expect(getPawnCell(0, -1, 0).row).toBeGreaterThanOrEqual(0);
    expect(getPawnCell(0, 5, 0)).toEqual({ row: 5, col: 6 });
    expect(formatProgress(-1)).toBe('yard');
    expect(formatProgress(10)).toBe('ring:10');
    expect(formatProgress(52)).toBe('home:1');
    expect(formatProgress(56)).toBe('HOME');
    expect(isPlayerFinished(s, 0)).toBe(false);
    expect(boardOccupancy(s).size).toBeGreaterThan(0);
    s = { ...s, diceValue: 1, phase: 'waiting_move' as const, legalMoves: [] };
    expect(getMovablePawnIds(s)).toEqual([]);
    expect(getMoveForPawn(s, 'x')).toBeUndefined();
  });

  it('hopWaypoints and formatEvent cover path helpers', () => {
    expect(hopWaypoints(0, -1, 0)).toHaveLength(1);
    expect(hopWaypoints(0, -1, 4)).toHaveLength(1);
    expect(hopWaypoints(0, 3, -1)).toEqual([]);
    expect(hopWaypoints(0, 48, 2, true).length).toBeGreaterThan(2);
    expect(hopWaypoints(0, 2, 5).length).toBe(3);
    expect(hopWaypoints(0, 5, 2).length).toBe(3);

    expect(formatEvent('roll', { value: 4 }, 'Red')).toBe('Red rolled 4');
    expect(formatEvent('move', { captures: ['a'] }, 'Red')).toContain('captured');
    expect(formatEvent('move', { to: 56 }, 'Red')).toContain('home');
    expect(formatEvent('move', { from: -1 }, 'Red')).toContain('entered');
    expect(formatEvent('move', { from: 2, to: 5 }, 'Red')).toBe('Red moved');
    expect(formatEvent('three_sixes_forfeit', undefined, 'Red')).toContain('forfeited');
    expect(formatEvent('pass', undefined, 'Red')).toContain('passed');
    expect(formatEvent('unknown', undefined, 'Red')).toContain('unknown');
  });

  it('reduce default, timed turn deadline, and empty autoplay move', () => {
    let s = createGame({
      mode: 'timed',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: false, 2: false },
      seed: 1,
      durationMs: 60_000,
      turnTimerEnabled: true,
    });
    expect(s.turnDeadlineMs).toBe(20_000);
    s = reduce(s, { type: 'PASS' });
    expect(s.turnDeadlineMs).toBe(20_000);
    s = { ...s, phase: 'waiting_move', legalMoves: [] };
    s = autoplay(s);
    expect(s.phase).toBe('waiting_roll');
    expect(reduce(s, { type: 'NOPE' } as never)).toEqual(s);
  });

  it('autoplay and pass advance the turn', () => {
    let s = createGame({
      mode: 'classic',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: true, 2: true },
      seed: 99,
    });
    s = autoplay(s);
    expect(['waiting_roll', 'waiting_move', 'finished']).toContain(s.phase);
    s = pass(s);
    expect(s.phase).toBe('waiting_roll');
  });

  it('tick is a no-op outside timed mode', () => {
    const s = createGame({
      mode: 'classic',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: false, 2: false },
      seed: 1,
    });
    expect(tick(s, 1000)).toEqual(s);
  });

  it('yardCell and seatsForPlayerCount helpers', () => {
    expect(seatsForPlayerCount(2)).toEqual([0, 2]);
    expect(seatsForPlayerCount(3)).toEqual([0, 1, 2]);
    expect(seatsForPlayerCount(4)).toEqual([0, 1, 2, 3]);
    expect(yardCell(0, 0)).toBeTruthy();
    expect(isSafe(0, 0)).toBe(true);
    expect(isSafe(0, 56)).toBe(true);
  });

  it('applyTimedMoveScores aggregates deltas', () => {
    const s = createGame({
      mode: 'timed',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: false, 2: false },
      seed: 1,
      durationMs: 1000,
    });
    const players = s.players.map((p) => ({ ...p, pawns: p.pawns.map((x) => ({ ...x })) }));
    players[1]!.score = 20;
    applyTimedMoveScores(players, 0, 4, [{ seat: 2, progress: 10 }], true);
    expect(players[0]!.score).toBe(4 + 30 + 50);
    expect(players[1]!.score).toBe(10);
    expect(timedRanking({ ...s, players })[0]).toBe(0);
  });

  it('selectPawn ignores illegal ids', () => {
    let s = createGame({
      mode: 'classic',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: false, 2: false },
      seed: 1,
    });
    s = { ...s, phase: 'waiting_move', legalMoves: [], diceValue: 2 };
    expect(selectPawn(s, 'nope').selectedPawnId).toBeNull();
  });
});
