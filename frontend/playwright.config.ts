import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests against the real stack: FastAPI on :8001 and Vite on :5174, both started
 * here (separate ports, so they never collide with your dev servers) and backed by the
 * pantry_e2e database, which global-setup migrates and seeds.
 */
const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  'mysql+pymysql://pantry:pantry@127.0.0.1:3307/pantry_e2e?charset=utf8mb4'
const API_PORT = 8001
const WEB_PORT = 5174

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // 375 px wide: the tab bar replaces the top navigation.
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } } },
  ],
  webServer: [
    {
      command: `uv run uvicorn app.main:app --port ${API_PORT}`,
      cwd: '../backend',
      url: `http://localhost:${API_PORT}/api/health`,
      env: { DATABASE_URL: E2E_DATABASE_URL, CORS_ORIGINS: `["http://localhost:${WEB_PORT}"]` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { CHEF_API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})

export { E2E_DATABASE_URL }
