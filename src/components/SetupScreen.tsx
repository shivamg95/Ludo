import { useMemo } from 'react';
import { motion } from 'motion/react';
import { useAppStore } from '../store/gameStore';
import { seatsForPlayerCount, SEATS } from '../engine/board';
import type { GameMode } from '../engine/types';

const MODES: { id: GameMode; title: string; blurb: string }[] = [
  { id: 'classic', title: 'Classic', blurb: 'Race all four home. Play on for places.' },
  { id: 'timed', title: 'X-Minute', blurb: 'Score under the clock. Respawn and keep scoring.' },
  { id: 'quick', title: 'Quick', blurb: 'Cut to unlock home. First pawn home wins.' },
];

const DURATION_PRESETS = [1, 2, 3, 5, 10];

function ModeArt({ mode }: { mode: GameMode }) {
  if (mode === 'classic') {
    return (
      <div className="mode-art" style={{ background: 'linear-gradient(135deg, #1c2433, #2a1a1a)' }}>
        <svg viewBox="0 0 120 64" className="h-full w-full" aria-hidden>
          <rect x="8" y="8" width="28" height="28" rx="4" fill="#e23d3d" opacity="0.9" />
          <rect x="84" y="8" width="28" height="28" rx="4" fill="#2f9e5c" opacity="0.9" />
          <rect x="8" y="28" width="28" height="28" rx="4" fill="#3d7ee2" opacity="0.9" />
          <rect x="84" y="28" width="28" height="28" rx="4" fill="#e2b93d" opacity="0.9" />
          <rect x="42" y="22" width="36" height="20" rx="3" fill="#f4f7fb" opacity="0.85" />
          <circle cx="50" cy="32" r="4" fill="#e23d3d" />
          <circle cx="70" cy="32" r="4" fill="#e2b93d" />
        </svg>
      </div>
    );
  }
  if (mode === 'timed') {
    return (
      <div className="mode-art" style={{ background: 'linear-gradient(135deg, #142033, #1a2a40)' }}>
        <svg viewBox="0 0 120 64" className="h-full w-full" aria-hidden>
          <circle cx="60" cy="32" r="20" fill="none" stroke="#3d7ee2" strokeWidth="3" />
          <circle cx="60" cy="32" r="20" fill="none" stroke="#5ec2a0" strokeWidth="3" strokeDasharray="40 80" />
          <line x1="60" y1="32" x2="60" y2="18" stroke="#e8eef7" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="60" y1="32" x2="72" y2="36" stroke="#5ec2a0" strokeWidth="2" strokeLinecap="round" />
          <text x="60" y="58" textAnchor="middle" fontSize="8" fill="#8b9bb3">
            SCORE
          </text>
        </svg>
      </div>
    );
  }
  return (
    <div className="mode-art" style={{ background: 'linear-gradient(135deg, #14261a, #2a2410)' }}>
      <svg viewBox="0 0 120 64" className="h-full w-full" aria-hidden>
        <rect x="70" y="18" width="18" height="28" rx="3" fill="#2f9e5c" opacity="0.85" />
        <rect x="70" y="18" width="18" height="12" rx="2" fill="rgba(0,0,0,0.45)" />
        <text x="79" y="28" textAnchor="middle" fontSize="10" fill="#fff">
          ⛓
        </text>
        <circle cx="40" cy="32" r="8" fill="#e23d3d" />
        <path d="M52 32 L66 32" stroke="#e2b93d" strokeWidth="2" strokeDasharray="3 2" />
        <polygon points="66,28 74,32 66,36" fill="#e2b93d" />
      </svg>
    </div>
  );
}

