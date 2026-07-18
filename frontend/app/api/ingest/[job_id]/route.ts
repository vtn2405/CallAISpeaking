import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ job_id: string }> }
) {
  try {
    const resolvedParams = await params;
    const jobId = resolvedParams.job_id;
    
    // In dev, defaults to localhost:8000, in prod should be your Azure VPS URL
    const workerUrl = (process.env.INGESTION_WORKER_URL || 'http://localhost:8000').replace(/\/$/, '');
    
    const response = await fetch(`${workerUrl}/api/ingest/${jobId}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ingestion Worker Status Error:', errorText);
      return NextResponse.json({ error: 'Failed to fetch job status from worker' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API /ingest/[job_id] GET error:', error);
    return NextResponse.json({ error: 'Internal server error communicating with worker' }, { status: 500 });
  }
}
