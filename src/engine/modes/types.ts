import type { GameState, Player, Pawn } from '../types';

export interface ModeHooks {
  initialProgress: () => number;
  canEnterHome: (state: GameState, player: Player) => boolean;
  onCapture?: (
    state: GameState,
    attacker: Player,
    victim: Player,
    victimProgress: number,
    players: Player[],
  ) => void;
  onPawnHome?: (state: GameState, player: Player, pawn: Pawn, players: Player[]) => void;
  afterPawnHome?: (state: GameState, seat: number) => GameState;
  /** Returns true if the game should end after this move. */
  checkWin: (state: GameState) => { finished: boolean; rankings: number[] };
  grantsExtraRoll?: (move: {
    unlocked: boolean;
    captures: string[];
    enteredHome: boolean;
    roll: number;
  }) => boolean;
}
