import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'generated.spec.ts',
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 15_000,
  globalTimeout: 30_000,
  outputDir: '/tmp/qa-bonus-output/test-results',
  reporter: [
    ['list'],
    ['json', { outputFile: '/tmp/qa-bonus-output/playwright.json' }],
    ['html', { outputFolder: '/tmp/qa-bonus-output/html', open: 'never' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
    testIdAttribute: 'data-test',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node sandbox.cjs serve',
    url: 'http://127.0.0.1:4173',
    timeout: 5_000,
  },
});
