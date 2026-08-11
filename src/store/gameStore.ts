import { create } from 'zustand';
import { createGame, reduce } from '../engine/engine';
import type { GameConfig, GameState, GameMode } from '../engine/types';
import { seatsForPlayerCount, SEATS } from '../engine/board';
import { chooseMove } from '../bot/chooseMove';

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
  announcement: string;
  resumed: boolean;

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
  botDelayMs: settings.botDelayMs ?? 650,
  animating: false,
  announcement: '',
  resumed: false,

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
    set({ game: withStart, screen: 'game', resumed: false, announcement: 'Game started' });
    persistGame(withStart, 'game');
    // Kick bot if first player is bot
    queueMicrotask(() => get().runBotTurn());
  },

  dispatch: (action) => {
    const { game } = get();
    if (!game) return;
    const next = reduce(game, action);
    const screen = next.phase === 'finished' ? 'results' : get().screen;
    set({
      game: next,
      screen,
      announcement:
        action.type === 'ROLL'
          ? `${next.players.find((p) => p.seat === next.config.seats[next.currentSeatIndex])?.name ?? ''} rolled ${next.diceValue ?? ''}`
          : get().announcement,
    });
    persistGame(next, screen === 'results' ? 'results' : 'game');
    if (next.phase === 'finished') {
      localStorage.removeItem(STORAGE_KEY);
    }
    queueMicrotask(() => get().runBotTurn());
  },

  roll: () => get().dispatch({ type: 'ROLL' }),

  movePawn: (pawnId) => get().dispatch({ type: 'MOVE', pawnId }),

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
    document.body.dataset.animIdle = animating ? 'false' : 'true';
  },

  setAnnouncement: (announcement) => set({ announcement }),

  goSetup: () => {
    set({ screen: 'setup', game: null });
    localStorage.removeItem(STORAGE_KEY);
  },

  goResults: () => set({ screen: 'results' }),

  resumeIfSaved: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as { game: GameState; screen: Screen };
      if (data.game && data.screen === 'game') {
        set({ game: data.game, screen: 'game', resumed: true });
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
    const { game } = get();
    if (!game || game.config.mode !== 'timed') return;
    get().dispatch({ type: 'TICK', nowMs });
  },

  runBotTurn: () => {
    const { game, botDelayMs, animating } = get();
    if (!game || game.phase === 'finished' || animating) return;
    const seat = game.config.seats[game.currentSeatIndex]!;
    const player = game.players.find((p) => p.seat === seat)!;
    if (!player.isBot) return;

    const act = () => {
      const g = get().game;
      if (!g || g.phase === 'finished') return;
      const s = g.config.seats[g.currentSeatIndex]!;
      const p = g.players.find((pl) => pl.seat === s)!;
      if (!p.isBot) return;

      if (g.phase === 'waiting_roll') {
        get().dispatch({ type: 'ROLL' });
        return;
      }
      if (g.phase === 'waiting_move') {
        const move = chooseMove(g);
        if (move) get().dispatch({ type: 'MOVE', pawnId: move.pawnId });
        else get().dispatch({ type: 'PASS' });
      }
    };

    if (botDelayMs <= 0) {
      act();
    } else {
      window.setTimeout(act, botDelayMs);
    }
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
    setBotDelay: (ms: number) => useAppStore.getState().setBotDelay(ms),
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
  // dice= URL param is applied after autostart via the test hook in main.tsx
  if (params.get('anim') === '0') result.anim = false;
  if (params.has('autostart')) result.autoStart = true;
  return result;
}
