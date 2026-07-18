import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // In dev, defaults to localhost:8000, in prod should be your Azure VPS URL
    const workerUrl = (process.env.INGESTION_WORKER_URL || 'http://localhost:8000').replace(/\/$/, '');
    
    const response = await fetch(`${workerUrl}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ingestion Worker Error:', errorText);
      return NextResponse.json({ error: 'Failed to start ingestion job on worker' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API /ingest POST error:', error);
    return NextResponse.json({ error: 'Internal server error communicating with worker' }, { status: 500 });
  }
}
