/** Seat color identifiers. */
export type SeatColor = 'red' | 'green' | 'yellow' | 'blue';

export type GameMode = 'classic' | 'timed' | 'quick';

export type Phase =
  | 'waiting_roll'
  | 'waiting_move'
  | 'animating'
  | 'finished';

export interface Cell {
  row: number;
  col: number;
}

export interface SeatDef {
  seat: number;
  color: SeatColor;
  entryIndex: number;
  startCell: Cell;
  homeColumn: Cell[];
  yard: { rowMin: number; rowMax: number; colMin: number; colMax: number };
}

export interface Pawn {
  id: string;
  seat: number;
  index: number;
  /** -1 yard, 0..50 ring, 51..55 home column, 56 HOME */
  progress: number;
  laps: number;
}

export interface Player {
  seat: number;
  color: SeatColor;
  name: string;
  isBot: boolean;
  /** Finished rank in classic (1-based), null if still playing */
  finishedRank: number | null;
  score: number;
  captures: number;
  distanceTravelled: number;
  sixesRolled: number;
  hasCaptured: boolean;
  pawns: Pawn[];
}

export interface Move {
  pawnId: string;
  fromProgress: number;
  toProgress: number;
  roll: number;
  captures: string[];
  enteredHome: boolean;
  unlocked: boolean;
  wrappedLap: boolean;
}

export interface RngState {
  seed: number;
  cursor: number;
}

export interface GameConfig {
  mode: GameMode;
  /** Seat indices that are active (length 2-4). */
  seats: number[];
  playerNames: Record<number, string>;
  bots: Record<number, boolean>;
  seed: number;
  /** Timed mode duration in ms. */
  durationMs?: number;
  /** Per-turn countdown in ms (timed mode). */
  turnTimerMs?: number;
  turnTimerEnabled?: boolean;
}

export interface TurnSnapshot {
  players: Player[];
  consecutiveSixes: number;
}

export interface GameEvent {
  type: string;
  seat: number;
  atCursor: number;
  detail?: Record<string, unknown>;
}

export interface GameState {
  config: GameConfig;
  players: Player[];
  currentSeatIndex: number;
  /** Index into active seats list. */
  phase: Phase;
  diceValue: number | null;
  consecutiveSixes: number;
  legalMoves: Move[];
  selectedPawnId: string | null;
  rng: RngState;
  /** Forced dice queue for tests (consumed before RNG). */
  diceQueue: number[];
  turnSnapshot: TurnSnapshot | null;
  events: GameEvent[];
  rankings: number[];
  /** Timed mode */
  clockMsRemaining: number | null;
  turnDeadlineMs: number | null;
  gameStartMs: number | null;
  hardStopped: boolean;
  winnerBannerSeat: number | null;
  version: number;
}

export type GameAction =
  | { type: 'ROLL' }
  | { type: 'SELECT_PAWN'; pawnId: string }
  | { type: 'MOVE'; pawnId: string }
  | { type: 'PASS' }
  | { type: 'TICK'; nowMs: number }
  | { type: 'AUTOPLAY' }
  | { type: 'SET_DICE_QUEUE'; queue: number[] };
