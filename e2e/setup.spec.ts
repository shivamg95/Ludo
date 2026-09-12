import { test, expect } from '@playwright/test';

test.describe('setup screen', () => {
  test('shows brand and mode cards', async ({ page }) => {
    await page.goto('/?anim=0');
    await expect(page.getByTestId('brand')).toHaveText('Ludo');
    await expect(page.getByTestId('app-version')).toHaveText(/^v\d+\.\d+\.\d+$/);
    await expect(page.getByTestId('check-updates')).toBeVisible();
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

  test('defaults to 2 humans', async ({ page }) => {
    await page.goto('/?anim=0');
    await expect(page.getByTestId('human-count')).toHaveText('2');
  });

  test('humans cannot go below 1', async ({ page }) => {
    await page.goto('/?anim=0');
    await page.getByTestId('human-dec').click();
    await expect(page.getByTestId('human-count')).toHaveText('1');
  });

  test('keeps player names after reload', async ({ page }) => {
    await page.goto('/?anim=0');
    await page.getByTestId('name-red').fill('Ada');
    await page.getByTestId('name-yellow').fill('Lin');
    await page.reload();
    await expect(page.getByTestId('name-red')).toHaveValue('Ada');
    await expect(page.getByTestId('name-yellow')).toHaveValue('Lin');
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

  test('duration panel sits between X-Minute and Quick', async ({ page }) => {
    await page.goto('/?anim=0');
    await page.getByTestId('mode-timed').click();
    await expect(page.getByTestId('duration-panel')).toBeVisible();
    const order = await page
      .locator('.mode-grid > *')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
    expect(order).toEqual(['mode-classic', 'mode-timed', 'duration-panel', 'mode-quick']);
  });

  test('starts a classic game', async ({ page }) => {
    await page.goto('/?anim=0');
    await page.getByTestId('start-game').click();
    await expect(page.getByTestId('game-screen')).toBeVisible();
    await expect(page.getByTestId('board-svg')).toBeVisible();
  });
});
