import type { ReactNode } from 'react';
import { RING, SEATS, SAFE_RING_INDICES } from '../engine/board';
import type { SeatColor } from '../engine/types';

const COLOR: Record<SeatColor, string> = {
  red: '#e23d3d',
  green: '#2f9e5c',
  yellow: '#e2b93d',
  blue: '#3d7ee2',
};

const COLOR_DEEP: Record<SeatColor, string> = {
  red: '#b82828',
  green: '#217a45',
  yellow: '#b89220',
  blue: '#2a5fb8',
};

function Star({ cx, cy }: { cx: number; cy: number }) {
  const r = 0.28;
  const points: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const b = a + Math.PI / 5;
    points.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
    points.push(`${cx + Math.cos(b) * r * 0.4},${cy + Math.sin(b) * r * 0.4}`);
  }
  return (
    <polygon
      points={points.join(' ')}
      fill="#c9a227"
      stroke="#8a6d14"
      strokeWidth={0.02}
      opacity={0.95}
    />
  );
}

export function BoardSvg({
  lockedSeats = [] as number[],
  activeSeats,
  activeSeat,
}: {
  lockedSeats?: number[];
  activeSeats?: number[];
  activeSeat?: number | null;
}) {
  const active = new Set(activeSeats ?? [0, 1, 2, 3]);
  const cells: ReactNode[] = [];

  // Soft path wash
  cells.push(
    <rect key="board-bg" x={0} y={0} width={15} height={15} fill="#c5ced9" rx={0.15} />,
  );

  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      cells.push(
        <rect
          key={`base-${r}-${c}`}
          x={c + 0.03}
          y={r + 0.03}
          width={0.94}
          height={0.94}
          rx={0.08}
          fill="#e8eef5"
          stroke="rgba(20,30,45,0.08)"
          strokeWidth={0.02}
          data-testid={`cell-r${r}-c${c}`}
        />,
      );
    }
  }

  for (const seat of SEATS) {
    const used = active.has(seat.seat);
    const y = seat.yard;
    const fill = used ? COLOR[seat.color] : '#9aa6b5';
    const deep = used ? COLOR_DEEP[seat.color] : '#7a8798';
    const isActiveYard = activeSeat === seat.seat;

    // Yard outer with gradient feel via two layers
    cells.push(
      <rect
        key={`yard-${seat.seat}`}
        x={y.colMin}
        y={y.rowMin}
        width={y.colMax - y.colMin + 1}
        height={y.rowMax - y.rowMin + 1}
        fill={fill}
        opacity={used ? 1 : 0.35}
        rx={0.2}
      />,
    );
    cells.push(
      <rect
        key={`yard-inner-${seat.seat}`}
        x={y.colMin + 1}
        y={y.rowMin + 1}
        width={y.colMax - y.colMin - 1}
        height={y.rowMax - y.rowMin - 1}
        fill="#f7fafc"
        opacity={used ? 1 : 0.4}
        rx={0.25}
        stroke={isActiveYard ? fill : 'rgba(0,0,0,0.06)'}
        strokeWidth={isActiveYard ? 0.12 : 0.03}
      />,
    );
    // Soft inset shadow ring for yard pad
    cells.push(
      <rect
        key={`yard-pad-${seat.seat}`}
        x={y.colMin + 1.25}
        y={y.rowMin + 1.25}
        width={y.colMax - y.colMin - 1.5}
        height={y.rowMax - y.rowMin - 1.5}
        fill="none"
        stroke={deep}
        strokeWidth={0.04}
        opacity={used ? 0.25 : 0.1}
        rx={0.2}
      />,
    );
  }

  for (let i = 0; i < RING.length; i++) {
    const cell = RING[i]!;
    const safe = SAFE_RING_INDICES.has(i);
    cells.push(
      <rect
        key={`ring-${i}`}
        x={cell.col + 0.05}
        y={cell.row + 0.05}
        width={0.9}
        height={0.9}
        rx={0.1}
        fill={safe ? '#fbf8ef' : '#f4f7fb'}
        stroke="rgba(20,30,45,0.1)"
        strokeWidth={0.025}
        data-testid={`cell-r${cell.row}-c${cell.col}`}
        data-ring-index={String(i)}
        {...(safe ? { 'data-safe': 'true' } : {})}
      />,
    );
  }

  for (const seat of SEATS) {
    if (!active.has(seat.seat)) continue;
    const cell = seat.startCell;
    cells.push(
      <rect
        key={`start-${seat.seat}`}
        x={cell.col + 0.05}
        y={cell.row + 0.05}
        width={0.9}
        height={0.9}
        rx={0.1}
        fill={COLOR[seat.color]}
        stroke={COLOR_DEEP[seat.color]}
        strokeWidth={0.04}
      />,
    );
  }

  for (const seat of SEATS) {
    const used = active.has(seat.seat);
    for (const cell of seat.homeColumn) {
      cells.push(
        <rect
          key={`home-${seat.seat}-${cell.row}-${cell.col}`}
          x={cell.col + 0.05}
          y={cell.row + 0.05}
          width={0.9}
          height={0.9}
          rx={0.1}
          fill={used ? COLOR[seat.color] : '#9aa6b5'}
          opacity={used ? 1 : 0.35}
          stroke={used ? COLOR_DEEP[seat.color] : '#7a8798'}
          strokeWidth={0.03}
        />,
      );
    }
  }

  const triangles = [
    { points: '6,6 7.5,7.5 6,9', fill: COLOR.red, deep: COLOR_DEEP.red },
    { points: '6,6 9,6 7.5,7.5', fill: COLOR.green, deep: COLOR_DEEP.green },
    { points: '9,6 9,9 7.5,7.5', fill: COLOR.yellow, deep: COLOR_DEEP.yellow },
    { points: '6,9 9,9 7.5,7.5', fill: COLOR.blue, deep: COLOR_DEEP.blue },
  ];

  const starCells = [...SAFE_RING_INDICES].filter((i) => ![0, 13, 26, 39].includes(i));

  return (
    <svg
      viewBox="0 0 15 15"
      className="h-full w-full rounded-2xl"
      role="img"
      aria-label="Ludo board"
      data-testid="board-svg"
      style={{
        background: 'linear-gradient(145deg, #1a222e, #0d1218)',
        boxShadow:
          '0 24px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <defs>
        <filter id="hub-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.15" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {cells}
      <g filter="url(#hub-glow)">
        {triangles.map((t) => (
          <polygon
            key={t.fill}
            points={t.points}
            fill={t.fill}
            stroke={t.deep}
            strokeWidth={0.04}
          />
        ))}
        <circle cx={7.5} cy={7.5} r={0.22} fill="#f5e6a8" stroke="#c9a227" strokeWidth={0.04} />
      </g>
      {starCells.map((i) => {
        const cell = RING[i]!;
        return <Star key={`star-${i}`} cx={cell.col + 0.5} cy={cell.row + 0.5} />;
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
              rx={0.12}
              fill="rgba(12,16,23,0.55)"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={0.03}
            />
            <text
              x={first.col + 0.5}
              y={first.row + 0.68}
              textAnchor="middle"
              fontSize={0.38}
              fill="#f5e6a8"
            >
              ⛓
            </text>
          </g>
        );
      })}
    </svg>
  );
}
