/**
 * identity.ts — Guest identity layer.
 *
 * Rules:
 *  - LocalStorage is the ONLY place guest_id lives (it is tiny, string, never grows).
 *  - IndexedDB is NOT used here — it is reserved for transcript archive data.
 *  - guest_id is stable for the lifetime of the browser profile.
 *  - When auth is added, map guest_id → real user_id; never remove old sessions.
 *
 * Storage split:
 *   LocalStorage  → guest_id, lightweight UI flags
 *   IndexedDB     → ArchivedSession, ArchivedMessage (transcript archive)
 *   Cookies       → Supabase session (user_id)
 */

import { createClient } from './supabase/client';

const GUEST_ID_KEY = 'chatboxai_guest_id';

/**
 * Returns the stable guest ID for this browser.
 * Creates one via crypto.randomUUID() and persists it to LocalStorage
 * if it does not yet exist.
 *
 * Safe to call synchronously when we only need the guest ID (e.g. for migration).
 * Returns null in environments without LocalStorage (e.g. SSR).
 */
export function getOrCreateGuestId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const existing = localStorage.getItem(GUEST_ID_KEY);
    if (existing) return existing;

    const id = crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
    return id;
  } catch {
    // LocalStorage may be blocked in some private modes or sandboxed iframes.
    // Return a session-scoped fallback so the app still functions — just
    // without persistence across tabs.
    return crypto.randomUUID();
  }
}

/** Read guest_id without creating one. Returns null if not yet set. */
export function getGuestId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(GUEST_ID_KEY);
  } catch {
    return null;
  }
}

/** 
 * Forces a rotation of the guest ID. 
 * Used after a successful guest -> user migration so the old bucket is empty. 
 */
export function rotateGuestId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const id = crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
    return id;
  } catch {
    return null;
  }
}

/**
 * Gets the current effective identity: Supabase user.id if logged in, 
 * otherwise the local guest_id.
 */
export async function getUserIdentity(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user?.id) {
      return session.user.id;
    }
  } catch (error) {
    // If Supabase is not configured or errors out, fallback to guest
    console.error('Failed to get Supabase session:', error);
  }

  // Fallback to guest ID
  return getOrCreateGuestId();
}
