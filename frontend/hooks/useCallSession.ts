'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createTransport } from '@/lib/transportFactory';
import { initSession, endSession } from '@/lib/sessionApi';
import { useVoiceClient } from './useVoiceClient';
import { useTranscript } from './useTranscript';
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

export function useCallSession({ videoUrl, mode = 'video_chat' }: UseCallSessionOptions) {
  // ── Single source of truth ──────────────────────────────────────────────────
  const [sessionState, setSessionState] = useState<CallSessionState>('initializing');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<SessionInitResponse['metadata'] | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // Session duration in seconds (for the end-session API call)
  const sessionStartRef = useRef<number>(Date.now());

  // ── Transport (stable across re-renders) ────────────────────────────────────
  // createTransport() reads NEXT_PUBLIC_PIPECAT_WS_URL at mount time:
  //   set  → WsTransport (real backend)
  //   unset → MockTransport (dev fallback)
  const transport = useMemo(() => createTransport(), []);

  // ── Transcript ───────────────────────────────────────────────────────────────
  const { messages, liveSubtitle, appendMessage, updateLiveSubtitle, clearMessages } =
    useTranscript();

  // ── Beginner Mode Features ───────────────────────────────────────────────────
  const [speedRate, setSpeedRate] = useState(1.0);
  const [isSubtitleHidden, setIsSubtitleHidden] = useState(false);

  // ── Transcript event handler (stable ref) ───────────────────────────────────
  const handleTranscriptEvent = useCallback(
    (event: PipecatRealtimeEvent) => {
      if (event.type === 'transcript.update') {
        const e = event as TranscriptUpdateEvent;
        updateLiveSubtitle(e.text, e.isFinal, e.sender);
      }
      // ai.speaking text is already handled via transcript.update from the mock;
      // a real backend might send it separately — add handling here if needed.
    },
    [updateLiveSubtitle],
  );

  // ── Voice client ─────────────────────────────────────────────────────────────
  const { isMuted, startListening, stopListening, toggleMute, sendPrompt } = useVoiceClient({
    transport,
    sessionId,
    onSessionStateChange: setSessionState,
    onTranscriptEvent: handleTranscriptEvent,
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

    activeInitPromise
      .then((res) => {
        if (cancelled) return;
        setSessionId(res.sessionId);
        setMetadata(res.metadata);

        // Pass the video title to MockTransport so it can craft a personalized greeting.
        // For a real WS transport this is a no-op (the property doesn't exist).
        const mock = transport as Partial<MockTransport>;
        if (typeof mock.videoTitle !== 'undefined' && res.metadata?.title) {
          mock.videoTitle = res.metadata.title;
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

  // ── End session ──────────────────────────────────────────────────────────────
  const handleEndSession = useCallback(async () => {
    setSessionState('ended');
    transport.disconnect();

    if (!sessionId) return;

    const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);
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
    if (isMuted) return;

    if (sessionState === 'idle') {
      startListening();
    } else if (sessionState === 'listening') {
      stopListening();
    }
    // Ignore clicks while thinking/speaking
  }, [isMuted, sessionState, startListening, stopListening]);

  return {
    // Session state (single source of truth)
    sessionState,
    metadata,
    initError,

    // Transcript
    messages,
    liveSubtitle,
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
  };
}
