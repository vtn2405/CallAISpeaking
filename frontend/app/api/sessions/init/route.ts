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

  // Derive a display title and channel from the YouTube URL
  let title = 'Video speaking session';
  let channelName: string | undefined = undefined;
  let videoId: string | undefined = undefined;

  try {
    // Basic regex for youtube URLs (v=... or youtu.be/...)
    const match = videoUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
    if (match) {
      videoId = match[1];
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
        // fast timeout so we don't block session init too long
        signal: AbortSignal.timeout(1500)
      });
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        title = data.title || title;
        channelName = data.author_name;
      }
    }
  } catch {
    // fallback to default title if fetch fails or URL is invalid
  }

  const metadata = {
    title,
    channelName,
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
