import { defineConfig, devices } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Chromium: CI downloads the pinned build; sandboxes with a preinstalled browser set
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH or keep it under /opt/pw-browsers (discovered here).
 * `playwright install` is never run by this suite.
 */
function chromiumExecutable(): string | undefined {
  const fromEnv = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const dir of readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
    for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const candidate = path.join(root, dir, sub);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

export default defineConfig({
  testDir: './tests',
  // One worker, files in order: authservice's per-IP limiter allows 20 auth calls/minute and every
  // call from the web container shares one IP. Journeys 02 -> 03 also hand data to each other.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    locale: 'pl-PL',
    launchOptions: { executablePath: chromiumExecutable() },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
