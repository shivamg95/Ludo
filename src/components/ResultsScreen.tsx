import { useMemo } from 'react';
import { motion } from 'motion/react';
import { useAppStore } from '../store/gameStore';
import { SEATS } from '../engine/board';
import { prefersReducedMotion } from '../ui/motion';

const CONFETTI_COLORS = ['#e23d3d', '#2f9e5c', '#e2b93d', '#3d7ee2', '#5ec2a0', '#f5e6a8'];

export function ResultsScreen() {
  const game = useAppStore((s) => s.game);
  const goSetup = useAppStore((s) => s.goSetup);
  const startGame = useAppStore((s) => s.startGame);

  const confetti = useMemo(
    () =>
      Array.from({ length: 72 }, (_, i) => ({
        id: i,
        left: `${(i * 17 + (i % 5) * 11) % 100}%`,
        delay: `${(i % 12) * 0.18 + Math.floor(i / 24) * 0.4}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
        rot: (i * 47) % 360,
        w: 6 + (i % 4) * 2,
        h: 10 + (i % 3) * 4,
      })),
    [],
  );

  if (!game) {
    return (
      <div className="flex h-full items-center justify-center">
        <button type="button" className="glass rounded-xl px-4" onClick={goSetup}>
          Back to setup
        </button>
      </div>
    );
  }

  const ranked = game.rankings.length ? game.rankings : game.config.seats;
  const winner = game.players.find((p) => p.seat === ranked[0]);
  const reduce = prefersReducedMotion();

  return (
    <div
      className="relative mx-auto flex h-full max-w-2xl flex-col gap-6 overflow-y-auto px-4 py-8"
      data-testid="results-screen"
      style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))' }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 overflow-hidden" aria-hidden>
        {confetti.map((c) => (
          <span
            key={c.id}
            className="confetti-piece"
            style={{
              left: c.left,
              width: c.w,
              height: c.h,
              background: c.color,
              animationDelay: c.delay,
              transform: `rotate(${c.rot}deg)`,
            }}
          />
        ))}
      </div>

      <header>
        <p
          className="text-4xl font-bold"
          style={{ fontFamily: 'var(--font-display)' }}
          data-testid="results-title"
        >
          {winner ? `${winner.name} wins` : 'Results'}
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {game.config.mode === 'timed' ? 'X-Minute' : game.config.mode} mode
          {winner ? ` · ${winner.name} takes the crown` : ''}
        </p>
      </header>

      <ol className="space-y-3">
        {ranked.map((seat, i) => {
          const p = game.players.find((pl) => pl.seat === seat)!;
          return (
            <motion.li
              key={seat}
              className={`glass flex items-center justify-between rounded-2xl px-4 py-3 ${i === 0 ? 'podium-1' : ''}`}
              data-testid={`rank-${i + 1}`}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : i * 0.08, duration: reduce ? 0 : 0.35 }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-2xl font-bold tabular-nums"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: i === 0 ? 'var(--accent)' : undefined,
                  }}
                >
                  {i === 0 ? '1' : i + 1}
                </span>
                <span
                  className="h-4 w-4 rounded-full"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, #fff, var(--${p.color}))`,
                  }}
                />
                <span className="font-semibold">{p.name}</span>
              </div>
              <div className="text-right text-sm" style={{ color: 'var(--muted)' }}>
                {game.config.mode === 'timed' && (
                  <div data-testid={`final-score-${p.color}`}>{p.score} pts</div>
                )}
                <div>
                  {p.captures} cuts · {p.distanceTravelled} steps · {p.sixesRolled} sixes
                </div>
              </div>
            </motion.li>
          );
        })}
      </ol>

      <section className="glass rounded-2xl p-4" data-testid="stats-breakdown">
        <h2
          className="mb-3 text-sm font-semibold uppercase tracking-wider"
          style={{ color: 'var(--muted)' }}
        >
          Stats
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {game.players.map((p) => {
            const home = p.pawns.filter((x) => x.progress === 56).length;
            return (
              <div
                key={p.seat}
                className="rounded-xl px-3 py-2"
                style={{ background: 'rgba(0,0,0,0.15)' }}
              >
                <p className="font-semibold capitalize">{SEATS[p.seat]!.color}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  Home: {home}/4 · Laps: {p.pawns.reduce((s, x) => s + x.laps, 0)}
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(home / 4) * 100}%`, background: `var(--${p.color})` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex gap-3">
        <motion.button
          type="button"
          className="cta-shine flex-1 rounded-2xl py-3 font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--bg0)' }}
          onClick={() => startGame({ seed: game.config.seed + 1 })}
          data-testid="play-again"
          whileTap={{ scale: 0.98 }}
        >
          Play again
        </motion.button>
        <motion.button
          type="button"
          className="glass flex-1 rounded-2xl py-3 font-semibold"
          onClick={goSetup}
          data-testid="back-setup"
          whileTap={{ scale: 0.98 }}
        >
          Setup
        </motion.button>
      </div>
    </div>
  );
}
