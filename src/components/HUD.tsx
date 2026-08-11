import type { GameState } from '../engine/types';
import { SEATS } from '../engine/board';
import { formatEvent } from '../engine/selectors';
import { Dice } from './Dice';

function formatMs(ms: number | null): string {
  if (ms === null) return '';
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

interface Props {
  game: GameState;
  onRoll: () => void;
  onMuteToggle: () => void;
  muted: boolean;
  onQuit: () => void;
  rolling?: boolean;
}

export function HUD({ game, onRoll, onMuteToggle, muted, onQuit, rolling = false }: Props) {
  const currentSeat = game.config.seats[game.currentSeatIndex]!;
  const canRoll = game.phase === 'waiting_roll' && !game.hardStopped && !rolling;
  const current = game.players.find((p) => p.seat === currentSeat)!;

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
          {game.config.mode}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            className="glass rounded-lg px-2 text-xs"
            onClick={onMuteToggle}
            data-testid="hud-mute"
          >
            {muted ? 'Muted' : 'SFX'}
          </button>
          <button
            type="button"
            className="glass rounded-lg px-2 text-xs"
            onClick={onQuit}
            data-testid="quit-game"
          >
            Quit
          </button>
        </div>
      </div>

      {game.config.mode === 'timed' && (
        <div
          className="rounded-xl px-3 py-2 text-center text-2xl font-bold tabular-nums"
          style={{ background: 'rgba(0,0,0,0.2)', fontFamily: 'var(--font-display)' }}
          data-testid="game-clock"
        >
          {formatMs(game.clockMsRemaining)}
        </div>
      )}

      {game.winnerBannerSeat !== null && (
        <div
          className="rounded-xl px-3 py-2 text-center text-sm font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--bg0)' }}
          data-testid="winner-banner"
        >
          Winner: {game.players.find((p) => p.seat === game.winnerBannerSeat)?.name}
        </div>
      )}

      <div className="flex flex-col gap-2" data-testid="player-cards">
        {game.players.map((p) => {
          const active = p.seat === currentSeat && game.phase !== 'finished';
          return (
            <div
              key={p.seat}
              className={`player-card relative overflow-hidden rounded-xl px-3 py-2 seat-${p.color}`}
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
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    {p.pawns.filter((x) => x.progress === 56).length}/4
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

      <div className="hud-dice mt-auto flex flex-col items-center gap-2 py-2">
        <p className="text-xs" style={{ color: 'var(--muted)' }} data-testid="turn-label">
          {rolling
            ? `${current.name} rolling…`
            : current.isBot
              ? `${current.name} thinking…`
              : `${current.name}'s turn`}
        </p>
        <Dice
          value={game.diceValue}
          disabled={!canRoll || current.isBot}
          onRoll={onRoll}
          rolling={rolling}
        />
      </div>

      <div
        className="hud-log max-h-28 overflow-y-auto rounded-xl p-2 text-xs"
        style={{ background: 'rgba(0,0,0,0.2)' }}
        data-testid="move-log"
      >
        {game.events
          .slice(-12)
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
