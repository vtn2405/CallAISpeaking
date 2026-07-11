import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for the ChatboxAI frontend.
 *
 * Key decisions:
 *   - NEXT_PUBLIC_PIPECAT_WS_URL is injected via webServer.env so Next.js
 *     picks it up at build/runtime. Do NOT use extraHTTPHeaders for this.
 *   - The URL points to a pattern that Playwright's routeWebSocket() will
 *     intercept before any real network connection is made.
 *   - microphone permission is granted at the browser context level to
 *     prevent permission popups (or silent permission denial) on all machines.
 */

const WS_MOCK_URL = 'ws://localhost:3000/ws/sessions';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',

  /* Fail fast on CI, keep going locally */
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // single worker keeps WS mock state predictable

  /* Reporter */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:3000',

    /* Grant mic permission so getUserMedia doesn't block or pop up */
    permissions: ['microphone'],

    /* Capture evidence on failure */
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start Next.js dev server before running tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      /**
       * Force WsTransport (instead of MockTransport) so Playwright can
       * intercept WebSocket frames deterministically via routeWebSocket().
       * The pattern must match what wsTransport.ts appends sessionId to.
       */
      NEXT_PUBLIC_PIPECAT_WS_URL: WS_MOCK_URL,
    },
  },
});

/** Export for use in helpers/spec files */
export { WS_MOCK_URL };
