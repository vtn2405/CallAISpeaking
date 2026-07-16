"""
legacy_shim.py — Migration bridge for /api/stt/groq.

Keeps the old route alive so the frontend doesn't break before rollout.
Internally delegates to the new normalize_speech handler in router.py.
Remove once useVoiceClient.ts has been updated to /api/stt/normalize
and verified in production.
"""
from __future__ import annotations

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse

from stt.router import normalize_speech

legacy_router = APIRouter()


@legacy_router.post("/api/stt/groq")
async def normalize_speech_legacy(audio: UploadFile = File(...)) -> JSONResponse:
    """Legacy route — delegates to /api/stt/normalize internally."""
    return await normalize_speech(audio)
