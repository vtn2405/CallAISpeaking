'use client';

/**
 * useAzureTTS — Azure Cognitive Services Speech SDK text-to-speech hook.
 *
 * Security model:
 *   The raw Azure Speech key is NEVER sent to the browser.
 *   On mount, this hook fetches a short-lived access token (valid ~10 min)
 *   from the backend endpoint GET /api/speech-token.
 *   SpeechConfig is initialized with fromAuthorizationToken() rather than
 *   fromSubscription(), so the key stays server-side only.
 *
 * Usage:
 *   const { speakText, isSpeaking, stop } = useAzureTTS({ voiceName, onEnd });
 *
 *   - speakText(text): start speaking. Non-blocking — returns immediately.
 *   - stop(): interrupt ongoing synthesis (barge-in support).
 *   - isSpeaking: boolean for UI state (speaking indicator, disable mic btn, etc.)
 *   - onEnd: callback fired when playback finishes naturally (not on stop()).
 *             Use this to send { type: "tts.done" } to the backend.
 *
 * TTS events drive state machine:
 *   tts.started → isSpeaking = true
 *   tts.ended   → isSpeaking = false + onEnd() called
 *
 * Cleanup: synthesizer is closed on unmount. Any in-progress synthesis is stopped.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

// Azure Speech SDK — loaded dynamically to avoid SSR issues in Next.js App Router
// (SpeechSDK uses Web APIs that don't exist on the server).
type SpeechSDKModule = typeof import('microsoft-cognitiveservices-speech-sdk');

interface UseAzureTTSOptions {
  /** Azure TTS voice name, e.g. "en-US-JennyNeural". Defaults to Jenny. */
  voiceName?: string;
  /** Backend base URL to fetch the speech token from. Defaults to NEXT_PUBLIC_PIPECAT_WS_URL base. */
  backendBaseUrl?: string;
  /** Called when TTS audio finishes naturally (not on manual stop). */
  onEnd?: (text: string) => void;
  /**
   * Called for each word boundary event during synthesis.
   * audioOffset: position in audio stream (100-nanosecond units)
   * textOffset:  character offset of the word in the original text
   * wordLength:  character length of the word
   * word:        the word text
   * Use this to drive per-word subtitle highlighting.
   */
  onWordBoundary?: (audioOffset: number, textOffset: number, wordLength: number, word: string) => void;
}

interface UseAzureTTSReturn {
  /** Speak the provided text. Non-blocking. */
  speakText: (text: string, rate?: number) => void;
  /** Interrupt ongoing TTS immediately. */
  stop: () => void;
  /** True while Azure TTS is actively synthesizing/playing audio. */
  isSpeaking: boolean;
  /** True if the speech token fetch failed or SDK is unavailable. */
  isUnavailable: boolean;
}

let cachedTokenPromise: Promise<{ token: string; region: string } | null> | null = null;
let tokenCacheTime = 0;

/** Fetch a short-lived Azure Speech token from our backend.
 * cache: 'no-store' ensures we never reuse a stale/expired token across sessions.
 * We cache the promise in memory for 5 minutes to prevent double-fetching in React StrictMode.
 */
async function fetchSpeechToken(backendBase: string): Promise<{ token: string; region: string } | null> {
  const now = Date.now();
  // If we have a cached promise, and it's either still pending (tokenCacheTime === 0)
  // or it hasn't expired yet (< 5 mins), reuse it.
  if (cachedTokenPromise && (tokenCacheTime === 0 || now - tokenCacheTime < 5 * 60 * 1000)) {
    return cachedTokenPromise;
  }

  // Set tokenCacheTime = 0 to indicate pending state
  tokenCacheTime = 0;
  cachedTokenPromise = (async () => {
    try {
      const url = `${backendBase.replace(/\/$/, '')}/api/speech-token`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json() as { token?: string; region?: string; error?: string };
      if (data.error || !data.token || !data.region) return null;
      tokenCacheTime = Date.now();
      return { token: data.token, region: data.region };
    } catch {
      return null;
    }
  })();

  cachedTokenPromise.then(res => {
    if (!res) {
      cachedTokenPromise = null;
      tokenCacheTime = 0;
    }
  });

  return cachedTokenPromise;
}

