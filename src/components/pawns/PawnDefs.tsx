import { Fragment } from 'react';
import type { SeatColor } from '../../engine/types';
import { SEAT_RAMP } from '../../theme/seats';

/**
 * Gradients every skin draws with. `ids` prefixes each id so a preview SVG
 * elsewhere on the page never resolves to the board's defs.
 *
 * Soft shadows are radial gradients rather than blur filters: a gradient is
 * painted once, while an SVG blur is re-run on every repaint of the token.
 */
export function PawnDefs({ ids = '' }: { ids?: string }) {
  return (
    <defs>
      <radialGradient id={`${ids}pawn-shadow`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#000" stopOpacity="0.6" />
        <stop offset="40%" stopColor="#000" stopOpacity="0.56" />
        <stop offset="62%" stopColor="#000" stopOpacity="0.4" />
        <stop offset="84%" stopColor="#000" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#000" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${ids}gem-sheen`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.45" />
        <stop offset="45%" stopColor="#fff" stopOpacity="0.05" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.25" />
      </linearGradient>
      {(Object.keys(SEAT_RAMP) as SeatColor[]).map((c) => {
        const ramp = SEAT_RAMP[c];
        return (
          <Fragment key={c}>
            <linearGradient id={`${ids}token-side-${c}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={ramp.deep} />
              <stop offset="45%" stopColor="#0a0f1a" />
              <stop offset="100%" stopColor="#05080f" />
            </linearGradient>
            <radialGradient id={`${ids}token-top-${c}`} cx="38%" cy="32%" r="72%">
              <stop offset="0%" stopColor={ramp.rim} />
              <stop offset="55%" stopColor={ramp.core} />
              <stop offset="100%" stopColor={ramp.deep} />
            </radialGradient>
            <radialGradient id={`${ids}token-halo-${c}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ramp.glow} stopOpacity="0.55" />
              <stop offset="60%" stopColor={ramp.glow} stopOpacity="0.16" />
              <stop offset="100%" stopColor={ramp.glow} stopOpacity="0" />
            </radialGradient>

            <linearGradient id={`${ids}peg-body-${c}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={ramp.deep} />
              <stop offset="28%" stopColor={ramp.core} />
              <stop offset="46%" stopColor={ramp.rim} />
              <stop offset="70%" stopColor={ramp.core} />
              <stop offset="100%" stopColor={ramp.deep} />
            </linearGradient>
            <radialGradient id={`${ids}peg-head-${c}`} cx="36%" cy="30%" r="75%">
              <stop offset="0%" stopColor={ramp.rim} />
              <stop offset="45%" stopColor={ramp.core} />
              <stop offset="100%" stopColor={ramp.deep} />
            </radialGradient>

            <radialGradient id={`${ids}marble-caustic-${c}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={ramp.core} stopOpacity="1" />
              <stop offset="40%" stopColor={ramp.core} stopOpacity="0.85" />
              <stop offset="65%" stopColor={ramp.core} stopOpacity="0.45" />
              <stop offset="85%" stopColor={ramp.core} stopOpacity="0.12" />
              <stop offset="100%" stopColor={ramp.core} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${ids}marble-${c}`} cx="36%" cy="32%" r="78%">
              <stop offset="0%" stopColor={ramp.rim} stopOpacity="0.95" />
              <stop offset="35%" stopColor={ramp.core} stopOpacity="0.9" />
              <stop offset="80%" stopColor={ramp.deep} stopOpacity="0.95" />
              <stop offset="100%" stopColor={ramp.core} stopOpacity="0.95" />
            </radialGradient>
          </Fragment>
        );
      })}
    </defs>
  );
}
