import { test, expect } from '@playwright/test';

type Store = {
  getState: () => {
    game: {
      version: number;
      rankings: number[];
      players: { color: string; finishedRank: number | null; pawns: { progress: number }[] }[];
    };
    setSetup: (p: { totalPlayers: number; humanCount: number }) => void;
    startGame: (o: { seed: number }) => void;
  };
  setState: (s: unknown) => void;
};

type LudoHook = { store: Store; setBotDelay: (n: number) => void };

test.describe('polish', () => {
  test('pawn skin choice persists across reloads', async ({ page }) => {
    await page.goto('/?anim=0');
    await page.getByTestId('skin-marble').click();
    await expect(page.getByTestId('skin-marble')).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.getByTestId('skin-marble')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('skin-arcade')).toHaveAttribute('aria-pressed', 'false');
  });

  test('a mid-game finish celebrates without resizing the board', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?anim=0');
    await page.waitForFunction(() => !!(window as unknown as { __ludo?: unknown }).__ludo);
    await page.evaluate(() => {
      const ludo = (window as unknown as { __ludo: LudoHook }).__ludo;
      ludo.store.getState().setSetup({ totalPlayers: 4, humanCount: 4 });
      ludo.store.getState().startGame({ seed: 3 });
    });
    const board = page.getByTestId('board-wrap');
    await expect(board).toBeVisible();
    const before = await board.boundingBox();

    await page.evaluate(() => {
      const { store } = (window as unknown as { __ludo: LudoHook }).__ludo;
      const g = store.getState().game;
      const players = g.players.map((p) =>
        p.color === 'green'
          ? { ...p, finishedRank: 1, pawns: p.pawns.map((x) => ({ ...x, progress: 56 })) }
          : p,
      );
      store.setState({ game: { ...g, players, rankings: [1], version: g.version + 1 } });
    });

    await expect(page.getByTestId('finish-celebration')).toBeVisible();
    await expect(page.getByTestId('finish-celebration')).toContainText('finishes 1st');
    await expect(page.getByTestId('medal-green')).toBeVisible();
    const after = await board.boundingBox();
    expect(after).toEqual(before);
  });

  test('settings popover switches pawn skin in game', async ({ page }) => {
    await page.goto('/?anim=0&autostart=1&mode=classic&seed=5');
    await expect(page.getByTestId('game-screen')).toBeVisible();
    await page.getByTestId('toggle-settings').click();
    await expect(page.getByTestId('settings-sheet')).toBeVisible();
    await page.getByTestId('settings-sheet').getByTestId('skin-gem').click();
    await expect(page.getByTestId('skin-gem')).toHaveAttribute('aria-pressed', 'true');
  });
});
