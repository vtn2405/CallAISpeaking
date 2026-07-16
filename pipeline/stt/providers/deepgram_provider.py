"""
deepgram_provider.py — Deepgram Nova-3 STT provider.

Uses Nova-3 (not Flux) because:
  - Flux Multilingual currently does NOT support Vietnamese.
  - Nova-3 supports Vietnamese and code-switched speech natively.
  - Frontend records audio as blobs (MediaRecorder → POST blob),
    which matches Nova-3's pre-recorded/file upload flow.

Requires DEEPGRAM_API_KEY env var.
translate_audio() is not supported by Deepgram; always returns None
so the router falls back to Groq's audio-translation path.
"""
from __future__ import annotations

import logging
import os

import httpx

from stt.providers.base import STTProvider, TranscriptionResult

logger = logging.getLogger(__name__)

_DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen"
_DEEPGRAM_MODEL = "nova-3"


class DeepgramProvider(STTProvider):
    """Deepgram Nova-3 transcription provider (primary)."""

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or os.getenv("DEEPGRAM_API_KEY", "")

    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        filename: str,
        *,
        hint_language: str | None = None,
    ) -> TranscriptionResult | None:
        if not self._api_key:
            logger.error("[deepgram] DEEPGRAM_API_KEY is not set")
            return None

        params: dict = {
            "model": _DEEPGRAM_MODEL,
            "smart_format": "true",
            "punctuate": "true",
        }
        # Optionally hint language to improve mixed-language accuracy
        if hint_language:
            params["language"] = hint_language

        # Derive content-type from filename extension
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "webm"
        content_type_map = {
            "webm": "audio/webm",
            "mp4": "audio/mp4",
            "m4a": "audio/mp4",
            "mp3": "audio/mpeg",
            "wav": "audio/wav",
            "ogg": "audio/ogg",
        }
        content_type = content_type_map.get(ext, "audio/webm")

        try:
            async with httpx.AsyncClient(timeout=30) as http:
                resp = await http.post(
                    _DEEPGRAM_API_URL,
                    params=params,
                    headers={
                        "Authorization": f"Token {self._api_key}",
                        "Content-Type": content_type,
                    },
                    content=audio_bytes,
                )
                resp.raise_for_status()
                data = resp.json()

            channels = data.get("results", {}).get("channels", [])
            if not channels:
                logger.warning("[deepgram] No channels in response")
                return None

            alternatives = channels[0].get("alternatives", [])
            if not alternatives:
                logger.warning("[deepgram] No alternatives in channel")
                return None

            best = alternatives[0]
            transcript = (best.get("transcript") or "").strip()
            if not transcript:
                logger.warning("[deepgram] Empty transcript returned")
                return None

            confidence = best.get("confidence")
            detected_language = channels[0].get("detected_language")

            logger.info(
                "[deepgram] Transcription OK | confidence=%.3f | lang=%s | text=%r",
                confidence or 0.0,
                detected_language,
                transcript[:80],
            )
            return TranscriptionResult(
                text=transcript,
                provider="deepgram",
                confidence=confidence,
                detected_language=detected_language,
                raw_response_meta={
                    "model": _DEEPGRAM_MODEL,
                    "duration": data.get("metadata", {}).get("duration"),
                },
            )
        except httpx.HTTPStatusError as exc:
            logger.warning("[deepgram] HTTP error %s: %s", exc.response.status_code, exc)
            return None
        except Exception as exc:
            logger.warning("[deepgram] Transcription failed: %s", exc)
            return None

    async def translate_audio(
        self,
        audio_bytes: bytes,
        filename: str,
    ) -> TranscriptionResult | None:
        # Deepgram does not offer audio-level translation.
        # The router will fall back to Groq's _call_groq_translations.
        return None
