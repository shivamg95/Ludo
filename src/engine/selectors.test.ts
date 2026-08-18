import { describe, it, expect } from 'vitest';
import type { Pawn, Player } from './types';
import { playerProgressPercent } from './selectors';

function pawn(index: number, progress: number): Pawn {
  return { id: `pawn-red-${index}`, seat: 0, index, progress, laps: 0 };
}

function player(progresses: number[]): Player {
  return {
    seat: 0,
    color: 'red',
    name: 'Red',
    isBot: false,
    finishedRank: null,
    score: 0,
    captures: 0,
    distanceTravelled: 0,
    sixesRolled: 0,
    hasCaptured: false,
    pawns: progresses.map((p, i) => pawn(i, p)),
  };
}

describe('playerProgressPercent', () => {
  it('is 0 when every pawn is in the yard', () => {
    expect(playerProgressPercent(player([-1, -1, -1, -1]))).toBe(0);
  });

  it('is 100 when every pawn is HOME', () => {
    expect(playerProgressPercent(player([56, 56, 56, 56]))).toBe(100);
  });

  it('is 25 when one pawn is HOME and the rest are in the yard', () => {
    expect(playerProgressPercent(player([56, -1, -1, -1]))).toBe(25);
  });

  it('counts start-square progress as 0 and mixed track progress by 224ths', () => {
    // 0 + 2 + 0 + 0 = 2/224 → 1%
    expect(playerProgressPercent(player([0, 2, -1, -1]))).toBe(1);
  });

  it('treats yard as 0 even when mixed with home-column progress', () => {
    // 55 / 224 → 25%
    expect(playerProgressPercent(player([55, -1, -1, -1]))).toBe(25);
  });
});
