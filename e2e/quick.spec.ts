import { test, expect } from '@playwright/test';

test.describe('quick mode', () => {
  test('shows cut-needed badge and home lock before capture', async ({ page }) => {
    await page.goto('/?anim=0&autostart=1&mode=quick&seed=5');
    await expect(page.getByTestId('game-screen')).toBeVisible();
    await expect(page.getByTestId('cut-needed-red')).toBeVisible();
    await expect(page.getByTestId('home-lock-red')).toBeVisible();
  });

  test('lap wrap at progress 50 before capture', async ({ page }) => {
    await page.goto('/?anim=0&autostart=1&mode=quick&seed=5');
    await page.waitForFunction(() => !!(window as unknown as { __ludo?: unknown }).__ludo);

    await page.evaluate(() => {
      const ludo = (
        window as unknown as {
          __ludo: {
            setBotDelay: (n: number) => void;
            setDiceQueue: (d: number[]) => void;
            store: {
              getState: () => {
                game: {
                  players: {
                    seat: number;
                    pawns: { index: number; progress: number }[];
                  }[];
                } | null;
                movePawn: (id: string) => void;
              };
              setState: (p: unknown) => void;
            };
          };
        }
      ).__ludo;
      ludo.setBotDelay(0);
      const state = ludo.store.getState();
      const game = structuredClone(state.game!);
      game.players = game.players.map((p) =>
        p.seat !== 0
          ? p
          : {
              ...p,
              pawns: p.pawns.map((pawn, i) =>
                i === 0 ? { ...pawn, progress: 50 } : pawn,
              ),
            },
      );
      ludo.store.setState({ game });
      ludo.setDiceQueue([1]);
    });

    await page.getByTestId('dice-button').click();
    await page.evaluate(() => {
      (
        window as unknown as {
          __ludo: { store: { getState: () => { movePawn: (id: string) => void } } };
        }
      ).__ludo.store.getState().movePawn('pawn-red-0');
    });
    await expect(page.getByTestId('pawn-red-0')).toHaveAttribute('data-progress', '0');
  });
});
