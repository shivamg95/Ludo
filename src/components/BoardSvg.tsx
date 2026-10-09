import { Fragment, memo, type ReactNode } from 'react';
import { RING, SEATS, SAFE_RING_INDICES, ringIndexOf } from '../engine/board';
import { SEAT_RAMP, boardPalette } from '../theme/seats';
import { useAppStore } from '../store/gameStore';
import type { SeatColor } from '../engine/types';

const NO_SEATS: number[] = [];

/** Ring cells a seat travels just before turning into its home column. */
function approachIndices(seat: number): number[] {
  const out: number[] = [];
  for (let p = 46; p <= 50; p++) {
    const idx = ringIndexOf(seat, p);
    if (idx !== null) out.push(idx);
  }
  return out;
}

/** Heading of a home column, in degrees, pointing at the hub. */
function runwayAngle(seat: number): number {
  const col = SEATS[seat]!.homeColumn;
  const a = col[0]!;
  const b = col[col.length - 1]!;
  return (Math.atan2(b.row - a.row, b.col - a.col) * 180) / Math.PI;
}

const PLATE = { x: 0.04, size: 14.92, rx: 0.8 } as const;
const INNER = { x: 0.16, size: 14.68, rx: 0.68 } as const;
const YARD_INSET = 0.2;
const YARD_RX = PLATE.rx - (YARD_INSET - PLATE.x);
const WELL_INSET = 0.95;
const WELL_RX = Math.max(0.22, YARD_RX - (WELL_INSET - YARD_INSET));
const HUB = { x: 5.9, size: 3.2, rx: 0.42 } as const;

function Chevron({
  x,
  y,
  angle,
  opacity,
  color,
}: {
  x: number;
  y: number;
  angle: number;
  opacity: number;
  color: string;
}) {
  return (
    <path
      d="M -0.13 -0.17 L 0.11 0 L -0.13 0.17"
      fill="none"
      stroke={color}
      strokeWidth={0.07}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
      transform={`translate(${x} ${y}) rotate(${angle})`}
    />
  );
}

/** Recessed plate marking a safe cell — no capture lands here. */
function SafePlate({
  cx,
  cy,
  color,
  plate,
  plateOpacity,
}: {
  cx: number;
  cy: number;
  color: string;
  plate: string;
  plateOpacity: number;
}) {
  const r = 0.27;
  const diamond = (k: number) =>
    [
      `${cx},${cy - r * k}`,
      `${cx + r * k},${cy}`,
      `${cx},${cy + r * k}`,
      `${cx - r * k},${cy}`,
    ].join(' ');
  return (
    <g pointerEvents="none">
      <polygon points={diamond(1)} fill={plate} opacity={plateOpacity} />
      <polygon points={diamond(1)} fill="none" stroke={color} strokeWidth={0.032} opacity={0.7} />
      <polygon points={diamond(0.42)} fill={color} opacity={0.75} />
    </g>
  );
}

