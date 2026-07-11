/**
 * POST /api/sessions/init
 *
 * Generates a sessionId, builds metadata, then pre-registers the session
 * with the Python WS shim (when PIPECAT_SHIM_URL is set) so the shim has
 * a CREATED record ready before the browser opens the WebSocket.
 *
 * Without PIPECAT_SHIM_URL (mock mode), the pre-registration step is
 * skipped and MockTransport handles session.ready itself.
 *
 * The returned sessionId is what the browser passes to the WS endpoint:
 *   ws://shim/ws/sessions/{sessionId}
 */
import { NextRequest, NextResponse } from 'next/server';
import type { SessionInitResponse } from '@/types/call';

// Server-side only (not exposed to the browser)
const SHIM_URL = process.env.PIPECAT_SHIM_URL ?? '';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { videoUrl?: string; mode?: string };

  const videoUrl  = body.videoUrl ?? '';
  const mode      = body.mode === 'beginner' ? 'beginner' : 'video_chat';
  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Derive a display title from the YouTube URL
  let title = 'Video Session';
  try {
    const url = new URL(videoUrl);
    const v = url.searchParams.get('v');
    if (v) title = `YouTube Video (${v.slice(0, 8)})`;
  } catch {
    // non-URL input — keep default title
  }

  const metadata = {
    title,
    duration: 900,           // 15 min placeholder; real backend provides actual value
    thumbnailUrl: undefined as string | undefined,
    mode,                    // "video_chat" | "beginner" — read by ai_turn.py
  };

  // ── Pre-register with Python WS shim ─────────────────────────────────────
  // This creates the CREATED record so that when the browser opens the WS,
  // the shim can immediately validate the sessionId and fire session.ready.
  // If the shim is unreachable, log and continue — browser will get a WS error.
  if (SHIM_URL) {
    try {
      const res = await fetch(`${SHIM_URL}/api/sessions/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, videoUrl, metadata }),
      });
      
      if (!res.ok) {
        throw new Error(`Shim returned status ${res.status}`);
      }
      
      const data = await res.json();
      if (!data.ok) {
        return NextResponse.json({ error: data.error || 'Failed to register session' }, { status: 400 });
      }
    } catch (err) {
      console.warn('[sessions/init] Could not pre-register with shim:', err);
      return NextResponse.json({ error: 'Shim registration failed. Please ensure backend is running.' }, { status: 500 });
    }
  }

  const response: SessionInitResponse = {
    sessionId,
    status: 'processing',   // becomes 'ready' only after WS session.ready fires
    metadata,
  };

  return NextResponse.json(response, { status: 200 });
}
