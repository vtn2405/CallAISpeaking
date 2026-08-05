"""
deepgram_provider.py — Deepgram Nova-3 STT provider.

Uses Nova-3 (not Flux) because:
  - Flux Multilingual currently does NOT support Vietnamese.
  - Nova-3 supports Vietnamese (monolingual `language=vi`).
  - Frontend records audio as blobs (MediaRecorder → POST blob),
    which matches Nova-3's pre-recorded/file upload flow.

Requires DEEPGRAM_API_KEY env var.
translate_audio() is not supported by Deepgram; always returns None
so the router falls back to Groq's audio-translation path.

── PATCH v3-detect (2026-07) ────────────────────────────────────────────────
ROOT-CAUSE FIX. The old "auto" branch (hint_language=None) sent NO `language`
param and assumed Deepgram would auto-detect. It does not:

    Deepgram docs: "All models default to `language=en` unless otherwise
    specified via the `language` parameter."
    https://developers.deepgram.com/docs/models-languages-overview

So the old auto branch was an exact duplicate of the forced-EN branch
(production logs: AUTO ≡ EN text+confidence on 100% of turns), and
Vietnamese speech was silently decoded with the English model.

Changes:
  1. hint_language=None now sends `detect_language=en&detect_language=vi`
     (real language identification, restricted to the two app languages).
     https://developers.deepgram.com/docs/language-detection
  2. Response parsing now extracts `language_confidence` (0-1) alongside
     `detected_language` and exposes both via TranscriptionResult
     (detected_language field + raw_response_meta["language_confidence"]).
     parallel_decoder v3 uses these as routing signals.
  3. Empty-transcript warnings now log which mode was requested — an empty
     forced-VI response means "not confidently Vietnamese", which is a
     signal, not an error.
"""
from __future__ import annotations

import logging
import os

import httpx

from stt.providers.base import STTProvider, TranscriptionResult

logger = logging.getLogger(__name__)

_DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen"
_DEEPGRAM_MODEL = "nova-3"

# The only two languages this app supports. Restricting detect_language to
# this set makes identification far more robust than open-ended detection
# (docs: "you can restrict the set of detectable languages").
_DETECT_LANGUAGES = ["en", "vi"]


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
        keyterms: list[str] | None = None,
    ) -> TranscriptionResult | None:
        if not self._api_key:
            logger.error("[deepgram] DEEPGRAM_API_KEY is not set")
            return None

        params: dict = {
            "model": _DEEPGRAM_MODEL,
            "smart_format": "true",
            "punctuate": "true",
        }
        if hint_language:
            # Forced-language mode. Per docs, speech in OTHER languages will
            # not be transcribed — an empty transcript here means "the audio
            # is not confidently this language", NOT that the audio is silent.
            params["language"] = hint_language
            requested_mode = f"forced_{hint_language}"
        else:
            # ── PATCH v3 ────────────────────────────────────────────────
            # BEFORE: no `language` param → Deepgram silently used EN.
            # AFTER : real language identification restricted to en/vi.
            # httpx expands the list into repeated query params:
            #   detect_language=en&detect_language=vi
            params["detect_language"] = _DETECT_LANGUAGES
            requested_mode = "detect"

        # Keyterm biasing (Nova-3 param — NOT 'keywords' which is legacy Nova-2).
        # Each keyterm is passed as a separate 'keyterm' URL param.
        # Note: Deepgram Nova-3 keyterm biasing works best for English terms;
        # for Vietnamese proper nouns, the Whisper fallback path is more reliable.
        if keyterms:
            logger.debug("[deepgram] injecting %d keyterms", len(keyterms))
            params["keyterm"] = keyterms  # httpx will expand list to repeated params

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
                logger.warning("[deepgram] No channels in response | mode=%s", requested_mode)
                return None

            alternatives = channels[0].get("alternatives", [])
            if not alternatives:
                logger.warning("[deepgram] No alternatives in channel | mode=%s", requested_mode)
                return None

            best = alternatives[0]
            transcript = (best.get("transcript") or "").strip()

            confidence = best.get("confidence")
            detected_language = channels[0].get("detected_language")
            # ── PATCH v3: language identification confidence (0-1).
            # Only present in detect mode; not supported for Whisper models.
            language_confidence = channels[0].get("language_confidence")

            if not transcript:
                # NOTE: for forced_vi / forced_en this is a routing SIGNAL
                # ("audio not confidently that language"), not a failure.
                logger.warning(
                    "[deepgram] Empty transcript | mode=%s detected=%s lang_conf=%s",
                    requested_mode, detected_language, language_confidence,
                )
                return None

            logger.info(
                "[deepgram] Transcription OK | mode=%s | confidence=%.3f | lang=%s | lang_conf=%s | text=%r",
                requested_mode,
                confidence or 0.0,
                detected_language,
                f"{language_confidence:.3f}" if isinstance(language_confidence, (int, float)) else None,
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
                    # ── PATCH v3: routing signals for parallel_decoder ──
                    "requested_mode": requested_mode,
                    "language_confidence": language_confidence,
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