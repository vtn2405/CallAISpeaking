import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  try {
    const resolvedParams = await params;
    const jobId = resolvedParams.job_id;

    // Frontend only talks to Pipeline (Railway). Worker is invisible to Frontend.
    const pipelineUrl = (process.env.PIPECAT_SHIM_URL || 'http://localhost:8000').replace(/\/$/, '');

    const response = await fetch(`${pipelineUrl}/api/ingest/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.PIPELINE_SECRET || 'dev-pipeline-secret'}`,
      },
    });

    if (response.status === 404) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Pipeline returns structured error codes — forward them directly
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    // Stable schema from Pipeline: { job_id, status, progress, error_code }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API /ingest/[job_id] GET error:', error);
    return NextResponse.json(
      { error_code: 'TRANSCRIPT_PROVIDER_DOWN', message: 'Cannot reach pipeline service' },
      { status: 503 }
    );
  }
}
