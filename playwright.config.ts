import { defineConfig, devices } from '@playwright/test';

// Server uji terpisah (port 5212): PostgreSQL lokal (TEST_DATABASE_URL) berisi data demo yang dibuat ulang setiap run,
// plus Supabase Auth & Storage tiruan (tests/e2e/server.ts). Jalankan `npm run build` dulu (frontend dari dist/).
const PORT = 5212;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npx tsx tests/e2e/server.ts',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PORT: String(PORT) },
  },
});
