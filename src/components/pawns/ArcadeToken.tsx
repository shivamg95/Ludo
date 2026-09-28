import { SEAT_RAMP } from '../../theme/seats';
import { footprint, TokenFrame, type TokenProps } from './frame';

/**
 * Arcade token: a dark obsidian puck with an emissive seat-coloured rim and a
 * lit core. Drawn at the origin — the parent group positions it.
 */
export function ArcadeToken(props: TokenProps) {
  const { color, r, selected, movable, ids = '' } = props;
  const ramp = SEAT_RAMP[color];
  const { halfW, ry, botY } = footprint(r);
  const topY = -0.3 * r;
  const lit = selected || movable;
  const edge = lit ? 0.9 : 0.6;

  return (
    <TokenFrame {...props}>
      {/* Base disc */}
      <ellipse cx={0} cy={botY} rx={halfW} ry={ry} fill={ramp.deep} />
      <ellipse
        cx={0}
        cy={botY}
        rx={halfW}
        ry={ry}
        fill="none"
        stroke={ramp.core}
        strokeWidth={0.04}
        opacity={edge}
      />

      {/* Body wall */}
      <rect
        x={-halfW}
        y={topY}
        width={halfW * 2}
        height={botY - topY}
        fill={`url(#${ids}token-side-${color})`}
      />

      {/* Silhouette edges keep the token legible against a dark board */}
      <path
        d={`M ${-halfW} ${topY} L ${-halfW} ${botY} M ${halfW} ${topY} L ${halfW} ${botY}`}
        stroke={ramp.core}
        strokeWidth={0.04}
        opacity={edge}
        fill="none"
      />

      {/* Emissive waistband */}
      <rect
        x={-halfW}
        y={topY + (botY - topY) * 0.58}
        width={halfW * 2}
        height={0.075 * r}
        fill={ramp.core}
        opacity={lit ? 1 : 0.7}
      />

      {/* Lit cap */}
      <ellipse
        cx={0}
        cy={topY}
        rx={halfW}
        ry={ry}
        fill={`url(#${ids}token-top-${color})`}
        stroke={ramp.rim}
        strokeWidth={lit ? 0.05 : 0.035}
        strokeOpacity={lit ? 0.9 : 0.6}
      />
      <ellipse cx={0} cy={topY} rx={halfW * 0.5} ry={ry * 0.5} fill={ramp.core} opacity={0.95} />
      <ellipse
        cx={-halfW * 0.12}
        cy={topY - ry * 0.16}
        rx={halfW * 0.24}
        ry={ry * 0.24}
        fill="#fff"
        opacity={selected ? 1 : 0.78}
      />

      {/* Specular down the left wall */}
      <path
        d={`M ${-halfW * 0.82} ${topY + ry * 0.5} L ${-halfW * 0.82} ${botY - ry * 0.3}`}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={0.05}
        strokeLinecap="round"
        fill="none"
      />
    </TokenFrame>
  );
}
