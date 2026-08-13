import { motion } from 'motion/react';
import { useAppStore } from '../store/gameStore';
import { SEATS } from '../engine/board';
import type { Player } from '../engine/types';
import { SEAT_RAMP, ACCENT } from '../theme/seats';
import { SPRING, useReducedMotion } from '../ui/motion';
import { Confetti } from '../ui/Confetti';
import { useCountUp } from '../ui/useCountUp';
import { ReplayIcon, TrophyIcon } from './icons';

const CONFETTI_COLORS = [
  SEAT_RAMP.red.core,
  SEAT_RAMP.green.core,
  SEAT_RAMP.yellow.core,
  SEAT_RAMP.blue.core,
  ACCENT.core,
  '#ffffff',
];

/** Reveal order: last place first, so the winner lands last. */
const revealDelay = (place: number, total: number) => 0.12 * (total - place);

function Stat({ label, value, delayMs }: { label: string; value: number; delayMs: number }) {
  const shown = useCountUp(value, { delayMs });
  return (
    <div className="stat">
      <span className="stat-value">{shown}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function PodiumSlot({
  player,
  place,
  total,
  timed,
}: {
  player: Player;
  place: number;
  total: number;
  timed: boolean;
}) {
  const reduced = useReducedMotion();
  const delay = revealDelay(place, total);
  const headline = timed ? player.score : player.captures;
  const shown = useCountUp(headline, { delayMs: (delay + 0.35) * 1000 });

  return (
    <motion.li
      className={`podium-slot seat-${player.color}`}
      data-place={place}
      data-testid={`rank-${place}`}
      initial={reduced ? false : { opacity: 0, y: 46 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING.ui, delay: reduced ? 0 : delay }}
    >
      <div className="podium-token">
        {place === 1 && <span className="podium-shine" aria-hidden />}
        {place === 1 && (
          <span className="podium-crown" aria-hidden>
            <TrophyIcon />
          </span>
        )}
      </div>
      <p className="podium-name">{player.name}</p>
      <p className="podium-headline" data-testid={timed ? `final-score-${player.color}` : undefined}>
        <span className="podium-headline-value">{shown}</span>
        <span className="podium-headline-label">{timed ? 'pts' : 'cuts'}</span>
      </p>
      <motion.div
        className="podium-plinth"
        initial={reduced ? false : { scaleY: 0.05 }}
        animate={{ scaleY: 1 }}
        transition={{ ...SPRING.ui, delay: reduced ? 0 : delay + 0.05 }}
      >
        <span className="podium-place">{place}</span>
      </motion.div>
    </motion.li>
  );
}

export function ResultsScreen() {
  const game = useAppStore((s) => s.game);
  const goSetup = useAppStore((s) => s.goSetup);
  const startGame = useAppStore((s) => s.startGame);
  const reduced = useReducedMotion();

  if (!game) {
    return (
      <div className="results-screen">
        <div className="results-inner results-empty">
          <button type="button" className="btn" onClick={goSetup}>
            Back to setup
          </button>
        </div>
      </div>
    );
  }

  const ranked = game.rankings.length ? game.rankings : game.config.seats;
  const players = ranked.map((seat) => game.players.find((p) => p.seat === seat)!);
  const winner = players[0];
  const timed = game.config.mode === 'timed';
  const podium = players.slice(0, 3);
  const rest = players.slice(3);

  return (
    <div className="results-screen" data-testid="results-screen">
      <Confetti colors={CONFETTI_COLORS} delayMs={reduced ? 0 : 620} />

      <div className="results-inner">
        <motion.header
          className="results-head"
          initial={reduced ? false : { opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING.ui}
        >
          <p className="results-eyebrow">{game.config.mode} mode</p>
          <h1 className="results-title neon-text" data-testid="results-title">
            Results
          </h1>
          {winner && (
            <p className={`results-sub seat-${winner.color}`}>
              <span className="results-sub-name">{winner.name}</span> takes the crown
            </p>
          )}
        </motion.header>

        <ol className="podium" data-count={podium.length}>
          {podium.map((p, i) => (
            <PodiumSlot key={p.seat} player={p} place={i + 1} total={podium.length} timed={timed} />
          ))}
        </ol>

        {rest.length > 0 && (
          <ol className="rank-list" start={4}>
            {rest.map((p, i) => (
              <motion.li
                key={p.seat}
                className={`rank-row seat-${p.color}`}
                data-testid={`rank-${i + 4}`}
                initial={reduced ? false : { opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING.ui, delay: reduced ? 0 : 0.05 * i }}
              >
                <span className="rank-place">{i + 4}</span>
                <span className="rank-token" aria-hidden />
                <span className="rank-name">{p.name}</span>
                <span className="rank-meta" data-testid={timed ? `final-score-${p.color}` : undefined}>
                  {timed ? `${p.score} pts` : `${p.captures} cuts`}
                </span>
              </motion.li>
            ))}
          </ol>
        )}

        <motion.section
          className="stats-panel panel"
          data-testid="stats-breakdown"
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.ui, delay: reduced ? 0 : 0.3 }}
        >
          <h2 className="setup-heading">Stats</h2>
          <div className="stats-grid">
            {players.map((p, i) => (
              <div key={p.seat} className={`stats-card seat-${p.color}`}>
                <div className="stats-card-head">
                  <span className="rank-token" aria-hidden />
                  <span className="stats-card-name">{p.name}</span>
                  <span className="stats-card-seat">{SEATS[p.seat]!.color}</span>
                </div>
                <div className="stat-row">
                  <Stat label="cuts" value={p.captures} delayMs={220 + i * 60} />
                  <Stat label="steps" value={p.distanceTravelled} delayMs={280 + i * 60} />
                  <Stat label="sixes" value={p.sixesRolled} delayMs={340 + i * 60} />
                  <Stat
                    label="home"
                    value={p.pawns.filter((x) => x.progress === 56).length}
                    delayMs={400 + i * 60}
                  />
                  <Stat
                    label="laps"
                    value={p.pawns.reduce((s, x) => s + x.laps, 0)}
                    delayMs={460 + i * 60}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.div
          className="results-actions"
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.ui, delay: reduced ? 0 : 0.38 }}
        >
          <button
            type="button"
            className="btn btn-primary results-action"
            onClick={() => startGame({ seed: game.config.seed + 1 })}
            data-testid="play-again"
          >
            <ReplayIcon />
            Play again
          </button>
          <button
            type="button"
            className="btn results-action"
            onClick={goSetup}
            data-testid="back-setup"
          >
            Setup
          </button>
        </motion.div>
      </div>
    </div>
  );
}
