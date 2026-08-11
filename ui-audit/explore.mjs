import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:5173';
const OUT = path.resolve('ui-audit/shots');
fs.mkdirSync(OUT, { recursive: true });

const findings = [];

function note(severity, area, msg) {
  findings.push({ severity, area, msg });
  console.log(`[${severity}] ${area}: ${msg}`);
}

async function checkOverflow(page, label) {
  const issues = await page.evaluate(() => {
    const out = [];
    const docW = document.documentElement.clientWidth;
    const docH = document.documentElement.clientHeight;
    const els = [...document.querySelectorAll('[data-testid]')];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > docW + 4)
        out.push({ testid: el.getAttribute('data-testid'), overflow: 'right', right: Math.round(r.right), docW });
      if (r.bottom > docH + 12)
        out.push({ testid: el.getAttribute('data-testid'), overflow: 'bottom', bottom: Math.round(r.bottom), docH });
      if (r.left < -4) out.push({ testid: el.getAttribute('data-testid'), overflow: 'left', left: Math.round(r.left) });
    }
    return {
      overflows: out,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      scrollH: document.documentElement.scrollHeight,
      clientH: document.documentElement.clientHeight,
    };
  });
  if (issues.overflows.length) {
    note('glitch', label, `overflow: ${JSON.stringify(issues.overflows.slice(0, 10))}`);
  }
  if (issues.scrollW > issues.clientW + 2) {
    note('glitch', label, `horizontal page scroll ${issues.scrollW} > ${issues.clientW}`);
  }
  return issues;
}

async function detectPawnOcclusion(page, label) {
  const hits = await page.evaluate(() => {
    const movable = [...document.querySelectorAll('[data-testid^="pawn-"][tabindex="0"]')];
    const problems = [];
    for (const el of movable) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      const topId = top?.getAttribute?.('data-testid') || top?.tagName;
      const selfId = el.getAttribute('data-testid');
      if (topId && topId !== selfId && String(topId).startsWith('pawn-')) {
        problems.push({ movable: selfId, blockedBy: topId, cx: Math.round(cx), cy: Math.round(cy) });
      }
    }
    return problems;
  });
  if (hits.length) note('glitch', label, `movable pawns occluded: ${JSON.stringify(hits)}`);
  return hits;
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('shot', name);
  return file;
}

async function playTurns(page, n) {
  for (let t = 0; t < n; t++) {
    const done = await page.evaluate(async () => {
      const st = window.__ludo.store.getState();
      const g = st.game;
      if (!g || g.phase === 'finished' || st.screen === 'results') return true;
      const seat = g.config.seats[g.currentSeatIndex];
      const player = g.players.find((p) => p.seat === seat);
      if (player?.isBot) return false;
      if (g.phase === 'waiting_roll') {
        st.roll();
        return false;
      }
      if (g.phase === 'waiting_move' && g.legalMoves[0]) {
        st.movePawn(g.legalMoves[0].pawnId);
        return false;
      }
      return false;
    });
    if (done) break;
    await page.waitForTimeout(120);
  }
}

