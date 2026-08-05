import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const videoUrl = body.videoUrl ?? '';

    if (!videoUrl) {
      return NextResponse.json({ error: 'Missing videoUrl' }, { status: 400 });
    }

    // Call the Python backend prefetch endpoint
    const backendUrl = process.env.PIPELINE_URL || 'http://127.0.0.1:8000';
    const res = await fetch(`${backendUrl}/api/sessions/prefetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl }),
    });

    if (!res.ok) {
      console.warn('[sessions/prefetch] Backend returned non-ok status:', res.status);
    }

    // Always return 200 to the client since it's a fire-and-forget hint
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[sessions/prefetch] Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
