import fs from 'node:fs';
import { defineConfig } from '@playwright/test';

const systemChromium = '/usr/bin/chromium';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ?? (fs.existsSync(systemChromium) ? systemChromium : undefined);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/FakeMS/',
    viewport: { width: 1024, height: 768 },
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: ['--no-sandbox'],
    },
  },
  webServer: {
    command: 'VITE_BUILD_ID=e2e npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/FakeMS/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
