'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { PipecatTransport } from '@/lib/transport';
import type { MockTransport } from '@/lib/mockTransport';
import { useAzureTTS } from './useAzureTTS';
import type {
  CallSessionState,
  PipecatRealtimeEvent,
  SessionReadyEvent,
} from '@/types/call';

interface UseVoiceClientOptions {
  /** The transport adapter to use (mock or real WS). */
  transport: PipecatTransport;
  /** API-issued session ID. null while the API call is in flight. */
  sessionId: string | null;
  /**
   * Callback fired whenever the transport drives a session state change.
   * useCallSession owns the state — this hook only signals transitions.
   */
  onSessionStateChange: (state: CallSessionState) => void;
  /**
   * Callback fired for every PipecatRealtimeEvent that carries transcript
   * or subtitle data (transcript.update).  Other events are handled
   * internally to drive onSessionStateChange.
   */
  onTranscriptEvent: (event: PipecatRealtimeEvent) => void;
  /** Speed rate for Azure TTS (e.g., 0.8 for slow, 1.0 for normal) */
  speedRate?: number;
}

/**
 * useVoiceClient — owns transport wiring, media stream, and audio playback.
 *
 * Internal state (micState, aiState) is NOT exported.
 * The host (useCallSession) receives state changes via callbacks and owns
 * the single CallSessionState source of truth.
 *
 * Cleanup contract:
 *   - transport event handlers removed in useEffect cleanup
 *   - getUserMedia stream tracks stopped on unmount
 *   - audio element paused and src cleared on unmount
 */
