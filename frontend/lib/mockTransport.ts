/**
 * mockTransport — PipecatTransport implementation for development.
 *
 * Does NOT make any network calls.  On connect(), it fires a synthetic
 * event chain that mirrors the real Pipecat event sequence:
 *
 *   session.ready → ai greeting (transcript.update) → idle
 *   → (on mic start) transcript.update → ai.thinking →
 *     ai.speaking → transcript.update (final)
 *
 * Cleanup: disconnect() cancels ALL pending timeouts — safe to call from
 * useEffect cleanup.
 */
import type { PipecatTransport } from './transport';
import type { PipecatRealtimeEvent } from '@/types/call';

/** Build a natural, friendly AI greeting based on the video title. */
function buildGreeting(videoTitle: string): string {
  const title = videoTitle && videoTitle !== 'Video Session' && videoTitle !== 'Mock Video Session'
    ? videoTitle
    : 'this video';
  return `Hey! I just finished scanning the video about "${title}". It's a great topic! Should we dive right into the conversation, or do you want me to tell you the main idea first?`;
}

const AI_RESPONSES = [
  "That's a great point! The speaker really nails this concept. What do you think about applying it to your own life?",
  "Interesting! Can you tell me more about your own experience with this topic?",
  "Exactly! The key idea here is consistency. Have you tried any of these techniques yourself?",
  "Good observation! What surprised you most about the video?",
  "You're expressing these ideas really clearly! Let's go deeper — what does the speaker say about the role of environment in shaping behavior?",
  "Great! And how would you explain this concept to someone who has never heard of it before?",
];

const USER_PHRASES = [
  "I think the main idea of the video is about building good habits gradually.",
  "The speaker mentions that environment plays a huge role in our behavior.",
  "I find it interesting how small changes can lead to big results over time.",
  "Can you tell me more about the 2-minute rule mentioned in the video?",
  "I agree that consistency is more important than intensity when forming habits.",
];

let responseIdx = 0;

export class MockTransport implements PipecatTransport {
  private listeners = new Map<string, Set<(data: unknown) => void>>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private connected = false;

  /** Optional video title injected by transportFactory for greeting personalisation */
  videoTitle: string = 'Video Session';

  // ── PipecatTransport interface ─────────────────────────────────────────────

  connect(sessionId: string): void {
    if (this.connected) return;
    this.connected = true;

    // Fire session.ready after a short simulated "processing" delay.
    this._schedule(800, () => {
      this._emit('session.ready', {
        type: 'session.ready',
        sessionId,
        metadata: {
          title: this.videoTitle,
          duration: 900,
          thumbnailUrl: undefined,
        },
      } satisfies PipecatRealtimeEvent);

      // After session is ready, fire the AI greeting (natural, video-aware).
      // Small delay so the UI has time to transition to 'idle' first.
      this._schedule(600, () => {
        const greeting = buildGreeting(this.videoTitle);
        this._emit('ai.thinking', { type: 'ai.thinking' } satisfies PipecatRealtimeEvent);

        this._schedule(900, () => {
          this._emit('ai.speaking', {
            type: 'ai.speaking',
            text: greeting,
          } satisfies PipecatRealtimeEvent);

          // Stream greeting as subtitle
          this._emit('transcript.update', {
            type: 'transcript.update',
            text: greeting,
            isFinal: false,
            sender: 'ai',
          } satisfies PipecatRealtimeEvent);

          // Commit greeting to transcript after "speaking" duration
          const speakMs = 1000 + greeting.length * 30;
          this._schedule(speakMs, () => {
            this._emit('transcript.update', {
              type: 'transcript.update',
              text: greeting,
              isFinal: true,
              sender: 'ai',
            } satisfies PipecatRealtimeEvent);

            // Signal AI done → transition back to idle
            this._emit('session.ready', {
              type: 'session.ready',
              sessionId: '__ai_done__',
              metadata: { title: '', duration: 0 },
            } satisfies PipecatRealtimeEvent);
          });
        });
      });
    });
  }

  disconnect(): void {
    this.connected = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  on(event: string, handler: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: (data: unknown) => void): void {
    this.listeners.get(event)?.delete(handler);
  }

  // ── Mock-only API (called by useVoiceClient to simulate user speech) ───────

  /**
   * Simulate the user speaking (triggered by startListening() in the hook).
   * Fires: transcript.update (non-final) → transcript.update (final) → ai pipeline.
   */
  simulateUserSpeech(): void {
    if (!this.connected) return;

    const listenMs = 3000 + Math.random() * 2000;
    this._schedule(listenMs, () => {
      const phrase = USER_PHRASES[Math.floor(Math.random() * USER_PHRASES.length)];

      // Non-final (live subtitle)
      this._emit('transcript.update', {
        type: 'transcript.update',
        text: phrase,
        isFinal: false,
        sender: 'user',
      } satisfies PipecatRealtimeEvent);

      // Final (adds to message list)
      this._schedule(200, () => {
        this._emit('transcript.update', {
          type: 'transcript.update',
          text: phrase,
          isFinal: true,
          sender: 'user',
        } satisfies PipecatRealtimeEvent);

        this._simulateAiResponse();
      });
    });
  }

  /**
   * Simulate the AI responding to a prompted text (sent from quick-prompt buttons).
   */
  simulatePrompt(text: string): void {
    if (!this.connected) return;

    this._emit('transcript.update', {
      type: 'transcript.update',
      text,
      isFinal: true,
      sender: 'user',
    } satisfies PipecatRealtimeEvent);

    this._simulateAiResponse();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _simulateAiResponse(): void {
    this._schedule(0, () => {
      this._emit('ai.thinking', { type: 'ai.thinking' } satisfies PipecatRealtimeEvent);

      const thinkMs = 1500 + Math.random() * 800;
      this._schedule(thinkMs, () => {
        const response = AI_RESPONSES[responseIdx % AI_RESPONSES.length];
        responseIdx++;

        this._emit('ai.speaking', {
          type: 'ai.speaking',
          text: response,
        } satisfies PipecatRealtimeEvent);

        // Stream the AI text incrementally as transcript.update events
        this._emit('transcript.update', {
          type: 'transcript.update',
          text: response,
          isFinal: false,
          sender: 'ai',
        } satisfies PipecatRealtimeEvent);

        const speakMs = 1200 + response.length * 38;
        this._schedule(speakMs, () => {
          this._emit('transcript.update', {
            type: 'transcript.update',
            text: response,
            isFinal: true,
            sender: 'ai',
          } satisfies PipecatRealtimeEvent);

          // Signal the hook that AI is done — it will call setSessionState('idle')
          this._emit('session.ready', {
            type: 'session.ready',
            sessionId: '__ai_done__',
            metadata: { title: '', duration: 0 },
          } satisfies PipecatRealtimeEvent);
        });
      });
    });
  }

  private _schedule(ms: number, fn: () => void): void {
    const t = setTimeout(fn, ms);
    this.timers.push(t);
  }

  private _emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((h) => h(data));
  }
}
