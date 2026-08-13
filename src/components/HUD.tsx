import { AnimatePresence, motion } from 'motion/react';
import type { GameState, Player } from '../engine/types';
import { SEATS } from '../engine/board';
import { formatEvent } from '../engine/selectors';
import { Dice } from './Dice';
import { lastRollValue } from '../ui/useGameEvents';
import { SPRING, DUR } from '../ui/motion';
import { LogIcon, QuitIcon, SoundOffIcon, SoundOnIcon } from './icons';

function formatMs(ms: number | null): string {
  if (ms === null) return '';
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/**
 * One player's status. On the wide layout these sit in the board quadrant that
 * matches the player's yard, so the HUD is spatially meaningful.
 */
export function SeatPod({
  player,
  game,
  active,
  compact = false,
}: {
  player: Player;
  game: GameState;
  active: boolean;
  compact?: boolean;
}) {
  const home = player.pawns.filter((p) => p.progress === 56).length;

  return (
    <motion.div
      className={`seat-pod seat-${player.color} ${compact ? 'seat-pod-compact' : ''}`}
      data-testid={`player-card-${player.color}`}
      data-active={active ? 'true' : 'false'}
      // No `layout` here: the far corners rotate their pod 180deg, and layout
      // projection cannot measure through a rotated ancestor.
      initial={false}
      animate={{ opacity: active ? 1 : 0.72 }}
      transition={SPRING.ui}
    >
      {active && <span className="seat-pod-glow" aria-hidden />}
      <div className="seat-pod-head">
        <span className="seat-pod-chip" aria-hidden />
        <span className="seat-pod-name">{player.name}</span>
        {player.isBot && <span className="seat-pod-tag">bot</span>}
      </div>

      <div className="seat-pod-stats">
        {game.config.mode === 'timed' ? (
          <span className="seat-pod-score" data-testid={`score-${player.color}`}>
            {player.score}
          </span>
        ) : (
          <span className="seat-pod-progress">
            <span className="seat-pod-progress-value">{home}</span>
            <span className="seat-pod-progress-total">/4</span>
          </span>
        )}
        {!compact && (
          <span className="seat-pod-pips" aria-hidden>
            {player.pawns.map((p) => (
              <span
                key={p.id}
                className="seat-pod-pip"
                data-state={p.progress === 56 ? 'home' : p.progress < 0 ? 'yard' : 'track'}
              />
            ))}
          </span>
        )}
      </div>

      {game.config.mode === 'quick' && !player.hasCaptured && (
        <span className="seat-pod-badge" data-testid={`cut-needed-${player.color}`}>
          Cut needed
        </span>
      )}
      {player.finishedRank !== null && (
        <span className="seat-pod-badge seat-pod-badge-done">Finished #{player.finishedRank}</span>
      )}
    </motion.div>
  );
}

/**
 * Turn label plus the hero die. `flipped` rotates only the copy, for the corners
 * whose player is sitting across the board.
 */
export function TurnDice({
  game,
  onRoll,
  rolling,
  flipped = false,
}: {
  game: GameState;
  onRoll: () => void;
  rolling: boolean;
  flipped?: boolean;
}) {
  const currentSeat = game.config.seats[game.currentSeatIndex]!;
  const current = game.players.find((p) => p.seat === currentSeat)!;
  const canRoll = game.phase === 'waiting_roll' && !game.hardStopped && !rolling;

  return (
    <div className="turn-dice" data-flip={flipped ? 'true' : 'false'}>
      <p className="turn-label" data-testid="turn-label">
        {rolling
          ? `${current.name} rolling…`
          : current.isBot
            ? `${current.name} thinking…`
            : `${current.name}'s turn`}
      </p>
      <Dice
        value={game.diceValue}
        face={lastRollValue(game)}
        disabled={!canRoll || current.isBot}
        onRoll={onRoll}
        rolling={rolling}
        seatColor={current.color}
        waitingLabel={current.isBot ? 'Bot playing' : 'Pick a token'}
      />
    </div>
  );
}

export function GameTopBar({
  game,
  muted,
  onMuteToggle,
  onQuit,
  onToggleLog,
  logOpen,
}: {
  game: GameState;
  muted: boolean;
  onMuteToggle: () => void;
  onQuit: () => void;
  onToggleLog: () => void;
  logOpen: boolean;
}) {
  return (
    <header className="game-topbar" data-testid="hud">
      <div className="game-topbar-left">
        <span className="mode-chip">{game.config.mode}</span>
        {game.config.mode === 'timed' && (
          <span className="game-clock" data-testid="game-clock">
            {formatMs(game.clockMsRemaining)}
          </span>
        )}
      </div>

      <div className="game-topbar-right">
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleLog}
          data-testid="toggle-log"
          aria-expanded={logOpen}
          aria-label={logOpen ? 'Hide move log' : 'Show move log'}
        >
          <LogIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onMuteToggle}
          data-testid="hud-mute"
          aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
        >
          {muted ? <SoundOffIcon /> : <SoundOnIcon />}
        </button>
        <button
          type="button"
          className="icon-btn icon-btn-danger"
          onClick={onQuit}
          data-testid="quit-game"
          aria-label="Quit game"
        >
          <QuitIcon />
        </button>
      </div>
    </header>
  );
}

/** Collapsible history. Replaces the 16px sliver that never showed anything. */
export function MoveLogSheet({
  game,
  open,
  onClose,
}: {
  game: GameState;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          className="log-sheet panel"
          data-testid="move-log"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: DUR.base, ease: 'easeOut' }}
        >
          <div className="log-sheet-head">
            <span>Move log</span>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close move log">
              ✕
            </button>
          </div>
          <div className="log-sheet-body">
            {game.events.length === 0 && <p className="log-empty">No moves yet.</p>}
            {game.events
              .slice(-40)
              .reverse()
              .map((e, i) => {
                const seat = SEATS[e.seat];
                const name =
                  game.players.find((p) => p.seat === e.seat)?.name ?? seat?.color ?? 'Player';
                return (
                  <div key={`${e.atCursor}-${i}`} className={`log-line seat-${seat?.color ?? 'red'}`}>
                    <span className="log-dot" aria-hidden />
                    {formatEvent(e.type, e.detail, name)}
                  </div>
                );
              })}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export function WinnerBanner({ game }: { game: GameState }) {
  if (game.winnerBannerSeat === null) return null;
  const winner = game.players.find((p) => p.seat === game.winnerBannerSeat);
  return (
    <motion.div
      className={`winner-banner seat-${winner?.color ?? 'red'}`}
      data-testid="winner-banner"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.ui}
    >
      {winner?.name} wins
    </motion.div>
  );
}
