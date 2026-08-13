import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { GameState, SeatColor } from '../engine/types';
import { SEATS } from '../engine/board';
import { BEAT, SPRING, useReducedMotion } from '../ui/motion';
import { eventCaptures, eventReachedHome, useEventStream } from './useGameEvents';

type ToastKind = 'capture' | 'home' | 'extra' | 'forfeit';

interface Toast {
  id: number;
  kind: ToastKind;
  color: SeatColor;
  headline: string;
  detail?: string;
}

const KIND_LABEL: Record<ToastKind, string> = {
  capture: 'Capture',
  home: 'Home',
  extra: 'Extra turn',
  forfeit: 'Turn lost',
};

/**
 * High-emotion moments used to appear only as grey text in a collapsed log.
 * This surfaces them where the player is already looking — over the board.
 */
export function EventFx({ game }: { game: GameState | null }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const reduced = useReducedMotion();

  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = nextId.current++;
    // Only ever show a pair; beats arrive faster than they can be read otherwise
    setToasts((list) => [...list.slice(-1), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, BEAT.toast);
  }, []);

  useEventStream(game, (events) => {
    if (!game) return;

    events.forEach((event, i) => {
      const color = SEATS[event.seat]?.color ?? 'red';
      const name = game.players.find((p) => p.seat === event.seat)?.name ?? color;
      const isLast = i === events.length - 1;

      if (event.type === 'three_sixes_forfeit') {
        push({ kind: 'forfeit', color, headline: 'Three sixes', detail: `${name} loses the turn` });
        return;
      }

      if (event.type !== 'move') return;

      const captures = eventCaptures(event);
      if (captures.length > 0) {
        push({
          kind: 'capture',
          color,
          headline: captures.length > 1 ? `Capture ×${captures.length}` : 'Capture',
          detail: `${name} sent it home`,
        });
        return;
      }

      if (eventReachedHome(event)) {
        push({ kind: 'home', color, headline: 'Home', detail: `${name} banked a token` });
        return;
      }

      // The engine has already advanced the turn by the time this runs, so an
      // unchanged seat still waiting to roll means the move earned another go.
      if (isLast && game.phase === 'waiting_roll') {
        const stillUp = game.config.seats[game.currentSeatIndex] === event.seat;
        if (stillUp) push({ kind: 'extra', color, headline: 'Roll again' });
      }
    });
  });

  return (
    <div className="event-fx" aria-live="polite" data-testid="event-fx">
      {/* popLayout pulls exiting toasts out of flow, so a burst of events cannot
          push the live one down over the board */}
      <AnimatePresence initial={false} mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            className={`event-toast event-toast-${toast.kind} seat-${toast.color}`}
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.86 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -22, scale: 0.94 }}
            transition={reduced ? { duration: 0 } : SPRING.ui}
          >
            <span className="sr-only">{KIND_LABEL[toast.kind]}: </span>
            <span className="event-toast-headline">{toast.headline}</span>
            {toast.detail && <span className="event-toast-detail">{toast.detail}</span>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
