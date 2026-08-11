import type { GameState, Move, TurnSnapshot } from './types';
import { rollD6, randomInt } from './rng';
import { legalMoves, applyMove, clonePlayers } from './rules';
import { getModeHooks } from './modes';
import { applyTimedStepScore } from './modes/timed';

function currentSeat(state: GameState): number {
  return state.config.seats[state.currentSeatIndex]!;
}

function currentPlayer(state: GameState) {
  return state.players.find((p) => p.seat === currentSeat(state))!;
}

function snapshotTurn(state: GameState): TurnSnapshot {
  return {
    players: clonePlayers(state.players),
    consecutiveSixes: 0,
  };
}

function restoreSnapshot(state: GameState, snap: TurnSnapshot): GameState {
  // Restore board positions from snapshot, but keep lifetime stats from current state
  // (sixesRolled, and any stats that are excluded from rollback per RULES.md).
  const restored = clonePlayers(snap.players).map((snapPlayer) => {
    const current = state.players.find((p) => p.seat === snapPlayer.seat)!;
    return {
      ...snapPlayer,
      sixesRolled: current.sixesRolled,
      // Keep score/captures/distance as they were at turn start (undone with board),
      // but sixesRolled is a lifetime stat that survives rollback.
    };
  });
  return {
    ...state,
    players: restored,
    consecutiveSixes: 0,
    diceValue: null,
    legalMoves: [],
    selectedPawnId: null,
    turnSnapshot: null,
  };
}

function nextActiveSeatIndex(state: GameState): number {
  const n = state.config.seats.length;
  let idx = state.currentSeatIndex;
  for (let i = 0; i < n; i++) {
    idx = (idx + 1) % n;
    const seat = state.config.seats[idx]!;
    const player = state.players.find((p) => p.seat === seat)!;
    if (player.finishedRank === null) return idx;
  }
  return state.currentSeatIndex;
}

function endTurn(state: GameState): GameState {
  const hooks = getModeHooks(state.config.mode);
  const win = hooks.checkWin(state);
  if (win.finished) {
    return {
      ...state,
      phase: 'finished',
      rankings: win.rankings,
      diceValue: null,
      legalMoves: [],
      selectedPawnId: null,
      turnSnapshot: null,
      consecutiveSixes: 0,
      turnDeadlineMs: null,
    };
  }

  const nextIdx = nextActiveSeatIndex(state);
  let next: GameState = {
    ...state,
    currentSeatIndex: nextIdx,
    phase: 'waiting_roll',
    diceValue: null,
    legalMoves: [],
    selectedPawnId: null,
    consecutiveSixes: 0,
    turnSnapshot: null,
    turnDeadlineMs: null,
  };

  // Set turn deadline for timed mode
  if (
    next.config.mode === 'timed' &&
    next.config.turnTimerEnabled &&
    next.clockMsRemaining !== null &&
    next.clockMsRemaining > 0
  ) {
    // turnDeadlineMs is absolute; set relative offset stored as remaining at turn start
    // Actual absolute deadline is managed by store via TICK; we store duration marker.
    next = {
      ...next,
      turnDeadlineMs: next.config.turnTimerMs ?? 20_000,
    };
  }

  return next;
}

function grantsExtraRoll(move: Move): boolean {
  return move.roll === 6 || move.unlocked || move.captures.length > 0 || move.enteredHome;
}

export function rollDice(state: GameState): GameState {
  if (state.phase !== 'waiting_roll' || state.hardStopped) return state;

  const hooks = getModeHooks(state.config.mode);

  // Hard stop check
  if (state.config.mode === 'timed' && state.clockMsRemaining !== null && state.clockMsRemaining <= 0) {
    return {
      ...state,
      hardStopped: true,
      phase: 'finished',
      rankings: hooks.checkWin({ ...state, hardStopped: true }).rankings,
    };
  }

  let rng = state.rng;
  let value: number;

  if (state.diceQueue.length > 0) {
    value = state.diceQueue[0]!;
    const diceQueue = state.diceQueue.slice(1);
    state = { ...state, diceQueue };
  } else {
    const rolled = rollD6(rng);
    value = rolled.value;
    rng = rolled.rng;
  }

  const consecutiveSixes = value === 6 ? state.consecutiveSixes + 1 : state.consecutiveSixes;
  const turnSnapshot = state.turnSnapshot ?? snapshotTurn(state);

  // Track sixes in lifetime stats
  const players = clonePlayers(state.players);
  if (value === 6) {
    const p = players.find((pl) => pl.seat === currentSeat(state))!;
    p.sixesRolled += 1;
  }

  let next: GameState = {
    ...state,
    players,
    rng,
    diceValue: value,
    consecutiveSixes,
    turnSnapshot,
    events: [
      ...state.events,
      { type: 'roll', seat: currentSeat(state), atCursor: rng.cursor, detail: { value } },
    ],
    version: state.version + 1,
  };

  // Three consecutive 6s → rollback and end turn
  if (value === 6 && consecutiveSixes >= 3) {
    next = restoreSnapshot(next, turnSnapshot);
    next = {
      ...next,
      events: [
        ...next.events,
        {
          type: 'three_sixes_forfeit',
          seat: currentSeat(state),
          atCursor: rng.cursor,
        },
      ],
    };
    return endTurn(next);
  }

  const moves = legalMoves(next, hooks);
  next = { ...next, legalMoves: moves, phase: 'waiting_move' };

  if (moves.length === 0) {
    // No legal move — end turn (even on 6)
    return endTurn({ ...next, phase: 'waiting_roll' });
  }

  return next;
}

