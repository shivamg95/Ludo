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

/**
 * Centre of each skin's body (contact shadow included, glow excluded), in token
 * radii below the token origin. Squash and pulse scale about this point, which
 * matches the old SVG `fill-box` centre.
 */
export const SKIN_CENTER_Y: Record<PawnSkin, number> = {
  arcade: 0.03,
  classic: -0.15,
  marble: -0.01,
  gem: 0.04,
};
