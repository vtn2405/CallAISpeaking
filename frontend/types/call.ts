// ─── Session lifecycle ─────────────────────────────────────────────────────────
export type CallSessionState =
  | 'initializing' // Fetching video context / awaiting session.ready
  | 'idle'         // Ready, waiting for user
  | 'listening'    // Mic is hot, capturing audio
  | 'thinking'     // Audio sent, waiting for AI
  | 'speaking'     // AI is speaking
  | 'ended';       // Session terminated

// ─── Mic state (internal to useVoiceClient) ───────────────────────────────────
export type MicState = 'idle' | 'listening' | 'muted';

// ─── AI state (internal to useVoiceClient) ────────────────────────────────────
export type AiState = 'idle' | 'thinking' | 'speaking';

// ─── Transcript message ────────────────────────────────────────────────────────
export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
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
  status: 'processing' | 'ready';
  metadata: {
    title: string;
    duration: number;       // seconds
    thumbnailUrl?: string;
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
