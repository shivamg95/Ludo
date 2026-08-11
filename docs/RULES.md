# Ludo Rules Spec (Canonical Test Oracle)

This document is the single source of truth for game behavior. Every bullet has a corresponding unit test.

## Shared rules (all modes)

- 4 pawns per player, one six-sided die.
- A pawn leaves the yard onto its start square (progress 0) on a roll of **1 or 6**.
- **Extra roll** is granted when the player: rolls a 6, unlocks a pawn (with either 1 or 6), captures an opponent pawn, or lands a pawn on HOME.
- **Three consecutive 6s**: the turn is forfeited and the whole turn is rolled back to the snapshot taken at turn start (captures and moves from the first two 6s are undone). Clock, event log, RNG cursor and lifetime stats are excluded from the rollback.
- If the rolled value produces **no legal move**, the turn ends immediately with no extra roll (the consecutive-six counter still increments).
- **Capture:** landing on a non-safe ring cell captures every opponent color-group on that cell that contains **exactly one** pawn; captured pawns return to their yard (progress -1). A group of **2 or more same-color pawns is immune**.
- **Stacking:** unlimited pawns of any colors may share a cell. A stack is only immune to capture — opponents may freely **pass over** and **land on** it.
- No captures on safe squares or anywhere in a home column. Only the owning color may enter a home column.
- Exact count required to enter HOME (progress 56). Overshoot is illegal.

## Mode 1 — Classic

- Shared rules only. A player wins when all 4 pawns reach HOME.
- After the winner is decided, play **continues** among the rest for 2nd/3rd/4th; finished players are skipped and a persistent "Winner" banner is shown. Game ends when only one player remains unfinished.

## Mode 2 — X-Minute (timer)

- X is chosen at setup (presets 1/2/3/5/10 min + custom 1-30).
- All 4 pawns **start on their start square** (progress 0, fanned out visually) — no unlock needed at kickoff.
- A pawn captured mid-game returns to the **yard** and needs a 1 or 6 to re-enter.
- **Scoring:** +1 per step moved (ring **and** home column steps count); +30 for each capture; the victim loses points equal to the captured pawn's `progress` at capture time; +50 when a pawn reaches HOME. **Score floors at 0.**
- Entering the board from the yard is 0 steps, so it scores 0.
- When all 4 of a player's pawns are HOME they **all respawn into the yard** and must re-enter with a 1 or 6, so scoring continues to the buzzer.
- Per-turn countdown, default 20s: on expiry the engine auto-rolls and plays a random legal move.
- **Hard stop** at 00:00 — no new roll or move may begin; a move already committed resolves atomically, then the game ends.
- Ranking by score; tie-breaks in order: captures made, total distance travelled, then seat order.

## Mode 3 — Quick

- Shared rules apply (including 1-or-6 unlock).
- A player's home-column entrance is **locked until that player has captured at least one opponent pawn** (tracked **per player** — one capture frees all four of their pawns).
- While locked, a pawn that would pass progress 50 wraps to a new lap: `progress -= 51`, `laps += 1`. Ring position stays `(entry + progress) % 52`.
- **The first pawn of any player to reach HOME ends the game immediately** and that player wins. Others are ranked by `laps * 51 + progress` summed across pawns, tie-broken by captures.
- The UI shows a lock/chain overlay on the home entrance and a "Cut needed" badge until the player's first capture.

## Progress model

- `-1` = in yard
- `0..50` = on the ring; `ringIndex = (entryIndex + progress) % 52`
- `51..55` = the 5 colored home-column cells
- `56` = HOME (center triangle). Requires an exact roll.

## Safe squares

Ring indices `0, 8, 13, 21, 26, 34, 39, 47` plus every home-column cell.
