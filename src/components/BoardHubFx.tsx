import { memo } from 'react';
import { boardPalette } from '../theme/seats';
import { useAppStore } from '../store/gameStore';

/** Board units: the hub is a 3.2-cell square whose top-left corner is (5.9, 5.9). */
const HUB_VIEW = '5.9 5.9 3.2 3.2';

/**
 * Hub shine and jewel. These loops used to run inside the board SVG, so every
 * frame repainted the whole board, drop-shadow included. Here they animate
 * composited layers only (transform and opacity), and the board stays still.
 *
 * Layer order matches the old SVG: shine sits above the hub, below the jewel.
 */
export const BoardHubFx = memo(function BoardHubFx() {
  const theme = useAppStore((s) => s.theme);
  const { surface, accent } = boardPalette(theme);
  const bloom = surface.bloom ? 'url(#hub-bloom)' : undefined;

  return (
    <div className="board-hub" aria-hidden="true">
      <div className="board-hub-clip">
        <div className="board-hub-shine" />
      </div>
      <svg viewBox={HUB_VIEW}>
        <g filter={bloom}>
          <circle
            cx={7.5}
            cy={7.5}
            r={0.32}
            fill={surface.jewel}
            stroke={accent.core}
            strokeWidth={0.05}
          />
        </g>
      </svg>
      <div className="board-hub-pulse">
        <svg viewBox={HUB_VIEW}>
          <g filter={bloom}>
            <circle cx={7.5} cy={7.5} r={0.17} fill={accent.core} />
          </g>
        </svg>
      </div>
    </div>
  );
});
