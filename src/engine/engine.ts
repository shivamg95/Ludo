import type { GameAction, GameConfig, GameState, Player, Pawn } from './types';
import { SEATS, SEAT_COLORS } from './board';
import { createRng } from './rng';
import { getModeHooks } from './modes';
import {
  rollDice,
  selectPawn,
  doMove,
  pass,
  tick,
  autoplay,
} from './turn';

function makePawns(seat: number, initialProgress: number): Pawn[] {
  return [0, 1, 2, 3].map((index) => ({
    id: `pawn-${SEAT_COLORS[seat]}-${index}`,
    seat,
    index,
    progress: initialProgress,
    laps: 0,
  }));
}

function makePlayer(
  seat: number,
  config: GameConfig,
  initialProgress: number,
): Player {
  return {
    seat,
    color: SEATS[seat]!.color,
    name: config.playerNames[seat] ?? SEATS[seat]!.color,
    isBot: config.bots[seat] ?? false,
    finishedRank: null,
    score: 0,
    captures: 0,
    distanceTravelled: 0,
    sixesRolled: 0,
    hasCaptured: false,
    pawns: makePawns(seat, initialProgress),
  };
}

export function createGame(config: GameConfig): GameState {
  const hooks = getModeHooks(config.mode);
  const initialProgress = hooks.initialProgress();
  const players = config.seats.map((seat) => makePlayer(seat, config, initialProgress));

  const durationMs = config.durationMs ?? 180_000;
  const isTimed = config.mode === 'timed';

  return {
    config: {
      ...config,
      turnTimerMs: config.turnTimerMs ?? 20_000,
      turnTimerEnabled: config.turnTimerEnabled ?? isTimed,
      durationMs,
    },
    players,
    currentSeatIndex: 0,
    phase: 'waiting_roll',
    diceValue: null,
    consecutiveSixes: 0,
    legalMoves: [],
    selectedPawnId: null,
    rng: createRng(config.seed),
    diceQueue: [],
    turnSnapshot: null,
    events: [],
    rankings: [],
    clockMsRemaining: isTimed ? durationMs : null,
    turnDeadlineMs: null,
    gameStartMs: null,
    hardStopped: false,
    winnerBannerSeat: null,
    version: 0,
  };
}

export function reduce(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'ROLL':
      return rollDice(state);
    case 'SELECT_PAWN':
      return selectPawn(state, action.pawnId);
    case 'MOVE':
      return doMove(state, action.pawnId);
    case 'PASS':
      return pass(state);
    case 'TICK':
      return tick(state, action.nowMs);
    case 'AUTOPLAY':
      return autoplay(state);
    case 'SET_DICE_QUEUE':
      return { ...state, diceQueue: [...action.queue] };
    default:
      return state;
  }
}

/** Convenience: apply a sequence of actions. */
export function reduceAll(state: GameState, actions: GameAction[]): GameState {
  return actions.reduce(reduce, state);
}
