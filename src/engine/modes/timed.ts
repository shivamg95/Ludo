import type { ModeHooks } from './types';
import type { GameState, Player } from '../types';
import { scoreCapture, scoreHome, scoreSteps, timedRanking } from '../scoring';

export const timedHooks: ModeHooks = {
  initialProgress: () => 0,

  canEnterHome: () => true,

  onCapture: (_state, attacker, victim, victimProgress) => {
    scoreCapture(attacker, victim, victimProgress);
  },

  onPawnHome: (_state, player) => {
    scoreHome(player);
  },

  afterPawnHome: (state, seat) => {
    const players = state.players.map((p) => ({
      ...p,
      pawns: p.pawns.map((pawn) => ({ ...pawn })),
    }));
    const player = players.find((p) => p.seat === seat)!;
    // Score steps are applied in turn.ts for timed mode
    if (player.pawns.every((p) => p.progress === 56)) {
      // Respawn all into yard
      for (const pawn of player.pawns) {
        pawn.progress = -1;
      }
    }
    return { ...state, players };
  },

  checkWin: (state: GameState) => {
    if (state.hardStopped || (state.clockMsRemaining !== null && state.clockMsRemaining <= 0)) {
      return { finished: true, rankings: timedRanking(state) };
    }
    return { finished: false, rankings: state.rankings };
  },
};

/** Apply step scoring after a move in timed mode. */
export function applyTimedStepScore(player: Player, steps: number): void {
  scoreSteps(player, steps);
}
