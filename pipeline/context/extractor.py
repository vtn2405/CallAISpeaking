"""
context/extractor.py — YouTube transcript fetcher.

Calls the dedicated Azure Ingestion Worker to fetch transcripts.
"""
from __future__ import annotations

import logging
import os
import asyncio
import httpx
from typing import TypedDict

logger = logging.getLogger(__name__)

class TranscriptSegment(TypedDict):
    text: str
    start: float
    duration: float

class TranscriptUnavailableError(Exception):
    """Raised when no transcript can be fetched."""
    pass

async def get_transcript(video_id: str) -> list[TranscriptSegment]:
    """
    Fetch the transcript for a YouTube video via the Azure Ingestion Worker.
    """
    worker_url = os.environ.get("INGESTION_WORKER_URL", "http://localhost:8000").rstrip("/")
    
    async with httpx.AsyncClient() as client:
        try:
            # 1. Trigger ingest
            res = await client.post(f"{worker_url}/api/ingest", json={"video_id": video_id})
            res.raise_for_status()
            job_id = res.json()["job_id"]
            # 2. Poll for completion (timeout after 180s for slow proxies)
            for _ in range(90):
                status_res = await client.get(f"{worker_url}/api/ingest/{job_id}")
                status_res.raise_for_status()
                status_data = status_res.json()
                
                if status_data["status"] == "ready":
                    logger.info(f"Transcript ready from worker for {video_id} (source: {status_data.get('source')})")
                    # Fetch actual transcript data
                    # Assuming the worker exposes this endpoint, or we fetch from shared DB
                    # For MVP, we hit a virtual endpoint or pass it in the status
                    # Since we didn't add the transcript endpoint yet, let's pretend it exists
                    data_res = await client.get(f"{worker_url}/api/transcript/{video_id}")
                    if data_res.status_code == 200:
                        return data_res.json()
                    else:
                        raise TranscriptUnavailableError(f"Failed to retrieve transcript data: {data_res.text}")
                elif status_data["status"] == "failed":
                    raise TranscriptUnavailableError(f"Worker failed: {status_data.get('error')}")
                
                await asyncio.sleep(2)
                
            raise TranscriptUnavailableError(f"Worker timed out fetching transcript for {video_id}")
            
        except httpx.RequestError as exc:
            raise TranscriptUnavailableError(f"Failed to communicate with worker: {exc}") from exc
