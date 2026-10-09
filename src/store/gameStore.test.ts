import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rollRevealFor, useAppStore } from './gameStore';
import { BEAT } from '../ui/motion';
import type { GameState } from '../engine/types';

// Node's own global localStorage shadows happy-dom's and is inert without a file
const memory = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
});

function start() {
  const store = useAppStore.getState();
  store.setSetup({ totalPlayers: 2, humanCount: 2 });
  useAppStore.setState({ botDelayMs: 650 });
  store.startGame({ seed: 1 });
}

describe('roll reveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    useAppStore.getState().goSetup();
    vi.useRealTimers();
  });

  it('holds a dead roll with its roller, blocks rolling, then passes the turn', () => {
    start();
    const firstSeat = useAppStore.getState().game!.config.seats[0]!;
    useAppStore.getState().dispatch({ type: 'SET_DICE_QUEUE', queue: [3, 4] });

    useAppStore.getState().roll();
    vi.advanceTimersByTime(520);

    const held = useAppStore.getState();
    expect(held.rollReveal).toEqual({ seat: firstSeat, value: 3, reason: 'no_moves' });
    expect(held.animating).toBe(true);
    // The engine has already moved on; only the UI is holding
    expect(held.game!.config.seats[held.game!.currentSeatIndex]).not.toBe(firstSeat);

    const eventsBefore = held.game!.events.length;
    useAppStore.getState().roll();
    vi.advanceTimersByTime(520);
    expect(useAppStore.getState().game!.events.length).toBe(eventsBefore);

    vi.advanceTimersByTime(BEAT.noMove);
    expect(useAppStore.getState().rollReveal).toBeNull();
    expect(useAppStore.getState().animating).toBe(false);

    useAppStore.getState().roll();
    vi.advanceTimersByTime(520);
    expect(useAppStore.getState().game!.events.length).toBe(eventsBefore + 1);
  });

  it('does not hold on the instant test path', () => {
    start();
    useAppStore.setState({ botDelayMs: 0 });
    useAppStore.getState().dispatch({ type: 'SET_DICE_QUEUE', queue: [3] });
    useAppStore.getState().dispatch({ type: 'ROLL' });
    expect(useAppStore.getState().rollReveal).toBeNull();
  });
});

describe('rollRevealFor', () => {
  const base = { phase: 'waiting_roll', events: [] } as unknown as GameState;

  it('flags a third six as a forfeit', () => {
    const after = {
      phase: 'waiting_roll',
      events: [
        { type: 'roll', seat: 1, atCursor: 0, detail: { value: 6 } },
        { type: 'three_sixes_forfeit', seat: 1, atCursor: 0 },
      ],
    } as unknown as GameState;
    expect(rollRevealFor(base, after)).toEqual({ seat: 1, value: 6, reason: 'forfeit' });
  });

  it('ignores a roll that leaves a move to make', () => {
    const after = {
      phase: 'waiting_move',
      events: [{ type: 'roll', seat: 0, atCursor: 0, detail: { value: 6 } }],
    } as unknown as GameState;
    expect(rollRevealFor(base, after)).toBeNull();
  });
});

describe('pawn skin setting', () => {
  it('persists the chosen skin', () => {
    useAppStore.getState().setPawnSkin('gem');
    const saved = JSON.parse(localStorage.getItem('ludo-settings-v1') ?? '{}');
    expect(saved.pawnSkin).toBe('gem');
    useAppStore.getState().setPawnSkin('arcade');
  });
});

describe('fps setting', () => {
  it('persists the FPS switch to ludo-settings-v1', () => {
    useAppStore.getState().setShowFps(true);
    const saved = JSON.parse(localStorage.getItem('ludo-settings-v1') ?? '{}');
    expect(saved.showFps).toBe(true);
    expect(useAppStore.getState().showFps).toBe(true);
    useAppStore.getState().setShowFps(false);
    const off = JSON.parse(localStorage.getItem('ludo-settings-v1') ?? '{}');
    expect(off.showFps).toBe(false);
  });
});
