import type { GameState, Player } from './types';

/** Pure scoring helpers for timed mode. Score floors at 0. */

export function addScore(player: Player, delta: number): void {
  player.score = Math.max(0, player.score + delta);
}

export function scoreSteps(player: Player, steps: number): void {
  if (steps > 0) addScore(player, steps);
}

export function scoreCapture(attacker: Player, victim: Player, victimProgress: number): void {
  addScore(attacker, 30);
  addScore(victim, -victimProgress);
}

export function scoreHome(player: Player): void {
  addScore(player, 50);
}

export function applyTimedMoveScores(
  players: Player[],
  moverSeat: number,
  steps: number,
  captureVictimIds: { seat: number; progress: number }[],
  enteredHome: boolean,
): void {
  const mover = players.find((p) => p.seat === moverSeat)!;
  scoreSteps(mover, steps);
  for (const v of captureVictimIds) {
    const victim = players.find((p) => p.seat === v.seat)!;
    scoreCapture(mover, victim, v.progress);
  }
  if (enteredHome) {
    scoreHome(mover);
  }
}

export function timedRanking(state: GameState): number[] {
  const seats = [...state.config.seats];
  seats.sort((a, b) => {
    const pa = state.players.find((p) => p.seat === a)!;
    const pb = state.players.find((p) => p.seat === b)!;
    if (pb.score !== pa.score) return pb.score - pa.score;
    if (pb.captures !== pa.captures) return pb.captures - pa.captures;
    if (pb.distanceTravelled !== pa.distanceTravelled) {
      return pb.distanceTravelled - pa.distanceTravelled;
    }
    return a - b;
  });
  return seats;
}
