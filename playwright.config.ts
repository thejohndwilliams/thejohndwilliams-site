import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4321',
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
  webServer: [
    {
      command: 'npm run preview',
      url: 'http://localhost:4321',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    // Placeholder case study only. astro preview always serves dist/, so
    // this build uses its own directory and a static file server. The dev
    // toolbar never enters the page. Production preview above stays flag-off.
    // reuseExistingServer stays off: a leftover dev server on this port
    // would hide the static flag-on build.
    {
      command: 'npx astro build --outDir dist-case-study && python3 -m http.server 4391 --bind 127.0.0.1 --directory dist-case-study',
      url: 'http://127.0.0.1:4391/work/',
      reuseExistingServer: false,
      timeout: 180000,
      env: {
        ...process.env,
        PUBLIC_SHOW_CASE_STUDY: 'true',
      },
    },
  ],
});
