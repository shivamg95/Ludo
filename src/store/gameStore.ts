import { create } from 'zustand';
import { createGame, reduce } from '../engine/engine';
import type { GameConfig, GameState, GameMode } from '../engine/types';
import { seatsForPlayerCount, SEATS } from '../engine/board';
import { chooseMove } from '../bot/chooseMove';
import { playSfx } from '../audio/sfx';
import {
  BOT_FACE_READ_MS,
  DICE_SETTLE_MS,
  DICE_TUMBLE_MS,
  NO_MOVE_HOLD_MS,
  prefersReducedMotion,
} from '../ui/motion';

export type Screen = 'setup' | 'game' | 'results';

export interface SetupDraft {
  mode: GameMode;
  totalPlayers: number;
  humanCount: number;
  names: Record<number, string>;
  durationMin: number;
  turnTimerEnabled: boolean;
}

interface AppState {
  screen: Screen;
  setup: SetupDraft;
  game: GameState | null;
  muted: boolean;
  theme: 'dark' | 'light';
  botDelayMs: number;
  animating: boolean;
  rolling: boolean;
  announcement: string;
  resumed: boolean;
  lastDiceValue: number | null;
  hint: string | null;
  extraRoll: boolean;
  turnStartedAt: number | null;
  turnTimerRemainingMs: number | null;
  diceSpin: { x: number; y: number };

  setSetup: (partial: Partial<SetupDraft>) => void;
  startGame: (overrides?: Partial<GameConfig>) => void;
  dispatch: (action: Parameters<typeof reduce>[1]) => void;
  roll: () => void;
  movePawn: (pawnId: string) => void;
  selectPawn: (pawnId: string) => void;
  setMuted: (muted: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setBotDelay: (ms: number) => void;
  setAnimating: (v: boolean) => void;
  setAnnouncement: (msg: string) => void;
  goSetup: () => void;
  goResults: () => void;
  resumeIfSaved: () => boolean;
  clearSave: () => void;
  tickClock: (nowMs: number) => void;
  runBotTurn: () => void;
  noteHopFinished: () => void;
}

const STORAGE_KEY = 'ludo-save-v1';
const SETTINGS_KEY = 'ludo-settings-v1';

function defaultNames(seats: number[]): Record<number, string> {
  const names: Record<number, string> = {};
  for (const s of seats) {
    names[s] = SEATS[s]!.color.charAt(0).toUpperCase() + SEATS[s]!.color.slice(1);
  }
  return names;
}

function buildConfig(setup: SetupDraft, seed?: number): GameConfig {
  const seats = seatsForPlayerCount(setup.totalPlayers);
  const bots: Record<number, boolean> = {};
  seats.forEach((seat, i) => {
    bots[seat] = i >= setup.humanCount;
  });
  return {
    mode: setup.mode,
    seats,
    playerNames: { ...defaultNames(seats), ...setup.names },
    bots,
    seed: seed ?? (Math.floor(Math.random() * 1_000_000_000) || 1),
    durationMs: setup.mode === 'timed' ? setup.durationMin * 60_000 : undefined,
    turnTimerEnabled: setup.mode === 'timed' ? setup.turnTimerEnabled : false,
  };
}

function loadSettings(): Partial<Pick<AppState, 'muted' | 'theme' | 'botDelayMs'>> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Pick<AppState, 'muted' | 'theme' | 'botDelayMs'>>;
  } catch {
    return {};
  }
}

function saveSettings(state: AppState) {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ muted: state.muted, theme: state.theme, botDelayMs: state.botDelayMs }),
  );
}

function persistGame(game: GameState | null, screen: Screen) {
  if (screen === 'game' && game && game.phase !== 'finished') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ game, screen }));
  } else if (screen !== 'game') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function lastRolledValue(state: GameState): number | null {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i]!;
    if (e.type === 'roll' && typeof e.detail?.value === 'number') return e.detail.value as number;
  }
  return null;
}

function randomSpin() {
  return {
    x: 360 + Math.random() * 420,
    y: -(380 + Math.random() * 520),
  };
}

