import { create } from 'zustand';
import { createGame, reduce } from '../engine/engine';
import type { GameConfig, GameState, GameMode } from '../engine/types';
import { seatsForPlayerCount, SEATS } from '../engine/board';
import { chooseMove } from '../bot/chooseMove';
import { playSfx } from '../audio/sfx';
import { BEAT } from '../ui/motion';
import { PAWN_SKINS, type PawnSkin } from '../components/pawns/skins';

export type Screen = 'setup' | 'game' | 'results';

/**
 * A roll that ended the turn on the spot — no legal move, or a third six. The
 * engine has already passed the turn, so this keeps the die with its roller
 * long enough for the result to be read.
 */
export interface RollReveal {
  seat: number;
  value: number;
  reason: 'no_moves' | 'forfeit';
}

/** Detects whether a ROLL from `before` produced `after` without leaving a move. */
export function rollRevealFor(before: GameState, after: GameState): RollReveal | null {
  if (after.phase === 'finished') return null;
  const fresh = after.events.slice(before.events.length);
  const rollEvent = fresh.find((e) => e.type === 'roll');
  if (!rollEvent) return null;
  const value = Number(rollEvent.detail?.value);
  if (fresh.some((e) => e.type === 'three_sixes_forfeit')) {
    return { seat: rollEvent.seat, value, reason: 'forfeit' };
  }
  if (after.phase === 'waiting_roll') return { seat: rollEvent.seat, value, reason: 'no_moves' };
  return null;
}

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
  rollReveal: RollReveal | null;
  pawnSkin: PawnSkin;
  /** Dev-style frame-rate meter in the corner. Off unless someone switches it on. */
  showFps: boolean;
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
  setPawnSkin: (skin: PawnSkin) => void;
  setShowFps: (show: boolean) => void;
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

export interface SavedGameSummary {
  mode: GameMode;
  playerCount: number;
  /** Tokens already home across every seat. */
  tokensHome: number;
  turnOf: string;
}

/** Reads the saved game without restoring it, so Setup can offer to continue. */
export function peekSavedGame(): SavedGameSummary | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { game: GameState; screen: Screen };
    const game = data.game;
    if (!game || data.screen !== 'game' || game.phase === 'finished') return null;

    const seat = game.config.seats[game.currentSeatIndex];
    return {
      mode: game.config.mode,
      playerCount: game.players.length,
      tokensHome: game.players.reduce(
        (n, p) => n + p.pawns.filter((x) => x.progress === 56).length,
        0,
      ),
      turnOf: game.players.find((p) => p.seat === seat)?.name ?? 'Player',
    };
  } catch {
    return null;
  }
}

type PersistedSettings = Partial<
  Pick<AppState, 'muted' | 'theme' | 'botDelayMs' | 'pawnSkin' | 'showFps'>
> & {
  names?: Record<number, string>;
};

function coerceNames(raw: unknown): Record<number, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const seat = Number(k);
    if (Number.isInteger(seat) && typeof v === 'string') out[seat] = v;
  }
  return out;
}

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedSettings;
    return { ...parsed, names: coerceNames(parsed.names) };
  } catch {
    return {};
  }
}

function saveSettings(state: AppState) {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      muted: state.muted,
      theme: state.theme,
      botDelayMs: state.botDelayMs,
      pawnSkin: state.pawnSkin,
      showFps: state.showFps,
      names: state.setup.names,
    }),
  );
}

function writeSave(game: GameState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ game, screen: 'game' }));
}

/**
 * Autosave is deferred. Serialising the whole game on every dispatch stalls the
 * frame where a hop starts, so only the newest game is written, at idle time.
 * Pending writes flush on pagehide and when the tab hides, so a reload keeps the last move.
 */
let queuedSave: GameState | null = null;
let queuedHandle: { id: number; idle: boolean } | null = null;

function cancelQueuedSave() {
  queuedSave = null;
  if (!queuedHandle) return;
  if (queuedHandle.idle) window.cancelIdleCallback(queuedHandle.id);
  else window.clearTimeout(queuedHandle.id);
  queuedHandle = null;
}

function flushQueuedSave() {
  const game = queuedSave;
  cancelQueuedSave();
  if (game) writeSave(game);
}

function runQueuedSave() {
  queuedHandle = null;
  flushQueuedSave();
}

