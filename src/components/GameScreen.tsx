import { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { useAppStore } from '../store/gameStore';
import { BoardSvg } from './BoardSvg';
import { PawnLayer } from './PawnLayer';
import { HUD } from './HUD';
import { playSfx } from '../audio/sfx';

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
  const autoMoveKey = useRef<string | null>(null);

  const reducedMotion =
    typeof window !== 'undefined' &&
    (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.reducedMotion === 'true');

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
      if (!useAppStore.getState().muted) {
        playSfx(move.captures.length ? 'capture' : move.enteredHome ? 'home' : 'move');
      }
      movePawn(id);
      setAnnouncement('Moved pawn');
      setPreviewId(null);
      return true;
    },
    [selectPawn, movePawn, setAnnouncement],
  );

  const onSelect = useCallback((id: string) => {
    playMove(id);
  }, [playMove]);

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

    const delay = reducedMotion ? 50 : 350;
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
      <div className="board-wrap relative mx-auto shrink-0" data-testid="board-wrap">
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
      </div>
      <HUD
        game={game}
        onRoll={onRoll}
        muted={muted}
        onMuteToggle={() => setMuted(!muted)}
        onQuit={goSetup}
        rolling={rolling}
      />
    </div>
  );
}