function markIdle(animating: boolean) {
  if (typeof document === 'undefined') return;
  document.body.dataset.animIdle = animating ? 'false' : 'true';
}

const settings = loadSettings();

export const useAppStore = create<AppState>((set, get) => ({
  screen: 'setup',
  setup: {
    mode: 'classic',
    totalPlayers: 2,
    humanCount: 1,
    names: defaultNames([0, 2]),
    durationMin: 3,
    turnTimerEnabled: true,
  },
  game: null,
  muted: settings.muted ?? false,
  theme: settings.theme ?? 'dark',
  botDelayMs: settings.botDelayMs && settings.botDelayMs > 0 ? settings.botDelayMs : 650,
  animating: false,
  rolling: false,
  announcement: '',
  resumed: false,
  lastDiceValue: null,
  hint: null,
  extraRoll: false,
  turnStartedAt: null,
  turnTimerRemainingMs: null,
  diceSpin: { x: 400, y: -520 },

  setSetup: (partial) => {
    set((s) => {
      const setup = { ...s.setup, ...partial };
      if (partial.totalPlayers !== undefined) {
        setup.humanCount = Math.min(setup.humanCount, setup.totalPlayers);
        setup.humanCount = Math.max(1, setup.humanCount);
        const seats = seatsForPlayerCount(setup.totalPlayers);
        setup.names = { ...defaultNames(seats), ...setup.names };
      }
      if (partial.humanCount !== undefined) {
        setup.humanCount = Math.max(1, Math.min(setup.totalPlayers, partial.humanCount));
      }
      return { setup };
    });
  },

  startGame: (overrides) => {
    const config = { ...buildConfig(get().setup), ...overrides };
    const game = createGame(config);
    const withStart =
      config.mode === 'timed'
        ? { ...game, gameStartMs: performance.now() }
        : game;
    const botDelayMs = get().botDelayMs <= 0 ? 650 : get().botDelayMs;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    set({
      game: withStart,
      screen: 'game',
      resumed: false,
      announcement: 'Game started',
      botDelayMs,
      rolling: false,
      animating: false,
      lastDiceValue: null,
      hint: null,
      extraRoll: false,
      turnStartedAt: withStart.turnDeadlineMs ? now : null,
      turnTimerRemainingMs: withStart.turnDeadlineMs,
      diceSpin: randomSpin(),
    });
    markIdle(false);
    persistGame(withStart, 'game');
    queueMicrotask(() => get().runBotTurn());
  },

  dispatch: (action) => {
    const { game } = get();
    if (!game) return;
    const prevSeat = game.config.seats[game.currentSeatIndex];
    const next = reduce(game, action);
    const screen = next.phase === 'finished' ? 'results' : get().screen;
    const rolled = lastRolledValue(next);
    const lastDiceValue =
      next.diceValue ?? (action.type === 'ROLL' ? rolled : get().lastDiceValue);

    let hint = get().hint;
    let extraRoll = get().extraRoll;
    if (action.type === 'ROLL') {
      extraRoll = false;
      const lastType = next.events[next.events.length - 1]?.type;
      if (next.phase === 'waiting_roll' && next.legalMoves.length === 0) {
        hint = lastType === 'three_sixes_forfeit' ? 'Three sixes' : 'No moves';
      } else {
        hint = null;
      }
    }
    if (action.type === 'MOVE') {
      const nextSeat = next.config.seats[next.currentSeatIndex];
      extraRoll = next.phase === 'waiting_roll' && nextSeat === prevSeat;
      hint = extraRoll ? 'Roll again' : null;
    }

    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    const seatChanged = next.currentSeatIndex !== game.currentSeatIndex;
    const deadlineChanged = next.turnDeadlineMs !== game.turnDeadlineMs;
    let turnStartedAt = get().turnStartedAt;
    let turnTimerRemainingMs = get().turnTimerRemainingMs;
    if (action.type !== 'TICK') {
      if (next.turnDeadlineMs && (seatChanged || deadlineChanged || turnStartedAt === null)) {
        turnStartedAt = now;
        turnTimerRemainingMs = next.turnDeadlineMs;
      }
      if (!next.turnDeadlineMs) {
        turnStartedAt = null;
        turnTimerRemainingMs = null;
      }
    }

    set({
      game: next,
      screen,
      lastDiceValue,
      hint,
      extraRoll,
      turnStartedAt,
      turnTimerRemainingMs,
      announcement:
        action.type === 'ROLL'
          ? (() => {
              const rollEv = [...next.events].reverse().find((e) => e.type === 'roll');
              const who =
                next.players.find((p) => p.seat === rollEv?.seat)?.name ??
                next.players.find((p) => p.seat === next.config.seats[next.currentSeatIndex])
                  ?.name ??
                '';
              return `${who} rolled ${next.diceValue ?? lastDiceValue ?? ''}`;
            })()
          : get().announcement,
    });
    persistGame(next, screen === 'results' ? 'results' : 'game');
    if (next.phase === 'finished') {
      localStorage.removeItem(STORAGE_KEY);
    }
    if (action.type !== 'TICK') {
      queueMicrotask(() => get().runBotTurn());
    }
  },

  roll: () => {
    if (get().rolling) return;
    const reduced = prefersReducedMotion();
    if (reduced) {
      get().dispatch({ type: 'ROLL' });
      return;
    }
    set({ rolling: true, animating: true, diceSpin: randomSpin(), hint: null });
    markIdle(true);
    window.setTimeout(() => {
      get().dispatch({ type: 'ROLL' });
      set({ rolling: false });
      const next = get().game;
      const noMoveHold =
        next && next.phase === 'waiting_roll' && next.legalMoves.length === 0
          ? NO_MOVE_HOLD_MS
          : 0;
      window.setTimeout(() => {
        set({ animating: false });
        markIdle(false);
        if (get().hint === 'No moves' || get().hint === 'Three sixes') {
          set({ hint: get().extraRoll ? 'Roll again' : null });
        }
        get().runBotTurn();
      }, DICE_SETTLE_MS + noMoveHold);
    }, DICE_TUMBLE_MS);
  },

  movePawn: (pawnId) => {
    if (!prefersReducedMotion()) {
      set({ animating: true });
      markIdle(true);
    }
    get().dispatch({ type: 'MOVE', pawnId });
  },

  selectPawn: (pawnId) => get().dispatch({ type: 'SELECT_PAWN', pawnId }),

  setMuted: (muted) => {
    set({ muted });
    saveSettings(get());
  },

  setTheme: (theme) => {
    set({ theme });
    document.documentElement.dataset.theme = theme;
    saveSettings(get());
  },

  setBotDelay: (ms) => {
    set({ botDelayMs: ms });
    saveSettings(get());
  },

  setAnimating: (animating) => {
    set({ animating });
    markIdle(animating);
  },

  noteHopFinished: () => {
    set({ animating: false });
    markIdle(false);
    get().runBotTurn();
  },

  setAnnouncement: (announcement) => set({ announcement }),

  goSetup: () => {
    set({
      screen: 'setup',
      game: null,
      hint: null,
      extraRoll: false,
      lastDiceValue: null,
      turnStartedAt: null,
      turnTimerRemainingMs: null,
    });
    localStorage.removeItem(STORAGE_KEY);
  },

  goResults: () => set({ screen: 'results' }),

  resumeIfSaved: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as { game: GameState; screen: Screen };
      if (data.game && data.screen === 'game') {
        const now = typeof performance !== 'undefined' ? performance.now() : 0;
        set({
          game: data.game,
          screen: 'game',
          resumed: true,
          turnStartedAt: data.game.turnDeadlineMs ? now : null,
          turnTimerRemainingMs: data.game.turnDeadlineMs,
        });
        queueMicrotask(() => get().runBotTurn());
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  },

  clearSave: () => localStorage.removeItem(STORAGE_KEY),

  tickClock: (nowMs) => {
    const { game, turnStartedAt, animating, rolling } = get();
    if (!game) return;
    if (game.config.mode === 'timed') {
      get().dispatch({ type: 'TICK', nowMs });
    }
    const g = get().game;
    if (!g || g.phase === 'finished' || !g.config.turnTimerEnabled || !g.turnDeadlineMs) {
      return;
    }
    if (turnStartedAt !== null) {
      const remaining = Math.max(0, g.turnDeadlineMs - (nowMs - turnStartedAt));
      set({ turnTimerRemainingMs: remaining });
      if (remaining <= 0 && !animating && !rolling) {
        get().dispatch({ type: 'AUTOPLAY' });
      }
    }
  },

  runBotTurn: () => {
    const { game, botDelayMs, animating, rolling } = get();
    if (!game || game.phase === 'finished' || animating || rolling) return;
    const seat = game.config.seats[game.currentSeatIndex]!;
    const player = game.players.find((p) => p.seat === seat)!;
    if (!player.isBot) return;

    const reduced = prefersReducedMotion();

    if (botDelayMs <= 0) {
      if (game.phase === 'waiting_roll') {
        get().dispatch({ type: 'ROLL' });
        return;
      }
      if (game.phase === 'waiting_move') {
        const move = chooseMove(game);
        if (move) get().dispatch({ type: 'MOVE', pawnId: move.pawnId });
        else get().dispatch({ type: 'PASS' });
      }
      return;
    }

    window.setTimeout(() => {
      const g = get().game;
      if (!g || g.phase === 'finished' || get().animating || get().rolling) return;
      const s = g.config.seats[g.currentSeatIndex]!;
      const p = g.players.find((pl) => pl.seat === s)!;
      if (!p.isBot) return;

      if (g.phase === 'waiting_roll') {
        if (reduced) {
          get().dispatch({ type: 'ROLL' });
          return;
        }
        if (!get().muted) playSfx('roll');
        set({ rolling: true, animating: true, diceSpin: randomSpin(), hint: null });
        markIdle(true);
        window.setTimeout(() => {
          get().dispatch({ type: 'ROLL' });
          set({ rolling: false });
          const after = get().game;
          const noMoveHold =
            after && after.phase === 'waiting_roll' && after.legalMoves.length === 0
              ? NO_MOVE_HOLD_MS
              : BOT_FACE_READ_MS;
          window.setTimeout(() => {
            set({ animating: false });
            markIdle(false);
            get().runBotTurn();
          }, noMoveHold);
        }, DICE_TUMBLE_MS);
        return;
      }

      if (g.phase === 'waiting_move') {
        const move = chooseMove(g);
        if (move) {
          if (!reduced) {
            set({ animating: true });
            markIdle(true);
          }
          get().dispatch({ type: 'MOVE', pawnId: move.pawnId });
        } else get().dispatch({ type: 'PASS' });
      }
    }, botDelayMs);
  },
}));

