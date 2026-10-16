import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [['list'], ['html', { outputFolder: 'evidence/playwright-report', open: 'never' }]],
  outputDir: 'test-results',
  use: { baseURL: 'http://127.0.0.1:5373', viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview -- --port 5373 --strictPort --host 127.0.0.1', url: 'http://127.0.0.1:5373', reuseExistingServer: true },
})
