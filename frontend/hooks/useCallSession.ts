'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createTransport } from '@/lib/transportFactory';
import { initSession, endSession } from '@/lib/sessionApi';
import { useVoiceClient } from './useVoiceClient';
import { useTranscript } from './useTranscript';
import {
  createSessionDraft,
  appendMessage as archiveAppendMessage,
  completeSession,
  abandonSession,
} from '@/lib/historyRepository';
import { getUserIdentity } from '@/lib/identity';
import type { MockTransport } from '@/lib/mockTransport';
import type {
  CallSessionState,
  PipecatRealtimeEvent,
  SessionInitResponse,
  TranscriptUpdateEvent,
} from '@/types/call';

interface UseCallSessionOptions {
  videoUrl: string | null;
  /** "video_chat" (default) or "beginner" — from URL query param */
  mode?: 'video_chat' | 'beginner';
  initialSessionId?: string | null;
}

/**
 * useCallSession — the single coordinator hook for a call session.
 *
 * Owns the ONLY source of truth: CallSessionState.
 *
 * Dependency flow (no circular deps):
 *   useCallSession
 *     ├── creates MockTransport (via useMemo)
 *     ├── calls sessionApi.initSession() → gets sessionId
 *     ├── passes { transport, sessionId, onSessionStateChange, onTranscriptEvent }
 *     │   to useVoiceClient
 *     └── passes transcript events to useTranscript
 *
 * The UI (CallInterface) reads everything from this hook — it should not
 * call useVoiceClient or useTranscript directly.
 */
// Module-level cache to prevent double-init in React StrictMode
let activeInitPromise: Promise<SessionInitResponse> | null = null;
let activeInitVideoUrl: string | null = null;

