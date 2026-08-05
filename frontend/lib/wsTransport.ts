/**
 * wsTransport — real WebSocket adapter for Pipecat.
 *
 * This is a PURE ADAPTER: it only handles connect/disconnect/on/off.
 * Session state mapping, transcript updates, and all business logic
 * live in hooks (useVoiceClient, useCallSession) — not here.
 *
 * Usage (future — not wired to useCallSession yet):
 *   const transport = new WsTransport('wss://your-pipecat-backend/ws');
 *   // pass to useCallSession({ transport, videoUrl })
 *
 * Message protocol (expected from Pipecat WS server):
 *   Every message is a JSON-serialised PipecatRealtimeEvent.
 *   The `type` field maps directly to the event name used in on/off.
 *
 * Error handling:
 *   - Backend-sent error frames ({ type: 'error', message: '...' }) are forwarded
 *     to listeners only when they carry a non-empty `message` field.
 *   - Browser-level transport failures (onerror, connection refused, TLS) are
 *     logged internally and do NOT produce a Pipecat 'error' event, because
 *     the browser Event object serialises to {} and has no useful message.
 */
import type { PipecatTransport } from './transport';

export class WsTransport implements PipecatTransport {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<(data: unknown) => void>>();
  private lastEventPayloads = new Map<string, unknown>();
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  // ── PipecatTransport interface ─────────────────────────────────────────────

  connect(sessionId: string, sessionToken?: string): void {
    if (this.ws) return; // idempotent

    console.log('[WsTransport] connect called', { sessionId, sessionToken });

    // Strip trailing slash if any to avoid double slashes
    const baseUrl = this.url.endsWith('/') ? this.url.slice(0, -1) : this.url;
    const wsUrl = `${baseUrl}/${encodeURIComponent(sessionId)}`;
    this.ws = new WebSocket(wsUrl);

    // Security: send the auth token as the very FIRST message after open.
    // This avoids token exposure in URL query strings (which appear in server
    // logs, CDN logs, and browser history). The backend requires this frame
    // within 5 seconds of the WS handshake.
    this.ws.addEventListener('open', () => {
      console.log('[WsTransport] ws open fired. sessionToken:', sessionToken, 'readyState:', this.ws?.readyState);
      if (sessionToken && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'auth', token: sessionToken }));
        console.log('[WsTransport] sent auth frame');
      }
    });

    this.ws.addEventListener('message', (evt) => {
      try {
        const payload = JSON.parse(evt.data as string) as { type: string; message?: string; metadata?: any };
        // Guard: drop error frames that have no message — they cannot be usefully
        // displayed and would produce { type:'error' } with no context in useVoiceClient.
        if (payload.type === 'error' && !payload.message) {
          console.warn('[WsTransport] received error frame without message — dropped', payload);
          return;
        }

        if (payload.type === 'session.ready') {
          if (payload.metadata?.title) {
            this.videoTitle = payload.metadata.title;
          }
          this._preSynthesizedGreeting = this._buildGreeting(this.videoTitle);
        }

        this._emit(payload.type, payload);
      } catch {
        // Ignore malformed frames
      }
    });

    this.ws.addEventListener('close', () => {
      this.ws = null;
    });

    // Browser-level transport errors (connection refused, TLS failure, etc.) are
    // technical signals — the Event object has no useful message and serialises
    // as {}. Log internally only; do NOT emit a Pipecat 'error' event.
    // Backend-originated errors arrive as text frames via the 'message' listener above.
    this.ws.addEventListener('error', () => {
      console.warn('[WsTransport] WebSocket connection error (transport-level)');
    });
  }

  disconnect(): void {
    if (!this.ws) return;
    this.ws.close();
    this.ws = null;
  }

  /** Optional video title, populated from session.ready for greeting personalisation */
  videoTitle: string = 'Video Session';
  private _preSynthesizedGreeting: string = '';

  /**
   * Send a JSON frame to the backend over the open WebSocket.
   * Silently drops if the connection is not open (avoids unhandled errors).
   */
  send(frame: any): void {
    if (frame.type === 'start_call') {
      const greeting = this._preSynthesizedGreeting || this._buildGreeting(this.videoTitle);
      
      this._emit('ai.speaking', {
        type: 'ai.speaking',
        text: greeting,
      });

      this._emit('transcript.update', {
        type: 'transcript.update',
        text: greeting,
        isFinal: false,
        sender: 'ai',
      });
      

      // Also send it to the backend so it ignores it (as fixed in ws_bridge.py)
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(frame));
      }
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WsTransport] send() called but WebSocket is not open — frame dropped', frame);
      return;
    }
    this.ws.send(JSON.stringify(frame));
  }

  private _buildGreeting(videoTitle: string): string {
    const title = videoTitle && videoTitle !== 'Video Session' && videoTitle !== 'Mock Video Session'
      ? videoTitle
      : 'this video';
    return `Hi! This video is about "${title}". What do you think about it?`;
  }

  on(event: string, handler: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Replay 'sticky' lifecycle events if they already fired and we just attached a listener.
    // This prevents Strict Mode dropping `session.ready` during unmount/remount cycles.
    if (event === 'session.ready' && this.lastEventPayloads.has('session.ready')) {
      handler(this.lastEventPayloads.get('session.ready'));
    }
  }

  off(event: string, handler: (data: unknown) => void): void {
    this.listeners.get(event)?.delete(handler);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _emit(event: string, data: unknown): void {
    this.lastEventPayloads.set(event, data);
    this.listeners.get(event)?.forEach((h) => h(data));
  }
}
