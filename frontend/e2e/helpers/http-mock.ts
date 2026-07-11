import type { Page } from '@playwright/test';
import type { SessionInitResponse } from '../../types/call';

/** Fixed sessionId used across all mocks so WS URL is predictable */
export const TEST_SESSION_ID = 'test-session-001';

/** Default init response returned by mockSessionInit() */
const DEFAULT_INIT_RESPONSE: SessionInitResponse = {
  sessionId: TEST_SESSION_ID,
  status: 'processing',
  metadata: {
    title: 'Test Video — Habits',
    duration: 300,
    thumbnailUrl: undefined,
  },
};

/**
 * mockSessionInit — intercept POST /api/sessions/init.
 *
 * @param page     Playwright Page
 * @param overrides Partial response to merge over the default (e.g. force error)
 * @param status   HTTP status code (default 200; use 500 for error edge case)
 */
export async function mockSessionInit(
  page: Page,
  overrides: Partial<SessionInitResponse> = {},
  status = 200,
): Promise<void> {
  await page.route('**/api/sessions/init', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    if (status !== 200) {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
      return;
    }

    const body: SessionInitResponse = { ...DEFAULT_INIT_RESPONSE, ...overrides };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/**
 * mockSessionEnd — intercept POST /api/sessions/:id/end.
 * Always returns { success: true } so endSession() doesn't throw.
 */
export async function mockSessionEnd(page: Page): Promise<void> {
  await page.route('**/api/sessions/*/end', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
}
