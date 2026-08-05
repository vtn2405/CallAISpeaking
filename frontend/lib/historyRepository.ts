/**
 * historyRepository.ts — Transcript archive read/write API.
 *
 * Design:
 *  - All writes go to IndexedDB via idb (db.ts).
 *  - Uses an incremental-write pattern: draft session created on call start,
 *    messages appended turn-by-turn, session status updated on end/abandon.
 *    This prevents data loss on tab crash or refresh mid-call.
 *  - All functions are async and return void or data. They never throw to callers —
 *    errors are caught and logged internally so a storage failure never crashes the call.
 *  - If IndexedDB is unavailable (private mode, storage quota exceeded), functions
 *    degrade gracefully and log a warning.
 *
 * Public API:
 *   createSessionDraft(opts)           → Call this when a call starts. Returns sessionId.
 *   appendMessage(sessionId, msg)      → Call this after each STT turn + each AI reply.
 *   appendLookupEvent(sessionId, evt)  → Call this after each word tap lookup.
 *   completeSession(sessionId, opts)   → Call this when endSession is confirmed.
 *   abandonSession(sessionId)          → Call this on beforeunload / crash path.
 *   getRecentSessions(guestId, n)      → Used by "Trò chuyện gần đây" list.
 *   getSessionMessages(sessionId)      → Used by the transcript viewer (read-only).
 *   getLookupsBySession(sessionId)     → Used by the vocabulary panel (read-only).
 */

import { getDb } from './db';
import type { ArchivedSession, ArchivedMessage, ArchivedLookupEvent } from '@/types/history';

// ── Internal helpers ──────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

/** Generates a UUID. Falls back to a timestamp-based string in very old browsers. */
function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Safely get the DB. Logs and returns null if unavailable. */
async function safeDb() {
  try {
    const db = getDb();
    if (!db) {
      console.warn('[historyRepository] IndexedDB not available (SSR or unsupported).');
      return null;
    }
    return await db;
  } catch (err) {
    console.warn('[historyRepository] Failed to open IndexedDB:', err);
    return null;
  }
}

// ── Write API ─────────────────────────────────────────────────────────────────

export interface CreateSessionDraftOptions {
  /** UUID from identity.ts */
  guest_id: string;
  /** Optional: title of the YouTube video providing context. */
  video_title?: string;
  /** Optional: ID of the YouTube video. */
  video_id?: string;
  /** Optional: YouTube channel name. */
  channel_name?: string;
  /** Optional: chat mode chosen by user. */
  mode?: 'video_chat' | 'beginner';
}

/**
 * Creates a draft session in IndexedDB the moment a call starts.
 * Status is 'active'. Messages are appended incrementally via appendMessage().
 *
 * Returns the new session ID, or null on failure.
 */
export async function createSessionDraft(opts: CreateSessionDraftOptions): Promise<string | null> {
  const db = await safeDb();
  if (!db) return null;

  const sessionId = uuid();
  const timestamp = now();

  const session: ArchivedSession = {
    id: sessionId,
    guest_id: opts.guest_id,
    title: opts.video_title ?? `Trò chuyện ${new Date().toLocaleDateString('vi-VN')}`,
    preview_text: '',
    created_at: timestamp,
    updated_at: timestamp,
    status: 'active',
    video_title: opts.video_title,
    video_id: opts.video_id,
    channel_name: opts.channel_name,
    mode: opts.mode,
  };

  try {
    await db.put('sessions', session);
    return sessionId;
  } catch (err) {
    console.warn('[historyRepository] createSessionDraft failed:', err);
    return null;
  }
}

export interface AppendMessageOptions {
  id?: string;
  role: 'user' | 'ai';
  content: string;
  /** Sequence number within this session. Caller is responsible for incrementing. */
  sequence: number;
}

/**
 * Appends a single message to a session and updates the session's
 * updated_at + preview_text (last message becomes preview).
 *
 * Call after each STT turn finalization and each AI reply.
 */
