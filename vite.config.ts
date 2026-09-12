import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8')) as {
  version: string;
};

// GitHub Pages serves this project from /<repo>/, so the build needs a base path.
// Local dev, preview and Playwright keep the default '/'.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION ?? pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Ludo',
        short_name: 'Ludo',
        description: 'Classic, X-Minute and Quick Ludo',
        theme_color: '#05070d',
        background_color: '#05070d',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        icons: [
          {
            src: `${base}favicon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts', 'src/bot/**/*.ts'],
      exclude: [
        'src/engine/**/*.test.ts',
        'src/bot/**/*.test.ts',
        'src/engine/fuzz.test.ts',
        'src/engine/index.ts',
        'src/bot/index.ts',
        'src/engine/modes/index.ts',
        'src/engine/modes/types.ts',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 80,
        statements: 90,
      },
    },
  },
});
