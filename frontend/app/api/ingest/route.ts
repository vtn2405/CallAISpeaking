import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Frontend only talks to Pipeline (Railway). Worker is invisible to Frontend.
    const pipelineUrl = (process.env.PIPECAT_SHIM_URL || 'http://localhost:8000').replace(/\/$/, '');

    const response = await fetch(`${pipelineUrl}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Pipeline returns structured error codes — forward them directly
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API /ingest POST error:', error);
    return NextResponse.json(
      { error_code: 'TRANSCRIPT_PROVIDER_DOWN', message: 'Cannot reach pipeline service' },
      { status: 503 }
    );
  }
}
