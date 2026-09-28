import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { GameState, SeatColor } from '../engine/types';
import { ACCENT, SEAT_RAMP } from '../theme/seats';
import { playSfx } from '../audio/sfx';
import { useAppStore } from '../store/gameStore';
import { TrophyIcon } from '../components/icons';
import { Confetti } from './Confetti';
import { capturerApproachSeconds } from './hop';
import { SPRING, useReducedMotion } from './motion';
import { ordinal } from './ordinal';

interface Celebration {
  id: number;
  seat: number;
  rank: number;
  name: string;
  color: SeatColor;
  colors: string[];
}

const CARD_MS = 2800;
/** Matches Confetti's LIFE_MS, so the canvas is not cut off mid-fall. */
const CONFETTI_MS = 4400;
/** Beat after the final hop lands, so the token is visibly home first. */
const LAND_PAD_MS = 220;

/** How long the finisher's last token is still travelling, in ms. */
function finalHopMs(game: GameState, seat: number): number {
  for (let i = game.events.length - 1; i >= 0; i--) {
    const event = game.events[i]!;
    if (event.type !== 'move' || event.seat !== seat) continue;
    const from = Number(event.detail?.from ?? -1);
    const to = Number(event.detail?.to ?? -1);
    return capturerApproachSeconds(from, to) * 1000;
  }
  return 0;
}

/**
 * Celebrates each player who finishes while the game carries on. It floats over
 * the board rather than taking a row in the layout, so the board never shrinks.
 * The final finish is left to the results screen, which has its own party.
 */
export function FinishCelebration({ game }: { game: GameState | null }) {
  const reduced = useReducedMotion();
  const ranks = useRef<Map<number, number | null> | null>(null);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);
  const [card, setCard] = useState<Celebration | null>(null);
  const [confetti, setConfetti] = useState<Celebration | null>(null);

  useEffect(() => {
    if (!game) {
      ranks.current = null;
      return;
    }
    const prev = ranks.current;
    ranks.current = new Map(game.players.map((p) => [p.seat, p.finishedRank]));
    // First sight only records a baseline, so a resumed game does not replay
    if (!prev || game.phase === 'finished') return;

    for (const player of game.players) {
      if (player.finishedRank === null || prev.get(player.seat) != null) continue;
      const ramp = SEAT_RAMP[player.color];
      const celebration: Celebration = {
        id: nextId.current++,
        seat: player.seat,
        rank: player.finishedRank,
        name: player.name,
        color: player.color,
        colors: [ramp.core, ramp.rim, ramp.glow, ACCENT.gold, '#ffffff'],
      };
      const delay = reduced ? 0 : finalHopMs(game, player.seat) + LAND_PAD_MS;
      timers.current.push(
        window.setTimeout(() => {
          setCard(celebration);
          setConfetti(celebration);
          if (!useAppStore.getState().muted) playSfx(celebration.rank === 1 ? 'win' : 'home');
          timers.current.push(
            window.setTimeout(() => {
              setCard((c) => (c?.id === celebration.id ? null : c));
            }, CARD_MS),
            window.setTimeout(() => {
              setConfetti((c) => (c?.id === celebration.id ? null : c));
            }, CONFETTI_MS),
          );
        }, delay),
      );
    }
  }, [game, reduced]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  return (
    <>
      {confetti && (
        <Confetti
          key={confetti.id}
          colors={confetti.colors}
          count={confetti.rank === 1 ? 180 : 90}
        />
      )}
      <AnimatePresence>
        {card && (
          <motion.div
            key={card.id}
            className={`finish-alert seat-${card.color}`}
            data-testid="finish-celebration"
            data-rank={card.rank}
            role="status"
            aria-live="polite"
            initial={reduced ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.22 }}
          >
            <motion.div
              className="finish-card"
              initial={reduced ? false : { opacity: 0, scale: 0.7, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: -14 }}
              transition={reduced ? { duration: 0 } : SPRING.ui}
            >
              <span className="finish-medal" data-rank={Math.min(card.rank, 4)}>
                <TrophyIcon />
              </span>
              <span className="finish-headline">{card.name}</span>
              <span className="finish-detail">
                finishes <strong>{ordinal(card.rank)}</strong>
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
