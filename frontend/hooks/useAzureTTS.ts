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

type SpeechSDKModule = typeof import('microsoft-cognitiveservices-speech-sdk');

interface UseAzureTTSOptions {
  voiceName?: string;
  backendBaseUrl?: string;
  onStart?: (turnId?: string) => void;
  onEnd?: (text: string, turnId?: string) => void;
  onError?: (error: any, turnId?: string) => void;
}

interface UseAzureTTSReturn {
  speakText: (text: string, rate?: number, turnId?: string) => void;
  stop: () => void;
  prewarm: () => void;
  isSpeaking: boolean;
  isUnavailable: boolean;
}

let cachedTokenPromise: Promise<{ token: string; region: string } | null> | null = null;
let tokenCacheTime = 0;

async function fetchSpeechToken(_backendBase: string): Promise<{ token: string; region: string } | null> {
  const now = Date.now();
  if (cachedTokenPromise && (tokenCacheTime === 0 || now - tokenCacheTime < 5 * 60 * 1000)) {
    return cachedTokenPromise;
  }
  tokenCacheTime = 0;
  cachedTokenPromise = (async () => {
    try {
      // Always call the Next.js same-origin proxy (PIPELINE_SECRET is server-side only).
      // The proxy at /api/speech-token adds the Authorization header and forwards to Pipeline.
      const res = await fetch('/api/speech-token', { cache: 'no-store' });
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
  onStart,
  onEnd,
  onError,
}: UseAzureTTSOptions = {}): UseAzureTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);

  const sdkRef = useRef<SpeechSDKModule | null>(null);
  const configRef = useRef<any>(null);
  
  // AudioContext for decoding and playback
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const activeSynthesizerRef = useRef<any>(null);
  const playGenRef = useRef(0);
  
  // Stable callbacks
  const onStartRef = useRef(onStart);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);
  useEffect(() => { onStartRef.current = onStart; }, [onStart]);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const resolvedBackend = (() => {
    const raw = backendBaseUrl
      ?? (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_PIPECAT_WS_URL : undefined);
    if (!raw) return 'http://localhost:8000';
    try {
      const httpUrl = raw.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://');
      return new URL(httpUrl).origin;
    } catch { return 'http://localhost:8000'; }
  })();

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      let sdk: SpeechSDKModule;
      try {
        sdk = await import('microsoft-cognitiveservices-speech-sdk');
        sdkRef.current = sdk;
      } catch {
        console.warn('[useAzureTTS] Speech SDK not available');
        if (!cancelled) setIsUnavailable(true);
        return;
      }
      const tokenData = await fetchSpeechToken(resolvedBackend);
      if (cancelled) return;
      if (!tokenData) {
        setIsUnavailable(true);
        return;
      }
      
      const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(tokenData.token, tokenData.region);
      speechConfig.speechSynthesisVoiceName = voiceName;
      // MUST use a format with header (e.g. MP3) so decodeAudioData can parse it
      speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
      configRef.current = speechConfig;
    };
    init();
    return () => {
      cancelled = true;
      if (configRef.current) {
        try { configRef.current.close(); } catch { /* ignore */ }
      }
      if (activeSourceRef.current) {
        try { activeSourceRef.current.stop(); } catch { /* ignore */ }
      }
      if (activeSynthesizerRef.current) {
        try { activeSynthesizerRef.current.close(); } catch { /* ignore */ }
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch { /* ignore */ }
      }
    };
  }, [resolvedBackend, voiceName]);

  const stop = useCallback(() => {
    playGenRef.current++;
    setIsSpeaking(false);
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch { /* ignore */ }
      activeSourceRef.current = null;
    }
    if (activeSynthesizerRef.current) {
      try { activeSynthesizerRef.current.close(); } catch { /* ignore */ }
      activeSynthesizerRef.current = null;
    }
  }, []);

  const speakText = useCallback((text: string, rate: number = 1.0, turnId?: string) => {
    if (!text.trim()) return;
    if (!configRef.current || !sdkRef.current) {
      console.warn('[useAzureTTS] speakText called but config not ready');
      onEndRef.current?.(text, turnId);
      return;
    }

    // Stop any ongoing playback
    stop();
    const myGen = playGenRef.current;
    setIsSpeaking(true);

    const sdk = sdkRef.current;
    
    // Lazy initialize AudioContext on user interaction
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const audioContext = audioContextRef.current;
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    // Initialize synthesizer with null audio output (we will pull the bytes manually)
    const synthesizer = new sdk.SpeechSynthesizer(configRef.current, null);
    activeSynthesizerRef.current = synthesizer;

    const escapeXml = (unsafe: string) => {
      return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<': return '&lt;'; case '>': return '&gt;';
          case '&': return '&amp;'; case '\'': return '&apos;'; case '"': return '&quot;';
          default: return c;
        }
      });
    };

    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
      <voice name="${voiceName}">
        <prosody rate="${rate}">
          ${escapeXml(text)}
        </prosody>
      </voice>
    </speak>`;

    synthesizer.speakSsmlAsync(
      ssml,
      async (result: any) => {
        if (activeSynthesizerRef.current === synthesizer) {
          activeSynthesizerRef.current = null;
        }
        synthesizer.close();

        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          try {
            // result.audioData is an ArrayBuffer containing the MP3/WAV data
            const audioData = result.audioData;
            if (!audioData || audioData.byteLength === 0) {
              throw new Error("Received empty audio data");
            }
            
            // decodeAudioData consumes the ArrayBuffer, so we don't need to copy it
            const audioBuffer = await audioContext.decodeAudioData(audioData);
            
            // Check if we were stopped while decoding
            if (playGenRef.current !== myGen) return;

            if (audioContext.state === 'suspended') {
              await audioContext.resume();
            }

            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            
            source.onended = () => {
              if (activeSourceRef.current === source) {
                activeSourceRef.current = null;
                setIsSpeaking(false);
                onEndRef.current?.(text, turnId);
              }
            };
            
            onStartRef.current?.(turnId);
            activeSourceRef.current = source;
            source.start(0);
            
          } catch (err) {
            console.error('[useAzureTTS] decodeAudioData error:', err);
            setIsSpeaking(false);
            onErrorRef.current?.(err, turnId);
            onEndRef.current?.(text, turnId); // Fallback to end on error to prevent hanging
          }
        } else {
          console.warn('[useAzureTTS] synthesis incomplete, reason:', result.reason);
          setIsSpeaking(false);
          onErrorRef.current?.(new Error(`Synthesis failed with reason: ${result.reason}`), turnId);
        }
      },
      (error: any) => {
        console.error('[useAzureTTS] speakSsmlAsync error:', error);
        if (activeSynthesizerRef.current === synthesizer) {
          activeSynthesizerRef.current = null;
        }
        synthesizer.close();
        setIsSpeaking(false);
        onErrorRef.current?.(error, turnId);
      }
    );
  }, [stop, voiceName]);

  const prewarm = useCallback(() => {
    // With null audio output, prewarming the connection is slightly different,
    // but we can still try to open a connection on the config if SDK supports it.
    // However, it's safer to just skip prewarming since the REST/WS call is fast enough
    // and we don't have a long-lived synthesizer.
  }, []);

  return { speakText, stop, prewarm, isSpeaking, isUnavailable };
}
