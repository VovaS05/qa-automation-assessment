import { defineConfig, devices } from '@playwright/test';

const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  forbidOnly: ci,
  workers: 3,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    {
      name: 'ui',
      testMatch: '**/ui/**/*.spec.ts',
      fullyParallel: true,
      retries: ci ? 1 : 0,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.SAUCEDEMO_BASE_URL ?? 'https://www.saucedemo.com',
        testIdAttribute: 'data-test',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
      },
    },
    {
      name: 'api',
      testMatch: '**/api/**/*.spec.ts',
      workers: 1,
      retries: 0,
      use: {
        baseURL: process.env.BOOKER_BASE_URL ?? 'https://restful-booker.herokuapp.com',
      },
    },
  ],
});
