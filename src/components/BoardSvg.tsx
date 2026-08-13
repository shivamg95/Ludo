import type { ReactNode } from 'react';
import { RING, SEATS, SAFE_RING_INDICES } from '../engine/board';
import { getYardSlotCell } from '../engine/selectors';
import type { SeatColor } from '../engine/types';
import { GOLD, GOLD_SOFT, SEAT_BOARD_DEEP, SEAT_HEX } from '../theme/seats';

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
    <g>
      <circle cx={cx} cy={cy} r={0.22} fill={GOLD} opacity={0.22} />
      <polygon
        points={points.join(' ')}
        fill={GOLD}
        stroke="#8a6d14"
        strokeWidth={0.02}
        opacity={0.95}
      />
    </g>
  );
}

function LockGlyph({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <rect x={-0.16} y={-0.02} width={0.32} height={0.24} rx={0.05} fill={GOLD_SOFT} />
      <path
        d="M -0.1 -0.02 V -0.14 A 0.1 0.1 0 0 1 0.1 -0.14 V -0.02"
        fill="none"
        stroke={GOLD_SOFT}
        strokeWidth={0.05}
      />
    </g>
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

  cells.push(
    <rect key="board-bg" x={0} y={0} width={15} height={15} fill="#cbbfa8" rx={0.18} />,
  );

  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      cells.push(
        <rect
          key={`base-${r}-${c}`}
          x={c + 0.04}
          y={r + 0.04}
          width={0.92}
          height={0.92}
          rx={0.1}
          fill="url(#cell-face)"
          stroke="rgba(20,30,45,0.12)"
          strokeWidth={0.025}
          data-testid={`cell-r${r}-c${c}`}
        />,
      );
    }
  }

  for (const seat of SEATS) {
    const used = active.has(seat.seat);
    const y = seat.yard;
    const fill = used ? SEAT_HEX[seat.color] : '#1a222e';
    const deep = used ? SEAT_BOARD_DEEP[seat.color] : '#121820';
    const isActiveYard = used && activeSeat === seat.seat;

    cells.push(
      <rect
        key={`yard-${seat.seat}`}
        x={y.colMin}
        y={y.rowMin}
        width={y.colMax - y.colMin + 1}
        height={y.rowMax - y.rowMin + 1}
        fill={fill}
        opacity={used ? 1 : 0.92}
        rx={0.22}
      />,
    );
    cells.push(
      <rect
        key={`yard-inner-${seat.seat}`}
        x={y.colMin + 1}
        y={y.rowMin + 1}
        width={y.colMax - y.colMin - 1}
        height={y.rowMax - y.rowMin - 1}
        fill={used ? '#f4efe6' : '#141b24'}
        opacity={1}
        rx={0.28}
        stroke={isActiveYard ? fill : used ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.04)'}
        strokeWidth={isActiveYard ? 0.14 : 0.03}
        className={isActiveYard ? 'yard-active-stroke' : undefined}
      />,
    );
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
        opacity={used ? 0.28 : 0.08}
        rx={0.2}
      />,
    );

    if (used) {
      for (let i = 0; i < 4; i++) {
        const slot = getYardSlotCell(seat.seat, i);
        cells.push(
          <circle
            key={`well-${seat.seat}-${i}`}
            cx={slot.col + 0.5}
            cy={slot.row + 0.5}
            r={0.58}
            fill="url(#well-inset)"
            stroke={deep}
            strokeWidth={0.045}
            opacity={0.95}
          />,
        );
      }
    }
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
        rx={0.12}
        fill={safe ? 'url(#cell-safe)' : 'url(#cell-path)'}
        stroke="rgba(20,30,45,0.14)"
        strokeWidth={0.03}
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
        rx={0.12}
        fill={SEAT_HEX[seat.color]}
        stroke={SEAT_BOARD_DEEP[seat.color]}
        strokeWidth={0.045}
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
          rx={0.12}
          fill={used ? SEAT_HEX[seat.color] : '#1a222e'}
          opacity={used ? 1 : 0.55}
          stroke={used ? SEAT_BOARD_DEEP[seat.color] : '#121820'}
          strokeWidth={0.03}
        />,
      );
    }
  }

  const triangles: { points: string; fill: string; deep: string; color: SeatColor; used: boolean }[] = [
    { points: '6,6 7.5,7.5 6,9', fill: SEAT_HEX.red, deep: SEAT_BOARD_DEEP.red, color: 'red', used: active.has(0) },
    { points: '6,6 9,6 7.5,7.5', fill: SEAT_HEX.green, deep: SEAT_BOARD_DEEP.green, color: 'green', used: active.has(1) },
    { points: '9,6 9,9 7.5,7.5', fill: SEAT_HEX.yellow, deep: SEAT_BOARD_DEEP.yellow, color: 'yellow', used: active.has(2) },
    { points: '6,9 9,9 7.5,7.5', fill: SEAT_HEX.blue, deep: SEAT_BOARD_DEEP.blue, color: 'blue', used: active.has(3) },
  ];

  const starCells = [...SAFE_RING_INDICES].filter((i) => ![0, 13, 26, 39].includes(i));
  const activeColor = activeSeat !== null && activeSeat !== undefined ? SEATS[activeSeat]?.color : null;

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
          '0 24px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -8px 16px rgba(0,0,0,0.35)',
      }}
    >
      <defs>
        <linearGradient id="cell-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f7f4ee" />
          <stop offset="100%" stopColor="#d9d3c6" />
        </linearGradient>
        <linearGradient id="cell-path" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbf8f2" />
          <stop offset="100%" stopColor="#e4ddd0" />
        </linearGradient>
        <linearGradient id="cell-safe" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff8e8" />
          <stop offset="100%" stopColor="#ead9a8" />
        </linearGradient>
        <radialGradient id="well-inset" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fffdf8" />
          <stop offset="70%" stopColor="#e8e0d2" />
          <stop offset="100%" stopColor="#cfc4b0" />
        </radialGradient>
        <filter id="hub-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.18" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x={0.12} y={0.12} width={14.76} height={14.76} rx={0.22} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.08} />
      {cells}
      <g filter="url(#hub-glow)">
        {triangles.map((t) => (
          <polygon
            key={t.color}
            points={t.points}
            fill={t.used ? t.fill : '#243040'}
            stroke={t.used ? t.deep : '#1a2430'}
            strokeWidth={0.04}
            opacity={t.used ? 1 : 0.45}
            style={
              t.used && t.color === activeColor
                ? { filter: `drop-shadow(0 0 0.25px ${t.fill})` }
                : undefined
            }
          />
        ))}
        <circle cx={7.5} cy={7.5} r={0.22} fill={GOLD_SOFT} stroke={GOLD} strokeWidth={0.04} />
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
            <LockGlyph cx={first.col + 0.5} cy={first.row + 0.48} />
          </g>
        );
      })}
    </svg>
  );
}
