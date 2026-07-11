/**
 * e2e/call-flow.spec.ts
 *
 * 3 E2E tests for the call flow:
 *   1. Happy path  — full sequence init → session.ready → mic → thinking → speaking → user ends
 *   2. Edge: init 500  — backend returns 500; UI shows error toast, no WS opened
 *   3. Edge: WS drop mid-turn — WS closes while AI is speaking; UI recovers, end button usable
 *
 * All tests are deterministic: HTTP and WS are fully mocked.
 * No backend or real microphone required.
 *
 * ── Ordering contract ─────────────────────────────────────────────────────────
 * setupWsMock() registers the route BEFORE page.goto(), returns handle immediately.
 * page.goto() causes the browser to open the WS → route handler fires → routeRef set.
 * ws.sendSequence() / ws.send() are called AFTER goto() → they find routeRef populated.
 *
 * ── State assertions ──────────────────────────────────────────────────────────
 * All assertions use data-testid and visible text — not animation classes.
 */

import { test, expect } from '@playwright/test';
import { mockSessionInit, mockSessionEnd } from './helpers/http-mock';
import { setupWsMock } from './helpers/ws-mock';

// ── Shared URL ────────────────────────────────────────────────────────────────
const CALL_URL = '/call?url=https%3A%2F%2Fyoutu.be%2FdQw4w9WgXcQ';

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — Happy Path
// ─────────────────────────────────────────────────────────────────────────────
test('happy path: full call flow init → session.ready → mic → ai turn → user ends session', async ({
  page,
}) => {
  // ── Step 1: Mock HTTP ──────────────────────────────────────────────────────
  await mockSessionInit(page);
  await mockSessionEnd(page);

  // ── Step 2: Register WS route BEFORE navigation ───────────────────────────
  // setupWsMock returns immediately. Route handler fires when browser connects.
  const ws = await setupWsMock(page);

  // ── Step 3: Navigate (browser connects to WS → session.ready sent) ────────
  await page.goto(CALL_URL);

  // ── Step 4: Wait for session.ready → idle state ───────────────────────────
  const micButton = page.getByTestId('mic-toggle-button');
  await expect(micButton).toBeVisible({ timeout: 8000 });
  await expect(micButton).toBeEnabled({ timeout: 8000 });

  // Toast shown when state transitions to idle (contains full toast text)
  await expect(page.getByText('Sẵn sàng! Nhấn mic để bắt đầu.')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('ai-status-idle')).toBeVisible({ timeout: 5000 });

  // ── Step 5: Click mic → listening state ──────────────────────────────────
  await micButton.click();

  // ── Step 6: Test drives AI thinking frame ────────────────────────────────
  await ws.sendSequence([
    { frame: { type: 'ai.thinking' }, delayMs: 200 },
  ]);

  await expect(page.getByTestId('ai-status-thinking')).toBeVisible({ timeout: 5000 });

  // ── Step 7: AI speaking frame ────────────────────────────────────────────
  await ws.sendSequence([
    {
      frame: { type: 'ai.speaking', text: 'Great point! Consistency is the key.' },
      delayMs: 300,
    },
    {
      frame: {
        type: 'transcript.update',
        text: 'Great point! Consistency is the key.',
        isFinal: false,
        sender: 'ai',
      },
      delayMs: 0,
    },
  ]);

  await expect(page.getByTestId('ai-status-speaking')).toBeVisible({ timeout: 5000 });

  // ── Step 8: AI subtitle / transcript text visible ─────────────────────────
  await expect(page.getByText('Great point! Consistency is the key.')).toBeVisible({
    timeout: 5000,
  });

  // ── Step 9: Final transcript + AI done sentinel → back to idle ────────────
  await ws.sendSequence([
    {
      frame: {
        type: 'transcript.update',
        text: 'Great point! Consistency is the key.',
        isFinal: true,
        sender: 'ai',
      },
      delayMs: 100,
    },
    // __ai_done__ sentinel → useVoiceClient transitions sessionState to 'idle'
    {
      frame: {
        type: 'session.ready',
        sessionId: '__ai_done__',
        metadata: { title: '', duration: 0 },
      },
      delayMs: 100,
    },
  ]);

  await expect(page.getByTestId('ai-status-idle')).toBeVisible({ timeout: 5000 });
  await expect(micButton).toBeEnabled({ timeout: 5000 });

  // ── Step 10: User ends session → modal → confirm → redirect to / ──────────
  // This tests the "user-initiated end" path (distinct from backend session.ended)
  const endCallButton = page.getByTestId('end-call-button');
  await endCallButton.click();

  const confirmButton = page.getByTestId('end-session-confirm');
  await expect(confirmButton).toBeVisible({ timeout: 3000 });
  await confirmButton.click();

  // After confirm → endSession() API call → router.push('/')
  await expect(page).toHaveURL('/', { timeout: 5000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — Edge Case: POST /api/sessions/init returns 500
// ─────────────────────────────────────────────────────────────────────────────
test('edge: init 500 → error toast shown, no WS connection, mic not usable', async ({
  page,
}) => {
  // ── Mock init to return 500 ────────────────────────────────────────────────
  await mockSessionInit(page, {}, 500);

  // Track whether any WS connection was attempted.
  // If sessionId is never set, transport.connect() is never called.
  const wsAttempted: string[] = [];
  await page.routeWebSocket('**/ws/sessions/**', (ws) => {
    wsAttempted.push(ws.url());
    ws.close(); // close immediately — this branch should not be reached
  });

  // ── Navigate ───────────────────────────────────────────────────────────────
  await page.goto(CALL_URL);

  // ── Assert error toast visible ────────────────────────────────────────────
  await expect(page.getByText('Không thể khởi tạo phiên')).toBeVisible({ timeout: 8000 });

  // ── Assert no WS connection was opened ───────────────────────────────────
  // Give a moment for any async connect attempt to have happened
  await page.waitForTimeout(1000);
  expect(wsAttempted).toHaveLength(0);

  // ── Assert mic button is disabled (session never reached idle) ────────────
  const micButton = page.getByTestId('mic-toggle-button');
  const micVisible = await micButton.isVisible().catch(() => false);
  if (micVisible) {
    await expect(micButton).toBeDisabled();
  }

  // ── Assert AI status panel shows initializing (not idle or crashed) ───────
  await expect(page.getByTestId('ai-status-initializing')).toBeVisible({ timeout: 3000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — Edge Case: WS drops while AI is speaking (mid-turn network drop)
// ─────────────────────────────────────────────────────────────────────────────
test('edge: WS closes mid-turn while AI speaking → end button stays usable, can exit', async ({
  page,
}) => {
  // ── Mock HTTP ─────────────────────────────────────────────────────────────
  await mockSessionInit(page);
  await mockSessionEnd(page);

  // ── Register WS route BEFORE navigation ──────────────────────────────────
  const ws = await setupWsMock(page);

  // ── Navigate ───────────────────────────────────────────────────────────────
  await page.goto(CALL_URL);

  // Wait for idle state (session.ready received)
  const micButton = page.getByTestId('mic-toggle-button');
  await expect(micButton).toBeEnabled({ timeout: 8000 });

  // ── Click mic → listening ────────────────────────────────────────────────
  await micButton.click();

  // ── Push partial AI turn: thinking → speaking starts ─────────────────────
  await ws.sendSequence([
    { frame: { type: 'ai.thinking' }, delayMs: 150 },
    { frame: { type: 'ai.speaking', text: 'The key idea is…' }, delayMs: 300 },
    {
      frame: { type: 'transcript.update', text: 'The key idea is…', isFinal: false, sender: 'ai' },
      delayMs: 0,
    },
  ]);

  // Assert AI is speaking
  await expect(page.getByTestId('ai-status-speaking')).toBeVisible({ timeout: 5000 });

  // ── Simulate server crash — close the WebSocket mid-turn ─────────────────
  ws.close();

  // Give the browser WS onclose event time to propagate into React state
  await page.waitForTimeout(600);

  // ── Critical assertion: end-call button must remain visible and enabled ───
  // The user must NEVER be locked out of ending the session, even after a network drop.
  const endCallButton = page.getByTestId('end-call-button');
  await expect(endCallButton).toBeVisible({ timeout: 3000 });
  await expect(endCallButton).toBeEnabled({ timeout: 3000 });

  // ── User can still cleanly exit the session ───────────────────────────────
  await endCallButton.click();
  const confirmButton = page.getByTestId('end-session-confirm');
  await expect(confirmButton).toBeVisible({ timeout: 3000 });
  await confirmButton.click();

  // App navigates home even after WS was dropped
  await expect(page).toHaveURL('/', { timeout: 5000 });
});