export async function appendMessage(
  sessionId: string,
  opts: AppendMessageOptions,
): Promise<void> {
  const db = await safeDb();
  if (!db) return;

  const timestamp = now();
  const message: ArchivedMessage = {
    id: opts.id || uuid(),
    session_id: sessionId,
    role: opts.role,
    content: opts.content,
    created_at: timestamp,
    sequence: opts.sequence,
  };

  try {
    const tx = db.transaction(['messages', 'sessions'], 'readwrite');

    // Write message
    await tx.objectStore('messages').put(message);

    // Update session updated_at + preview_text
    const session = await tx.objectStore('sessions').get(sessionId);
    if (session) {
      session.updated_at = timestamp;
      // Preview shows the last message, trimmed to 80 chars
      session.preview_text = opts.content.length > 80
        ? `${opts.content.slice(0, 80)}…`
        : opts.content;
      await tx.objectStore('sessions').put(session);
    }

    await tx.done;
  } catch (err) {
    console.warn('[historyRepository] appendMessage failed:', err);
  }
}

export interface CompleteSessionOptions {
  duration_seconds?: number;
}

/**
 * Marks a session as 'completed'. Call this when the user confirms endSession.
 * Only updates status, updated_at, and duration — does not modify messages.
 */
export async function completeSession(
  sessionId: string,
  opts: CompleteSessionOptions = {},
): Promise<void> {
  const db = await safeDb();
  if (!db) return;

  try {
    const session = await db.get('sessions', sessionId);
    if (!session) return;

    session.status = 'completed';
    session.updated_at = now();
    if (opts.duration_seconds !== undefined) {
      session.duration_seconds = opts.duration_seconds;
    }

    await db.put('sessions', session);
  } catch (err) {
    console.warn('[historyRepository] completeSession failed:', err);
  }
}

/**
 * Marks a session as 'abandoned'. Call this on the beforeunload / crash path.
 * Sessions that are 'abandoned' can still be read in the archive —
 * they render with a visual indicator that the call ended unexpectedly.
 */
export async function abandonSession(sessionId: string): Promise<void> {
  const db = await safeDb();
  if (!db) return;

  try {
    const session = await db.get('sessions', sessionId);
    if (!session || session.status !== 'active') return;

    session.status = 'abandoned';
    session.updated_at = now();
    await db.put('sessions', session);
  } catch (err) {
    console.warn('[historyRepository] abandonSession failed:', err);
  }
}

/**
 * Permanently deletes a session and all its messages.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = await safeDb();
  if (!db) return;

  try {
    const tx = db.transaction(['messages', 'sessions'], 'readwrite');
    
    // Delete session
    await tx.objectStore('sessions').delete(sessionId);
    
    // Delete messages associated with this session
    const messagesStore = tx.objectStore('messages');
    const index = messagesStore.index('by_session_id');
    let cursor = await index.openCursor(sessionId);
    
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    
    await tx.done;
  } catch (err) {
    console.warn('[historyRepository] deleteSession failed:', err);
    throw err; // Re-throw so UI can handle error
  }
}

/**
 * Permanently deletes all sessions and their messages for a specific guest/user.
 * Also clears lookups for those sessions.
 */
export async function clearAllHistory(guestId: string): Promise<void> {
  const db = await safeDb();
  if (!db) return;

  try {
    // 1. Get all sessions for this guest
    const sessions = await db.getAllFromIndex('sessions', 'by_guest_id', guestId);
    if (sessions.length === 0) return;

    const sessionIds = sessions.map(s => s.id);
    
    // 2. Start a transaction for all relevant stores
    const tx = db.transaction(['sessions', 'messages', 'lookups'], 'readwrite');
    
    // 3. Delete sessions
    for (const id of sessionIds) {
      await tx.objectStore('sessions').delete(id);
    }
    
    // 4. Delete messages by session_id
    const messagesStore = tx.objectStore('messages');
    const msgIndex = messagesStore.index('by_session_id');
    for (const id of sessionIds) {
      let cursor = await msgIndex.openCursor(id);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    }
    
    // 5. Delete lookups by session_id
    const lookupsStore = tx.objectStore('lookups');
    const lookupIndex = lookupsStore.index('by_session_id');
    for (const id of sessionIds) {
      let cursor = await lookupIndex.openCursor(id);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    }
    
    await tx.done;
  } catch (err) {
    console.warn('[historyRepository] clearAllHistory failed:', err);
    throw err;
  }
}

// ── Read API ──────────────────────────────────────────────────────────────────

/**
 * Returns the N most recent sessions for a given guest_id,
 * sorted descending by created_at (newest first).
 *
 * Used by "Trò chuyện gần đây" and the full history page (/library).
 */
