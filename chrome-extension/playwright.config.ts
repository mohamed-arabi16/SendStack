import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 0,
  reporter: [['list']],
  use: {
    // Extensions require headful Chrome
    headless: false,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // Build the extension before running tests
  globalSetup: path.resolve('./tests/e2e/global-setup.ts'),
});
