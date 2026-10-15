import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'apps/client/e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1366, height: 768 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } }],
  webServer: {
    command: 'npm run dev -w @eoc/client -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
