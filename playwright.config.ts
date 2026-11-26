import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PREVIEW_PORT || '4321';
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // WebKit projects added 2026-06-11: every defect cluster on this site
    // (mask-image, backdrop-filter url(), reveal opacity, lightbox crash)
    // was iOS/WebKit-specific and found by John post-deploy. Catch it here.
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'iphone',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: process.env.PREVIEW_PORT ? `npx astro preview --port ${PORT} --ignore-lock` : 'npm run preview',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI && !process.env.PREVIEW_PORT,
    timeout: 120000,
  },
});