export function useCallSession({ videoUrl, mode = 'video_chat', initialSessionId = null }: UseCallSessionOptions) {
  // ── Single source of truth ──────────────────────────────────────────────────
  const [sessionState, setSessionState] = useState<CallSessionState>('initializing');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<SessionInitResponse['metadata'] | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // Session duration in seconds (for the end-session API call)
  const sessionStartRef    = useRef<number>(Date.now());
  // Prevents double-fire from simultaneous click + Space events
  const micToggleLockRef   = useRef(false);

  // ── Archive refs (stable, never trigger re-render) ──────────────────────────
  // The archive session ID (IndexedDB key) — separate from the Pipecat sessionId.
  const archiveSessionIdRef = useRef<string | null>(null);
  // Monotonically increasing sequence counter for messages within this session.
  const messageSequenceRef  = useRef<number>(0);

  // ── Transport (stable across re-renders) ────────────────────────────────────
  // createTransport() reads NEXT_PUBLIC_PIPECAT_WS_URL at mount time:
  //   set  → WsTransport (real backend)
  //   unset → MockTransport (dev fallback)
  const transport = useMemo(() => createTransport(), []);

  // ── Transcript ───────────────────────────────────────────────────────────────
  const { messages, liveSubtitle, liveUserSubtitle, aiUnderstood, appendMessage, updateLiveSubtitle, onNormalizationResult, clearMessages } =
    useTranscript();

  // ── Beginner Mode Features ───────────────────────────────────────────────────
  const [speedRate, setSpeedRate] = useState(1.0);
  const [isSubtitleHidden, setIsSubtitleHidden] = useState(false);

  // ── Archive: append message per turn ────────────────────────────────────────
  // Defined before handleTranscriptEvent because the transcript handler references it.
  const archiveMessage = useCallback(async (role: 'user' | 'ai', content: string, id?: string) => {
    const archiveId = archiveSessionIdRef.current;
    if (!archiveId || !content.trim()) return;
    const sequence = messageSequenceRef.current++;
    await archiveAppendMessage(archiveId, { id, role, content, sequence });
  }, []);

  // ── Transcript event handler (stable ref) ───────────────────────────────────
  const handleTranscriptEvent = useCallback(
    (event: PipecatRealtimeEvent) => {
      if (event.type === 'transcript.update') {
        const e = event as TranscriptUpdateEvent;
        updateLiveSubtitle(e.text, e.isFinal, e.sender, e.turn_id);
        // Archive final turns only — live partial transcripts are not persisted.
        if (e.isFinal && e.text.trim()) {
          archiveMessage(e.sender, e.text.trim(), e.turn_id);
        }
      }
      // ai.speaking text is already handled via transcript.update from the mock;
      // a real backend might send it separately — add handling here if needed.
    },
    [updateLiveSubtitle, archiveMessage],
  );

  // ── Voice client ─────────────────────────────────────────────────────────────
  const { isMuted, startListening, stopListening, toggleMute, sendPrompt } = useVoiceClient({
    transport,
    sessionId,
    sessionToken,
    onSessionStateChange: setSessionState,
    onTranscriptEvent: handleTranscriptEvent,
    onNormalizationResult,
    speedRate,
  });

  // ── Session init on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!videoUrl) {
      // No URL provided — skip init; stay in initializing until URL is supplied
      return;
    }

    let cancelled = false;

    // Use cached promise if available and matching URL to avoid StrictMode double-fetch
    let promise: Promise<SessionInitResponse>;
    if (initialSessionId) {
      promise = Promise.resolve({
        sessionId: initialSessionId,
        status: 'processing',
        metadata: (() => {
          if (typeof window === 'undefined') return undefined;
          try {
             const stored = sessionStorage.getItem(`meta-${initialSessionId}`);
             if (stored) return JSON.parse(stored);
          } catch(e) {}
          return undefined;
        })()
      });
    } else {
      if (activeInitVideoUrl !== videoUrl || !activeInitPromise) {
        activeInitVideoUrl = videoUrl;
        activeInitPromise = initSession(videoUrl, mode).finally(() => {
          // Clear cache after completion so future navigations re-init
          if (activeInitVideoUrl === videoUrl) {
            activeInitPromise = null;
            activeInitVideoUrl = null;
          }
        });
      }
      promise = activeInitPromise;
    }

    promise
      .then(async (res) => {
        if (cancelled) return;
        setSessionId(res.sessionId);
        setSessionToken(res.sessionToken ?? null);
        setMetadata(res.metadata);

        // Pass the video title to MockTransport so it can craft a personalized greeting.
        // For a real WS transport this is a no-op (the property doesn't exist).
        const mock = transport as Partial<MockTransport>;
        if (typeof mock.videoTitle !== 'undefined' && res.metadata?.title) {
          mock.videoTitle = res.metadata.title;
        }

        // ── Create archive draft in IndexedDB ───────────────────────────────
        // Created here (not at component mount) because we need the video title.
        // If already created (StrictMode double-fire), skip.
        if (!archiveSessionIdRef.current) {
          const guestId = await getUserIdentity() ?? 'guest';
          
          let extractedVideoId: string | undefined;
          if (videoUrl) {
            const match = videoUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
            if (match) extractedVideoId = match[1];
          }

          const archiveId = await createSessionDraft({
            guest_id: guestId,
            video_title: res.metadata?.title,
            video_id: extractedVideoId,
            channel_name: res.metadata?.channelName,
            mode: mode as 'video_chat' | 'beginner',
          });
          archiveSessionIdRef.current = archiveId;
        }
        // State transitions to 'idle' only after session.ready fires from transport.
        // The transport.connect() is triggered inside useVoiceClient when sessionId is set.
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setInitError(msg);
        // Stay in 'initializing' — UI can show an error state
      });

    return () => {
      cancelled = true;
    };
  }, [videoUrl, mode, transport]);




  // ── Archive: abandon on tab close / crash ────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      const archiveId = archiveSessionIdRef.current;
      if (archiveId) {
        // abandonSession is async but beforeunload fires synchronously.
        // IndexedDB writes are best-effort here — the browser may not wait.
        // This still marks the session as 'abandoned' in most desktop browsers.
        abandonSession(archiveId).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ── End session ──────────────────────────────────────────────────────────────
  const handleEndSession = useCallback(async () => {
    setSessionState('ended');
    transport.disconnect();

    const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);

    // Flush archive session to 'completed' before navigating away
    const archiveId = archiveSessionIdRef.current;
    if (archiveId) {
      await completeSession(archiveId, { duration_seconds: durationSeconds });
    }

    if (!sessionId) return;

    try {
      await endSession(sessionId, durationSeconds);
    } catch (err) {
      // Non-fatal — session is already ended client-side
      console.warn('[useCallSession] endSession API error', err);
    }
  }, [sessionId, transport]);

  // ── Quick-prompt that also appends the user message to transcript ────────────
  const handleSendPrompt = useCallback(
    (text: string) => {
      if (sessionState !== 'idle') return;
      sendPrompt(text);
    },
    [sessionState, sendPrompt],
  );

  // ── Toggle mic with session state coordination ────────────────────────────────
  const handleToggleMic = useCallback(() => {
    if (micToggleLockRef.current) {
      console.log(`[gstack] handleToggleMic LOCKED (debounce). t=${performance.now().toFixed(1)}ms`);
      return;
    }
    micToggleLockRef.current = true;
    setTimeout(() => { micToggleLockRef.current = false; }, 400);

    console.log(
      `[gstack] handleToggleMic called. t=${performance.now().toFixed(1)}ms | isMuted=${isMuted} | sessionState=${sessionState}\n`,
      new Error().stack?.split('\n').slice(1, 4).join(' | ')
    );
    if (isMuted) return;

    // Guard: 'listening' means getUserMedia is in-flight but recorder not yet started.
    // Block any toggle in this transient window — the mic button is also disabled here,
    // but this guard catches any programmatic call path that bypasses the button.
    if (sessionState === 'listening') {
      console.log('[gstack] handleToggleMic blocked — state is listening (getUserMedia in-flight)');
      return;
    }

    if (sessionState === 'idle' || sessionState === 'speaking') {
      startListening(true);
    } else if (['recording', 'turn_candidate_end'].includes(sessionState)) {
      stopListening();
    }
    // Ignore clicks while thinking/processing
  }, [isMuted, sessionState, startListening, stopListening]);

  return {
    // Session state (single source of truth)
    sessionState,
    metadata,
    initError,

    // Transcript
    messages,
    liveSubtitle,
    liveUserSubtitle,
    aiUnderstood,
    clearMessages,
    appendMessage,

    // Controls
    isMuted,
    speedRate,
    setSpeedRate,
    isSubtitleHidden,
    setIsSubtitleHidden,
    toggleMute,
    handleToggleMic,
    // Note: handleSendPrompt intentionally omitted — new voice-first UI
    // does not auto-send text. FluencyBooster hints are visual-only.
    endSession: handleEndSession,

    // Session IDs
    /** The Pipecat/Python WS session ID — used for REST API calls (hints, lookup). */
    wsSessionId: sessionId,
    /** The IndexedDB archive session ID — used for local lookup event persistence. */
    idbSessionId: archiveSessionIdRef.current,
  };
}