function queueSave(game: GameState) {
  queuedSave = game;
  // A run is already scheduled, and it will write this newer game when it fires
  if (queuedHandle) return;
  queuedHandle =
    typeof window.requestIdleCallback === 'function'
      ? { id: window.requestIdleCallback(runQueuedSave, { timeout: 500 }), idle: true }
      : { id: window.setTimeout(runQueuedSave, 150), idle: false };
}

function persistGame(game: GameState | null, screen: Screen) {
  if (screen === 'game' && game && game.phase !== 'finished') {
    queueSave(game);
    return;
  }
  // Finished or left the game: a late write must never bring a cleared save back
  cancelQueuedSave();
  if (screen !== 'game') localStorage.removeItem(STORAGE_KEY);
}

const settings = loadSettings();

let revealTimer: number | undefined;

export const useAppStore = create<AppState>((set, get) => ({
  screen: 'setup',
  setup: {
    mode: 'classic',
    totalPlayers: 2,
    humanCount: 2,
    names: { ...defaultNames([0, 2]), ...settings.names },
    durationMin: 3,
    turnTimerEnabled: true,
  },
  game: null,
  muted: settings.muted ?? false,
  theme: settings.theme ?? 'dark',
  botDelayMs: settings.botDelayMs && settings.botDelayMs > 0 ? settings.botDelayMs : 650,
  animating: false,
  rolling: false,
  rollReveal: null,
  pawnSkin: settings.pawnSkin && PAWN_SKINS.includes(settings.pawnSkin) ? settings.pawnSkin : 'arcade',
  showFps: settings.showFps === true,
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
    saveSettings(get());
  },

  startGame: (overrides) => {
    const config = { ...buildConfig(get().setup), ...overrides };
    const game = createGame(config);
    const withStart = config.mode === 'timed' ? { ...game, gameStartMs: performance.now() } : game;
    // Tests may leave botDelay at 0 in memory; restore a human-playable pace for normal starts
    const botDelayMs = get().botDelayMs <= 0 ? 650 : get().botDelayMs;
    set({
      game: withStart,
      screen: 'game',
      resumed: false,
      announcement: 'Game started',
      botDelayMs,
      rolling: false,
      animating: false,
      rollReveal: null,
    });
    window.clearTimeout(revealTimer);
    document.body.dataset.animIdle = 'true';
    // A new game is written now, so a reload right after starting always restores it
    cancelQueuedSave();
    writeSave(withStart);
    // Kick bot if first player is bot
    queueMicrotask(() => get().runBotTurn());
  },

  dispatch: (action) => {
    const { game } = get();
    if (!game) return;
    const next = reduce(game, action);
    const screen = next.phase === 'finished' ? 'results' : get().screen;
    // botDelay 0 is the instant test path; holding there would only slow scripts down
    const reveal = action.type === 'ROLL' && get().botDelayMs > 0 ? rollRevealFor(game, next) : null;
    const revealName = reveal ? next.players.find((p) => p.seat === reveal.seat)?.name : null;
    set({
      game: next,
      screen,
      announcement: reveal
        ? `${revealName ?? ''} rolled ${reveal.value}, ${reveal.reason === 'forfeit' ? 'three sixes' : 'no moves'}`
        : action.type === 'ROLL'
          ? `${next.players.find((p) => p.seat === next.config.seats[next.currentSeatIndex])?.name ?? ''} rolled ${next.diceValue ?? ''}`
          : get().announcement,
    });
    if (reveal) {
      set({ rollReveal: reveal, animating: true });
      document.body.dataset.animIdle = 'false';
      window.clearTimeout(revealTimer);
      revealTimer = window.setTimeout(() => {
        set({ rollReveal: null, animating: false });
        document.body.dataset.animIdle = 'true';
        get().runBotTurn();
      }, BEAT.noMove);
    }
    persistGame(next, screen === 'results' ? 'results' : 'game');
    if (next.phase === 'finished') {
      localStorage.removeItem(STORAGE_KEY);
    }
    queueMicrotask(() => get().runBotTurn());
  },

  roll: () => {
    const reduced =
      typeof document !== 'undefined' && document.documentElement.dataset.reducedMotion === 'true';
    if (get().rollReveal) return;
    if (reduced || get().rolling) {
      if (!get().rolling) get().dispatch({ type: 'ROLL' });
      return;
    }
    set({ rolling: true, animating: true });
    document.body.dataset.animIdle = 'false';
    window.setTimeout(() => {
      get().dispatch({ type: 'ROLL' });
      // A reveal owns the idle flag until it clears
      if (get().rollReveal) {
        set({ rolling: false });
        return;
      }
      set({ rolling: false, animating: false });
      document.body.dataset.animIdle = 'true';
    }, 520);
  },

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

  setPawnSkin: (pawnSkin) => {
    set({ pawnSkin });
    saveSettings(get());
  },

  setShowFps: (showFps) => {
    set({ showFps });
    saveSettings(get());
  },

  setAnimating: (animating) => {
    set({ animating });
    document.body.dataset.animIdle = animating ? 'false' : 'true';
  },

  setAnnouncement: (announcement) => set({ announcement }),

  goSetup: () => {
    window.clearTimeout(revealTimer);
    set({ screen: 'setup', game: null, rollReveal: null, animating: false, rolling: false });
    cancelQueuedSave();
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

  clearSave: () => {
    cancelQueuedSave();
    localStorage.removeItem(STORAGE_KEY);
  },

  tickClock: (nowMs) => {
    const { game } = get();
    if (!game || game.config.mode !== 'timed' || game.phase === 'finished') return;
    // The HUD shows whole seconds, so dispatch only when the shown second changes or the
    // clock runs out. Until the start time is recorded, every call has to dispatch.
    if (game.gameStartMs !== null && game.clockMsRemaining !== null) {
      const remaining = Math.max(
        0,
        (game.config.durationMs ?? 60_000) - (nowMs - game.gameStartMs),
      );
      if (
        remaining > 0 &&
        Math.ceil(remaining / 1000) === Math.ceil(game.clockMsRemaining / 1000)
      ) {
        return;
      }
    }
    get().dispatch({ type: 'TICK', nowMs });
  },

  runBotTurn: () => {
    const { game, botDelayMs, animating, rolling, rollReveal } = get();
    if (!game || game.phase === 'finished' || animating || rolling || rollReveal) return;
    const seat = game.config.seats[game.currentSeatIndex]!;
    const player = game.players.find((p) => p.seat === seat)!;
    if (!player.isBot) return;

    const reduced =
      typeof document !== 'undefined' && document.documentElement.dataset.reducedMotion === 'true';

    // Instant path for tests (botDelay 0) — no animation
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

    // Thinking pause, then act
    window.setTimeout(() => {
      const g = get().game;
      if (!g || g.phase === 'finished') return;
      const s = g.config.seats[g.currentSeatIndex]!;
      const p = g.players.find((pl) => pl.seat === s)!;
      if (!p.isBot) return;

      if (g.phase === 'waiting_roll') {
        // Show dice tumble, reveal face, then allow the move step
        if (reduced) {
          get().dispatch({ type: 'ROLL' });
          return;
        }
        if (!get().muted) playSfx('roll');
        set({ rolling: true, animating: true });
        document.body.dataset.animIdle = 'false';
        window.setTimeout(() => {
          get().dispatch({ type: 'ROLL' });
          // Face is visible now; hold before moving so the roll can be read
          set({ rolling: false });
          if (get().rollReveal) return;
          window.setTimeout(() => {
            set({ animating: false });
            document.body.dataset.animIdle = 'true';
            get().runBotTurn();
          }, 650);
        }, 520);
        return;
      }

      if (g.phase === 'waiting_move') {
        const move = chooseMove(g);
        if (move) get().dispatch({ type: 'MOVE', pawnId: move.pawnId });
        else get().dispatch({ type: 'PASS' });
      }
    }, botDelayMs);
  },
}));

if (typeof window !== 'undefined') {
  // Save before the page goes away, so a reload right after a move restores it
  window.addEventListener('pagehide', flushQueuedSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushQueuedSave();
  });
}

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
      // Test-only: do not persist — otherwise botDelay 0 leaks into real play
      useAppStore.setState({ botDelayMs: ms });
    },
    advanceClock: (ms: number) => {
      // Unthrottled on purpose: the test sets the exact clock value, not the next displayed second
      const g = useAppStore.getState().game;
      if (!g || g.config.mode !== 'timed') return;
      const start = g.gameStartMs ?? 0;
      useAppStore.getState().dispatch({ type: 'TICK', nowMs: start + ms });
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
