import { describe, it, expect } from 'vitest';
import {
  RING,
  SEATS,
  manhattan,
  cellKey,
  ringIndexOf,
  cellOf,
  SAFE_RING_INDICES,
} from './board';

describe('board geometry', () => {
  it('has exactly 52 unique ring cells', () => {
    expect(RING).toHaveLength(52);
    const keys = RING.map(cellKey);
    expect(new Set(keys).size).toBe(52);
  });

  it('consecutive ring cells are adjacent (orthogonal, or diagonal at cross corners)', () => {
    // Within each 13-cell arm, indices 4→5 jump the cross corner (manhattan 2).
    // All other steps, including arm junctions and 51→0, are manhattan 1.
    for (let i = 0; i < 52; i++) {
      const a = RING[i]!;
      const b = RING[(i + 1) % 52]!;
      const d = manhattan(a, b);
      const isCrossCorner = i % 13 === 4;
      if (isCrossCorner) {
        expect(d).toBe(2);
      } else {
        expect(d).toBe(1);
      }
    }
  });

  it('each seat start equals ring[entryIndex]', () => {
    for (const seat of SEATS) {
      expect(RING[seat.entryIndex]).toEqual(seat.startCell);
    }
  });

  it('ring[(entry+50)%52] is adjacent to first home-column cell for every seat', () => {
    for (const seat of SEATS) {
      const lastRing = RING[(seat.entryIndex + 50) % 52]!;
      const firstHome = seat.homeColumn[0]!;
      expect(manhattan(lastRing, firstHome)).toBe(1);
    }
  });

  it('home-column cells are consecutive and adjacent', () => {
    for (const seat of SEATS) {
      expect(seat.homeColumn).toHaveLength(5);
      for (let i = 0; i < 4; i++) {
        expect(manhattan(seat.homeColumn[i]!, seat.homeColumn[i + 1]!)).toBe(1);
      }
    }
  });

  it('ring and home-column cells never overlap', () => {
    const ringKeys = new Set(RING.map(cellKey));
    for (const seat of SEATS) {
      for (const cell of seat.homeColumn) {
        expect(ringKeys.has(cellKey(cell))).toBe(false);
      }
    }
  });

  it('no ring or home-column cell falls inside a yard block', () => {
    const all = [...RING, ...SEATS.flatMap((s) => s.homeColumn)];
    for (const cell of all) {
      for (const seat of SEATS) {
        const y = seat.yard;
        const inYard =
          cell.row >= y.rowMin &&
          cell.row <= y.rowMax &&
          cell.col >= y.colMin &&
          cell.col <= y.colMax;
        expect(inYard).toBe(false);
      }
    }
  });

  it('safe squares are the 4 starts + 4 stars', () => {
    expect(SAFE_RING_INDICES).toEqual(new Set([0, 8, 13, 21, 26, 34, 39, 47]));
  });

  it('ringIndexOf and cellOf map progress correctly', () => {
    expect(ringIndexOf(0, 0)).toBe(0);
    expect(cellOf(0, 0)).toEqual({ row: 6, col: 1 });
    expect(ringIndexOf(1, 0)).toBe(13);
    expect(cellOf(0, 51)).toEqual(SEATS[0]!.homeColumn[0]);
    expect(cellOf(0, 56)).toEqual({ row: 7, col: 7 });
    expect(cellOf(0, -1)).toBeNull();
  });
});
