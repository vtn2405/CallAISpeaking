/**
 * db.ts — IndexedDB schema via `idb`.
 *
 * This file owns the database definition only. All reads/writes go through
 * historyRepository.ts — never call openDB directly from UI components.
 *
 * Schema:
 *   DB name    : ChatboxAIDB
 *   Version    : 2
 *
 *   Object store: sessions
 *     keyPath  : id (UUID string)
 *     Indexes  : by_guest_id (guest_id)
 *                by_created_at (created_at)
 *
 *   Object store: messages
 *     keyPath  : id (UUID string)
 *     Indexes  : by_session_id (session_id)
 *                by_session_sequence ([session_id, sequence])  — for deterministic ordering
 *
 *   Object store: lookups  [added v2]
 *     keyPath  : id (UUID string)
 *     Indexes  : by_session_id (session_id)  — fetch all lookups for a session
 *                by_session_term ([session_id, term])  — for dedup check
 *
 * Migration notes:
 *   - Bump DB_VERSION and add a new upgrade() branch when schema changes.
 *   - Never mutate an existing upgrade() branch — always add a new version block.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ArchivedSession, ArchivedMessage, ArchivedLookupEvent } from '@/types/history';

const DB_NAME = 'ChatboxAIDB';
const DB_VERSION = 2;

interface ChatboxAISchema extends DBSchema {
  sessions: {
    key: string;
    value: ArchivedSession;
    indexes: {
      by_guest_id: string;
      by_created_at: string;
    };
  };
  messages: {
    key: string;
    value: ArchivedMessage;
    indexes: {
      by_session_id: string;
      by_session_sequence: [string, number];
    };
  };
  lookups: {
    key: string;
    value: ArchivedLookupEvent;
    indexes: {
      by_session_id: string;
      by_session_term: [string, string];
    };
  };
}

let _dbPromise: Promise<IDBPDatabase<ChatboxAISchema>> | null = null;

/**
 * Returns a singleton promise for the IndexedDB connection.
 * Safe to call multiple times — opens the DB only once per page load.
 *
 * Returns null in SSR environments (no `window`).
 */
export function getDb(): Promise<IDBPDatabase<ChatboxAISchema>> | null {
  if (typeof window === 'undefined') return null;

  if (!_dbPromise) {
    _dbPromise = openDB<ChatboxAISchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Version 1 — initial schema
        if (oldVersion < 1) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('by_guest_id', 'guest_id');
          sessionStore.createIndex('by_created_at', 'created_at');

          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('by_session_id', 'session_id');
          messageStore.createIndex('by_session_sequence', ['session_id', 'sequence']);
        }
        // Version 2 — add lookups store for word/phrase lookup event log
        if (oldVersion < 2) {
          const lookupStore = db.createObjectStore('lookups', { keyPath: 'id' });
          lookupStore.createIndex('by_session_id', 'session_id');
          // Compound index for dedup check and vocabulary panel grouping
          lookupStore.createIndex('by_session_term', ['session_id', 'term']);
        }
        // Future: add new version blocks here. Do not touch the blocks above.
      },
      blocked() {
        // Another tab has the DB open on an old version.
        console.warn('[db] IndexedDB upgrade blocked — close other tabs to proceed.');
      },
      blocking() {
        // This page is blocking a newer version from loading in another tab.
        _dbPromise = null;
      },
      terminated() {
        // The connection was terminated unexpectedly (e.g., browser killed the worker).
        _dbPromise = null;
      },
    });
  }

  return _dbPromise;
}
