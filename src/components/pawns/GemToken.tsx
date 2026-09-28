import { SEAT_RAMP } from '../../theme/seats';
import { TokenFrame, type TokenProps } from './frame';

/**
 * Cut gem: a table-and-crown over a pointed pavilion. Each facet takes a step of
 * the seat ramp so the stone reads as faceted, with an inner glow when lit.
 */
export function GemToken(props: TokenProps) {
  const { color, r, selected, movable, ids = '' } = props;
  const ramp = SEAT_RAMP[color];
  const lit = selected || movable;

  const p = (x: number, y: number) => `${x * r},${y * r}`;
  const girdleY = -0.24;
  const tableY = -0.56;
  const tipY = 0.3;
  const gW = 0.64;
  const tW = 0.32;
  const cW = 0.13;

  const outline = [p(-gW, girdleY), p(-tW, tableY), p(tW, tableY), p(gW, girdleY), p(0, tipY)].join(
    ' ',
  );

  return (
    <TokenFrame {...props}>
      {/* Crown */}
      <polygon points={[p(-gW, girdleY), p(-tW, tableY), p(-cW, girdleY)].join(' ')} fill={ramp.core} />
      <polygon
        points={[p(-tW, tableY), p(tW, tableY), p(cW, girdleY), p(-cW, girdleY)].join(' ')}
        fill={ramp.rim}
      />
      <polygon points={[p(tW, tableY), p(gW, girdleY), p(cW, girdleY)].join(' ')} fill={ramp.glow} />

      {/* Pavilion */}
      <polygon points={[p(-gW, girdleY), p(-cW, girdleY), p(0, tipY)].join(' ')} fill={ramp.glow} />
      <polygon points={[p(-cW, girdleY), p(cW, girdleY), p(0, tipY)].join(' ')} fill={ramp.core} />
      <polygon points={[p(cW, girdleY), p(gW, girdleY), p(0, tipY)].join(' ')} fill={ramp.deep} />

      {/* Sheen across the whole stone */}
      <polygon points={outline} fill={`url(#${ids}gem-sheen)`} />

      {/* Inner fire */}
      {lit && (
        <ellipse
          cx={0}
          cy={(girdleY - 0.04) * r}
          rx={0.36 * r}
          ry={0.26 * r}
          fill={`url(#${ids}token-halo-${color})`}
          opacity={selected ? 1 : 0.8}
        />
      )}

      {/* Facet edges */}
      <polyline
        points={[p(-gW, girdleY), p(gW, girdleY)].join(' ')}
        stroke={ramp.rim}
        strokeWidth={0.025}
        opacity={0.7}
        fill="none"
      />
      <polyline
        points={[p(-tW, tableY), p(-cW, girdleY), p(0, tipY), p(cW, girdleY), p(tW, tableY)].join(' ')}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={0.018}
        fill="none"
      />
      <polygon
        points={outline}
        fill="none"
        stroke={lit ? ramp.rim : ramp.core}
        strokeWidth={lit ? 0.045 : 0.03}
        strokeLinejoin="round"
        opacity={lit ? 0.95 : 0.75}
      />

      {/* Sparkle on the table */}
      <path
        d={`M ${-0.2 * r} ${-0.62 * r} l ${0.03 * r} ${0.075 * r} l ${0.075 * r} ${0.03 * r} l ${-0.075 * r} ${0.03 * r} l ${-0.03 * r} ${0.075 * r} l ${-0.03 * r} ${-0.075 * r} l ${-0.075 * r} ${-0.03 * r} l ${0.075 * r} ${-0.03 * r} Z`}
        fill="#fff"
        opacity={selected ? 1 : 0.85}
      />
    </TokenFrame>
  );
}
