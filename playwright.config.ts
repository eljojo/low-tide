import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'e2e/tmp/playwright-report' }]],
  outputDir: 'e2e/tmp/test-results',
  use: {
    baseURL: 'http://127.0.0.1:8081',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'rm -rf e2e/tmp && mkdir -p e2e/tmp && env LOWTIDE_CONFIG=e2e/configs/test-config.yaml ./low-tide',
    url: 'http://127.0.0.1:8081',
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
