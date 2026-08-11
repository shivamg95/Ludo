# Ludo

Premium web Ludo with **Classic**, **X-Minute**, and **Quick** modes.

## Stack

Vite 8 · React 19 · TypeScript 7 · Tailwind 4 · Zustand · Motion · Vitest · Playwright

## Scripts

```bash
npm install
npm run dev          # local app
npm run typecheck
npm run lint
npm run test:unit    # engine + bot (+ coverage with --coverage)
npm run test:e2e     # Playwright (Chromium)
npm run verify       # typecheck + lint + unit coverage + e2e
```

## Rules

Canonical rules live in [`docs/RULES.md`](docs/RULES.md). The pure engine under `src/engine/` has no React, `Date.now()`, or `Math.random()`.

## Test hooks

In the browser (dev/test builds):

```js
window.__ludo.setDiceQueue([6, 2, 1])
window.__ludo.setSeed(42)
window.__ludo.setBotDelay(0)
window.__ludo.advanceClock(60_000)
window.__ludo.getState()
```

URL params: `?seed=&dice=&mode=&anim=0&autostart=1`
