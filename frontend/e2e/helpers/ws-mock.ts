import type { Page, WebSocketRoute } from '@playwright/test';
import type { PipecatRealtimeEvent } from '../../types/call';
import { TEST_SESSION_ID } from './http-mock';

/** A queued frame to send over the WS after a delay */
export interface QueuedFrame {
  frame: PipecatRealtimeEvent;
  /** Milliseconds to wait before sending this frame (relative to previous) */
  delayMs?: number;
}

/**
 * Control handle returned by setupWsMock().
 * Tests use these to drive WS frames imperatively after specific UI actions.
 */
export interface WsMockHandle {
  /**
   * Send a single frame.
   * Waits up to 5 s for the WS connection if called before the browser connects.
   */
  send(frame: PipecatRealtimeEvent): Promise<void>;
  /** Close the WebSocket to simulate a network drop */
  close(): void;
  /**
   * Queue and send frames in sequence with configurable delays.
   * Automatically waits for the WS connection before the first send.
   */
  sendSequence(frames: QueuedFrame[]): Promise<void>;
}

/**
 * setupWsMock — intercept the Pipecat WebSocket and return a control handle.
 *
 * ── Ordering contract ────────────────────────────────────────────────────────
 * Call BEFORE page.goto():
 *   const ws = await setupWsMock(page);
 *   await page.goto(CALL_URL);          // browser connects → route handler fires
 *   await ws.sendSequence([...]);        // handle waits for connection internally
 *
 * The route must be registered before navigation so Playwright can intercept
 * the WS upgrade request. setupWsMock itself returns immediately (no polling).
 * The handle's send/sendSequence wait for routeRef lazily at call-time.
 *
 * ── How WS mock works ────────────────────────────────────────────────────────
 * 1. page.routeWebSocket() matches the URL pattern and hands us a WebSocketRoute.
 * 2. The route handler fires when the browser opens the WS connection.
 * 3. Inside the handler: send session.ready immediately + register onMessage listener.
 * 4. The returned handle lets tests push subsequent frames imperatively.
 *
 * @param page        Playwright Page
 * @param onUserTurn  Optional callback fired when frontend sends { type: 'user.turn' }
 */
export async function setupWsMock(
  page: Page,
  onUserTurn?: (handle: WsMockHandle, userText: string) => void | Promise<void>,
): Promise<WsMockHandle> {
  let routeRef: WebSocketRoute | null = null;

  // Register the route BEFORE navigation.
  // page.routeWebSocket() is synchronous in setup — no await needed internally,
  // but the outer function is async for consistency with page.route() patterns.
  await page.routeWebSocket(
    // Match the URL WsTransport constructs: baseUrl/sessionId
    `**/ws/sessions/${TEST_SESSION_ID}`,
    (ws) => {
      routeRef = ws;

      // Send session.ready as the very first server message after handshake.
      // Playwright queues this until the WS upgrade completes.
      ws.send(
        JSON.stringify({
          type: 'session.ready',
          sessionId: TEST_SESSION_ID,
          metadata: {
            title: 'Test Video — Habits',
            duration: 300,
          },
        } satisfies PipecatRealtimeEvent),
      );

      // Listen for inbound frames from the browser (user.turn, ping)
      ws.onMessage((msg) => {
        try {
          const data = JSON.parse(msg as string) as { type: string; text?: string };
          if (data.type === 'user.turn' && onUserTurn) {
            const handle = buildHandle(() => routeRef);
            void onUserTurn(handle, data.text ?? '');
          }
          // ping frames are silently ignored
        } catch {
          // malformed frame — ignore
        }
      });
    },
  );

  // Return the handle IMMEDIATELY — do NOT wait for routeRef here.
  // The browser hasn't navigated yet, so there's no WS connection.
  // send/sendSequence will poll for routeRef lazily when called after goto().
  return buildHandle(() => routeRef);
}

// ── Internal helpers ────────────────────────────────────────────────────────

function buildHandle(getWs: () => WebSocketRoute | null): WsMockHandle {
  return {
    async send(frame) {
      const ws = await awaitConnection(getWs);
      ws.send(JSON.stringify(frame));
    },

    close() {
      // Best-effort — if not connected yet, this is a no-op
      getWs()?.close();
    },

    async sendSequence(frames) {
      // Wait for connection once before the loop
      const ws = await awaitConnection(getWs);
      for (const { frame, delayMs = 0 } of frames) {
        if (delayMs > 0) {
          await sleep(delayMs);
        }
        ws.send(JSON.stringify(frame));
      }
    },
  };
}

/**
 * Wait until the WebSocket route handler has fired (routeRef is populated).
 * This only blocks if send/sendSequence is called before the browser connects,
 * which should not happen in a correctly ordered test.
 * Timeout: 8 s (generous, accounts for slow CI).
 */
async function awaitConnection(
  getWs: () => WebSocketRoute | null,
  timeoutMs = 8000,
): Promise<WebSocketRoute> {
  const start = Date.now();
  while (true) {
    const ws = getWs();
    if (ws) return ws;
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        '[ws-mock] WebSocket connection not established within timeout.\n' +
        'Ensure page.goto() is called AFTER setupWsMock() and BEFORE sendSequence().',
      );
    }
    await sleep(50);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
