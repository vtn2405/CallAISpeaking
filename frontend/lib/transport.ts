/**
 * PipecatTransport — the only interface the frontend cares about.
 *
 * Implementations:
 *   - mockTransport   (src: lib/mockTransport.ts)  — fires synthetic events, no network
 *   - wsTransport     (src: lib/wsTransport.ts)     — real WebSocket adapter (future)
 *
 * Rules for implementors:
 *   - connect/disconnect are idempotent
 *   - on/off manage a per-event listener set (no wildcard events)
 *   - NO business logic — session state and transcript mapping live in hooks
 */
export interface PipecatTransport {
  /** Start the transport connection, using the API-issued session identifier. */
  connect(sessionId: string): void;

  /** Tear down the connection and cancel all pending work. */
  disconnect(): void;

  /** Subscribe to a named event. Multiple listeners per event are allowed. */
  on(event: string, handler: (data: unknown) => void): void;

  /** Unsubscribe a previously registered listener. */
  off(event: string, handler: (data: unknown) => void): void;

  /**
   * Send a frame to the backend (optional — only implemented by WsTransport).
   * MockTransport does not implement this; use simulatePrompt/simulateUserSpeech instead.
   */
  send?(frame: object): void;
}
