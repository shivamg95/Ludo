import { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { useAppStore } from '../store/gameStore';
import { BoardSvg } from './BoardSvg';
import { PawnLayer } from './PawnLayer';
import { HUD } from './HUD';
import { playSfx, resumeAudio } from '../audio/sfx';
import { prefersReducedMotion } from '../ui/motion';

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
  const lastDiceValue = useAppStore((s) => s.lastDiceValue);
  const hint = useAppStore((s) => s.hint);
  const extraRoll = useAppStore((s) => s.extraRoll);
  const diceSpin = useAppStore((s) => s.diceSpin);
  const turnTimerRemainingMs = useAppStore((s) => s.turnTimerRemainingMs);
  const noteHopFinished = useAppStore((s) => s.noteHopFinished);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const autoMoveKey = useRef<string | null>(null);
  const hopCompleteRef = useRef(noteHopFinished);
  hopCompleteRef.current = noteHopFinished;

  const reducedMotion = prefersReducedMotion();

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
      return true;
    },
    [selectPawn, movePawn, setAnnouncement],
  );

  const onSelect = useCallback(
    (id: string) => {
      const g = useAppStore.getState().game;
      if (!g || g.phase !== 'waiting_move') return;
      const move = g.legalMoves.find((m) => m.pawnId === id);
      if (!move) return;
      const seat = g.config.seats[g.currentSeatIndex]!;
      const player = g.players.find((p) => p.seat === seat);
      if (!player || player.isBot) return;
      if (g.legalMoves.length > 1 && g.selectedPawnId !== id) {
        selectPawn(id);
        setPreviewId(id);
        return;
      }
      playMove(id);
    },
    [playMove, selectPawn],
  );

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

    const delay = reducedMotion ? 50 : 350;
    const t = window.setTimeout(() => {
      const g = useAppStore.getState().game;
      if (!g || g.phase !== 'waiting_move') return;
      if (g.legalMoves.length !== 1) return;

      const liveSeat = g.config.seats[g.currentSeatIndex]!;
      const livePlayer = g.players.find((p) => p.seat === liveSeat);
      if (!livePlayer || livePlayer.isBot) return;
      if (liveSeat !== seat) return;
      if (g.legalMoves[0]!.pawnId !== only.pawnId) return;
      if (!livePlayer.pawns.some((p) => p.id === only.pawnId)) return;

      playMove(only.pawnId);
    }, delay);

    return () => clearTimeout(t);
  }, [game, rolling, reducedMotion, playMove]);

  const onRoll = useCallback(() => {
    resumeAudio();
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
        } else if (game.phase === 'waiting_move' && game.legalMoves.length === 1 && game.legalMoves[0]) {
          playMove(game.legalMoves[0].pawnId);
        } else if (game.phase === 'waiting_move' && game.legalMoves[0]) {
          selectPawn(game.legalMoves[0].pawnId);
          setPreviewId(game.legalMoves[0].pawnId);
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

  const onHopsScheduled = useCallback((ms: number) => {
    const { animating, rolling } = useAppStore.getState();
    if (ms <= 0 && animating && !rolling) {
      hopCompleteRef.current();
    }
  }, []);

  const onHopComplete = useCallback(() => {
    setPreviewId(null);
    if (useAppStore.getState().animating) hopCompleteRef.current();
  }, []);

  const onImpact = useCallback(() => {
    setShake(true);
    window.setTimeout(() => setShake(false), 180);
  }, []);

  const onHopSfx = useCallback(
    (kind: 'land' | 'capture' | 'home') => {
      if (!useAppStore.getState().muted) playSfx(kind);
    },
    [],
  );

  if (!game) return null;

  return (
    <div
      className="game-screen flex h-full w-full flex-col gap-3 p-3 lg:flex-row lg:items-center"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
      data-testid="game-screen"
    >
      <div
        className={`board-wrap relative mx-auto shrink-0 ${shake ? 'board-shake' : ''}`}
        data-testid="board-wrap"
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
          onDest={playMove}
          reducedMotion={reducedMotion}
          previewPawnId={previewId ?? game.selectedPawnId}
          onHopsScheduled={onHopsScheduled}
          onHopComplete={onHopComplete}
          onImpact={onImpact}
          onHopSfx={onHopSfx}
        />
      </div>
      <HUD
        game={game}
        onRoll={onRoll}
        muted={muted}
        onMuteToggle={() => setMuted(!muted)}
        onQuit={goSetup}
        rolling={rolling}
        lastDiceValue={lastDiceValue}
        hint={hint}
        extraRoll={extraRoll}
        diceSpin={diceSpin}
        turnTimerRemainingMs={turnTimerRemainingMs}
      />
    </div>
  );
}
