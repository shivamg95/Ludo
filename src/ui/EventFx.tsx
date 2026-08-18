import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { GameState, SeatColor } from '../engine/types';
import { SEATS } from '../engine/board';
import { BEAT, SPRING, useReducedMotion } from './motion';
import { eventCaptures, eventReachedHome, useEventStream } from './useGameEvents';

type ToastKind = 'capture' | 'home' | 'extra';

interface Toast {
  id: number;
  kind: ToastKind;
  color: SeatColor;
  headline: string;
  detail?: string;
}

interface ForfeitAlert {
  id: number;
  color: SeatColor;
  name: string;
}

const KIND_LABEL: Record<ToastKind, string> = {
  capture: 'Capture',
  home: 'Home',
  extra: 'Extra turn',
};

function SixFace() {
  return (
    <span className="three-sixes-die" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="three-sixes-pip" />
      ))}
    </span>
  );
}

/**
 * High-emotion moments used to appear only as grey text in a collapsed log.
 * This surfaces them where the player is already looking — over the board.
 */
export function EventFx({ game }: { game: GameState | null }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [forfeit, setForfeit] = useState<ForfeitAlert | null>(null);
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
        const id = nextId.current++;
        setForfeit({ id, color, name });
        window.setTimeout(() => {
          setForfeit((cur) => (cur?.id === id ? null : cur));
        }, BEAT.forfeit);
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
    <>
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

      <AnimatePresence>
        {forfeit && (
          <motion.div
            key={forfeit.id}
            className={`three-sixes-alert seat-${forfeit.color}`}
            data-testid="three-sixes-alert"
            role="alert"
            aria-live="assertive"
            initial={reduced ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.22 }}
          >
            <div className="three-sixes-scrim" aria-hidden />
            <motion.div
              className="three-sixes-card"
              initial={reduced ? false : { opacity: 0, scale: 0.72, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -16 }}
              transition={reduced ? { duration: 0 } : SPRING.ui}
            >
              <motion.div
                className="three-sixes-body"
                animate={reduced ? { x: 0 } : { x: [0, -10, 8, -6, 3, 0] }}
                transition={reduced ? { duration: 0 } : { duration: 0.48, delay: 0.08, ease: 'easeOut' }}
              >
                <div className="three-sixes-dice" aria-hidden>
                  <SixFace />
                  <SixFace />
                  <SixFace />
                </div>
                <span className="three-sixes-headline">Three sixes</span>
                <span className="three-sixes-detail">{forfeit.name} loses the turn</span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
