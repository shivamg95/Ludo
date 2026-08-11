import type { ModeHooks } from './types';
import type { GameState, Player } from '../types';

function allHome(player: Player): boolean {
  return player.pawns.every((p) => p.progress === 56);
}

export const classicHooks: ModeHooks = {
  initialProgress: () => -1,

  canEnterHome: () => true,

  checkWin: (state: GameState) => {
    const unfinished = state.players.filter((p) => p.finishedRank === null);
    if (unfinished.length <= 1) {
      // Assign last place if needed
      const rankings = [...state.players]
        .filter((p) => p.finishedRank !== null)
        .sort((a, b) => a.finishedRank! - b.finishedRank!)
        .map((p) => p.seat);
      if (unfinished.length === 1) {
        rankings.push(unfinished[0]!.seat);
      }
      return { finished: true, rankings };
    }
    return { finished: false, rankings: state.rankings };
  },

  afterPawnHome: (state, seat) => {
    const players = state.players.map((p) => ({
      ...p,
      pawns: p.pawns.map((pawn) => ({ ...pawn })),
    }));
    const player = players.find((p) => p.seat === seat)!;
    if (allHome(player) && player.finishedRank === null) {
      const nextRank =
        players.filter((p) => p.finishedRank !== null).length + 1;
      player.finishedRank = nextRank;
      const rankings = [...state.rankings];
      if (!rankings.includes(seat)) rankings.push(seat);
      return {
        ...state,
        players,
        rankings,
        winnerBannerSeat: rankings[0] ?? seat,
      };
    }
    return { ...state, players };
  },
};