export function useAzureTTS({
  voiceName = 'en-US-JennyNeural',
  backendBaseUrl,
  onEnd,
  onWordBoundary,
}: UseAzureTTSOptions = {}): UseAzureTTSReturn {
  const lastTextRef      = useRef<string>('');
  const playbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const endPlaybackRef     = useRef<() => void>(() => {});
  const trueStartTimeRef   = useRef<number>(0);

  const [isSpeaking, setIsSpeaking]     = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);

  // SDK + synthesizer refs — stable across renders
  // Note: typed as `any` to avoid TS's protected-constructor InstanceType constraint
  // that the Speech SDK types trigger. Runtime safety is preserved by the init guard.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sdkRef           = useRef<SpeechSDKModule | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const synthesizerRef   = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configRef        = useRef<any>(null);
  // Keep audioConfig ref so we can explicitly close it on unmount and free the hardware lock.
  // Without this, the browser audio context stays locked between SPA navigations,
  // causing silence on the 2nd (and subsequent) sessions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audioConfigRef   = useRef<any>(null);

  // Stable onEnd + onWordBoundary refs
  const onEndRef          = useRef(onEnd);
  const onWordBoundaryRef = useRef(onWordBoundary);
  useEffect(() => { onEndRef.current          = onEnd; },          [onEnd]);
  useEffect(() => { onWordBoundaryRef.current = onWordBoundary; }, [onWordBoundary]);

  endPlaybackRef.current = () => {
    setIsSpeaking(false);
    onEndRef.current?.(lastTextRef.current);
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
  };

  // Derive backend HTTP base URL from NEXT_PUBLIC_PIPECAT_WS_URL.
  // The WS URL may include a path like ws://localhost:8000/ws/sessions
  // We need only the origin (protocol+host+port) for REST calls.
  const resolvedBackend = (() => {
    const raw = backendBaseUrl
      ?? (typeof process !== 'undefined'
        ? process.env.NEXT_PUBLIC_PIPECAT_WS_URL
        : undefined);
    if (!raw) return 'http://localhost:8000';
    try {
      // Convert ws(s):// → http(s):// then extract origin only
      const httpUrl = raw.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://');
      const url = new URL(httpUrl);
      return url.origin;  // e.g. "http://localhost:8000"
    } catch {
      return 'http://localhost:8000';
    }
  })();

  // ── Load SDK and create SpeechConfig on mount ─────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // 1. Dynamically import Speech SDK (avoids SSR crash in Next.js)
      let sdk: SpeechSDKModule;
      try {
        sdk = await import('microsoft-cognitiveservices-speech-sdk');
        sdkRef.current = sdk;
      } catch {
        console.warn('[useAzureTTS] Speech SDK not available — TTS disabled');
        if (!cancelled) setIsUnavailable(true);
        return;
      }

      // 2. Fetch short-lived token from backend
      const tokenData = await fetchSpeechToken(resolvedBackend);
      if (cancelled) return;
      if (!tokenData) {
        console.warn('[useAzureTTS] Failed to fetch speech token — TTS disabled');
        setIsUnavailable(true);
        return;
      }

      // 3. Build SpeechConfig from token (never from raw key)
      const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(tokenData.token, tokenData.region);
      speechConfig.speechSynthesisVoiceName = voiceName;
      // Use browser's native audio output — no need for AudioConfig.fromDefaultSpeakerOutput() in browser
      configRef.current = speechConfig;

      // 4. Create synthesizer to play through browser's default speaker.
      // We use SpeakerAudioDestination to hook into the TRUE native Web Audio playback events.
      const player = new sdk.SpeakerAudioDestination();
      player.onAudioEnd = () => {
        // This fires when the Web Audio node finishes playing, but is notoriously unreliable in MSE.
        // We leave it here as a fastest-path fallback, but rely on audioDuration math below.
        endPlaybackRef.current();
      };

      const audioConfig = sdk.AudioConfig.fromSpeakerOutput(player);
      audioConfigRef.current = audioConfig;
      const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

      // Wire word boundary events for subtitle highlighting and exact playback timing
      synthesizer.wordBoundary = (_s: unknown, e: { audioOffset: number; textOffset: number; wordLength: number; text: string }) => {
        if (trueStartTimeRef.current === 0) {
          // e.audioOffset is in ticks (100ns). e.g. 15000000 = 1500ms
          trueStartTimeRef.current = Date.now() - (e.audioOffset / 10000);
        }
        onWordBoundaryRef.current?.(e.audioOffset, e.textOffset, e.wordLength, e.text);
      };

      synthesizerRef.current = synthesizer;
    };

    init();

    return () => {
      cancelled = true;
      // Close synthesizer first, then AudioConfig.
      // Closing both is required to fully release the browser's audio hardware lock.
      // If AudioConfig is not closed, the next session will initialize but produce silence.
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }
      if (synthesizerRef.current) {
        try { synthesizerRef.current.close(); } catch { /* ignore */ }
        synthesizerRef.current = null;
      }
      if (audioConfigRef.current) {
        try { audioConfigRef.current.close(); } catch { /* ignore */ }
        audioConfigRef.current = null;
      }
      if (configRef.current) {
        try { configRef.current.close(); } catch { /* ignore */ }
        configRef.current = null;
      }
    };
  // Re-initialize if backend URL or voice changes (rare in practice)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedBackend, voiceName]);

  // ── speakText ─────────────────────────────────────────────────────────────
  const speakText = useCallback((text: string, rate: number = 1.0) => {
    if (!text.trim()) return;
    if (!synthesizerRef.current || !sdkRef.current) {
      console.warn('[useAzureTTS] speakText called but synthesizer not ready');
      onEndRef.current?.(text);
      return;
    }

    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }

    lastTextRef.current = text;
    trueStartTimeRef.current = 0; // Reset exact playback timer
    setIsSpeaking(true);

    const escapeXml = (unsafe: string) => {
      return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '\'': return '&apos;';
          case '"': return '&quot;';
          default: return c;
        }
      });
    };

    const safeText = escapeXml(text);
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
      <voice name="${voiceName}">
        <prosody rate="${rate}">
          ${safeText}
        </prosody>
      </voice>
    </speak>`;

    const startTime = Date.now();

    synthesizerRef.current.speakSsmlAsync(
      ssml,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result: any) => {
        const sdk = sdkRef.current!;
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          // Synthesis is done. SpeakerAudioDestination.onAudioEnd is highly unreliable in browsers.
          // Instead, we mathematically calculate the EXACT end time based on Azure's audioDuration ticks!
          const audioDurationMs = result.audioDuration / 10000;
          let timeRemaining = audioDurationMs;
          
          if (trueStartTimeRef.current > 0) {
            const expectedEndTime = trueStartTimeRef.current + audioDurationMs;
            timeRemaining = expectedEndTime - Date.now();
          }

          if (timeRemaining < 0) timeRemaining = 0;
          
          if (!playbackTimeoutRef.current) {
            playbackTimeoutRef.current = setTimeout(() => {
              endPlaybackRef.current();
            }, timeRemaining + 150); // 150ms buffer for browser audio buffer flush
          }
        } else {
          // Cancelled or error
          console.warn('[useAzureTTS] synthesis incomplete, reason:', result.reason);
          endPlaybackRef.current();
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error: any) => {
        console.error('[useAzureTTS] speakSsmlAsync error:', error);
        endPlaybackRef.current();
      },
    );
  }, [voiceName]);

  // ── stop (barge-in) ───────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    endPlaybackRef.current();
    if (!synthesizerRef.current) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = synthesizerRef.current as any;
      if (typeof s.stopSpeakingAsync === 'function') {
        s.stopSpeakingAsync(
          () => { /* handled by endPlaybackRef */ },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (err: any) => { console.warn('[useAzureTTS] stopSpeakingAsync error:', err); }
        );
      }
    } catch {
      // ignore
    }
  }, []);

  return { speakText, stop, isSpeaking, isUnavailable };
}
