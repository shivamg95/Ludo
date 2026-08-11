import type { Cell, SeatColor, SeatDef } from './types';

const rot = (r: number, c: number): Cell => ({ row: c, col: 14 - r });

const ARM0: Cell[] = [
  { row: 6, col: 1 },
  { row: 6, col: 2 },
  { row: 6, col: 3 },
  { row: 6, col: 4 },
  { row: 6, col: 5 },
  { row: 5, col: 6 },
  { row: 4, col: 6 },
  { row: 3, col: 6 },
  { row: 2, col: 6 },
  { row: 1, col: 6 },
  { row: 0, col: 6 },
  { row: 0, col: 7 },
  { row: 0, col: 8 },
];

function rotateArm(arm: Cell[], times: number): Cell[] {
  let cells = arm.map((c) => ({ ...c }));
  for (let t = 0; t < times; t++) {
    cells = cells.map((c) => rot(c.row, c.col));
  }
  return cells;
}

/** 52-cell ring, index 0-51 clockwise. */
export const RING: Cell[] = [
  ...ARM0,
  ...rotateArm(ARM0, 1),
  ...rotateArm(ARM0, 2),
  ...rotateArm(ARM0, 3),
];

/** Safe ring indices: 4 starts + 4 stars. */
export const SAFE_RING_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const SEAT_COLORS: SeatColor[] = ['red', 'green', 'yellow', 'blue'];

export const SEATS: SeatDef[] = [
  {
    seat: 0,
    color: 'red',
    entryIndex: 0,
    startCell: { row: 6, col: 1 },
    homeColumn: [
      { row: 7, col: 1 },
      { row: 7, col: 2 },
      { row: 7, col: 3 },
      { row: 7, col: 4 },
      { row: 7, col: 5 },
    ],
    yard: { rowMin: 0, rowMax: 5, colMin: 0, colMax: 5 },
  },
  {
    seat: 1,
    color: 'green',
    entryIndex: 13,
    startCell: { row: 1, col: 8 },
    homeColumn: [
      { row: 1, col: 7 },
      { row: 2, col: 7 },
      { row: 3, col: 7 },
      { row: 4, col: 7 },
      { row: 5, col: 7 },
    ],
    yard: { rowMin: 0, rowMax: 5, colMin: 9, colMax: 14 },
  },
  {
    seat: 2,
    color: 'yellow',
    entryIndex: 26,
    startCell: { row: 8, col: 13 },
    homeColumn: [
      { row: 7, col: 13 },
      { row: 7, col: 12 },
      { row: 7, col: 11 },
      { row: 7, col: 10 },
      { row: 7, col: 9 },
    ],
    yard: { rowMin: 9, rowMax: 14, colMin: 9, colMax: 14 },
  },
  {
    seat: 3,
    color: 'blue',
    entryIndex: 39,
    startCell: { row: 13, col: 6 },
    homeColumn: [
      { row: 13, col: 7 },
      { row: 12, col: 7 },
      { row: 11, col: 7 },
      { row: 10, col: 7 },
      { row: 9, col: 7 },
    ],
    yard: { rowMin: 9, rowMax: 14, colMin: 0, colMax: 5 },
  },
];

export function cellKey(cell: Cell): string {
  return `${cell.row},${cell.col}`;
}

export function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function ringIndexOf(seat: number, progress: number): number | null {
  if (progress < 0 || progress > 50) return null;
  const entry = SEATS[seat]!.entryIndex;
  return (entry + progress) % 52;
}

export function cellOf(seat: number, progress: number): Cell | null {
  if (progress < 0) return null;
  if (progress <= 50) {
    const idx = ringIndexOf(seat, progress)!;
    return RING[idx]!;
  }
  if (progress <= 55) {
    return SEATS[seat]!.homeColumn[progress - 51]!;
  }
  // HOME — center of the board triangle for this seat
  return { row: 7, col: 7 };
}

export function isSafeRing(ringIndex: number): boolean {
  return SAFE_RING_INDICES.has(ringIndex);
}

export function isSafe(seat: number, progress: number): boolean {
  if (progress < 0) return true;
  if (progress >= 51) return true; // home column + HOME
  const idx = ringIndexOf(seat, progress);
  return idx !== null && isSafeRing(idx);
}

/** Active seats for a given player count. */
export function seatsForPlayerCount(n: number): number[] {
  if (n === 2) return [0, 2];
  if (n === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}

export function yardCell(seat: number, pawnIndex: number): Cell {
  const y = SEATS[seat]!.yard;
  const positions: Cell[] = [
    { row: y.rowMin + 1, col: y.colMin + 1 },
    { row: y.rowMin + 1, col: y.colMax - 1 },
    { row: y.rowMax - 1, col: y.colMin + 1 },
    { row: y.rowMax - 1, col: y.colMax - 1 },
  ];
  return positions[pawnIndex] ?? { row: y.rowMin + 2, col: y.colMin + 2 };
}
