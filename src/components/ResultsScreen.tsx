import { useAppStore } from '../store/gameStore';
import { SEATS } from '../engine/board';

export function ResultsScreen() {
  const game = useAppStore((s) => s.game);
  const goSetup = useAppStore((s) => s.goSetup);
  const startGame = useAppStore((s) => s.startGame);

  if (!game) {
    return (
      <div className="flex h-full items-center justify-center">
        <button type="button" className="glass rounded-xl px-4" onClick={goSetup}>
          Back to setup
        </button>
      </div>
    );
  }

  const ranked = game.rankings.length
    ? game.rankings
    : game.config.seats;

  return (
    <div
      className="mx-auto flex h-full max-w-2xl flex-col gap-6 overflow-y-auto px-4 py-8"
      data-testid="results-screen"
      style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))' }}
    >
      <header>
        <p
          className="text-4xl font-bold"
          style={{ fontFamily: 'var(--font-display)' }}
          data-testid="results-title"
        >
          Results
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {game.config.mode} mode
        </p>
      </header>

      <ol className="space-y-3">
        {ranked.map((seat, i) => {
          const p = game.players.find((pl) => pl.seat === seat)!;
          return (
            <li
              key={seat}
              className="glass flex items-center justify-between rounded-2xl px-4 py-3"
              data-testid={`rank-${i + 1}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
                  {i + 1}
                </span>
                <span className="h-4 w-4 rounded-full" style={{ background: `var(--${p.color})` }} />
                <span className="font-semibold">{p.name}</span>
              </div>
              <div className="text-right text-sm" style={{ color: 'var(--muted)' }}>
                {game.config.mode === 'timed' && <div data-testid={`final-score-${p.color}`}>{p.score} pts</div>}
                <div>
                  {p.captures} cuts · {p.distanceTravelled} steps · {p.sixesRolled} sixes
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="glass rounded-2xl p-4" data-testid="stats-breakdown">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          Stats
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {game.players.map((p) => (
            <div key={p.seat} className="rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.15)' }}>
              <p className="font-semibold capitalize">{SEATS[p.seat]!.color}</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Home: {p.pawns.filter((x) => x.progress === 56).length}/4 · Laps:{' '}
                {p.pawns.reduce((s, x) => s + x.laps, 0)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 rounded-2xl py-3 font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--bg0)' }}
          onClick={() => startGame({ seed: game.config.seed + 1 })}
          data-testid="play-again"
        >
          Play again
        </button>
        <button type="button" className="glass flex-1 rounded-2xl py-3 font-semibold" onClick={goSetup} data-testid="back-setup">
          Setup
        </button>
      </div>
    </div>
  );
}
