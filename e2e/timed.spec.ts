import { test, expect } from '@playwright/test';

test.describe('timed mode', () => {
  test('scores steps and hard-stops via injected clock', async ({ page }) => {
    await page.goto('/?anim=0');
    await page.getByTestId('mode-timed').click();
    await page.getByTestId('duration-1').click();
    await page.getByTestId('turn-timer-toggle').uncheck();
    await page.getByTestId('start-game').click();
    await expect(page.getByTestId('game-screen')).toBeVisible();

    await page.waitForFunction(() => !!(window as unknown as { __ludo?: unknown }).__ludo);
    await page.evaluate(() => {
      const ludo = (
        window as unknown as {
          __ludo: {
            setBotDelay: (n: number) => void;
            setDiceQueue: (d: number[]) => void;
            store: { getState: () => { movePawn: (id: string) => void } };
          };
        }
      ).__ludo;
      ludo.setBotDelay(0);
      ludo.setDiceQueue([4]);
    });

    await page.getByTestId('dice-button').click();
    await page.evaluate(() => {
      (
        window as unknown as {
          __ludo: { store: { getState: () => { movePawn: (id: string) => void } } };
        }
      ).__ludo.store.getState().movePawn('pawn-red-0');
    });
    await expect(page.getByTestId('score-red')).toHaveText('4');

    await page.evaluate(() => {
      (
        window as unknown as { __ludo: { advanceClock: (ms: number) => void } }
      ).__ludo.advanceClock(60_000);
    });
    await expect(page.getByTestId('results-screen')).toBeVisible({ timeout: 5000 });
  });
});
