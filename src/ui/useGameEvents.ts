import { useEffect, useRef } from 'react';
import type { GameEvent, GameState } from '../engine/types';

/**
 * Calls back with each batch of events the engine has appended since the last
 * render. The first observation only records a baseline, so resuming a saved
 * game does not replay its whole history as fresh effects.
 */
export function useEventStream(
  game: GameState | null,
  onEvents: (events: GameEvent[]) => void,
): void {
  const seen = useRef<number | null>(null);
  const handler = useRef(onEvents);
  handler.current = onEvents;

  useEffect(() => {
    if (!game) {
      seen.current = null;
      return;
    }

    const total = game.events.length;

    // First sight of this game, or the log shrank because a new game started
    if (seen.current === null || total < seen.current) {
      seen.current = total;
      return;
    }
    if (total === seen.current) return;

    const fresh = game.events.slice(seen.current);
    seen.current = total;
    handler.current(fresh);
  }, [game]);
}

/** True when this move event knocked at least one opponent token back. */
export function eventCaptures(event: GameEvent): string[] {
  if (event.type !== 'move') return [];
  const captures = event.detail?.captures;
  return Array.isArray(captures) ? (captures as string[]) : [];
}

/** True when this move event landed a token on HOME. */
export function eventReachedHome(event: GameEvent): boolean {
  return event.type === 'move' && event.detail?.to === 56;
}

/**
 * The most recent roll by anyone. The engine clears `diceValue` the moment a
 * move is applied, so this is what keeps a face on the die between turns — a
 * real die holds its result until someone picks it up. Reading it from the event
 * log means it also survives a reload.
 */
export function lastRollValue(game: GameState | null): number | null {
  if (!game) return null;
  for (let i = game.events.length - 1; i >= 0; i--) {
    const event = game.events[i]!;
    if (event.type !== 'roll') continue;
    const value = Number(event.detail?.value);
    return Number.isFinite(value) && value >= 1 && value <= 6 ? value : null;
  }
  return null;
}
