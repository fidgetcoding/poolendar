import { defineConfig, devices } from '@playwright/test'

// E2E targets an external stack when E2E_BASE is set (CI / live Supabase);
// otherwise Playwright boots the web app itself on a dedicated port. The
// DB-dependent specs skip themselves when E2E_BASE is unset, so `--list` and the
// smoke test work without a backend.
const E2E_BASE = process.env.E2E_BASE
const PORT = 3999

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: E2E_BASE || `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: E2E_BASE
    ? undefined
    : {
        command: `pnpm --filter @poolendar/web dev --port ${PORT}`,
        url: `http://127.0.0.1:${PORT}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
