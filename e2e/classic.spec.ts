import { test, expect } from '@playwright/test';

type LudoHook = {
  setBotDelay: (n: number) => void;
  setDiceQueue: (d: number[]) => void;
  store: { getState: () => { movePawn: (id: string) => void; roll: () => void; game: unknown } };
};

async function boot(page: import('@playwright/test').Page, dice: number[]) {
  await page.goto('/?anim=0&autostart=1&mode=classic&seed=99');
  await expect(page.getByTestId('game-screen')).toBeVisible();
  await page.waitForFunction(() => !!(window as unknown as { __ludo?: unknown }).__ludo);
  await page.evaluate((q) => {
    const ludo = (window as unknown as { __ludo: LudoHook }).__ludo;
    ludo.setBotDelay(0);
    ludo.setDiceQueue(q);
  }, dice);
}

async function rollAndMove(page: import('@playwright/test').Page, pawnId: string) {
  await page.getByTestId('dice-button').click();
  await page.evaluate((id) => {
    (window as unknown as { __ludo: LudoHook }).__ludo.store.getState().movePawn(id);
  }, pawnId);
}

test.describe('classic mode', () => {
  test('scripted unlock and move via dice queue', async ({ page }) => {
    await boot(page, [6, 2]);
    await rollAndMove(page, 'pawn-red-0');
    await expect(page.getByTestId('pawn-red-0')).toHaveAttribute('data-progress', '0');
    await rollAndMove(page, 'pawn-red-0');
    await expect(page.getByTestId('pawn-red-0')).toHaveAttribute('data-progress', '2');
    await expect(page.getByTestId('progress-red')).toHaveText('1%');
  });

  test('reload mid-game restores state', async ({ page }) => {
    await boot(page, [6]);
    await rollAndMove(page, 'pawn-red-0');
    await expect(page.getByTestId('pawn-red-0')).toHaveAttribute('data-progress', '0');
    await page.reload();
    await expect(page.getByTestId('game-screen')).toBeVisible();
    await expect(page.getByTestId('pawn-red-0')).toHaveAttribute('data-progress', '0');
  });
});
