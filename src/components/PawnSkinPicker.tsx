import type { SeatColor } from '../engine/types';
import { useAppStore } from '../store/gameStore';
import { boardPalette } from '../theme/seats';
import { PawnDefs } from './pawns/PawnDefs';
import { Token } from './pawns/Token';
import { PAWN_SKINS, PAWN_SKIN_LABEL, type PawnSkin } from './pawns/skins';

const ALL_COLORS: SeatColor[] = ['red', 'green', 'yellow', 'blue'];

function SkinPreview({ skin, colors }: { skin: PawnSkin; colors: SeatColor[] }) {
  const theme = useAppStore((s) => s.theme);
  const { surface, accent } = boardPalette(theme);
  const ids = `pv-${skin}-`;
  const pitch = 1.05;
  const width = colors.length * pitch + 0.2;

  return (
    <svg viewBox={`0 0 ${width} 1.5`} className="skin-preview" aria-hidden>
      <PawnDefs ids={ids} />
      {colors.map((color, i) => (
        <g key={color} transform={`translate(${0.1 + pitch * (i + 0.5)} 0.86)`}>
          <Token
            skin={skin}
            ids={ids}
            color={color}
            r={0.5}
            selected={false}
            movable
            doomed={false}
            collar={surface.collar}
            gold={accent.gold}
          />
        </g>
      ))}
    </svg>
  );
}

/** Pawn skin tiles, each showing the skin in the seat colours in play. */
export function PawnSkinPicker({ colors = ALL_COLORS }: { colors?: SeatColor[] }) {
  const pawnSkin = useAppStore((s) => s.pawnSkin);
  const setPawnSkin = useAppStore((s) => s.setPawnSkin);

  return (
    <div className="skin-grid" role="group" aria-label="Pawn style">
      {PAWN_SKINS.map((skin) => {
        const active = skin === pawnSkin;
        return (
          <button
            key={skin}
            type="button"
            className="skin-tile"
            data-active={active ? 'true' : 'false'}
            aria-pressed={active}
            onClick={() => setPawnSkin(skin)}
            data-testid={`skin-${skin}`}
          >
            <SkinPreview skin={skin} colors={colors} />
            <span className="skin-label">{PAWN_SKIN_LABEL[skin]}</span>
          </button>
        );
      })}
    </div>
  );
}
