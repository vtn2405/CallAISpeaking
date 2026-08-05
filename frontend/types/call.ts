// ─── Session lifecycle ─────────────────────────────────────────────────────────
export type CallSessionState =
  | 'initializing'      // Fetching video context / awaiting session.ready
  | 'countdown'         // 3-2-1 ritual before AI speaks
  | 'idle'              // Ready, waiting for user
  | 'listening'         // Mic is hot, MediaRecorder is capturing chunks
  | 'recording'         // Audio data is actively being recorded (can be same as listening)
  | 'turn_candidate_end'// Short pause detected — waiting the commit window before finalising
  | 'speech_processing' // Audio sent to Groq; awaiting normalized_english result
  | 'thinking'          // normalized_english sent to Azure; awaiting LLM reply
  | 'speaking'          // AI is speaking (Azure TTS playing)
  | 'ended';            // Session terminated

// ─── Mic state (internal to useVoiceClient) ───────────────────────────────────
export type MicState = 'idle' | 'listening' | 'muted' | 'locked';

// ─── AI state (internal to useVoiceClient) ────────────────────────────────────
export type AiState = 'idle' | 'thinking' | 'speaking';

// ─── Transcript message ────────────────────────────────────────────────────────
export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
}

// ─── Beginner helper types ─────────────────────────────────────────────────────

/** One response idea returned by the hints API. */
export interface HintSuggestion {
  type: 'answer' | 'question' | 'reaction';
  /** A1–A2 English suggestion text. */
  en: string;
  /** Vietnamese translation. */
  vi: string;
}

/**
 * Full result from POST /api/sessions/[id]/hints.
 * Feeds BOTH "Tôi nên nói gì?" and "Câu đó nghĩa là gì?" buttons from ONE call.
 */
export interface HintResult {
  /** Vietnamese explanation of what the AI just said. */
  sentence_vi: string;
  suggestions: HintSuggestion[];
}

/**
 * Full result from POST /api/lookup.
 * term may be wider than the word the user tapped (collocation expansion).
 * startChar/endChar are offsets into the originalSentence string —
 * use these (NOT the tapped word) for inline highlight rendering.
 */
export interface LookupResult {
  term: string;
  type: 'WORD' | 'COLLOCATION';
  meaning_vi: string;
  collocation_note: string;
  startChar: number | null;
  endChar: number | null;
  is_offline?: boolean;
}

// ─── REST API contracts ────────────────────────────────────────────────────────

/** POST /api/sessions/init request body */
export interface SessionInitRequest {
  videoUrl: string;
  /** "video_chat" (default) or "beginner" */
  mode?: 'video_chat' | 'beginner';
}

/** POST /api/sessions/init response */
export interface SessionInitResponse {
  sessionId: string;
  /** One-time WS auth token. Sent as the first WS frame { type: "auth", token }. */
  sessionToken?: string;
  status: 'processing' | 'ready';
  metadata: {
    title: string;
    channelName?: string;
    duration?: number;       // seconds
    thumbnailUrl?: string;
    mode?: 'video_chat' | 'beginner';
  };
}

/** POST /api/sessions/:id/end request body */
export interface SessionEndRequest {
  durationSeconds: number;
}

/** POST /api/sessions/:id/end response */
export interface SessionEndResponse {
  success: boolean;
  report?: {
    summary?: string;
  };
}

// ─── Realtime event discriminated union ───────────────────────────────────────
// These are the 6 events the Pipecat backend will emit over the transport.
// The transport layer fires them; hooks interpret them.

export interface SessionReadyEvent {
  type: 'session.ready';
  sessionId: string;
  metadata: SessionInitResponse['metadata'];
}

export interface TranscriptUpdateEvent {
  type: 'transcript.update';
  text: string;
  isFinal: boolean;
  sender: 'user' | 'ai';
  turn_id?: string;
}

export interface AiThinkingEvent {
  type: 'ai.thinking';
}

export interface AiSpeakingEvent {
  type: 'ai.speaking';
  text: string;
}

export interface SessionEndedEvent {
  type: 'session.ended';
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  code?: string;
}

/** Union of all realtime events the frontend must handle */
export type PipecatRealtimeEvent =
  | SessionReadyEvent
  | TranscriptUpdateEvent
  | AiThinkingEvent
  | AiSpeakingEvent
  | SessionEndedEvent
  | ErrorEvent;

// ─── Speech Normalization result ──────────────────────────────────────────────
/** Response from POST /api/stt/normalize (Provider-Agnostic Normalization Layer) */
export interface SpeechNormalizationResult {
  /** Near-verbatim audio as the STT provider heard it — canonical source for the UI ("Bạn nói"). */
  verbatim_text: string;
  /** Alias for verbatim_text — kept for backward compatibility. */
  provider_text: string;
  /** Clean, intent-preserving English string to feed the LLM turn engine. */
  normalized_english: string;
  source_language_mode: 'english' | 'mixed_vi_en' | 'mostly_vietnamese' | 'unknown';
  mode_used: 'transcription' | 'translation' | 'transcription+translation';
  normalization_status: 'ok' | 'fallback_used' | 'clarification_needed' | 'provider_error';
  /** Which STT provider delivered the transcript (for migration debugging). */
  provider_used: 'deepgram' | 'groq' | null;
  /** Which translation provider was used, if any. */
  translation_provider_used: 'groq_llm' | 'groq_whisper' | null;
  /** Why a fallback was triggered, or null if primary path succeeded. */
  fallback_reason: string | null;
  notes: {
    contains_code_switch: boolean;
    contains_fillers_only: boolean;
    contains_proper_noun: boolean;
    needs_clarification: boolean;
    /** True when verbatim_text !== normalized_english — UI shows "AI hiểu là" label. */
    normalization_applied: boolean;
    asr_correction_applied?: boolean;
    /** Low-confidence signal: true when STT used fallback/translation path. */
    stt_low_confidence?: boolean;
    turn_handling_mode?: string;
    user_intent?: string;
    embedded_phrase_source?: string;
  };
}

/** @deprecated Use SpeechNormalizationResult instead. Will be removed after frontend rollout. */
export type GroqNormalizationResult = SpeechNormalizationResult;
