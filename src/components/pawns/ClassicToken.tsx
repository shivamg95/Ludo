import { SEAT_RAMP } from '../../theme/seats';
import { footprint, TokenFrame, type TokenProps } from './frame';

/**
 * The traditional Ludo pawn: flared base, tapered cone body, collar at the neck
 * and a round glossy head. Turned-wood shading comes from a horizontal ramp.
 */
export function ClassicToken(props: TokenProps) {
  const { color, r, selected, movable, ids = '' } = props;
  const ramp = SEAT_RAMP[color];
  const { halfW, ry, botY } = footprint(r);
  const lit = selected || movable;
  const edge = lit ? 0.95 : 0.65;

  const baseTop = botY - 0.12 * r;
  const baseRx = halfW * 0.94;
  const baseRy = ry * 0.9;
  const shoulder = 0.5 * r;
  const neckY = -0.36 * r;
  const neckW = 0.17 * r;
  const headY = -0.64 * r;
  const headR = 0.3 * r;

  const body = [
    `M ${-shoulder} ${baseTop}`,
    `C ${-shoulder * 0.7} ${baseTop - 0.18 * r} ${-neckW * 1.3} ${neckY + 0.2 * r} ${-neckW} ${neckY}`,
    `L ${neckW} ${neckY}`,
    `C ${neckW * 1.3} ${neckY + 0.2 * r} ${shoulder * 0.7} ${baseTop - 0.18 * r} ${shoulder} ${baseTop}`,
    `A ${shoulder} ${baseRy * 0.6} 0 0 1 ${-shoulder} ${baseTop}`,
    'Z',
  ].join(' ');

  return (
    <TokenFrame {...props}>
      {/* Flared foot */}
      <ellipse cx={0} cy={botY} rx={halfW} ry={ry} fill={ramp.deep} />
      <rect
        x={-baseRx}
        y={baseTop}
        width={baseRx * 2}
        height={botY - baseTop}
        fill={`url(#${ids}peg-body-${color})`}
      />
      <ellipse
        cx={0}
        cy={botY}
        rx={halfW}
        ry={ry}
        fill="none"
        stroke={ramp.core}
        strokeWidth={0.035}
        opacity={edge}
      />
      <ellipse
        cx={0}
        cy={baseTop}
        rx={baseRx}
        ry={baseRy}
        fill={`url(#${ids}peg-body-${color})`}
        stroke={ramp.rim}
        strokeWidth={0.03}
        strokeOpacity={edge * 0.7}
      />

      {/* Cone body */}
      <path
        d={body}
        fill={`url(#${ids}peg-body-${color})`}
        stroke={ramp.rim}
        strokeWidth={0.03}
        strokeOpacity={edge * 0.6}
      />

      {/* Neck collar */}
      <ellipse cx={0} cy={neckY} rx={neckW * 1.7} ry={0.075 * r} fill={ramp.core} />
      <ellipse
        cx={0}
        cy={neckY - 0.02 * r}
        rx={neckW * 1.7}
        ry={0.06 * r}
        fill="none"
        stroke={ramp.rim}
        strokeWidth={0.025}
        opacity={0.8}
      />

      {/* Head */}
      <circle
        cx={0}
        cy={headY}
        r={headR}
        fill={`url(#${ids}peg-head-${color})`}
        stroke={ramp.rim}
        strokeWidth={lit ? 0.045 : 0.03}
        strokeOpacity={edge}
      />
      <ellipse
        cx={-headR * 0.32}
        cy={headY - headR * 0.38}
        rx={headR * 0.34}
        ry={headR * 0.22}
        fill="#fff"
        opacity={selected ? 0.95 : 0.75}
        transform={`rotate(-28 ${-headR * 0.32} ${headY - headR * 0.38})`}
      />

      {/* Specular down the left of the cone */}
      <path
        d={`M ${-neckW * 1.25} ${neckY + 0.1 * r} Q ${-shoulder * 0.62} ${baseTop - 0.2 * r} ${-shoulder * 0.74} ${baseTop - 0.02 * r}`}
        stroke="rgba(255,255,255,0.38)"
        strokeWidth={0.04}
        strokeLinecap="round"
        fill="none"
      />
    </TokenFrame>
  );
}
