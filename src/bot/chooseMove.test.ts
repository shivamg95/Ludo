import { describe, it, expect } from 'vitest';
import { createGame } from '../engine/engine';
import { chooseMove } from './chooseMove';
import type { GameState } from '../engine/types';
import { legalMoves } from '../engine/rules';
import { getModeHooks } from '../engine/modes';

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

describe('bot heuristics', () => {
  it('prefers a capture over a plain advance', () => {
    let s = createGame({
      mode: 'classic',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: true, 2: false },
      seed: 1,
    });
    s = setPawn(s, 0, 0, 1);
    s = setPawn(s, 0, 1, 10);
    s = setPawn(s, 2, 0, 30); // ring 4
    s = { ...s, diceValue: 3, phase: 'waiting_move' };
    s = { ...s, legalMoves: legalMoves(s, getModeHooks('classic')) };
    const move = chooseMove(s)!;
    expect(move.captures.length).toBeGreaterThan(0);
  });

  it('prefers exact HOME landing', () => {
    let s = createGame({
      mode: 'classic',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: true, 2: false },
      seed: 1,
    });
    s = setPawn(s, 0, 0, 55);
    s = setPawn(s, 0, 1, 10);
    s = { ...s, diceValue: 1, phase: 'waiting_move' };
    s = { ...s, legalMoves: legalMoves(s, getModeHooks('classic')) };
    const move = chooseMove(s)!;
    expect(move.enteredHome).toBe(true);
  });

  it('prefers escaping a threatened pawn', () => {
    let s = createGame({
      mode: 'classic',
      seats: [0, 2],
      playerNames: { 0: 'R', 2: 'Y' },
      bots: { 0: true, 2: false },
      seed: 1,
    });
    // Red at progress 10 (ring 10). Yellow at ring 7 → can reach in 3.
    // yellow: (26+p)%52=7 → p=33. Other red pawn is behind and safe-ish.
    s = setPawn(s, 0, 0, 10);
    s = setPawn(s, 0, 1, 2);
    s = setPawn(s, 2, 0, 33);
    s = { ...s, diceValue: 2, phase: 'waiting_move' };
    s = { ...s, legalMoves: legalMoves(s, getModeHooks('classic')) };
    const move = chooseMove(s)!;
    expect(move.pawnId).toBe('pawn-red-0');
  });
});
