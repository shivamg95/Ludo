import { test, expect } from '@playwright/test';

test.describe('setup screen', () => {
  test('shows brand and mode cards', async ({ page }) => {
    await page.goto('/?anim=0');
    await expect(page.getByTestId('brand')).toHaveText('Ludo');
    await expect(page.getByTestId('mode-classic')).toBeVisible();
    await expect(page.getByTestId('mode-timed')).toBeVisible();
    await expect(page.getByTestId('mode-quick')).toBeVisible();
  });

  test('cannot start with fewer than 2 players via UI constraints', async ({ page }) => {
    await page.goto('/?anim=0');
    await expect(page.getByTestId('total-players')).toHaveText('2');
    // Dec button keeps floor at 2
    await page.getByTestId('total-dec').click();
    await expect(page.getByTestId('total-players')).toHaveText('2');
    await expect(page.getByTestId('start-game')).toBeEnabled();
  });

  test('humans cannot go below 1', async ({ page }) => {
    await page.goto('/?anim=0');
    await page.getByTestId('human-dec').click();
    await expect(page.getByTestId('human-count')).toHaveText('1');
  });

  test('2/3/4 player seat placement', async ({ page }) => {
    await page.goto('/?anim=0');
    await expect(page.getByTestId('name-red')).toBeVisible();
    await expect(page.getByTestId('name-yellow')).toBeVisible();

    await page.getByTestId('total-inc').click();
    await expect(page.getByTestId('total-players')).toHaveText('3');
    await expect(page.getByTestId('name-green')).toBeVisible();

    await page.getByTestId('total-inc').click();
    await expect(page.getByTestId('total-players')).toHaveText('4');
    await expect(page.getByTestId('name-blue')).toBeVisible();
  });

  test('starts a classic game', async ({ page }) => {
    await page.goto('/?anim=0');
    await page.getByTestId('start-game').click();
    await expect(page.getByTestId('game-screen')).toBeVisible();
    await expect(page.getByTestId('board-svg')).toBeVisible();
  });
});
