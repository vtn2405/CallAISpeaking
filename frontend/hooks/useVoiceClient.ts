'use client';

/**
 * useVoiceClient — owns transport wiring, media stream, and audio playback.
 *
 * STT Architecture (Groq Speech Normalization):
 *   - replaces Web Speech API with MediaRecorder + Groq /api/stt/groq.
 *   - Recording does NOT commit on the first silence; it enters a
 *     'turn_candidate_end' window (MIN_SILENCE_MS, default 1200ms).
 *   - If speech resumes before the window closes, audio chunks are appended
 *     to the SAME utterance — never creating a new turn mid-sentence.
 *   - Only normalized_english is sent to the backend as user.turn.
 *   - provider_text is used only for the "AI understood: …" trust label.
 *
 * State machine:
 *   idle → listening → recording → turn_candidate_end → speech_processing → thinking → speaking → idle
 *
 * Duplicate-submission guard:
 *   In speech_processing, thinking, or speaking states, startListening is
 *   a no-op unless the user intentionally interrupts during AI speaking (barge-in).
 *
 * Cleanup contract:
 *   - transport event handlers removed in useEffect cleanup
 *   - getUserMedia stream tracks stopped on unmount
 *   - MediaRecorder stopped and chunks cleared on unmount
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { PipecatTransport } from '@/lib/transport';
import type { MockTransport } from '@/lib/mockTransport';
import { useAzureTTS } from './useAzureTTS';
import { showToast } from '@/components/ui/Toast';
import type {
  CallSessionState,
  GroqNormalizationResult,
  SpeechNormalizationResult,
  PipecatRealtimeEvent,
  SessionReadyEvent,
} from '@/types/call';

// ── Constants ──────────────────────────────────────────────────────────────────
/** Minimum silence duration (ms) before committing a turn candidate.
 *  400ms: tight enough for push-to-talk (user controls commit via button release),
 *  still forgiving for brief pauses in VAD mode. */
const MIN_SILENCE_MS = 400;
const ENABLE_AUTO_BARGE_IN = false;

/**
 * Minimum recording duration (ms) before sending audio to STT.
 * Recordings shorter than this are treated as accidental taps and discarded.
 * This prevents STT hallucination from mic pop sounds or background noise
 * when the user briefly taps the mic button without intending to speak.
 */
const MIN_RECORDING_MS = 600;

/** States in which the system blocks a new turn submission (not counting barge-in). */
const BLOCKING_STATES: CallSessionState[] = [
  'speech_processing',
  'thinking',
];

interface UseVoiceClientOptions {
  transport: PipecatTransport;
  sessionId: string | null;
  /** One-time WS auth token generated at session init. */
  sessionToken?: string | null;
  onSessionStateChange: (state: CallSessionState) => void;
  onTranscriptEvent: (event: PipecatRealtimeEvent) => void;
  /** Called when Groq returns a result — carries both provider and normalized texts. */
  onNormalizationResult?: (result: GroqNormalizationResult) => void;
  speedRate?: number;
  /** Backend HTTP base URL (for /api/stt/normalize). Defaults to PIPECAT WS URL origin. */
  backendBaseUrl?: string;
}

