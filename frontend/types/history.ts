// ─── Transcript Archive Types ─────────────────────────────────────────────────
// These types model the read-only archive stored in IndexedDB.
// They are intentionally separate from the live-call types in call.ts.
// Data flows one-way: Live Call State → Archive. Never the other direction.

/** Status lifecycle of an archived session. */
export type SessionStatus = 'active' | 'completed' | 'abandoned';

/**
 * A single archived conversation session.
 * Stored in the `sessions` object store in IndexedDB.
 */
export interface ArchivedSession {
  /** UUID, generated at createSessionDraft() time. */
  id: string;

  /** Guest identity — UUID stored in LocalStorage. Future: maps to auth user_id. */
  guest_id: string;

  /** Display title. Derived from video_title or first user message. */
  title: string;

  /** Short preview shown in "Trò chuyện gần đây" list without loading messages. */
  preview_text: string;

  /** ISO 8601 string — when the session was first created (call started). */
  created_at: string;

  /** ISO 8601 string — last time session or any of its messages were written. */
  updated_at: string;

  /** Lifecycle status. Default: 'active'. Set to 'completed' on endSession. */
  status: SessionStatus;

  /**
   * Optional context for the source video.
   * Kept here so the list can show "Từ: [video title]" without scanning messages.
   */
  video_title?: string;

  /** YouTube video ID, extracted at call start to display thumbnails. */
  video_id?: string;

  /** YouTube channel name, extracted via oEmbed. */
  channel_name?: string;

  /** Total call duration in seconds. Populated on completeSession(). */
  duration_seconds?: number;

  /** Which chat mode the user selected (e.g. video_chat vs beginner). */
  mode?: 'video_chat' | 'beginner';
}

/**
 * A single message within a session.
 * Stored in the `messages` object store in IndexedDB.
 */
export interface ArchivedMessage {
  /** UUID, generated per message. */
  id: string;

  /** Foreign key — links to ArchivedSession.id. */
  session_id: string;

  /** 'user' = STT verbatim text; 'ai' = AI reply text. */
  role: 'user' | 'ai';

  /** The text content of the message. */
  content: string;

  /** ISO 8601 string. Used for deterministic sort order within a session. */
  created_at: string;

  /**
   * Monotonically increasing integer within a session (0, 1, 2, …).
   * Used as a stable tiebreaker if two messages share the same created_at ms.
   */
  sequence: number;
}
