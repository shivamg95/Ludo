import type { ReactNode } from 'react';
import type { SeatColor } from '../../engine/types';
import { SEAT_RAMP } from '../../theme/seats';

export interface TokenProps {
  color: SeatColor;
  r: number;
  selected: boolean;
  movable: boolean;
  doomed: boolean;
  collar: string;
  gold: string;
  /** Prefix for gradient ids, matching the `PawnDefs` in the same SVG. */
  ids?: string;
}

/** Footprint every skin stands on, so rings and shadows line up across skins. */
export function footprint(r: number) {
  return { halfW: 0.72 * r, ry: 0.28 * r, botY: 0.26 * r };
}

/**
 * Ground halo and contact shadow beneath the body, selection collar and danger
 * ring around it. Shared so movable / selected / doomed read the same in every skin.
 */
export function TokenFrame({
  color,
  r,
  selected,
  movable,
  doomed,
  collar,
  gold,
  ids = '',
  children,
}: TokenProps & { children: ReactNode }) {
  const ramp = SEAT_RAMP[color];
  const { halfW, ry, botY } = footprint(r);
  const lit = selected || movable;

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Ground halo — only lit tokens spill light */}
      {lit && (
        <ellipse
          cx={0}
          cy={botY + ry * 0.5}
          rx={halfW * 1.7}
          ry={ry * 1.9}
          fill={`url(#${ids}token-halo-${color})`}
          opacity={selected ? 1 : 0.75}
        />
      )}

      {/* Contact shadow */}
      <ellipse
        cx={0.03 * r}
        cy={botY + ry * 0.7}
        rx={halfW * 0.98}
        ry={ry * 0.66}
        fill="rgba(0,0,0,0.6)"
        filter={`url(#${ids}pawn-blur)`}
      />

      {children}

      {/* Selection collar — ink on paper tiles, white on night tiles, plus a seat rim */}
      {selected && (
        <>
          <ellipse
            cx={0}
            cy={botY}
            rx={halfW * 1.34}
            ry={ry * 1.34}
            fill="none"
            stroke={collar}
            strokeWidth={0.07}
            opacity={0.95}
          />
          <ellipse
            cx={0}
            cy={botY}
            rx={halfW * 1.22}
            ry={ry * 1.22}
            fill="none"
            stroke={ramp.rim}
            strokeWidth={0.035}
            opacity={0.9}
          />
        </>
      )}

      {/* Danger ring — this token dies if the highlighted move is taken */}
      {doomed && (
        <ellipse
          cx={0}
          cy={botY}
          rx={halfW * 1.42}
          ry={ry * 1.42}
          fill="none"
          stroke={gold}
          strokeWidth={0.06}
          strokeDasharray="0.14 0.1"
          opacity={0.95}
        />
      )}
    </g>
  );
}