export function installTestHook() {
  if (typeof window === 'undefined') return;
  const w = window as Window & { __ludo?: Record<string, unknown> };
  w.__ludo = {
    setDiceQueue: (queue: number[]) => {
      useAppStore.getState().dispatch({ type: 'SET_DICE_QUEUE', queue });
    },
    setSeed: (seed: number) => {
      const { setup, startGame } = useAppStore.getState();
      startGame({ ...buildConfig(setup, seed), seed });
    },
    getState: () => useAppStore.getState().game,
    setBotDelay: (ms: number) => {
      useAppStore.setState({ botDelayMs: ms });
    },
    advanceClock: (ms: number) => {
      const g = useAppStore.getState().game;
      if (!g) return;
      const start = g.gameStartMs ?? 0;
      useAppStore.getState().tickClock(start + ms);
    },
    store: useAppStore,
  };
}

export function parseUrlParams(): Partial<GameConfig> & { anim?: boolean; autoStart?: boolean } {
  const params = new URLSearchParams(window.location.search);
  const result: Partial<GameConfig> & { anim?: boolean; autoStart?: boolean } = {};
  if (params.has('seed')) result.seed = Number(params.get('seed'));
  if (params.has('mode')) result.mode = params.get('mode') as GameMode;
  if (params.get('anim') === '0') result.anim = false;
  if (params.has('autostart')) result.autoStart = true;
  return result;
}
