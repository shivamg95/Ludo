import { Fragment, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { peekSavedGame, useAppStore, type SavedGameSummary } from '../store/gameStore';
import { seatsForPlayerCount, SEATS } from '../engine/board';
import type { GameMode } from '../engine/types';
import { SEAT_RAMP, ACCENT } from '../theme/seats';
import { DUR, SPRING, useReducedMotion } from '../ui/motion';
import { PlayIcon, RefreshIcon, SoundOffIcon, SoundOnIcon } from './icons';
import { usePwaUpdate } from '../pwa';

const MODES: { id: GameMode; title: string; blurb: string }[] = [
  { id: 'classic', title: 'Classic', blurb: 'Race all four home. Play on for places.' },
  { id: 'timed', title: 'X-Minute', blurb: 'Score under the clock. Respawn and keep scoring.' },
  { id: 'quick', title: 'Quick', blurb: 'Cut to unlock home. First token home wins.' },
];

const DURATION_PRESETS = [1, 2, 3, 5, 10];

/** Looping mini-animations that show what each mode actually feels like. */
function ModeArt({ mode, active }: { mode: GameMode; active: boolean }) {
  const reduced = useReducedMotion();
  const loop = (duration: number) =>
    reduced || !active
      ? { duration: 0 }
      : { duration, repeat: Infinity, ease: 'easeInOut' as const };

  if (mode === 'classic') {
    return (
      <svg viewBox="0 0 120 64" className="mode-art" aria-hidden>
        <rect x="4" y="26" width="112" height="12" rx="6" fill="rgba(150,190,255,0.08)" />
        {(['red', 'green', 'yellow', 'blue'] as const).map((c, i) => (
          <motion.circle
            key={c}
            cy={32}
            r={5}
            fill={SEAT_RAMP[c].core}
            initial={false}
            animate={reduced || !active ? { cx: 20 + i * 24 } : { cx: [12 + i * 8, 100 - i * 6] }}
            transition={loop(2.6 + i * 0.35)}
          />
        ))}
        <path d="M108 18 v28" stroke={ACCENT.core} strokeWidth="2" strokeDasharray="3 3" />
      </svg>
    );
  }

  if (mode === 'timed') {
    return (
      <svg viewBox="0 0 120 64" className="mode-art" aria-hidden>
        <circle
          cx="60"
          cy="32"
          r="20"
          fill="none"
          stroke="rgba(150,190,255,0.16)"
          strokeWidth="4"
        />
        <motion.circle
          cx="60"
          cy="32"
          r="20"
          fill="none"
          stroke={ACCENT.core}
          strokeWidth="4"
          strokeLinecap="round"
          transform="rotate(-90 60 32)"
          initial={false}
          animate={reduced || !active ? { pathLength: 0.7 } : { pathLength: [1, 0.06, 1] }}
          transition={loop(3.4)}
        />
        <motion.text
          x="60"
          y="37"
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          fill={ACCENT.core}
          fontFamily="var(--font-display)"
          initial={false}
          animate={reduced || !active ? { opacity: 1 } : { opacity: [1, 0.45, 1] }}
          transition={loop(1.7)}
        >
          3:00
        </motion.text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 64" className="mode-art" aria-hidden>
      <motion.circle
        cy={32}
        r={7}
        fill={SEAT_RAMP.red.core}
        initial={false}
        animate={reduced || !active ? { cx: 34 } : { cx: [22, 62, 62, 22] }}
        transition={loop(2.4)}
      />
      <motion.circle
        cx={62}
        cy={32}
        r={7}
        fill={SEAT_RAMP.yellow.core}
        initial={false}
        animate={
          reduced || !active
            ? { opacity: 1, scale: 1 }
            : { opacity: [1, 1, 0, 1], scale: [1, 1, 1.6, 1] }
        }
        transition={loop(2.4)}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      />
      <motion.circle
        cx={62}
        cy={32}
        r={7}
        fill="none"
        stroke={ACCENT.gold}
        strokeWidth={2}
        initial={false}
        animate={
          reduced || !active ? { opacity: 0 } : { opacity: [0, 0, 0.9, 0], r: [7, 7, 20, 7] }
        }
        transition={loop(2.4)}
      />
      <path d="M92 20 h14 v24 h-14 z" fill="none" stroke={ACCENT.core} strokeWidth="2" rx="2" />
      <motion.path
        d="M96 20 v-5 a3 3 0 0 1 6 0 v5"
        fill="none"
        stroke={ACCENT.core}
        strokeWidth="2"
        initial={false}
        animate={reduced || !active ? { opacity: 1 } : { opacity: [1, 1, 0.2, 1] }}
        transition={loop(2.4)}
      />
    </svg>
  );
}

function Stepper({
  label,
  value,
  onDec,
  onInc,
  decTestId,
  incTestId,
  valueTestId,
  decLabel,
  incLabel,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  decTestId: string;
  incTestId: string;
  valueTestId: string;
  decLabel: string;
  incLabel: string;
}) {
  return (
    <div className="stepper-row">
      <span className="stepper-label">{label}</span>
      <div className="stepper">
        <button
          type="button"
          className="stepper-btn"
          onClick={onDec}
          data-testid={decTestId}
          aria-label={decLabel}
        >
          −
        </button>
        <span className="stepper-value" data-testid={valueTestId}>
          {value}
        </span>
        <button
          type="button"
          className="stepper-btn"
          onClick={onInc}
          data-testid={incTestId}
          aria-label={incLabel}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function SetupScreen() {
  const setup = useAppStore((s) => s.setup);
  const setSetup = useAppStore((s) => s.setSetup);
  const startGame = useAppStore((s) => s.startGame);
  const resumeIfSaved = useAppStore((s) => s.resumeIfSaved);
  const clearSave = useAppStore((s) => s.clearSave);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const muted = useAppStore((s) => s.muted);
  const setMuted = useAppStore((s) => s.setMuted);
  const reduced = useReducedMotion();
  const { version, status, check } = usePwaUpdate();

  const [saved, setSaved] = useState<SavedGameSummary | null>(null);
  useEffect(() => setSaved(peekSavedGame()), []);

  const seats = useMemo(() => seatsForPlayerCount(setup.totalPlayers), [setup.totalPlayers]);
  const bots = setup.totalPlayers - setup.humanCount;

  const disabledReason =
    setup.totalPlayers < 2
      ? 'Need at least 2 players'
      : setup.humanCount < 1
        ? 'Need at least 1 human'
        : null;

  const rise = (delay: number) =>
    reduced
      ? { initial: false as const, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { ...SPRING.ui, delay },
        };

  return (
    <div className="setup-screen" data-testid="setup-screen">
      <div className="setup-inner">
        <motion.header className="setup-hero" {...rise(0)}>
          <div className="setup-hero-mark">
            <h1 className="brand" data-testid="brand">
              Ludo
            </h1>
            <p className="brand-sub">Classic · X-Minute · Quick</p>
            <p className="app-version" data-testid="app-version">
              v{version}
            </p>
            {(status === 'checking' || status === 'current' || status === 'unavailable') && (
              <p className="update-status" data-testid="update-status" aria-live="polite">
                {status === 'checking' ? 'Checking for updates…' : "You're up to date"}
              </p>
            )}
          </div>
          <div className="setup-hero-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => void check()}
              disabled={status === 'checking'}
              aria-label="Check for updates"
              data-testid="check-updates"
            >
              <RefreshIcon />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setMuted(!muted)}
              aria-label={muted ? 'Unmute' : 'Mute'}
              data-testid="mute-toggle"
            >
              {muted ? <SoundOffIcon /> : <SoundOnIcon />}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              data-testid="theme-toggle"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </motion.header>

        {saved && (
          <motion.div className="resume-card panel" {...rise(0.04)} data-testid="resume-card">
            <div className="resume-copy">
              <p className="resume-title">Continue game</p>
              <p className="resume-detail">
                {saved.mode} · {saved.playerCount} players · {saved.tokensHome} home ·{' '}
                {saved.turnOf}&apos;s turn
              </p>
            </div>
            <div className="resume-actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  clearSave();
                  setSaved(null);
                }}
                data-testid="discard-save"
              >
                Discard
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => resumeIfSaved()}
                data-testid="resume-game"
              >
                <PlayIcon />
                Resume
              </button>
            </div>
          </motion.div>
        )}

        <motion.section className="setup-section" {...rise(0.08)}>
          <h2 className="setup-heading">Mode</h2>
          <div className="mode-grid">
            {MODES.map((m) => {
              const active = setup.mode === m.id;
              return (
                <Fragment key={m.id}>
                  <motion.button
                    type="button"
                    whileHover={reduced ? undefined : { y: -3 }}
                    whileTap={reduced ? undefined : { scale: 0.985 }}
                    transition={SPRING.tight}
                    onClick={() => setSetup({ mode: m.id })}
                    className="mode-card"
                    data-active={active ? 'true' : 'false'}
                    data-testid={`mode-${m.id}`}
                    aria-pressed={active}
                  >
                    <span className="mode-art-frame">
                      <ModeArt mode={m.id} active={active} />
                    </span>
                    <span className="mode-title">{m.title}</span>
                    <span className="mode-blurb">{m.blurb}</span>
                  </motion.button>
                  {m.id === 'timed' && setup.mode === 'timed' && (
                    <motion.div
                      className="duration-panel"
                      data-testid="duration-panel"
                      initial={reduced ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: DUR.base, ease: 'easeOut' }}
                    >
                      <p className="setup-heading">Duration</p>
                      <div className="chip-row">
                        {DURATION_PRESETS.map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            className="chip"
                            data-active={setup.durationMin === mins ? 'true' : 'false'}
                            onClick={() => setSetup({ durationMin: mins })}
                            data-testid={`duration-${mins}`}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                      <div className="setup-field-row">
                        <label className="setup-field">
                          <span>Custom (1–30)</span>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={setup.durationMin}
                            onChange={(e) =>
                              setSetup({
                                durationMin: Math.max(1, Math.min(30, Number(e.target.value) || 1)),
                              })
                            }
                            className="text-input w-20"
                            data-testid="duration-custom"
                          />
                        </label>
                        <label className="setup-toggle">
                          <input
                            type="checkbox"
                            checked={setup.turnTimerEnabled}
                            onChange={(e) => setSetup({ turnTimerEnabled: e.target.checked })}
                            data-testid="turn-timer-toggle"
                          />
                          20s turn timer
                        </label>
                      </div>
                    </motion.div>
                  )}
                </Fragment>
              );
            })}
          </div>
        </motion.section>

        <motion.section className="setup-section players-panel panel" {...rise(0.12)}>
          <h2 className="setup-heading">Players</h2>

          <div className="stepper-grid">
            <Stepper
              label="Total"
              value={setup.totalPlayers}
              onDec={() => setSetup({ totalPlayers: Math.max(2, setup.totalPlayers - 1) })}
              onInc={() => setSetup({ totalPlayers: Math.min(4, setup.totalPlayers + 1) })}
              decTestId="total-dec"
              incTestId="total-inc"
              valueTestId="total-players"
              decLabel="Fewer players"
              incLabel="More players"
            />
            <Stepper
              label="Humans"
              value={setup.humanCount}
              onDec={() => setSetup({ humanCount: setup.humanCount - 1 })}
              onInc={() => setSetup({ humanCount: setup.humanCount + 1 })}
              decTestId="human-dec"
              incTestId="human-inc"
              valueTestId="human-count"
              decLabel="Fewer humans"
              incLabel="More humans"
            />
          </div>
          <p className="bot-count" data-testid="bot-count">
            {bots === 0 ? 'All human' : `${bots} bot${bots > 1 ? 's' : ''}`}
          </p>

          <ul className="seat-list">
            {seats.map((seat, i) => {
              const color = SEATS[seat]!.color;
              const isBot = i >= setup.humanCount;
              return (
                <motion.li key={seat} className={`seat-row seat-${color}`} layout={!reduced}>
                  <span className="seat-token" aria-hidden />
                  <input
                    className="text-input flex-1"
                    value={setup.names[seat] ?? color}
                    onChange={(e) =>
                      setSetup({ names: { ...setup.names, [seat]: e.target.value } })
                    }
                    disabled={isBot}
                    data-testid={`name-${color}`}
                    aria-label={`${color} name`}
                  />
                  <span className="seat-kind">{isBot ? 'Bot' : 'You'}</span>
                </motion.li>
              );
            })}
          </ul>

          <button
            type="button"
            className="btn btn-primary start-btn"
            disabled={!!disabledReason}
            onClick={() => startGame()}
            data-testid="start-game"
          >
            Start game
          </button>
          {disabledReason && (
            <p className="start-blocked" data-testid="start-blocked">
              {disabledReason}
            </p>
          )}
        </motion.section>
      </div>
    </div>
  );
}
