import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env' });
dotenvConfig({ path: '.env.local', override: true });

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 7000,
  },
  retries: 2,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    actionTimeout: 10000,
    navigationTimeout: 15000,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
  globalSetup: require.resolve('./scripts/cleanup-e2e.ts'),
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: true,
  //   timeout: 120000,
  // },
});
