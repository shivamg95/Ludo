import type { ModeHooks } from './types';
import type { GameState, Player } from '../types';

function progressScore(player: Player): number {
  return player.pawns.reduce((sum, p) => {
    const prog = p.progress < 0 ? 0 : p.progress;
    return sum + p.laps * 51 + prog;
  }, 0);
}

export const quickHooks: ModeHooks = {
  initialProgress: () => -1,

  canEnterHome: (_state, player) => player.hasCaptured,

  checkWin: (state: GameState) => {
    // First pawn home ends the game
    for (const player of state.players) {
      if (player.pawns.some((p) => p.progress === 56)) {
        const others = state.players
          .filter((p) => p.seat !== player.seat)
          .sort((a, b) => {
            const sa = progressScore(a);
            const sb = progressScore(b);
            if (sb !== sa) return sb - sa;
            if (b.captures !== a.captures) return b.captures - a.captures;
            return a.seat - b.seat;
          })
          .map((p) => p.seat);
        return { finished: true, rankings: [player.seat, ...others] };
      }
    }
    return { finished: false, rankings: state.rankings };
  },
};
