import type { PawnSkin } from './skins';
import type { TokenProps } from './frame';
import { ArcadeToken } from './ArcadeToken';
import { ClassicToken } from './ClassicToken';
import { MarbleToken } from './MarbleToken';
import { GemToken } from './GemToken';

const SKIN_COMPONENT = {
  arcade: ArcadeToken,
  classic: ClassicToken,
  marble: MarbleToken,
  gem: GemToken,
} satisfies Record<PawnSkin, (props: TokenProps) => React.JSX.Element>;

export function Token({ skin, ...props }: TokenProps & { skin: PawnSkin }) {
  const Skin = SKIN_COMPONENT[skin] ?? ArcadeToken;
  return <Skin {...props} />;
}