/** Launch pad on a seat's entry cell. */
function StartPad({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <g pointerEvents="none">
      <circle
        cx={cx}
        cy={cy}
        r={0.29}
        fill="none"
        stroke={color}
        strokeWidth={0.05}
        opacity={0.9}
      />
      <circle cx={cx} cy={cy} r={0.17} fill={color} opacity={0.28} />
      <path
        d={`M ${cx - 0.09} ${cy + 0.06} L ${cx} ${cy - 0.09} L ${cx + 0.09} ${cy + 0.06}`}
        fill="none"
        stroke={color}
        strokeWidth={0.05}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function BoardSvgView({
  lockedSeats = NO_SEATS,
  activeSeats,
  activeSeat,
}: {
  lockedSeats?: number[];
  activeSeats?: number[];
  activeSeat?: number | null;
}) {
  const theme = useAppStore((s) => s.theme);
  const { surface, accent } = boardPalette(theme);
  const live = new Set(activeSeats ?? [0, 1, 2, 3]);
  const bloom = surface.bloom ? 'url(#board-bloom)' : undefined;

  /** ringIndex -> seat that owns the tint (start cell or approach lane). */
  const ringOwner = new Map<number, number>();
  for (const seat of SEATS) {
    if (!live.has(seat.seat)) continue;
    ringOwner.set(seat.entryIndex, seat.seat);
    for (const idx of approachIndices(seat.seat)) ringOwner.set(idx, seat.seat);
  }

  const layers: ReactNode[] = [];

  // ---- Track ----------------------------------------------------------
  for (let i = 0; i < RING.length; i++) {
    const cell = RING[i]!;
    const safe = SAFE_RING_INDICES.has(i);
    const owner = ringOwner.get(i);
    const ramp = owner !== undefined ? SEAT_RAMP[SEATS[owner]!.color] : null;
    const isStart = owner !== undefined && SEATS[owner]!.entryIndex === i;

    layers.push(
      <g key={`ring-${i}`}>
        <rect
          x={cell.col + 0.06}
          y={cell.row + 0.06}
          width={0.88}
          height={0.88}
          rx={0.14}
          fill={safe ? surface.tileSafe : surface.tile}
          stroke={surface.tileEdge}
          strokeWidth={0.022}
          data-testid={`cell-r${cell.row}-c${cell.col}`}
          data-ring-index={String(i)}
          {...(safe ? { 'data-safe': 'true' } : {})}
        />
        {ramp && (
          <>
            <rect
              x={cell.col + 0.06}
              y={cell.row + 0.06}
              width={0.88}
              height={0.88}
              rx={0.14}
              fill={ramp.core}
              opacity={isStart ? 0.42 : 0.16}
            />
            <rect
              x={cell.col + 0.06}
              y={cell.row + 0.06}
              width={0.88}
              height={0.88}
              rx={0.14}
              fill="none"
              stroke={ramp.core}
              strokeWidth={isStart ? 0.055 : 0.03}
              opacity={isStart ? 0.95 : 0.5}
            />
          </>
        )}
        {/* top-edge sheen so tiles read as lit glass */}
        <rect
          x={cell.col + 0.14}
          y={cell.row + 0.1}
          width={0.72}
          height={0.16}
          rx={0.08}
          fill={surface.sheen}
          opacity={surface.sheenOpacity}
        />
        {isStart && ramp ? (
          <StartPad cx={cell.col + 0.5} cy={cell.row + 0.5} color={ramp.rim} />
        ) : (
          safe && (
            <SafePlate
              cx={cell.col + 0.5}
              cy={cell.row + 0.5}
              color={ramp ? ramp.rim : accent.core}
              plate={surface.safePlate}
              plateOpacity={surface.safePlateOpacity}
            />
          )
        )}
      </g>,
    );
  }

  // ---- Home runways ---------------------------------------------------
  for (const seat of SEATS) {
    const used = live.has(seat.seat);
    const ramp = SEAT_RAMP[seat.color];
    const angle = runwayAngle(seat.seat);
    const isActive = activeSeat === seat.seat;

    seat.homeColumn.forEach((cell, step) => {
      const t = step / (seat.homeColumn.length - 1);
      layers.push(
        <g key={`home-${seat.seat}-${step}`}>
          <rect
            x={cell.col + 0.06}
            y={cell.row + 0.06}
            width={0.88}
            height={0.88}
            rx={0.14}
            fill={used ? ramp.core : surface.dormant}
            opacity={used ? surface.homeFillStart + t * surface.homeFillSpan : 0.5}
            data-testid={`cell-r${cell.row}-c${cell.col}`}
          />
          <rect
            x={cell.col + 0.06}
            y={cell.row + 0.06}
            width={0.88}
            height={0.88}
            rx={0.14}
            fill="none"
            stroke={used ? ramp.deep : surface.dormantEdge}
            strokeWidth={used ? 0.04 : 0.028}
            opacity={used ? 0.55 + t * 0.35 : 1}
          />
          {used && (
            <Chevron
              x={cell.col + 0.5}
              y={cell.row + 0.5}
              angle={angle}
              opacity={isActive ? 0.5 + t * 0.4 : 0.22 + t * 0.28}
              color={surface.chevron}
            />
          )}
        </g>,
      );
    });
  }

  // ---- Yards ----------------------------------------------------------
  for (const seat of SEATS) {
    const used = live.has(seat.seat);
    const ramp = SEAT_RAMP[seat.color];
    const y = seat.yard;
    const w = y.colMax - y.colMin + 1;
    const h = y.rowMax - y.rowMin + 1;
    const isActive = activeSeat === seat.seat;

    const sockets = [
      { cx: y.colMin + 2, cy: y.rowMin + 2 },
      { cx: y.colMin + 4, cy: y.rowMin + 2 },
      { cx: y.colMin + 2, cy: y.rowMin + 4 },
      { cx: y.colMin + 4, cy: y.rowMin + 4 },
    ];

    layers.push(
      <g key={`yard-${seat.seat}`} data-testid={`yard-${seat.color}`}>
        <rect
          x={y.colMin + YARD_INSET}
          y={y.rowMin + YARD_INSET}
          width={w - YARD_INSET * 2}
          height={h - YARD_INSET * 2}
          rx={YARD_RX}
          fill={used ? `url(#yard-fill-${seat.color})` : surface.dormant}
          stroke={used ? ramp.core : surface.dormantEdge}
          strokeWidth={used ? (isActive ? 0.09 : 0.055) : 0.03}
          opacity={used ? 1 : 0.75}
          filter={used && isActive ? bloom : undefined}
        />
        <rect
          x={y.colMin + WELL_INSET}
          y={y.rowMin + WELL_INSET}
          width={w - WELL_INSET * 2}
          height={h - WELL_INSET * 2}
          rx={WELL_RX}
          fill={surface.well}
          stroke={used ? ramp.core : surface.dormantEdge}
          strokeWidth={0.025}
          opacity={used ? 0.5 : 0.6}
          strokeDasharray={used ? undefined : '0.18 0.14'}
        />
        {sockets.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={0.46}
            fill={surface.socket}
            stroke={used ? ramp.core : surface.dormantEdge}
            strokeWidth={0.03}
            opacity={used ? 0.42 : 0.5}
          />
        ))}
      </g>,
    );
  }

  // ---- Hub ------------------------------------------------------------
  const hub = [
    { seat: 0, points: '6,6 7.5,7.5 6,9' },
    { seat: 1, points: '6,6 9,6 7.5,7.5' },
    { seat: 2, points: '9,6 9,9 7.5,7.5' },
    { seat: 3, points: '6,9 9,9 7.5,7.5' },
  ];

  return (
    <svg
      viewBox="0 0 15 15"
      className="h-full w-full"
      role="img"
      aria-label="Ludo board"
      data-testid="board-svg"
      data-board-theme={theme}
      style={{ overflow: 'hidden' }}
    >
      <defs>
        <filter id="board-bloom" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.12" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="hub-bloom" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <radialGradient id="board-vignette" cx="50%" cy="45%" r="72%">
          <stop offset="55%" stopColor={surface.vignette} stopOpacity="0" />
          <stop offset="100%" stopColor={surface.vignette} stopOpacity={surface.vignetteOpacity} />
        </radialGradient>

        <linearGradient id="board-plate" x1="0%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor={surface.plateStart} />
          <stop offset="55%" stopColor={surface.board} />
          <stop offset="100%" stopColor={surface.plateEnd} />
        </linearGradient>

        {(Object.keys(SEAT_RAMP) as SeatColor[]).map((c) => (
          <Fragment key={c}>
            <linearGradient id={`yard-fill-${c}`} x1="0%" y1="0%" x2="55%" y2="100%">
              <stop offset="0%" stopColor={SEAT_RAMP[c].core} stopOpacity="0.2" />
              <stop offset="55%" stopColor={SEAT_RAMP[c].deep} stopOpacity="0.34" />
              <stop
                offset="100%"
                stopColor={surface.yardDeep}
                stopOpacity={surface.yardDeepOpacity}
              />
            </linearGradient>
            <radialGradient
              id={`hub-${c}`}
              gradientUnits="userSpaceOnUse"
              cx="7.5"
              cy="7.5"
              r="2.12"
            >
              <stop offset="0%" stopColor={surface.hubWell} stopOpacity={surface.hubWellOpacity} />
              <stop
                offset="45%"
                stopColor={SEAT_RAMP[c].deep}
                stopOpacity={surface.hubDeepOpacity}
              />
              <stop offset="82%" stopColor={SEAT_RAMP[c].core} stopOpacity="0.42" />
              <stop offset="100%" stopColor={SEAT_RAMP[c].core} stopOpacity="0.72" />
            </radialGradient>
          </Fragment>
        ))}

        <clipPath id="board-clip">
          <rect x={PLATE.x} y={PLATE.x} width={PLATE.size} height={PLATE.size} rx={PLATE.rx} />
        </clipPath>
        <clipPath id="hub-clip">
          <rect x={HUB.x} y={HUB.x} width={HUB.size} height={HUB.size} rx={HUB.rx} />
        </clipPath>
      </defs>

      {/* Board plate */}
      <rect
        x={PLATE.x}
        y={PLATE.x}
        width={PLATE.size}
        height={PLATE.size}
        rx={PLATE.rx}
        fill="url(#board-plate)"
      />
      <rect
        x={PLATE.x}
        y={PLATE.x}
        width={PLATE.size}
        height={PLATE.size}
        rx={PLATE.rx}
        fill="none"
        stroke={accent.core}
        strokeWidth={0.06}
        opacity={0.3}
      />

      <g clipPath="url(#board-clip)">
        <rect
          x={INNER.x}
          y={INNER.x}
          width={INNER.size}
          height={INNER.size}
          rx={INNER.rx}
          fill="none"
          stroke={surface.innerStroke}
          strokeWidth={0.03}
        />

        {/* Raised plus-shaped road so the track reads as a path, not scattered tiles */}
        <g pointerEvents="none">
          <rect x={0.5} y={5.94} width={14} height={3.12} rx={0.3} fill={surface.track} />
          <rect x={5.94} y={0.5} width={3.12} height={14} rx={0.3} fill={surface.track} />
          <rect
            x={0.5}
            y={5.94}
            width={14}
            height={3.12}
            rx={0.3}
            fill="none"
            stroke={surface.trackStroke}
            strokeWidth={0.03}
          />
          <rect
            x={5.94}
            y={0.5}
            width={3.12}
            height={14}
            rx={0.3}
            fill="none"
            stroke={surface.trackStroke}
            strokeWidth={0.03}
          />
        </g>

        {layers}

        {/* Hub */}
        <g>
          <rect
            x={HUB.x}
            y={HUB.x}
            width={HUB.size}
            height={HUB.size}
            rx={HUB.rx}
            fill={surface.hub}
          />
          <g clipPath="url(#hub-clip)">
            {hub.map((t) => {
              const used = live.has(t.seat);
              const color = SEATS[t.seat]!.color;
              const ramp = SEAT_RAMP[color];
              const isActive = activeSeat === t.seat;
              return (
                <g key={t.seat}>
                  <polygon
                    points={t.points}
                    fill={used ? `url(#hub-${color})` : surface.dormant}
                    opacity={used ? 1 : 0.55}
                  />
                  <polygon
                    points={t.points}
                    fill="none"
                    stroke={used ? ramp.core : surface.dormantEdge}
                    strokeWidth={used ? (isActive ? 0.07 : 0.045) : 0.025}
                    strokeLinejoin="round"
                    opacity={used ? (isActive ? 1 : 0.75) : 1}
                    filter={used && isActive ? bloom : undefined}
                  />
                </g>
              );
            })}
          </g>
          <rect
            x={HUB.x}
            y={HUB.x}
            width={HUB.size}
            height={HUB.size}
            rx={HUB.rx}
            fill="none"
            stroke={accent.core}
            strokeWidth={0.045}
            opacity={0.4}
          />
          {/* The hub shine and jewel are animated in BoardHubFx, outside this SVG */}
        </g>

        {/* Quick-mode home locks */}
        {lockedSeats.map((seat) => {
          const first = SEATS[seat]!.homeColumn[0]!;
          const ramp = SEAT_RAMP[SEATS[seat]!.color];
          return (
            <g key={`lock-${seat}`} data-testid={`home-lock-${SEATS[seat]!.color}`}>
              <rect
                x={first.col + 0.12}
                y={first.row + 0.12}
                width={0.76}
                height={0.76}
                rx={0.16}
                fill={surface.lockPlate}
                stroke={ramp.core}
                strokeWidth={0.04}
                opacity={0.95}
              />
              <rect
                x={first.col + 0.34}
                y={first.row + 0.46}
                width={0.32}
                height={0.24}
                rx={0.05}
                fill={accent.gold}
              />
              <path
                d={`M ${first.col + 0.39} ${first.row + 0.46} v -0.1 a 0.11 0.11 0 0 1 0.22 0 v 0.1`}
                fill="none"
                stroke={accent.gold}
                strokeWidth={0.045}
              />
            </g>
          );
        })}

        <rect
          x={PLATE.x}
          y={PLATE.x}
          width={PLATE.size}
          height={PLATE.size}
          rx={PLATE.rx}
          fill="url(#board-vignette)"
          pointerEvents="none"
        />
      </g>
    </svg>
  );
}

/** Memoised: the board only needs to repaint when its theme, seats or locks change. */
export const BoardSvg = memo(BoardSvgView);