export function SetupScreen() {
  const setup = useAppStore((s) => s.setup);
  const setSetup = useAppStore((s) => s.setSetup);
  const startGame = useAppStore((s) => s.startGame);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const muted = useAppStore((s) => s.muted);
  const setMuted = useAppStore((s) => s.setMuted);

  const seats = useMemo(() => seatsForPlayerCount(setup.totalPlayers), [setup.totalPlayers]);
  const bots = setup.totalPlayers - setup.humanCount;

  const disabledReason =
    setup.totalPlayers < 2
      ? 'Need at least 2 players'
      : setup.humanCount < 1
        ? 'Need at least 1 human'
        : null;

  return (
    <div
      className="h-full w-full overflow-y-auto px-4 py-6 sm:px-8"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
      data-testid="setup-screen"
    >
      <header className="mx-auto flex max-w-5xl items-start justify-between gap-4">
        <div>
          <p
            className="text-5xl font-bold tracking-tight sm:text-6xl"
            style={{ fontFamily: 'var(--font-display)' }}
            data-testid="brand"
          >
            Ludo
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Classic · Timed · Quick
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="glass rounded-xl px-3 text-sm"
            onClick={() => setMuted(!muted)}
            aria-label={muted ? 'Unmute' : 'Mute'}
            data-testid="mute-toggle"
          >
            {muted ? 'Muted' : 'Sound'}
          </button>
          <button
            type="button"
            className="glass rounded-xl px-3 text-sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            data-testid="theme-toggle"
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>

      <main className="mx-auto mt-8 grid max-w-5xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section>
          <h2
            className="mb-3 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--muted)' }}
          >
            Mode
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {MODES.map((m) => {
              const active = setup.mode === m.id;
              return (
                <motion.button
                  key={m.id}
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSetup({ mode: m.id })}
                  className={`rounded-2xl p-4 text-left transition ${active ? 'ring-2 ring-[var(--accent)]' : ''}`}
                  style={{
                    background: 'var(--glass-strong)',
                    border: '1px solid var(--line)',
                    backdropFilter: 'blur(16px)',
                  }}
                  data-testid={`mode-${m.id}`}
                  aria-pressed={active}
                >
                  <ModeArt mode={m.id} />
                  <p className="mt-3 text-lg font-semibold" style={{ color: 'var(--ink)' }}>
                    {m.title}
                  </p>
                  <p className="mt-1 text-sm leading-snug" style={{ color: 'var(--muted)' }}>
                    {m.blurb}
                  </p>
                </motion.button>
              );
            })}
          </div>

          {setup.mode === 'timed' && (
            <div className="glass mt-4 rounded-2xl p-4" data-testid="duration-panel">
              <p className="mb-2 text-sm font-semibold">Duration</p>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`rounded-xl px-3 py-2 text-sm ${setup.durationMin === m ? 'bg-[var(--accent)] text-[var(--bg0)]' : 'glass'}`}
                    onClick={() => setSetup({ durationMin: m })}
                    data-testid={`duration-${m}`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                Custom (1–30)
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={setup.durationMin}
                  onChange={(e) =>
                    setSetup({ durationMin: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })
                  }
                  className="glass w-20 rounded-lg px-2 py-1"
                  data-testid="duration-custom"
                />
              </label>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={setup.turnTimerEnabled}
                  onChange={(e) => setSetup({ turnTimerEnabled: e.target.checked })}
                  data-testid="turn-timer-toggle"
                />
                20s turn timer
              </label>
            </div>
          )}
        </section>

        <section className="glass rounded-2xl p-5" style={{ background: 'var(--glass-strong)' }}>
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--muted)' }}
          >
            Players
          </h2>

          <div className="flex items-center justify-between gap-3">
            <span>Total</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="glass rounded-xl px-3"
                onClick={() => setSetup({ totalPlayers: Math.max(2, setup.totalPlayers - 1) })}
                data-testid="total-dec"
                aria-label="Fewer players"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-semibold" data-testid="total-players">
                {setup.totalPlayers}
              </span>
              <button
                type="button"
                className="glass rounded-xl px-3"
                onClick={() => setSetup({ totalPlayers: Math.min(4, setup.totalPlayers + 1) })}
                data-testid="total-inc"
                aria-label="More players"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span>Humans</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="glass rounded-xl px-3"
                onClick={() => setSetup({ humanCount: setup.humanCount - 1 })}
                data-testid="human-dec"
                aria-label="Fewer humans"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-semibold" data-testid="human-count">
                {setup.humanCount}
              </span>
              <button
                type="button"
                className="glass rounded-xl px-3"
                onClick={() => setSetup({ humanCount: setup.humanCount + 1 })}
                data-testid="human-inc"
                aria-label="More humans"
              >
                +
              </button>
            </div>
          </div>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }} data-testid="bot-count">
            Bots: {bots}
          </p>

          <ul className="mt-5 space-y-3">
            {seats.map((seat, i) => {
              const color = SEATS[seat]!.color;
              const isBot = i >= setup.humanCount;
              return (
                <li key={seat} className={`flex items-center gap-3 seat-${color}`}>
                  <span
                    className="h-8 w-8 rounded-full"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, #fff 0%, var(--${color}) 45%, color-mix(in oklab, var(--${color}) 60%, #000) 100%)`,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                    }}
                    aria-hidden
                  />
                  <input
                    className="glass flex-1 rounded-xl px-3 py-2 text-sm"
                    value={setup.names[seat] ?? color}
                    onChange={(e) =>
                      setSetup({ names: { ...setup.names, [seat]: e.target.value } })
                    }
                    disabled={isBot}
                    data-testid={`name-${color}`}
                    aria-label={`${color} name`}
                  />
                  <span className="text-xs uppercase" style={{ color: 'var(--muted)' }}>
                    {isBot ? 'Bot' : 'Human'}
                  </span>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            className="mt-6 w-full rounded-2xl py-3 text-base font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'var(--bg0)' }}
            disabled={!!disabledReason}
            onClick={() => startGame()}
            data-testid="start-game"
          >
            Start game
          </button>
          {disabledReason && (
            <p
              className="mt-2 text-center text-sm"
              style={{ color: 'var(--danger)' }}
              data-testid="start-blocked"
            >
              {disabledReason}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