export function selectPawn(state: GameState, pawnId: string): GameState {
  if (state.phase !== 'waiting_move') return state;
  if (!state.legalMoves.some((m) => m.pawnId === pawnId)) return state;
  return { ...state, selectedPawnId: pawnId };
}

export function doMove(state: GameState, pawnId: string): GameState {
  if (state.phase !== 'waiting_move' || state.hardStopped) return state;
  const move = state.legalMoves.find((m) => m.pawnId === pawnId);
  if (!move) return state;

  const hooks = getModeHooks(state.config.mode);

  // Capture victim progress before apply for timed scoring of steps
  let next = applyMove(state, move, hooks);

  // Timed mode: score steps
  if (state.config.mode === 'timed') {
    const players = clonePlayers(next.players);
    const mover = players.find((p) => p.seat === currentSeat(state))!;
    const steps =
      move.unlocked || move.fromProgress === -1
        ? 0
        : move.wrappedLap
          ? move.roll
          : move.toProgress - move.fromProgress;
    applyTimedStepScore(mover, steps);
    // Capture and home scoring already applied via hooks.onCapture / onPawnHome
    next = { ...next, players };
  }

  next = {
    ...next,
    events: [
      ...next.events,
      {
        type: 'move',
        seat: currentSeat(state),
        atCursor: next.rng.cursor,
        detail: {
          pawnId: move.pawnId,
          from: move.fromProgress,
          to: move.toProgress,
          captures: move.captures,
        },
      },
    ],
    diceValue: null,
    legalMoves: [],
    selectedPawnId: null,
  };

  // Check win after move
  const win = hooks.checkWin(next);
  if (win.finished) {
    return {
      ...next,
      phase: 'finished',
      rankings: win.rankings,
      turnSnapshot: null,
      consecutiveSixes: 0,
      turnDeadlineMs: null,
      winnerBannerSeat: win.rankings[0] ?? next.winnerBannerSeat,
    };
  }

  // If the current player just finished (classic), skip them — no extra roll
  const mover = next.players.find((p) => p.seat === currentSeat(state))!;
  if (mover.finishedRank !== null) {
    return endTurn(next);
  }

  if (grantsExtraRoll(move)) {
    return {
      ...next,
      phase: 'waiting_roll',
      consecutiveSixes: move.roll === 6 ? next.consecutiveSixes : 0,
      turnSnapshot: next.turnSnapshot,
    };
  }

  return endTurn(next);
}

export function pass(state: GameState): GameState {
  if (state.phase !== 'waiting_move' && state.phase !== 'waiting_roll') return state;
  return endTurn({ ...state, diceValue: null, legalMoves: [], selectedPawnId: null });
}

export function tick(state: GameState, nowMs: number): GameState {
  if (state.phase === 'finished') return state;
  if (state.config.mode !== 'timed') return state;
  if (state.clockMsRemaining === null) return state;

  const start = state.gameStartMs ?? nowMs;
  const duration = state.config.durationMs ?? 60_000;
  const elapsed = nowMs - start;
  const remaining = Math.max(0, duration - elapsed);

  let next: GameState = {
    ...state,
    gameStartMs: start,
    clockMsRemaining: remaining,
  };

  if (remaining <= 0) {
    // Hard stop — no new roll or move may begin; resolve atomically then end.
    next = { ...next, hardStopped: true, clockMsRemaining: 0 };
    const hooks = getModeHooks(next.config.mode);
    return {
      ...next,
      phase: 'finished',
      rankings: hooks.checkWin(next).rankings,
      turnDeadlineMs: null,
      diceValue: null,
      legalMoves: [],
      selectedPawnId: null,
    };
  }

  // Turn timer expiry is handled by the store via AUTOPLAY when deadline passes.
  return next;
}

export function autoplay(state: GameState): GameState {
  if (state.phase === 'finished' || state.hardStopped) {
    if (state.hardStopped && state.phase !== 'finished') {
      const hooks = getModeHooks(state.config.mode);
      return {
        ...state,
        phase: 'finished',
        rankings: hooks.checkWin(state).rankings,
      };
    }
    return state;
  }

  let next = state;
  if (next.phase === 'waiting_roll') {
    next = rollDice(next);
  }
  if (next.phase === 'waiting_move' && next.legalMoves.length > 0) {
    const { value, rng } = randomInt(next.rng, next.legalMoves.length);
    next = { ...next, rng };
    const move = next.legalMoves[value]!;
    next = doMove(next, move.pawnId);
  } else if (next.phase === 'waiting_move' && next.legalMoves.length === 0) {
    next = endTurn(next);
  }
  return next;
}

export { endTurn, grantsExtraRoll, currentSeat, currentPlayer };