export function useVoiceClient({
  transport,
  sessionId,
  onSessionStateChange,
  onTranscriptEvent,
  speedRate = 1.0,
}: UseVoiceClientOptions) {
  // Internal mic state — not exported
  const [isMuted, setIsMuted] = useState(false);

  // Media stream ref (browser microphone)
  const streamRef = useRef<MediaStream | null>(null);
  // (Audio playback is now handled by useAzureTTS — no standalone audioRef needed)
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Whether we are currently in a "listening" cycle
  const isListeningRef = useRef(false);

  // Web Speech API recognition instance (real WS mode)
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Accumulated transcript while listening
  const liveTranscriptRef = useRef('');

  // Stable callback refs so useEffect deps don't thrash
  const onSessionStateChangeRef = useRef(onSessionStateChange);
  const onTranscriptEventRef = useRef(onTranscriptEvent);
  const speedRateRef = useRef(speedRate);
  useEffect(() => { onSessionStateChangeRef.current = onSessionStateChange; }, [onSessionStateChange]);
  useEffect(() => { onTranscriptEventRef.current = onTranscriptEvent; }, [onTranscriptEvent]);
  useEffect(() => { speedRateRef.current = speedRate; }, [speedRate]);

  // Ref to track the last AI reply text — used to echo in tts.done frame
  const lastAiReplyRef = useRef<string>('');

  // For VAD monitoring during AI speaking
  const isAiSpeakingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadRafRef = useRef<number | null>(null);

  // ── Azure TTS ───────────────────────────────────────────────────────────────
  // onEnd: fires when TTS audio finishes naturally → signal backend to commit isFinal
  const { speakText: azureSpeakText, stop: azureStop, isSpeaking: azureIsSpeaking } = useAzureTTS({
    voiceName: 'en-US-JennyNeural',
    onEnd: useCallback((text: string) => {
      // 1. Update internal AI speaking state
      isAiSpeakingRef.current = false;
      // 2. Signal backend: TTS done → it will emit transcript.update(isFinal=True)
      if (typeof transport.send === 'function') {
        transport.send({ type: 'tts.done', text });
      } else {
        // Mock transport: emit isFinal locally (no backend round-trip)
        onTranscriptEventRef.current({
          type: 'transcript.update',
          text,
          isFinal: true,
          sender: 'ai',
        } as PipecatRealtimeEvent);
      }
      // 3. State machine: AI speaking → idle
      onSessionStateChangeRef.current('idle');
    // transport is stable (useMemo in parent) — safe dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transport]),
  });

  // Keep isSpeaking ref in sync for VAD
  useEffect(() => {
    isAiSpeakingRef.current = azureIsSpeaking;
  }, [azureIsSpeaking]);

  // ── Connect transport when sessionId becomes available ───────────────────────
  useEffect(() => {
    if (!sessionId) return;

    // ── Event handlers ───────────────────────────────────────────────────────

    const handleSessionReady = (data: unknown) => {
      const event = data as SessionReadyEvent;
      // Mock transport reuses session.ready { sessionId: '__ai_done__' } as an old "AI done" sentinel.
      // With Azure TTS, the idle transition is driven by TTS onEnd callback instead.
      // Ignore this sentinel to avoid double-transitioning to idle.
      if (event.sessionId === '__ai_done__') return;
      // Real session.ready → transition from initializing → idle
      onSessionStateChangeRef.current('idle');
    };

    const handleTranscriptUpdate = (data: unknown) => {
      onTranscriptEventRef.current(data as PipecatRealtimeEvent);
    };

    const handleAiThinking = (_data: unknown) => {
      isAiSpeakingRef.current = false;
      onSessionStateChangeRef.current('thinking');
    };

    const handleAiSpeaking = (data: unknown) => {
      isAiSpeakingRef.current = true;
      const event = data as PipecatRealtimeEvent & { text?: string };
      const replyText = event.text ?? '';

      // ── tts.started: rail text shown immediately ──────────────────────────
      // 1. Update state machine to 'speaking'
      onSessionStateChangeRef.current('speaking');
      // 2. Forward to transcript hook — subtitle renders NOW (before audio)
      onTranscriptEventRef.current(data as PipecatRealtimeEvent);
      // 3. Start VAD to detect barge-in
      startVadMonitoring();

      // ── tts.started: begin Azure TTS audio (non-blocking) ────────────────
      if (replyText) {
        lastAiReplyRef.current = replyText;
        azureSpeakText(replyText, speedRateRef.current);
      }
    };

    const handleSessionEnded = (_data: unknown) => {
      isAiSpeakingRef.current = false;
      onSessionStateChangeRef.current('ended');
    };

    const handleError = (data: unknown) => {
      console.error('[useVoiceClient] transport error', data);
      // Keep the session alive on non-fatal errors; host decides whether to end
    };

    // ── Register ─────────────────────────────────────────────────────────────
    transport.on('session.ready', handleSessionReady);
    transport.on('transcript.update', handleTranscriptUpdate);
    transport.on('ai.thinking', handleAiThinking);
    transport.on('ai.speaking', handleAiSpeaking);
    transport.on('session.ended', handleSessionEnded);
    transport.on('error', handleError);

    transport.connect(sessionId);

    return () => {
      // ── Deregister (cleanup) ──────────────────────────────────────────────
      transport.off('session.ready', handleSessionReady);
      transport.off('transcript.update', handleTranscriptUpdate);
      transport.off('ai.thinking', handleAiThinking);
      transport.off('ai.speaking', handleAiSpeaking);
      transport.off('session.ended', handleSessionEnded);
      transport.off('error', handleError);
      transport.disconnect();
    };
  }, [transport, sessionId]);

  // ── Media stream + SpeechRecognition + VAD AudioContext cleanup on unmount ──
  useEffect(() => {
    return () => {
      // Stop SpeechRecognition if active
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* already stopped */ }
        recognitionRef.current = null;
      }
      // Cancel any pending VAD animation frame
      if (vadRafRef.current) {
        cancelAnimationFrame(vadRafRef.current);
        vadRafRef.current = null;
      }
      // Close VAD AudioContext to release the browser audio hardware lock.
      // Without this, the next session's SpeechSynthesizer may acquire the
      // context in a suspended state, producing silence on the 2nd call.
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch { /* ignore */ }
        audioContextRef.current = null;
        analyserRef.current = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  // ── Public API ───────────────────────────────────────────────────────────────

  const startListening = useCallback(() => {
    if (isMuted) return;
    if (isListeningRef.current) return;
    
    // If interrupting AI — stop Azure TTS audio immediately (barge-in)
    isAiSpeakingRef.current = false;
    azureStop();
    if (audioRef.current) audioRef.current.pause();

    isListeningRef.current = true;
    liveTranscriptRef.current = '';
    onSessionStateChangeRef.current('listening');

    // ── Mock mode: delegate to transport simulation ────────────────────────
    const mock = transport as Partial<MockTransport>;
    if (typeof mock.simulateUserSpeech === 'function') {
      // Request mic for realism, then let mock handle the rest
      navigator.mediaDevices
        ?.getUserMedia({ audio: true })
        .then((stream) => { streamRef.current = stream; })
        .catch(() => {});
      mock.simulateUserSpeech();
      return;
    }

    // ── Real WS mode: use Web Speech API to transcribe mic ─────────────────
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition as typeof SpeechRecognition | undefined;

    if (!SpeechRecognitionAPI) {
      // Browser doesn't support Web Speech API — fall back to text prompt
      console.warn('[useVoiceClient] SpeechRecognition not supported in this browser');
      navigator.mediaDevices
        ?.getUserMedia({ audio: true })
        .then((stream) => { streamRef.current = stream; })
        .catch(() => {});
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'vi-VN';      // Set to Vietnamese to support Code-switching (English + Vietnamese)
    recognition.interimResults = true;
    recognition.continuous = false;   // Stop automatically after a pause
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final   = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }
      // Accumulate final text; stream interim as live subtitle
      if (final) liveTranscriptRef.current += final;
      // Show live subtitle while user speaks
      onTranscriptEventRef.current({
        type: 'transcript.update',
        text: liveTranscriptRef.current || interim,
        isFinal: false,
        sender: 'user',
      });
    };

    recognition.onend = () => {
      if (!isListeningRef.current) return; // stopListening already called
      // Auto-ended (user paused speaking) — same as clicking mic to stop
      stopListening();
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn('[useVoiceClient] SpeechRecognition error', event.error);
      if (isListeningRef.current) stopListening();
    };

    recognition.start();
    // Also request mic so VAD works alongside SpeechRecognition
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => { streamRef.current = stream; })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMuted, transport]);

  const stopListening = useCallback(() => {
    if (!isListeningRef.current) return;
    isListeningRef.current = false;
    
    // Stop SpeechRecognition if running (won't re-trigger onend because
    // isListeningRef is already false)
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* already stopped */ }
      recognitionRef.current = null;
    }

    const userText = liveTranscriptRef.current.trim();
    liveTranscriptRef.current = '';

    // ── Send user.turn to backend (WsTransport only) ──────────────────────
    if (userText && typeof transport.send === 'function') {
      // Commit final user transcript to UI
      onTranscriptEventRef.current({
        type: 'transcript.update',
        text: userText,
        isFinal: true,
        sender: 'user',
      });
      // Send to backend — this triggers run_turn() on the Python shim
      transport.send({ type: 'user.turn', text: userText });
    } else if (!userText && typeof transport.send === 'function') {
      // Nothing was said — go back to idle instead of thinking
      onSessionStateChangeRef.current('idle');
      return;
    }

    // Transition to thinking to show processing spinner
    onSessionStateChangeRef.current('thinking');
  }, [transport]);


  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        // Muting → fully stop tracks for privacy
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        isListeningRef.current = false;
      }
      return next;
    });
  }, []);

  // ── VAD Interruption Logic ──────────────────────────────────────────────────
  const startVadMonitoring = useCallback(() => {
    if (!streamRef.current || isMuted) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      source.connect(analyserRef.current);
    }

    const analyser = analyserRef.current!;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkVolume = () => {
      if (!isAiSpeakingRef.current) return; // Stop if AI stopped

      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;

      // Threshold for voice activity (adjust based on sensitivity)
      if (average > 30) {
        console.log('[useVoiceClient] VAD interruption detected (volume > threshold)');
        startListening(); // This will pause audio, stop VAD, and transition to listening
        return;
      }

      vadRafRef.current = requestAnimationFrame(checkVolume);
    };

    if (vadRafRef.current) cancelAnimationFrame(vadRafRef.current);
    checkVolume();
  }, [isMuted, startListening]);

  /**
   * Send a quick-prompt text directly without mic capture.
   * Mock: delegates to MockTransport.simulatePrompt.
   * Real: would POST the text over the WS channel (future).
   */
  const sendPrompt = useCallback(
    (text: string) => {
      const mock = transport as Partial<MockTransport>;
      if (typeof mock.simulatePrompt === 'function') {
        mock.simulatePrompt(text);
      }
    },
    [transport],
  );

  return {
    isMuted,
    startListening,
    stopListening,
    toggleMute,
    sendPrompt,
  };
}
