export type PawnSkin = 'arcade' | 'classic' | 'marble' | 'gem';

export const PAWN_SKINS: readonly PawnSkin[] = ['arcade', 'classic', 'marble', 'gem'];

export const PAWN_SKIN_LABEL: Record<PawnSkin, string> = {
  arcade: 'Arcade',
  classic: 'Classic',
  marble: 'Marble',
  gem: 'Gem',
};

/** Stack-count badge height, in cells above the token centre; taller skins lift it. */
export const SKIN_BADGE_Y: Record<PawnSkin, number> = {
  arcade: -0.3,
  classic: -0.46,
  marble: -0.38,
  gem: -0.36,
};