export async function getRecentSessions(
  guestId: string,
  limit: number = 10,
): Promise<ArchivedSession[]> {
  const db = await safeDb();
  if (!db) return [];

  try {
    // Fetch all sessions for this guest. IndexedDB does not support compound
    // filter + sort natively, so we filter in-memory (acceptable for MVP scale).
    const all = await db.getAllFromIndex('sessions', 'by_guest_id', guestId);

    return all
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  } catch (err) {
    console.warn('[historyRepository] getRecentSessions failed:', err);
    return [];
  }
}

/**
 * Returns all sessions for a given guest_id, sorted descending by created_at.
 * Used by the full History page (/history).
 */
export async function getAllSessions(guestId: string): Promise<ArchivedSession[]> {
  const db = await safeDb();
  if (!db) return [];

  try {
    const all = await db.getAllFromIndex('sessions', 'by_guest_id', guestId);

    return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (err) {
    console.warn('[historyRepository] getAllSessions failed:', err);
    return [];
  }
}

/**
 * Returns all messages for a session, sorted by (sequence, created_at) ascending.
 * This is the deterministic order to display in the transcript viewer.
 */
export async function getSessionMessages(sessionId: string): Promise<ArchivedMessage[]> {
  const db = await safeDb();
  if (!db) return [];

  try {
    const messages = await db.getAllFromIndex('messages', 'by_session_id', sessionId);
    return messages.sort((a, b) => {
      if (a.sequence !== b.sequence) return a.sequence - b.sequence;
      return a.created_at.localeCompare(b.created_at);
    });
  } catch (err) {
    console.warn('[historyRepository] getSessionMessages failed:', err);
    return [];
  }
}

// ── Lookup Write API ──────────────────────────────────────────────────────────

export interface AppendLookupOptions {
  message_id: string;
  term: string;
  type: 'WORD' | 'COLLOCATION';
  meaning_vi: string;
  collocation_note: string;
  original_sentence: string;
  start_char: number | null;
  end_char: number | null;
}

/**
 * Appends a single lookup event (one tap = one row).
 * Dedup / count-by-term is performed at query time in getLookupsBySession().
 * Never throws — storage failures are logged and ignored.
 */
export async function appendLookupEvent(
  sessionId: string,
  opts: AppendLookupOptions,
): Promise<void> {
  const db = await safeDb();
  if (!db) return;

  const event: ArchivedLookupEvent = {
    id: uuid(),
    session_id: sessionId,
    message_id: opts.message_id,
    term: opts.term,
    type: opts.type,
    meaning_vi: opts.meaning_vi,
    collocation_note: opts.collocation_note,
    original_sentence: opts.original_sentence,
    start_char: opts.start_char,
    end_char: opts.end_char,
    created_at: now(),
  };

  try {
    await db.put('lookups', event);
  } catch (err) {
    console.warn('[historyRepository] appendLookupEvent failed:', err);
  }
}

// ── Lookup Read API ──────────────────────────────────────────────────────────

/**
 * Returns all lookup events for a session, sorted by created_at descending.
 *
 * Callers derive two views from this single list:
 *   1. Inline highlights: group by message_id, render highlighted spans.
 *   2. Vocabulary panel: group by term (case-insensitive), count frequency,
 *      show last meaning_vi per term.
 */
export async function getLookupsBySession(
  sessionId: string,
): Promise<ArchivedLookupEvent[]> {
  const db = await safeDb();
  if (!db) return [];

  try {
    const events = await db.getAllFromIndex('lookups', 'by_session_id', sessionId);
    return events.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch (err) {
    console.warn('[historyRepository] getLookupsBySession failed:', err);
    return [];
  }
}

// ── Migration API ─────────────────────────────────────────────────────────────

/**
 * Migrates all sessions from a guest ID to an authenticated user ID.
 * Call this on successful login or registration.
 */
export async function migrateGuestToUser(guestId: string, userId: string): Promise<void> {
  const db = await safeDb();
  if (!db) return;

  try {
    const sessions = await db.getAllFromIndex('sessions', 'by_guest_id', guestId);
    if (sessions.length === 0) return;

    const tx = db.transaction('sessions', 'readwrite');
    for (const session of sessions) {
      session.guest_id = userId;
      session.updated_at = now();
      await tx.store.put(session);
    }
    await tx.done;
  } catch (err) {
    console.warn('[historyRepository] migrateGuestToUser failed:', err);
  }
}
