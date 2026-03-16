import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env' });
dotenvConfig({ path: '.env.local', override: true });

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 7000,
  },
  retries: 2,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3002',
    actionTimeout: 10000,
    navigationTimeout: 30000,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
  globalSetup: require.resolve('./scripts/cleanup-e2e.ts'),
  webServer: {
    command: 'PORT=3002 NEXT_PUBLIC_USE_MOCK_AUTH=true npm run dev',
    url: 'http://localhost:3002',
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      ...process.env,
      PORT: '3002',
      NEXT_PUBLIC_USE_MOCK_AUTH: 'true',
    },
  },
});
