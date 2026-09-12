import { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { motion, useAnimationControls } from 'motion/react';
import { useAppStore } from '../store/gameStore';
import { BoardSvg } from './BoardSvg';
import { PawnLayer } from './PawnLayer';
import { GameTopBar, MoveLogSheet, SeatPod, TurnDice, WinnerBanner } from './HUD';
import { playHopTicks, playSfx } from '../audio/sfx';
import { useReducedMotion, BEAT, DUR, SPRING } from '../ui/motion';
import { capturerApproachSeconds } from '../ui/hop';
import { useEventStream, eventCaptures, eventReachedHome } from '../ui/useGameEvents';
import { useWideLayout } from '../ui/useMediaQuery';
import { EventFx } from '../ui/EventFx';

/** Board quadrants, matching each seat's yard in engine/board. */
const SEAT_CORNER: Record<number, 'tl' | 'tr' | 'br' | 'bl'> = {
  0: 'tl',
  1: 'tr',
  2: 'br',
  3: 'bl',
};

/** Corners whose player sits across the board and reads the screen upside-down. */
const FAR_CORNERS = new Set(['tl', 'tr']);

export function GameScreen() {
  const game = useAppStore((s) => s.game);
  const roll = useAppStore((s) => s.roll);
  const rolling = useAppStore((s) => s.rolling);
  const movePawn = useAppStore((s) => s.movePawn);
  const selectPawn = useAppStore((s) => s.selectPawn);
  const muted = useAppStore((s) => s.muted);
  const setMuted = useAppStore((s) => s.setMuted);
  const goSetup = useAppStore((s) => s.goSetup);
  const tickClock = useAppStore((s) => s.tickClock);
  const setAnnouncement = useAppStore((s) => s.setAnnouncement);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const autoMoveKey = useRef<string | null>(null);
  const boardControls = useAnimationControls();

  const reducedMotion = useReducedMotion();
  const wide = useWideLayout();

  /**
   * A capture is the loudest thing that happens in Ludo — the board takes a hit.
   * Driven from the engine's event log so bot captures land as hard as yours.
   */
  useEventStream(game, (events) => {
    const muted = useAppStore.getState().muted;
    events.forEach((event, i) => {
      if (event.type === 'three_sixes_forfeit') {
        if (!muted) playSfx('forfeit');
        if (!reducedMotion) {
          void boardControls.start({
            x: [0, -12, 10, -8, 5, -2, 0],
            y: [0, 6, -5, 4, -2, 1, 0],
            transition: { duration: 0.55, ease: 'easeOut' },
          });
        }
        return;
      }
      if (event.type !== 'move') return;

      if (eventCaptures(event).length > 0) {
        const from = Number(event.detail?.from ?? -1);
        const to = Number(event.detail?.to ?? -1);
        const delayMs = reducedMotion ? 0 : capturerApproachSeconds(from, to) * 1000;
        const extraTurn =
          i === events.length - 1 &&
          game &&
          game.phase === 'waiting_roll' &&
          game.config.seats[game.currentSeatIndex] === event.seat;
        window.setTimeout(() => {
          if (!useAppStore.getState().muted) playSfx('capture');
          if (!reducedMotion) {
            void boardControls.start({
              x: [0, -7, 6, -4, 2, 0],
              y: [0, 4, -3, 2, -1, 0],
              transition: { duration: 0.42, ease: 'easeOut' },
            });
          }
          if (extraTurn && !useAppStore.getState().muted) playSfx('extra');
        }, delayMs);
        return;
      }

      if (eventReachedHome(event)) {
        if (!muted) playSfx('home');
      } else if (!muted) {
        if (reducedMotion) {
          // No hop to score — one blip stands in for the whole move
          playSfx('move');
        } else {
          // One click per cell travelled, matched to the hop cadence
          const from = Number(event.detail?.from ?? -1);
          const to = Number(event.detail?.to ?? -1);
          const steps = from < 0 ? 1 : Math.max(1, to - from);
          playHopTicks(steps, DUR.hop * 1000);
        }
      }

      // The engine advances the turn before we see this, so the same seat still
      // waiting to roll means the move bought another go.
      const isLast = i === events.length - 1;
      if (isLast && !muted && game && game.phase === 'waiting_roll') {
        if (game.config.seats[game.currentSeatIndex] === event.seat) playSfx('extra');
      }
    });
  });

  const finished = game?.phase === 'finished';
  useEffect(() => {
    if (finished && !useAppStore.getState().muted) playSfx('win');
  }, [finished]);

  useEffect(() => {
    if (!game || game.config.mode !== 'timed') return;
    const id = window.setInterval(() => {
      tickClock(performance.now());
    }, 200);
    return () => clearInterval(id);
  }, [game?.config.mode, tickClock, game]);

  const movableIds = useMemo(
    () => new Set(game?.legalMoves.map((m) => m.pawnId) ?? []),
    [game?.legalMoves],
  );

  const lockedSeats = useMemo(() => {
    if (!game || game.config.mode !== 'quick') return [];
    return game.players.filter((p) => !p.hasCaptured).map((p) => p.seat);
  }, [game]);

  const currentSeat = game ? game.config.seats[game.currentSeatIndex]! : null;

  /** Move a pawn only if it belongs to the current human player. */
  const playMove = useCallback(
    (id: string) => {
      const g = useAppStore.getState().game;
      if (!g || g.phase !== 'waiting_move') return false;
      const move = g.legalMoves.find((m) => m.pawnId === id);
      if (!move) return false;

      const seat = g.config.seats[g.currentSeatIndex]!;
      const player = g.players.find((p) => p.seat === seat);
      if (!player || player.isBot) return false;
      if (!player.pawns.some((p) => p.id === id)) return false;

      selectPawn(id);
      setPreviewId(id);
      movePawn(id);
      setAnnouncement('Moved pawn');
      setPreviewId(null);
      return true;
    },
    [selectPawn, movePawn, setAnnouncement],
  );

  const onSelect = useCallback(
    (id: string) => {
      playMove(id);
    },
    [playMove],
  );

  // Auto-play the current human's single forced choice only — never other seats / bots.
  useEffect(() => {
    if (!game || rolling) return;
    if (game.phase !== 'waiting_move') {
      autoMoveKey.current = null;
      return;
    }
    if (game.legalMoves.length !== 1) return;

    const seat = game.config.seats[game.currentSeatIndex]!;
    const player = game.players.find((p) => p.seat === seat);
    if (!player || player.isBot) return;

    const only = game.legalMoves[0]!;
    if (!player.pawns.some((p) => p.id === only.pawnId)) return;

    const key = `${game.version}:${seat}:${only.pawnId}:${only.toProgress}`;
    if (autoMoveKey.current === key) return;
    autoMoveKey.current = key;

    const delay = reducedMotion ? 50 : BEAT.autoMove;
    const t = window.setTimeout(() => {
      const g = useAppStore.getState().game;
      if (!g || g.phase !== 'waiting_move') return;
      if (g.legalMoves.length !== 1) return;

      const liveSeat = g.config.seats[g.currentSeatIndex]!;
      const livePlayer = g.players.find((p) => p.seat === liveSeat);
      // Seat must still be the same human who earned this forced move
      if (!livePlayer || livePlayer.isBot) return;
      if (liveSeat !== seat) return;
      if (g.legalMoves[0]!.pawnId !== only.pawnId) return;
      if (!livePlayer.pawns.some((p) => p.id === only.pawnId)) return;

      playMove(only.pawnId);
    }, delay);

    return () => clearTimeout(t);
  }, [game, rolling, reducedMotion, playMove]);

  const onRoll = useCallback(() => {
    if (!muted) playSfx('roll');
    roll();
  }, [roll, muted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!game) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (game.phase === 'waiting_roll') onRoll();
        else if (game.phase === 'waiting_move' && game.selectedPawnId) {
          playMove(game.selectedPawnId);
        } else if (game.phase === 'waiting_move' && game.legalMoves[0]) {
          playMove(game.legalMoves[0].pawnId);
        }
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (game.phase !== 'waiting_move' || game.legalMoves.length === 0) return;
        const ids = game.legalMoves.map((m) => m.pawnId);
        const cur = game.selectedPawnId ? ids.indexOf(game.selectedPawnId) : -1;
        const next =
          e.key === 'ArrowRight'
            ? ids[(cur + 1) % ids.length]!
            : ids[(cur - 1 + ids.length) % ids.length]!;
        selectPawn(next);
        setPreviewId(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, onRoll, playMove, selectPawn]);

  if (!game) return null;

  /** Seat -> board quadrant, so each pod sits beside the yard it describes. */
  const podFor = (seat: number, compact = false) => {
    const player = game.players.find((p) => p.seat === seat);
    if (!player) return null;
    return (
      <SeatPod
        key={seat}
        player={player}
        game={game}
        active={player.seat === currentSeat && game.phase !== 'finished'}
        compact={compact}
      />
    );
  };

  /**
   * A player's corner of the table: their pod, plus the die itself while it is
   * their turn. The die is the outermost element so it lands nearest the player
   * it belongs to, and `data-corner` drives the 180deg flip for the far side.
   */
  const cornerFor = (seat: number) => {
    const player = game.players.find((p) => p.seat === seat);
    if (!player) return null;
    const corner = SEAT_CORNER[seat]!;
    const active = player.seat === currentSeat && game.phase !== 'finished';

    return (
      <div className={`corner-cell seat-${player.color}`} data-corner={corner}>
        {/* The slot is always here, empty or not, so pods never shift as the
            die moves on. It doubles as a stable anchor for the travel. */}
        <div className="corner-die-slot">
          {!active && <span className="corner-die-tray" aria-hidden="true" />}
          {active && (
            <motion.div
              className="corner-die"
              // Shared layout id: as the turn passes, the die unmounts from one
              // corner and mounts in the next, and motion slides it across.
              layoutId={reducedMotion ? undefined : 'turn-die'}
              transition={SPRING.ui}
            >
              <TurnDice
                game={game}
                onRoll={onRoll}
                rolling={rolling}
                flipped={FAR_CORNERS.has(corner)}
              />
            </motion.div>
          )}
        </div>
        <div className="corner-face">{podFor(seat)}</div>
      </div>
    );
  };

  const board = (
    <motion.div
      className="board-wrap relative shrink-0"
      data-testid="board-wrap"
      animate={boardControls}
    >
      <BoardSvg
        lockedSeats={lockedSeats}
        activeSeats={game.config.seats}
        activeSeat={currentSeat}
      />
      <PawnLayer
        game={game}
        movableIds={movableIds}
        selectedId={game.selectedPawnId}
        onSelect={onSelect}
        reducedMotion={reducedMotion}
        previewPawnId={previewId ?? game.selectedPawnId}
      />
    </motion.div>
  );

  return (
    <div className="game-screen" data-testid="game-screen">
      <GameTopBar
        game={game}
        muted={muted}
        onMuteToggle={() => setMuted(!muted)}
        onQuit={goSetup}
        onToggleLog={() => setLogOpen((v) => !v)}
        logOpen={logOpen}
      />
      <WinnerBanner game={game} />

      {wide ? (
        <div className="game-stage">
          <div className="pod-rail">
            <div className="pod-slot pod-slot-start">{cornerFor(0)}</div>
            <div className="pod-slot" />
            <div className="pod-slot pod-slot-end">{cornerFor(3)}</div>
          </div>

          {board}

          <div className="pod-rail">
            <div className="pod-slot pod-slot-start">{cornerFor(1)}</div>
            <div className="pod-slot" />
            <div className="pod-slot pod-slot-end">{cornerFor(2)}</div>
          </div>
        </div>
      ) : (
        <>
          <div className="pod-strip">{game.config.seats.map((seat) => podFor(seat, true))}</div>
          <div className="game-stage game-stage-narrow">{board}</div>
          <div className="action-bar">
            <TurnDice game={game} onRoll={onRoll} rolling={rolling} />
          </div>
        </>
      )}

      <MoveLogSheet game={game} open={logOpen} onClose={() => setLogOpen(false)} />
      <EventFx game={game} />
    </div>
  );
}
