import { SEAT_RAMP } from '../../theme/seats';
import { footprint, TokenFrame, type TokenProps } from './frame';

/**
 * Glass marble: a seat-tinted sphere with an inner swirl, a hard specular spot
 * and a coloured caustic thrown onto the ground beneath it.
 */
export function MarbleToken(props: TokenProps) {
  const { color, r, selected, movable, ids = '' } = props;
  const ramp = SEAT_RAMP[color];
  const { halfW, ry, botY } = footprint(r);
  const lit = selected || movable;

  const cy = -0.16 * r;
  const R = 0.5 * r;

  return (
    <TokenFrame {...props}>
      {/* Caustic — light focused through the glass */}
      <ellipse
        cx={0.08 * r}
        cy={botY + ry * 0.35}
        rx={halfW * 0.55 + 0.1}
        ry={ry * 0.4 + 0.1}
        fill={`url(#${ids}marble-caustic-${color})`}
        opacity={lit ? 0.55 : 0.32}
      />

      {/* Sphere */}
      <circle cx={0} cy={cy} r={R} fill={`url(#${ids}marble-${color})`} />

      {/* Inner swirl bands, kept inside the sphere by their radius */}
      <g transform={`rotate(-28 0 ${cy})`} fill="none" strokeLinecap="round">
        <path
          d={`M ${-R * 0.72} ${cy + R * 0.1} C ${-R * 0.3} ${cy - R * 0.5} ${R * 0.3} ${cy + R * 0.5} ${R * 0.72} ${cy - R * 0.1}`}
          stroke={ramp.rim}
          strokeWidth={0.07 * r}
          opacity={0.55}
        />
        <path
          d={`M ${-R * 0.6} ${cy + R * 0.34} C ${-R * 0.2} ${cy - R * 0.1} ${R * 0.24} ${cy + R * 0.7} ${R * 0.58} ${cy + R * 0.2}`}
          stroke={ramp.deep}
          strokeWidth={0.05 * r}
          opacity={0.5}
        />
      </g>

      {/* Glass edge */}
      <circle
        cx={0}
        cy={cy}
        r={R}
        fill="none"
        stroke={ramp.rim}
        strokeWidth={lit ? 0.045 : 0.03}
        strokeOpacity={lit ? 0.95 : 0.55}
      />

      {/* Refraction glint low on the far side */}
      <path
        d={`M ${R * 0.05} ${cy + R * 0.78} A ${R * 0.82} ${R * 0.82} 0 0 0 ${R * 0.72} ${cy + R * 0.3}`}
        stroke={ramp.rim}
        strokeWidth={0.045 * r}
        strokeLinecap="round"
        fill="none"
        opacity={0.6}
      />

      {/* Specular */}
      <ellipse
        cx={-R * 0.36}
        cy={cy - R * 0.42}
        rx={R * 0.26}
        ry={R * 0.15}
        fill="#fff"
        opacity={selected ? 1 : 0.88}
        transform={`rotate(-34 ${-R * 0.36} ${cy - R * 0.42})`}
      />
      <circle cx={-R * 0.08} cy={cy - R * 0.62} r={R * 0.06} fill="#fff" opacity={0.8} />
    </TokenFrame>
  );
}
