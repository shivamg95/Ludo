import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npx vite build && npx vite preview --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'ipad',
      use: {
        ...devices['Desktop Chrome'],
        viewport: devices['iPad Pro 11'].viewport,
        userAgent: devices['iPad Pro 11'].userAgent,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: devices['iPad Pro 11'].deviceScaleFactor,
      },
      testMatch: /a11y-touch|setup/,
    },
    {
      name: 'pixel',
      use: {
        ...devices['Desktop Chrome'],
        viewport: devices['Pixel 7'].viewport,
        userAgent: devices['Pixel 7'].userAgent,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor,
      },
      testMatch: /a11y-touch|setup/,
    },
  ],
});
