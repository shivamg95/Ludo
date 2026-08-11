import { useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../store/gameStore';
import { BoardSvg } from './BoardSvg';
import { PawnLayer } from './PawnLayer';
import { HUD } from './HUD';
import { playSfx } from '../audio/sfx';

export function GameScreen() {
  const game = useAppStore((s) => s.game);
  const roll = useAppStore((s) => s.roll);
  const movePawn = useAppStore((s) => s.movePawn);
  const selectPawn = useAppStore((s) => s.selectPawn);
  const muted = useAppStore((s) => s.muted);
  const setMuted = useAppStore((s) => s.setMuted);
  const goSetup = useAppStore((s) => s.goSetup);
  const tickClock = useAppStore((s) => s.tickClock);
  const setAnnouncement = useAppStore((s) => s.setAnnouncement);

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

  const onSelect = useCallback(
    (id: string) => {
      if (!game) return;
      if (game.phase !== 'waiting_move') return;
      if (!movableIds.has(id)) return;
      selectPawn(id);
      if (!muted) playSfx('move');
      movePawn(id);
      setAnnouncement(`Moved pawn`);
    },
    [game, movableIds, selectPawn, movePawn, muted, setAnnouncement],
  );

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
          movePawn(game.selectedPawnId);
        } else if (game.phase === 'waiting_move' && game.legalMoves[0]) {
          movePawn(game.legalMoves[0].pawnId);
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
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, onRoll, movePawn, selectPawn]);

  if (!game) return null;

  return (
    <div
      className="flex h-full w-full flex-col gap-3 p-3 lg:flex-row lg:items-stretch"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
      data-testid="game-screen"
    >
      <div
        className="relative mx-auto aspect-square w-full max-w-[min(100dvw-1.5rem,calc(100dvh-12rem))] lg:max-w-[min(100%,calc(100dvh-2rem))]"
        data-testid="board-wrap"
      >
        <BoardSvg lockedSeats={lockedSeats} />
        <PawnLayer
          game={game}
          movableIds={movableIds}
          selectedId={game.selectedPawnId}
          onSelect={onSelect}
          reducedMotion={reducedMotion}
        />
      </div>
      <HUD
        game={game}
        onRoll={onRoll}
        muted={muted}
        onMuteToggle={() => setMuted(!muted)}
        onQuit={goSetup}
      />
    </div>
  );
}