export function useVoiceClient({
  transport,
  sessionId,
  sessionToken,
  onSessionStateChange,
  onTranscriptEvent,
  onNormalizationResult,
  speedRate = 1.0,
  backendBaseUrl,
}: UseVoiceClientOptions) {
  const [isMuted, setIsMuted] = useState(false);

  // Stable callback refs
  const onSessionStateChangeRef = useRef(onSessionStateChange);
  const onTranscriptEventRef    = useRef(onTranscriptEvent);
  const onNormalizationRef      = useRef(onNormalizationResult);
  const speedRateRef            = useRef(speedRate);
  useEffect(() => { onSessionStateChangeRef.current = onSessionStateChange; }, [onSessionStateChange]);
  useEffect(() => { onTranscriptEventRef.current    = onTranscriptEvent; },    [onTranscriptEvent]);
  useEffect(() => { onNormalizationRef.current       = onNormalizationResult; }, [onNormalizationResult]);
  useEffect(() => { speedRateRef.current             = speedRate; },            [speedRate]);

  // Current session state (mirrored internally to gate barge-in logic)
  const sessionStateRef = useRef<CallSessionState>('initializing');

  // Media stream + MediaRecorder
  const streamRef   = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);

  // Persistent mic warm-up: stream opened once at session start, reused every turn.
  // Eliminates the 100–300ms getUserMedia spin-up that previously cut off the first
  // syllable of each utterance.
  const micReadyRef = useRef<boolean>(false);
  const micWarmingRef = useRef<boolean>(false); // prevent concurrent warm-up calls

  // Silence / turn-candidate timer
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whether we are actively in a recording cycle
  const isRecordingRef = useRef(false);

  // Last AI reply text (for echo in tts.done)
  const lastAiReplyRef = useRef<string>('');
  const pendingTranscriptRef = useRef<PipecatRealtimeEvent | null>(null);

  // VAD
  const isAiSpeakingRef    = useRef(false);
  const audioContextRef    = useRef<AudioContext | null>(null);
  const analyserRef        = useRef<AnalyserNode | null>(null);
  const vadRafRef          = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number>(0);

  // Derive backend HTTP base URL (same logic as useAzureTTS)
  const resolvedBackend = (() => {
    const raw = backendBaseUrl
      ?? (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_PIPECAT_WS_URL : undefined);
    if (!raw) return 'http://localhost:8000';
    try {
      const httpUrl = raw.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://');
      return new URL(httpUrl).origin;
    } catch { return 'http://localhost:8000'; }
  })();

  // ── Azure TTS ─────────────────────────────────────────────────────────────────
  const { speakText: azureSpeakText, stop: azureStop, prewarm: azurePrewarm, isSpeaking: azureIsSpeaking } = useAzureTTS({
    voiceName: 'en-US-JennyNeural',
    onStart: useCallback((turnId?: string) => {
      onSessionStateChangeRef.current('speaking');
      sessionStateRef.current = 'speaking';
      if (pendingTranscriptRef.current) {
        onTranscriptEventRef.current(pendingTranscriptRef.current);
        pendingTranscriptRef.current = null;
      }
    }, []),
    onEnd: useCallback((text: string, turnId?: string) => {
      isAiSpeakingRef.current = false;
      if (typeof transport.send === 'function') {
        transport.send({ type: 'tts.done', text, turnId });
      } else {
        onTranscriptEventRef.current({
          type: 'transcript.update',
          text,
          isFinal: true,
          sender: 'ai',
          turnId,
        } as PipecatRealtimeEvent);
      }
      onSessionStateChangeRef.current('idle');
      sessionStateRef.current = 'idle';
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transport]),
    onError: useCallback((error: any, turnId?: string) => {
      if (typeof transport.send === 'function') {
        transport.send({ type: 'tts.error', message: String(error), turnId });
      }
    }, [transport]),
  });

  useEffect(() => { isAiSpeakingRef.current = azureIsSpeaking; }, [azureIsSpeaking]);

  // ── Persistent mic warm-up ────────────────────────────────────────────────────
  /**
   * Open getUserMedia once at session start and keep the stream alive.
   * Every subsequent call to startListening reuses this stream — zero spin-up,
   * zero first-syllable loss. The stream is only closed on component unmount.
   *
   * A3 fix: previously getUserMedia was called inside startListening, causing
   * 100–300ms delay where MediaRecorder had not started yet → first syllable lost.
   */
  const _warmUpMic = useCallback(async () => {
    if (micReadyRef.current || micWarmingRef.current) return;
    const mock = transport as Partial<MockTransport>;
    if (typeof mock.simulateUserSpeech === 'function') return; // mock mode — skip

    micWarmingRef.current = true;
    console.log('[gstack] mic warm-up: requesting getUserMedia...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      micReadyRef.current = true;
      console.log('[gstack] mic warm-up: stream ready ✓');
    } catch (err) {
      console.warn('[useVoiceClient] mic warm-up failed (non-fatal, will retry on startListening):', err);
    } finally {
      micWarmingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport]);

  // ── Transport wiring ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || !sessionToken) return;
    
    let countdownTimeout: ReturnType<typeof setTimeout>;

    const handleSessionReady = (data: unknown) => {
      const event = data as SessionReadyEvent;
      if (event.sessionId === '__ai_done__') return;
      onSessionStateChangeRef.current('countdown');
      sessionStateRef.current = 'countdown';
      // B6: Prewarm Azure TTS WSS as early as possible — session is ready,
      // LLM reply is coming soon. Don't wait for ai.thinking.
      azurePrewarm();
      // A3: Warm-up mic stream so the first startListening call has zero spin-up.
      _warmUpMic();
      
      // Start 3-2-1 countdown logic
      if (countdownTimeout) clearTimeout(countdownTimeout);
      countdownTimeout = setTimeout(() => {
        if (typeof transport.send === 'function') {
          transport.send({ type: 'start_call' });
        }
      }, 3000);
    };

    const handleTranscriptUpdate = (data: unknown) => {
      onTranscriptEventRef.current(data as PipecatRealtimeEvent);
    };

    const handleAiThinking = (_data: unknown) => {
      isAiSpeakingRef.current = false;
      onSessionStateChangeRef.current('thinking');
      sessionStateRef.current = 'thinking';
      // Keep prewarm here as well in case session.ready was missed or already fired.
      azurePrewarm();
    };

    const handleAiSpeaking = (data: unknown) => {
      isAiSpeakingRef.current = true;
      const event = data as PipecatRealtimeEvent & { text?: string; turnId?: string };
      const replyText = event.text ?? '';
      const turnId = event.turnId;
      
      // Defer 'speaking' state and subtitle reveal until TTS audio actually starts
      pendingTranscriptRef.current = data as PipecatRealtimeEvent;
      onSessionStateChangeRef.current('thinking');
      sessionStateRef.current = 'thinking';
      
      // startVadMonitoring() intentionally disabled — ENABLE_AUTO_BARGE_IN = false.
      // Re-enable this call when auto barge-in is ready for production.
      if (replyText) {
        lastAiReplyRef.current = replyText;
        azureSpeakText(replyText, speedRateRef.current, turnId);
      }
    };

    const handleSessionEnded = (_data: unknown) => {
      isAiSpeakingRef.current = false;
      onSessionStateChangeRef.current('ended');
      sessionStateRef.current = 'ended';
    };

    const handleError = (data: unknown) => {
      console.error('[useVoiceClient] transport error', data);
    };

    transport.on('session.ready',      handleSessionReady);
    transport.on('transcript.update',  handleTranscriptUpdate);
    transport.on('ai.thinking',        handleAiThinking);
    transport.on('ai.speaking',        handleAiSpeaking);
    transport.on('session.ended',      handleSessionEnded);
    transport.on('error',              handleError);
    transport.connect(sessionId, sessionToken ?? undefined);

    return () => {
      if (countdownTimeout) clearTimeout(countdownTimeout);
      transport.off('session.ready',     handleSessionReady);
      transport.off('transcript.update', handleTranscriptUpdate);
      transport.off('ai.thinking',       handleAiThinking);
      transport.off('ai.speaking',       handleAiSpeaking);
      transport.off('session.ended',     handleSessionEnded);
      transport.off('error',             handleError);
    };
  }, [transport, sessionId, sessionToken, _warmUpMic]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      _stopSilenceTimer();
      _stopRecorder();
      if (vadRafRef.current) cancelAnimationFrame(vadRafRef.current);
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch { /* ignore */ }
        audioContextRef.current = null;
        analyserRef.current = null;
      }
      // Close the persistent mic stream on unmount only (not on stopListening).
      // The stream is kept alive between turns to avoid getUserMedia spin-up.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      micReadyRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Internal helpers ──────────────────────────────────────────────────────────

  function _stopSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function _stopRecorder() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
    recorderRef.current = null;
    chunksRef.current = [];
  }

  /** POST recorded audio blob to /api/stt/normalize and return normalization result. */
  async function _callSpeechNormalize(blob: Blob): Promise<SpeechNormalizationResult | null> {
    try {
      const form = new FormData();
      form.append('audio', blob, 'utterance.webm');
      // Pass session_id so the backend can look up video context for keyterm biasing.
      if (sessionId) form.append('session_id', sessionId);
      const res = await fetch(`/api/stt/normalize`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        console.error('[useVoiceClient] STT endpoint returned', res.status);
        return null;
      }
      return await res.json() as SpeechNormalizationResult;
    } catch (err) {
      console.error('[useVoiceClient] STT fetch failed', err);
      return null;
    }
  }

  /**
   * Called when the commit window expires (or stopListening is called manually).
   * Finalises the recorded audio, sends it to Groq, then routes the result.
   */
  const _commitTurn = useCallback(async () => {
    console.log('[gstack] commitTurn start');
    _stopSilenceTimer();

    if (vadRafRef.current) {
      cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }

    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;

    // Stop MediaRecorder — ondataavailable will fire once more to flush remaining chunks
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      // Give ondataavailable a tick to flush
      await new Promise<void>((res) => setTimeout(res, 50));
    }

    const chunks = chunksRef.current;
    chunksRef.current = [];
    recorderRef.current = null;

    if (!chunks.length) {
      onSessionStateChangeRef.current('idle');
      sessionStateRef.current = 'idle';
      return;
    }

    // ── Mock mode: no real Groq call ─────────────────────────────────────────
    const mock = transport as Partial<MockTransport>;
    if (typeof mock.simulateUserSpeech === 'function') {
      mock.simulateUserSpeech();
      return;
    }

    // ── Real mode: send to Groq ──────────────────────────────────────────────
    onSessionStateChangeRef.current('speech_processing');
    sessionStateRef.current = 'speech_processing';

    // ── Guard: discard accidental short taps ────────────────────────────────
    // If the user held the mic for under MIN_RECORDING_MS, the audio is almost
    // certainly a tap noise or silence. Sending it to STT causes hallucinations.
    // This check runs BEFORE the blob size check because blob size is not a
    // reliable proxy for recording duration (WebM has a fixed-size header that
    // can make even silence look like >4000 bytes).
    const recordingDurationMs = Date.now() - recordingStartedAtRef.current;
    if (recordingDurationMs < MIN_RECORDING_MS) {
      console.log(`[gstack] recording too short (${recordingDurationMs}ms < ${MIN_RECORDING_MS}ms), discarding — accidental tap`);
      onSessionStateChangeRef.current('idle');
      sessionStateRef.current = 'idle';
      return;
    }

    const audioBlob = new Blob(chunks, { type: 'audio/webm' });
    if (audioBlob.size < 4000) {
      console.log(`[gstack] audio blob too small (${audioBlob.size} bytes), ignoring turn`);
      onSessionStateChangeRef.current('idle');
      sessionStateRef.current = 'idle';
      return;
    }

    console.log(`[gstack] calling /api/stt/normalize + blob size: ${audioBlob.size}`);
    const normResult = await _callSpeechNormalize(audioBlob);

    if (!normResult) {
      // Provider error — surface non-blocking and return to idle
      console.warn('[useVoiceClient] STT returned null — provider error, returning to idle');
      onSessionStateChangeRef.current('idle');
      sessionStateRef.current = 'idle';
      return;
    }

    // Notify parent of normalization details (for trust-label display)
    // Pass verbatim + normalized so useTranscript can show "AI hiểu là" when they differ.
    onNormalizationRef.current?.(normResult);

    if (normResult.normalization_status === 'provider_error') {
      onSessionStateChangeRef.current('idle');
      sessionStateRef.current = 'idle';
      return;
    }

    if (normResult.normalization_status === 'clarification_needed') {
      // filler-only / empty — do NOT push to ai_thinking; stay idle
      onSessionStateChangeRef.current('idle');
      sessionStateRef.current = 'idle';
      return;
    }

    const normalizedText = normResult.normalized_english.trim();
    if (!normalizedText) {
      onSessionStateChangeRef.current('idle');
      sessionStateRef.current = 'idle';
      return;
    }

    // Commit user transcript to UI using verbatim_text (what the user actually said,
    // including any Vietnamese / code-switched words).
    const verbatimText = (normResult.verbatim_text || normResult.provider_text || normalizedText).trim();
    onTranscriptEventRef.current({
      type: 'transcript.update',
      text: verbatimText,
      isFinal: true,
      sender: 'user',
    } as PipecatRealtimeEvent);

    // Send normalized_english to backend WS — this goes to the LLM.
    // Code-switch context is sent via the separate `meta` field, NOT embedded in `text`.
    // This prevents:
    //   (a) The LLM mirroring back Vietnamese text as if it were user input.
    //   (b) TF-IDF retrieval queries being contaminated with Vietnamese tokens.
    //   (c) Session history accumulating noisy bilingual strings.
    if (typeof transport.send === 'function') {
      transport.send({
        type: 'user.turn',
        text: normalizedText,
        meta: {
          source_language_mode: normResult.source_language_mode,
          verbatim_text: verbatimText,
          contains_code_switch: normResult.notes.contains_code_switch,
          normalization_applied: normResult.notes.normalization_applied,
          asr_correction_applied: normResult.notes.asr_correction_applied ?? false,
          stt_low_confidence: normResult.notes.stt_low_confidence ?? false,
          turn_handling_mode: normResult.notes.turn_handling_mode,
          user_intent: normResult.notes.user_intent,
          embedded_phrase_source: normResult.notes.embedded_phrase_source,
          provider_used: normResult.provider_used,
          fallback_reason: normResult.fallback_reason,
        },

      });
    }


    onSessionStateChangeRef.current('thinking');
    sessionStateRef.current = 'thinking';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport]);

  // ── Public: startListening ────────────────────────────────────────────────────
  const startListening = useCallback((manual: boolean = false) => {
    if (isMuted) return;

    const currentState = sessionStateRef.current;

    // Block new turn submission in processing/thinking states
    if (BLOCKING_STATES.includes(currentState)) return;

    // If interrupting AI speaking (barge-in) — stop TTS immediately
    if (currentState === 'speaking') {
      if (!manual && !ENABLE_AUTO_BARGE_IN) return;
      isAiSpeakingRef.current = false;
      azureStop();
    }

    if (isRecordingRef.current) return; // already listening

    isRecordingRef.current = true;
    recordingStartedAtRef.current = Date.now();
    chunksRef.current = [];
    onSessionStateChangeRef.current('listening');
    sessionStateRef.current = 'listening';

    // ── Mock mode ────────────────────────────────────────────────────────────
    const mock = transport as Partial<MockTransport>;
    if (typeof mock.simulateUserSpeech === 'function') {
      // Pass constraints inline to prevent bundler dead-code elimination
      navigator.mediaDevices?.getUserMedia({ audio: true, video: false })
        .then((stream) => { streamRef.current = stream; })
        .catch(() => {});
      mock.simulateUserSpeech();
      return;
    }

    // ── Real mode: MediaRecorder ─────────────────────────────────────────────
    // A3 FIX: Reuse the warm-up stream if already open — zero spin-up, zero
    // first-syllable loss. Only fall back to a fresh getUserMedia call when the
    // persistent stream is not ready (e.g. permission not yet granted).
    const _startRecorderOnStream = (stream: MediaStream) => {
      // Pick a supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          if (chunksRef.current.length === 0) {
            console.log(`[gstack] first audio chunk. size: ${e.data.size}`);
          }
          chunksRef.current.push(e.data);
        }
      };

      // Removed recorder.onstart: some browsers fail to fire it, causing UI to
      // get stuck in 'listening' state indefinitely.
      recorder.onstop = () => {
        // Handled in _commitTurn; nothing to do here
      };

      // Collect chunks frequently for VAD responsiveness
      console.log(`[gstack] MediaRecorder.start(100) — persistent stream: ${micReadyRef.current}`);
      recorder.start(100);
      isRecordingRef.current = true;
      onSessionStateChangeRef.current('recording');
      sessionStateRef.current = 'recording';
    };

    if (micReadyRef.current && streamRef.current) {
      // Fast path: stream already warm — MediaRecorder starts instantly
      console.log('[gstack] reusing warm mic stream ✓');
      _startRecorderOnStream(streamRef.current);
    } else {
      // Cold path: first call or warm-up failed — request mic now
      const constraints = { audio: true as boolean | MediaTrackConstraints, video: false as boolean | MediaTrackConstraints };
      if (!constraints.audio) {
        console.error('[useVoiceClient] FATAL: audio constraint was stripped by bundler — cannot start mic');
        isRecordingRef.current = false;
        onSessionStateChangeRef.current('idle');
        sessionStateRef.current = 'idle';
        return;
      }
      console.log('[gstack] cold getUserMedia (warm-up not ready)');
      navigator.mediaDevices?.getUserMedia(constraints)
        .then((stream) => {
          console.log('[gstack] cold getUserMedia success');
          streamRef.current = stream;
          micReadyRef.current = true;
          _startRecorderOnStream(stream);
        })
        .catch((err) => {
          console.warn('[useVoiceClient] getUserMedia failed', err);
          showToast('Không thể truy cập Micro. Hãy kiểm tra quyền trên trình duyệt/Windows!', { type: 'error', duration: 4000 });
          isRecordingRef.current = false;
          onSessionStateChangeRef.current('idle');
          sessionStateRef.current = 'idle';
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMuted, transport, azureStop]);

  // ── Public: stopListening (manual mic button release) ────────────────────────
  const stopListening = useCallback(() => {
    console.log(`[gstack] stopListening called`);
    if (!isRecordingRef.current) return;
    // Skip straight to commit (bypass turn_candidate_end when user explicitly stops)
    _commitTurn();
  }, [_commitTurn]);

  /**
   * Signal a natural end-of-speech pause detected externally (e.g., VAD).
   * Enters turn_candidate_end state with MIN_SILENCE_MS window.
   * If startListening is called again before the window expires, the timer is
   * cancelled and recording continues in the same utterance.
   */
  const signalSpeechPause = useCallback(() => {
    if (!isRecordingRef.current) return;
    if (Date.now() - recordingStartedAtRef.current < 500) return; // MIN_TALK_MS

    onSessionStateChangeRef.current('turn_candidate_end');
    sessionStateRef.current = 'turn_candidate_end';

    _stopSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      silenceTimerRef.current = null;
      _commitTurn();
    }, MIN_SILENCE_MS);
  }, [_commitTurn]);

  /**
   * Called if speech resumes during turn_candidate_end window.
   * Cancels the pending commit and returns to 'recording'.
   */
  const resumeRecording = useCallback(() => {
    if (sessionStateRef.current !== 'turn_candidate_end') return;
    _stopSilenceTimer();
    onSessionStateChangeRef.current('recording');
    sessionStateRef.current = 'recording';
  }, []);

  // ── Toggle mute ───────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        _stopSilenceTimer();
        _stopRecorder();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        isRecordingRef.current = false;
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── VAD monitoring (barge-in detection during AI speaking) ───────────────────
  const startVadMonitoring = useCallback(() => {
    if (!ENABLE_AUTO_BARGE_IN) return;
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

    // Grace period: TTS vừa bắt đầu phát, echo/rè từ loa dễ lọt vào mic nhất ở
    // những ms đầu tiên trước khi echoCancellation kịp thích nghi. Bỏ qua barge-in
    // check trong khoảng này.
    const monitorStartedAt = Date.now();
    const GRACE_MS = 500;

    // Yêu cầu âm lượng vượt ngưỡng LIÊN TỤC nhiều frame — echo/tiếng ồn thường
    // chỉ là 1-2 tick rời rạc, giọng nói thật kéo dài hàng chục ms trở lên.
    let consecutiveHits = 0;
    const REQUIRED_CONSECUTIVE_FRAMES = 8; // ~130ms ở 60fps
    const VOLUME_THRESHOLD = 35; // nâng nhẹ so với 30 cũ

    const checkVolume = () => {
      if (!isAiSpeakingRef.current) return;

      if (Date.now() - monitorStartedAt < GRACE_MS) {
        vadRafRef.current = requestAnimationFrame(checkVolume);
        return;
      }

      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const average = sum / dataArray.length;

      if (average > VOLUME_THRESHOLD) {
        consecutiveHits++;
        if (consecutiveHits >= REQUIRED_CONSECUTIVE_FRAMES) {
          console.log('[useVoiceClient] VAD barge-in detected (sustained)');
          startListening();
          return;
        }
      } else {
        consecutiveHits = 0;
      }
      vadRafRef.current = requestAnimationFrame(checkVolume);
    };

    if (vadRafRef.current) cancelAnimationFrame(vadRafRef.current);
    checkVolume();
  }, [isMuted, startListening]);

  // ── Quick-prompt (mock / future text channel) ────────────────────────────────
  const sendPrompt = useCallback((text: string) => {
    const mock = transport as Partial<MockTransport>;
    if (typeof mock.simulatePrompt === 'function') {
      mock.simulatePrompt(text);
    }
  }, [transport]);

  return {
    isMuted,
    startListening,
    stopListening,
    signalSpeechPause,
    resumeRecording,
    toggleMute,
    sendPrompt,
  };
}
