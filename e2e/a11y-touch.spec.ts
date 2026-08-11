import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('accessibility and touch', () => {
  test('setup screen has no serious axe violations', async ({ page }) => {
    await page.goto('/?anim=0');
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? ''),
    );
    expect(serious).toEqual([]);
  });

  test('keyboard can roll dice', async ({ page }) => {
    await page.goto('/?anim=0&autostart=1&mode=classic&seed=3&dice=6');
    await expect(page.getByTestId('game-screen')).toBeVisible();
    await page.waitForFunction(() => !!(window as unknown as { __ludo?: unknown }).__ludo);
    await page.evaluate(() => {
      (
        window as unknown as { __ludo: { setBotDelay: (n: number) => void; setDiceQueue: (d: number[]) => void } }
      ).__ludo.setBotDelay(0);
      (
        window as unknown as { __ludo: { setDiceQueue: (d: number[]) => void } }
      ).__ludo.setDiceQueue([6]);
    });
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('dice-face')).toHaveAttribute('data-value', '6');
  });

  test('board is fully visible', async ({ page }) => {
    await page.goto('/?anim=0&autostart=1&seed=1');
    const box = await page.getByTestId('board-wrap').boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
  });

  test('visual snapshot of setup', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'baseline snapshot on desktop chromium only');
    await page.goto('/?anim=0');
    await expect(page.getByTestId('setup-screen')).toBeVisible();
    await expect(page).toHaveScreenshot('setup.png', {
      maxDiffPixelRatio: 0.08,
      animations: 'disabled',
    });
  });
});
