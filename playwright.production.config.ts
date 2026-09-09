import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/production',
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  outputDir: 'test-results-production',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-production' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'production-chromium', use: { ...devices['Desktop Chrome'] } }],
});
