import type { ReactNode } from 'react';
import { RING, SEATS, SAFE_RING_INDICES } from '../engine/board';
import type { SeatColor } from '../engine/types';

const COLOR: Record<SeatColor, string> = {
  red: '#e23d3d',
  green: '#2f9e5c',
  yellow: '#e2b93d',
  blue: '#3d7ee2',
};

function cellRect(row: number, col: number, fill: string, extra?: Record<string, string>) {
  return (
    <rect
      key={`c-${row}-${col}-${fill}`}
      x={col}
      y={row}
      width={1}
      height={1}
      fill={fill}
      stroke="rgba(0,0,0,0.18)"
      strokeWidth={0.03}
      data-testid={`cell-r${row}-c${col}`}
      {...extra}
    />
  );
}

export function BoardSvg({ lockedSeats = [] as number[] }: { lockedSeats?: number[] }) {
  const cells: ReactNode[] = [];

  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      cells.push(cellRect(r, c, '#d9e0ea'));
    }
  }

  for (const seat of SEATS) {
    const y = seat.yard;
    for (let r = y.rowMin; r <= y.rowMax; r++) {
      for (let c = y.colMin; c <= y.colMax; c++) {
        cells.push(cellRect(r, c, COLOR[seat.color]));
      }
    }
    for (let r = y.rowMin + 1; r <= y.rowMax - 1; r++) {
      for (let c = y.colMin + 1; c <= y.colMax - 1; c++) {
        cells.push(cellRect(r, c, '#f4f7fb'));
      }
    }
  }

  for (let i = 0; i < RING.length; i++) {
    const cell = RING[i]!;
    const safe = SAFE_RING_INDICES.has(i);
    cells.push(
      cellRect(cell.row, cell.col, '#f4f7fb', {
        'data-ring-index': String(i),
        ...(safe ? { 'data-safe': 'true' } : {}),
      }),
    );
  }

  for (const seat of SEATS) {
    cells.push(cellRect(seat.startCell.row, seat.startCell.col, COLOR[seat.color]));
  }

  for (const seat of SEATS) {
    for (const cell of seat.homeColumn) {
      cells.push(cellRect(cell.row, cell.col, COLOR[seat.color]));
    }
  }

  const triangles = [
    { points: '6,6 7.5,7.5 6,9', fill: COLOR.red },
    { points: '6,6 9,6 7.5,7.5', fill: COLOR.green },
    { points: '9,6 9,9 7.5,7.5', fill: COLOR.yellow },
    { points: '6,9 9,9 7.5,7.5', fill: COLOR.blue },
  ];

  const starCells = [...SAFE_RING_INDICES].filter((i) => ![0, 13, 26, 39].includes(i));

  return (
    <svg
      viewBox="0 0 15 15"
      className="h-full w-full rounded-2xl shadow-2xl"
      role="img"
      aria-label="Ludo board"
      data-testid="board-svg"
      style={{ background: '#0f1419' }}
    >
      {cells}
      {triangles.map((t) => (
        <polygon key={t.fill} points={t.points} fill={t.fill} />
      ))}
      {starCells.map((i) => {
        const cell = RING[i]!;
        return (
          <text
            key={`star-${i}`}
            x={cell.col + 0.5}
            y={cell.row + 0.68}
            textAnchor="middle"
            fontSize={0.55}
            fill="#6b7c93"
          >
            ★
          </text>
        );
      })}
      {lockedSeats.map((seat) => {
        const first = SEATS[seat]!.homeColumn[0]!;
        return (
          <g key={`lock-${seat}`} data-testid={`home-lock-${SEATS[seat]!.color}`}>
            <rect
              x={first.col + 0.15}
              y={first.row + 0.15}
              width={0.7}
              height={0.7}
              rx={0.1}
              fill="rgba(0,0,0,0.45)"
            />
            <text
              x={first.col + 0.5}
              y={first.row + 0.68}
              textAnchor="middle"
              fontSize={0.4}
              fill="#fff"
            >
              ⛓
            </text>
          </g>
        );
      })}
    </svg>
  );
}