async function auditDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => note('error', 'console', e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') note('error', 'console', msg.text());
  });

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.getByTestId('setup-screen').waitFor();
  await shot(page, '01-setup-desktop-dark');
  await checkOverflow(page, 'setup-desktop');

  const fonts = await page.evaluate(() => {
    const brand = document.querySelector('[data-testid="brand"]');
    const cs = getComputedStyle(brand);
    return { family: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight };
  });
  note('info', 'typography', JSON.stringify(fonts));

  // Mode cards — flat gradient blocks, no illustrations
  const modeArt = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="mode-"]')].map((el) => {
      const art = el.querySelector('div');
      const cs = art ? getComputedStyle(art) : null;
      return {
        id: el.getAttribute('data-testid'),
        hasImg: !!el.querySelector('img,svg'),
        artBg: cs?.backgroundImage || cs?.backgroundColor,
      };
    }),
  );
  note('info', 'setup-modes', JSON.stringify(modeArt));
  if (modeArt.every((m) => !m.hasImg)) {
    note('gap', 'setup', 'mode cards use flat gradient rectangles — no animated illustrations');
  }

  await page.getByTestId('mode-timed').click();
  await shot(page, '02-setup-timed');
  await page.getByTestId('mode-quick').click();
  await shot(page, '03-setup-quick');
  await page.getByTestId('mode-classic').click();
  await page.getByTestId('theme-toggle').click();
  await shot(page, '04-setup-light');
  await page.getByTestId('theme-toggle').click();

  // 4 players, 1 human
  for (let i = 0; i < 3; i++) await page.getByTestId('total-dec').click().catch(() => {});
  for (let i = 0; i < 2; i++) await page.getByTestId('total-inc').click();
  for (let i = 0; i < 4; i++) await page.getByTestId('human-dec').click().catch(() => {});
  await page.getByTestId('human-inc').click();

  await page.getByTestId('start-game').click();
  await page.getByTestId('game-screen').waitFor();
  await page.waitForFunction(() => !!window.__ludo);
  await page.evaluate(() => window.__ludo.setBotDelay(40));
  await shot(page, '05-game-start-desktop');
  await checkOverflow(page, 'game-desktop-start');

  const layout = await page.evaluate(() => {
    const board = document.querySelector('[data-testid="board-wrap"]')?.getBoundingClientRect();
    const hud = document.querySelector('[data-testid="hud"]')?.getBoundingClientRect();
    const svg = document.querySelector('[data-testid="board-svg"]');
    const cells = [...svg.querySelectorAll('rect')].slice(0, 5).map((r) => ({
      fill: r.getAttribute('fill'),
      stroke: r.getAttribute('stroke'),
    }));
    const pawns = [...document.querySelectorAll('circle[data-testid^="pawn-"]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.getAttribute('data-testid'), w: Math.round(r.width), h: Math.round(r.height) };
    });
    return {
      board: board && { w: Math.round(board.width), h: Math.round(board.height) },
      hud: hud && { w: Math.round(hud.width), h: Math.round(hud.height), right: Math.round(hud.right) },
      cells,
      pawns: pawns.slice(0, 4),
      minPawn: Math.min(...pawns.map((p) => p.w)),
      viewportW: window.innerWidth,
    };
  });
  note('info', 'layout', JSON.stringify(layout));
  if (layout.board && Math.abs(layout.board.w - layout.board.h) > 4) {
    note('glitch', 'board', `board not square: ${layout.board.w}x${layout.board.h}`);
  }
  if (layout.hud && layout.hud.right > layout.viewportW + 2) {
    note('glitch', 'hud', `HUD clipped off right edge (right=${layout.hud.right}, vw=${layout.viewportW})`);
  }
  if (layout.minPawn < 44) {
    note('glitch', 'touch', `pawn hit size ~${layout.minPawn}px (<44px target)`);
  }

  // Flat board look
  note('gap', 'board', 'cells are flat #d9e0ea/#f4f7fb fills with hard stroke — no soft inset, wood/felt texture, or depth');
  note('gap', 'pawns', 'pawns are flat filled circles — no 3D token, gloss, shadow, or seat emblem');
  note('gap', 'dice', 'Dice component always receives rolling={false} from HUD — no roll animation');
  note('gap', 'motion', 'pawn moves use single spring to end cell — not hop-along-path waypoints');
  note('gap', 'feedback', 'no destination preview / path highlight before selecting a pawn');
  note('gap', 'sfx', 'move-log shows raw event types (rolled/moved) — not human-readable premium copy');

  await page.evaluate(() => {
    window.__ludo.setDiceQueue([
      6, 6, 4, 6, 3, 6, 5, 6, 2, 1, 6, 6, 1, 4, 5, 6, 3, 2, 6, 4, 5, 6, 1, 3, 6, 2, 4, 6, 5, 3, 6, 1, 2, 6, 4,
    ]);
  });

  await playTurns(page, 6);
  await shot(page, '06-game-after-unlock');
  await playTurns(page, 10);
  await shot(page, '07-game-mid');
  await detectPawnOcclusion(page, 'game-mid-occlusion');

  // Force a stacked-cell occlusion scenario if possible
  await page.evaluate(() => {
    const st = window.__ludo.store.getState();
    if (st.game?.phase === 'waiting_roll') st.roll();
  });
  await page.waitForTimeout(200);
  await detectPawnOcclusion(page, 'after-roll-occlusion');
  await shot(page, '08-game-legal-moves');
  await checkOverflow(page, 'game-desktop-mid');

  // Active player glow present?
  const activeCard = await page.locator('[data-testid^="player-card-"][data-active="true"]').count();
  note('info', 'hud', `active player cards: ${activeCard}`);

  await page.getByTestId('quit-game').click();
  await page.getByTestId('setup-screen').waitFor();

  // Quick mode
  await page.getByTestId('mode-quick').click();
  await page.getByTestId('start-game').click();
  await page.getByTestId('game-screen').waitFor();
  await page.waitForFunction(() => !!window.__ludo);
  await page.evaluate(() => window.__ludo.setBotDelay(30));
  await shot(page, '10-quick-locks');
  const locks = await page.locator('[data-testid^="home-lock-"]').count();
  const badges = await page.locator('[data-testid^="cut-needed-"]').count();
  note('info', 'quick', `locks=${locks} cut-badges=${badges}`);
  if (locks === 0) note('glitch', 'quick', 'expected home-lock overlays missing');
  await checkOverflow(page, 'quick-desktop');

  await page.getByTestId('quit-game').click();
  await page.getByTestId('mode-timed').click();
  await page.getByTestId('start-game').click();
  await page.getByTestId('game-screen').waitFor();
  await shot(page, '11-timed-start');
  const clock = await page.getByTestId('game-clock').textContent();
  note('info', 'timed', `clock shows "${clock}"`);
  await checkOverflow(page, 'timed-desktop');

  // Reach results via fast play (2p)
  await page.goto(`${BASE}/?anim=0&autostart=1&mode=classic&seed=7`);
  await page.getByTestId('game-screen').waitFor({ timeout: 8000 });
  await page.waitForFunction(() => !!window.__ludo);
  await page.evaluate(() => {
    window.__ludo.setBotDelay(0);
    window.__ludo.setDiceQueue(Array.from({ length: 400 }, (_, i) => ([6, 6, 5, 6, 4, 6, 3, 6, 2, 6, 1][i % 11])));
  });
  for (let i = 0; i < 250; i++) {
    const screen = await page.evaluate(() => {
      const st = window.__ludo.store.getState();
      const g = st.game;
      if (!g) return st.screen;
      if (g.phase === 'finished') return 'finished';
      if (st.screen === 'results') return 'results';
      if (g.phase === 'waiting_roll') st.roll();
      else if (g.phase === 'waiting_move' && g.legalMoves[0]) st.movePawn(g.legalMoves[0].pawnId);
      return st.screen;
    });
    if (screen === 'results' || screen === 'finished') break;
  }
  await page.waitForTimeout(300);
  if (await page.getByTestId('results-screen').count()) {
    await shot(page, '12-results');
    await checkOverflow(page, 'results');
    note('gap', 'results', 'results are plain ranked list — no podium, confetti, or celebration motion');
  } else {
    await shot(page, '12-still-in-game');
    note('info', 'results', `did not reach results; screen=${await page.evaluate(() => window.__ludo?.store.getState().screen)}`);
  }

  await page.close();
}

