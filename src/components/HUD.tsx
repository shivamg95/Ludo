import { motion } from 'motion/react';
import type { GameState } from '../engine/types';
import { SEATS } from '../engine/board';
import { formatEvent } from '../engine/selectors';
import { Dice } from './Dice';
import { IconLeave, IconSpeaker } from './icons';

function formatMs(ms: number | null): string {
  if (ms === null) return '';
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function titleCase(mode: string) {
  if (mode === 'timed') return 'X-Minute';
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

interface Props {
  game: GameState;
  onRoll: () => void;
  onMuteToggle: () => void;
  muted: boolean;
  onQuit: () => void;
  rolling?: boolean;
  lastDiceValue?: number | null;
  hint?: string | null;
  extraRoll?: boolean;
  diceSpin?: { x: number; y: number };
  turnTimerRemainingMs?: number | null;
}

export function HUD({
  game,
  onRoll,
  onMuteToggle,
  muted,
  onQuit,
  rolling = false,
  lastDiceValue = null,
  hint = null,
  extraRoll = false,
  diceSpin,
  turnTimerRemainingMs = null,
}: Props) {
  const currentSeat = game.config.seats[game.currentSeatIndex]!;
  const canRoll = game.phase === 'waiting_roll' && !game.hardStopped && !rolling;
  const current = game.players.find((p) => p.seat === currentSeat)!;
  const duration = game.config.durationMs ?? 1;
  const clockFrac =
    game.clockMsRemaining !== null ? Math.max(0, Math.min(1, game.clockMsRemaining / duration)) : 1;
  const clockWarn = game.clockMsRemaining !== null && game.clockMsRemaining <= 30_000;
  const timerFrac =
    game.config.turnTimerEnabled && game.turnDeadlineMs && turnTimerRemainingMs !== null
      ? Math.max(0, Math.min(1, turnTimerRemainingMs / game.turnDeadlineMs))
      : null;

  return (
    <aside
      className="glass hud-panel flex w-full flex-col gap-3 rounded-2xl p-3 sm:p-4 lg:w-72 lg:shrink-0"
      data-testid="hud"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: 'var(--muted)' }}
        >
          {titleCase(game.config.mode)}
        </p>
        <div className="flex gap-1">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            className="icon-btn glass rounded-lg px-2"
            onClick={onMuteToggle}
            data-testid="hud-mute"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            <IconSpeaker off={muted} />
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            className="icon-btn glass rounded-lg px-2"
            onClick={onQuit}
            data-testid="quit-game"
            aria-label="Quit"
          >
            <IconLeave />
          </motion.button>
        </div>
      </div>

      <div className="hud-dice flex flex-col items-center gap-2 py-1">
        <p className="text-xs" style={{ color: 'var(--muted)' }} data-testid="turn-label">
          {rolling
            ? `${current.name} rolling…`
            : current.isBot
              ? `${current.name} thinking…`
              : `${current.name}'s turn`}
        </p>
        <Dice
          value={game.diceValue}
          lastValue={lastDiceValue}
          disabled={!canRoll || current.isBot}
          onRoll={onRoll}
          rolling={rolling}
          spin={diceSpin}
          hint={hint}
          extraRoll={extraRoll && canRoll && !current.isBot}
          timerFraction={timerFrac}
        />
      </div>

      {game.config.mode === 'timed' && (
        <div
          className="relative overflow-hidden rounded-xl px-3 py-2 text-center text-2xl font-bold tabular-nums"
          style={{
            background: 'rgba(0,0,0,0.2)',
            fontFamily: 'var(--font-display)',
            color: clockWarn ? 'var(--danger)' : undefined,
          }}
          data-testid="game-clock"
        >
          <span
            className="clock-deplete"
            style={{ transform: `scaleX(${clockFrac})` }}
            aria-hidden
          />
          <span className="relative">{formatMs(game.clockMsRemaining)}</span>
        </div>
      )}

      {game.winnerBannerSeat !== null && (
        <motion.div
          className="rounded-xl px-3 py-2 text-center text-sm font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--bg0)' }}
          data-testid="winner-banner"
          initial={{ y: -8, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        >
          Winner: {game.players.find((p) => p.seat === game.winnerBannerSeat)?.name}
        </motion.div>
      )}

      <div className="flex flex-col gap-2" data-testid="player-cards">
        {game.players.map((p) => {
          const active = p.seat === currentSeat && game.phase !== 'finished';
          const thinking = active && current.isBot && !rolling;
          return (
            <div
              key={p.seat}
              className={`player-card relative overflow-hidden rounded-xl px-3 py-1.5 seat-${p.color}`}
              style={{
                background: active
                  ? `linear-gradient(90deg, color-mix(in oklab, var(--seat) 40%, transparent), transparent)`
                  : 'rgba(255,255,255,0.03)',
                boxShadow: active
                  ? `0 0 0 1.5px var(--seat), 0 0 22px color-mix(in oklab, var(--seat) 45%, transparent)`
                  : undefined,
              }}
              data-testid={`player-card-${p.color}`}
              data-active={active ? 'true' : 'false'}
            >
              {active && <span className="active-glow" aria-hidden />}
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: `var(--${p.color})` }}
                  />
                  <span className="truncate text-sm font-semibold">{p.name}</span>
                  {p.isBot && (
                    <span className="text-[10px] uppercase" style={{ color: 'var(--muted)' }}>
                      bot
                    </span>
                  )}
                  {thinking && (
                    <span className="thinking-dots" aria-hidden>
                      <span />
                      <span />
                      <span />
                    </span>
                  )}
                  {game.config.mode === 'quick' && !p.hasCaptured && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: 'rgba(0,0,0,0.35)' }}
                      data-testid={`cut-needed-${p.color}`}
                    >
                      Cut needed
                    </span>
                  )}
                </div>
                {game.config.mode === 'timed' ? (
                  <span className="text-sm tabular-nums" data-testid={`score-${p.color}`}>
                    {p.score}
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5" aria-label={`${p.pawns.filter((x) => x.progress === 56).length} of 4 home`}>
                    {p.pawns.map((pawn) => {
                      const home = pawn.progress === 56;
                      return (
                        <span
                          key={pawn.id}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            background: home ? `var(--${p.color})` : 'transparent',
                            boxShadow: `inset 0 0 0 1px var(--${p.color})`,
                            opacity: home ? 1 : 0.35,
                          }}
                        />
                      );
                    })}
                  </span>
                )}
              </div>
              {p.finishedRank !== null && (
                <p className="mt-1 text-xs" style={{ color: 'var(--accent)' }}>
                  Finished #{p.finishedRank}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="hud-log mt-auto max-h-16 overflow-hidden rounded-xl p-2 text-xs"
        style={{ background: 'rgba(0,0,0,0.2)' }}
        data-testid="move-log"
      >
        {game.events
          .slice(-3)
          .reverse()
          .map((e, i) => {
            const name =
              game.players.find((p) => p.seat === e.seat)?.name ??
              SEATS[e.seat]?.color ??
              'Player';
            return (
              <div key={`${e.atCursor}-${i}`} style={{ color: 'var(--ink)', opacity: 0.75 }}>
                {formatEvent(e.type, e.detail, name)}
              </div>
            );
          })}
      </div>
    </aside>
  );
}
