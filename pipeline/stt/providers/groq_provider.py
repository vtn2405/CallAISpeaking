"""
groq_provider.py — Groq Whisper STT provider (fallback).

Contains both:
  - transcribe_audio(): Groq Whisper audio.transcriptions (primary Groq path).
  - translate_audio(): Groq Whisper audio.translations (2-layer audio fallback).
    Role (a): when transcription fails completely → direct audio-translate.
    Role (b): when LLM text translation fails → audio-translate as final net.

Do NOT remove translate_audio. It is the safety net of last resort.
"""
from __future__ import annotations

import logging
import os
from io import BytesIO

from stt.providers.base import STTProvider, TranscriptionResult

logger = logging.getLogger(__name__)


class GroqProvider(STTProvider):
    """Groq Whisper provider (transcription fallback + audio-translate fallback)."""

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or os.getenv("GROQ_API_KEY", "")

    def _make_client(self):
        try:
            from groq import AsyncGroq
            return AsyncGroq(api_key=self._api_key)
        except ImportError as exc:
            raise RuntimeError("groq package not installed") from exc

    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        filename: str,
        *,
        hint_language: str | None = None,
        keyterms: list[str] | None = None,
    ) -> TranscriptionResult | None:
        if not self._api_key:
            logger.error("[groq] GROQ_API_KEY is not set")
            return None
        try:
            client = self._make_client()
            kwargs = {}
            if hint_language:
                kwargs["language"] = hint_language

            # Build Whisper prompt: base context prompt + optional keyterm list.
            # Whisper uses the prompt field as a ~224-token prior; inject keyterms
            # so proper nouns and target vocab are biased toward correct spelling.
            # Handle empty outline gracefully: if keyterms is None/empty, skip.
            base_prompt = (
                "Tôi đang nói chuyện bằng tiếng Anh và tiếng Việt. "
                "I am speaking in English and Vietnamese. "
                "Preserve proper nouns, brand names, and place names exactly. "
                "Do not translate. Transcribe exactly as spoken."
            )
            if keyterms:
                # Append up to 30 keyterms (stay well within ~224-token Whisper prompt limit)
                terms_str = ", ".join(keyterms[:30])
                whisper_prompt = f"{base_prompt} Key terms: {terms_str}."
            else:
                whisper_prompt = base_prompt

            response = await client.audio.transcriptions.create(
                model="whisper-large-v3",
                file=(filename, BytesIO(audio_bytes)),
                response_format="text",
                prompt=whisper_prompt,
                **kwargs
            )
            text = response if isinstance(response, str) else getattr(response, "text", "")

            text = (text or "").strip()
            if not text:
                logger.warning("[groq] transcriptions returned empty text")
                return None
            logger.info("[groq] Transcription OK | text=%r", text[:80])
            return TranscriptionResult(
                text=text,
                provider="groq",
                confidence=None,
                detected_language=None,
            )
        except Exception as exc:
            logger.warning("[groq] Transcription failed: %s", exc)
            return None

    async def translate_audio(
        self,
        audio_bytes: bytes,
        filename: str,
    ) -> TranscriptionResult | None:
        """Groq Whisper audio.translations — audio-level English translation.

        Used as 2-layer fallback:
          (a) when primary transcription fails completely.
          (b) when LLM text translation (translation.py) fails.
        Must not be removed.
        """
        if not self._api_key:
            logger.error("[groq] GROQ_API_KEY is not set")
            return None
        try:
            client = self._make_client()
            response = await client.audio.translations.create(
                model="whisper-large-v3",
                file=(filename, BytesIO(audio_bytes)),
                response_format="text",
                prompt=(
                    "Translate to English. "
                    "Preserve proper nouns. "
                    "Do not translate brand names or place names."
                ),
            )
            text = response if isinstance(response, str) else getattr(response, "text", "")
            text = (text or "").strip()
            if not text:
                logger.warning("[groq] translations returned empty text")
                return None
            
            # Guard: reject common Whisper hallucinations on short/noisy audio
            lower_val = text.lower().strip(" .!?,")
            hallucinations = {
                "thank you", "thanks", "subscribe", "please subscribe",
                "thank you for watching", "thanks for watching",
                "thank you very much", "you"
            }
            if lower_val in hallucinations or len(lower_val) <= 2:
                logger.warning("[groq] audio translation rejected as hallucination | text=%r", text)
                return None

            logger.info("[groq] Audio translation OK | text=%r", text[:80])
            return TranscriptionResult(
                text=text,
                provider="groq",
                confidence=None,
                detected_language="en",
            )
        except Exception as exc:
            logger.warning("[groq] Audio translation failed: %s", exc)
            return None