async function auditMobile(browser) {
  const pixel = devices['Pixel 7'];
  const context = await browser.newContext({ ...pixel });
  const page = await context.newPage();
  page.on('pageerror', (e) => note('error', 'mobile', e.message));

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await shot(page, '20-setup-mobile');
  await checkOverflow(page, 'setup-mobile');

  // setup scroll: body overflow hidden may clip setup content
  const setupScroll = await page.evaluate(() => {
    const screen = document.querySelector('[data-testid="setup-screen"]');
    return {
      bodyOverflow: getComputedStyle(document.body).overflow,
      screenScrollH: screen?.scrollHeight,
      screenClientH: screen?.clientHeight,
      canScroll: screen ? screen.scrollHeight > screen.clientHeight + 4 : false,
      startBtnBottom: document.querySelector('[data-testid="start-game"]')?.getBoundingClientRect().bottom,
      vh: window.innerHeight,
    };
  });
  note('info', 'setup-mobile-scroll', JSON.stringify(setupScroll));
  if (setupScroll.startBtnBottom > setupScroll.vh && !setupScroll.canScroll) {
    note('glitch', 'setup-mobile', 'Start button below fold and setup cannot scroll');
  }

  await page.getByTestId('start-game').click();
  await page.getByTestId('game-screen').waitFor();
  await page.waitForFunction(() => !!window.__ludo);
  await page.evaluate(() => window.__ludo.setBotDelay(40));
  await shot(page, '21-game-mobile-portrait');
  await checkOverflow(page, 'game-mobile');

  const vis = await page.evaluate(() => {
    const board = document.querySelector('[data-testid="board-wrap"]').getBoundingClientRect();
    const hud = document.querySelector('[data-testid="hud"]').getBoundingClientRect();
    const dice = document.querySelector('[data-testid="dice-button"]').getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    return {
      board: { top: Math.round(board.top), bottom: Math.round(board.bottom), h: Math.round(board.height), w: Math.round(board.width) },
      hud: { top: Math.round(hud.top), bottom: Math.round(hud.bottom), h: Math.round(hud.height) },
      diceInView: dice.top >= 0 && dice.bottom <= vh + 2,
      boardInView: board.top >= -2 && board.bottom <= vh + 4,
      hudClipped: hud.bottom > vh + 4,
      vh,
      vw,
      gapBoardHud: Math.round(hud.top - board.bottom),
    };
  });
  note('info', 'mobile-layout', JSON.stringify(vis));
  if (!vis.boardInView) note('glitch', 'mobile', 'board not fully visible in portrait');
  if (!vis.diceInView) note('glitch', 'mobile', 'dice not fully in viewport');
  if (vis.hudClipped) note('glitch', 'mobile', 'HUD clipped below fold — must scroll mid-turn');
  if (vis.board.h < 180) note('glitch', 'mobile', `board too small (${vis.board.h}px)`);

  // landscape
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(250);
  await shot(page, '22-game-mobile-landscape');
  await checkOverflow(page, 'game-mobile-landscape');
  const land = await page.evaluate(() => {
    const board = document.querySelector('[data-testid="board-wrap"]').getBoundingClientRect();
    const hud = document.querySelector('[data-testid="hud"]').getBoundingClientRect();
    return {
      board: { w: Math.round(board.width), h: Math.round(board.height), bottom: Math.round(board.bottom) },
      hud: { w: Math.round(hud.width), h: Math.round(hud.height), top: Math.round(hud.top) },
      vh: window.innerHeight,
      boardClipped: board.bottom > window.innerHeight + 4 || board.height < 120,
      usesRowLayout: Math.abs(board.top - hud.top) < 40 && hud.left > board.right - 20,
    };
  });
  note('info', 'landscape', JSON.stringify(land));
  if (land.boardClipped) note('glitch', 'landscape', 'board clipped/tiny in landscape');
  if (!land.usesRowLayout && land.vh < 500) {
    note('gap', 'landscape', 'portrait column layout persists in short landscape — board + HUD fight for height');
  }

  await page.setViewportSize({ width: 834, height: 1194 });
  await page.goto(`${BASE}/?autostart=1&mode=classic&seed=3`);
  await page.getByTestId('game-screen').waitFor();
  await shot(page, '23-game-tablet');
  await checkOverflow(page, 'tablet');

  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await auditDesktop(browser);
  await auditMobile(browser);
} finally {
  await browser.close();
}

fs.writeFileSync('ui-audit/findings.json', JSON.stringify(findings, null, 2));
console.log('\n=== SUMMARY ===');
const by = Object.groupBy(findings, (f) => f.severity);
for (const [k, v] of Object.entries(by ?? {})) console.log(`${k}: ${v.length}`);
console.log(JSON.stringify(findings.filter((f) => f.severity === 'glitch' || f.severity === 'error'), null, 2));
