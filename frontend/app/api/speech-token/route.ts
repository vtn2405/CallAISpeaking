/**
 * GET /api/speech-token
 *
 * Next.js server-side proxy for the Pipeline's Azure Speech token endpoint.
 *
 * Security model:
 *   - The browser calls this Next.js route (same origin -- no CORS issue).
 *   - This route adds the PIPELINE_SECRET bearer token and forwards to Pipeline.
 *   - The Pipeline exchanges it for a short-lived Azure STS token.
 *   - The raw Azure Speech Key never reaches the browser.
 *   - The Pipeline URL + PIPELINE_SECRET never reach the browser.
 */
import { NextResponse } from 'next/server';

const SHIM_URL        = (process.env.PIPECAT_SHIM_URL ?? '').replace(/\/$/, '');
const PIPELINE_SECRET = process.env.PIPELINE_SECRET || 'dev-pipeline-secret';

export async function GET() {
  // In mock/dev mode (no shim), degrade gracefully.
  if (!SHIM_URL) {
    return NextResponse.json(
      { error: 'Speech service not configured (no PIPECAT_SHIM_URL)' },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${SHIM_URL}/api/speech-token`, {
      headers: { 'Authorization': `Bearer ${PIPELINE_SECRET}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`[speech-token] Pipeline returned ${res.status}`);
      return NextResponse.json(
        { error: 'Failed to fetch speech token from pipeline' },
        { status: res.status }
      );
    }

    const data = await res.json();
    // Forward { token, region } directly to the browser.
    return NextResponse.json(data);
  } catch (err) {
    console.error('[speech-token] Error proxying to pipeline:', err);
    return NextResponse.json({ error: 'Speech token service unavailable' }, { status: 503 });
  }
}
