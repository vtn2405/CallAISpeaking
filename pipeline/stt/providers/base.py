"""
base.py — Abstract STT provider interface.

All providers must implement STTProvider and return a TranscriptionResult,
not a plain string. This structured result allows Phase 2 benchmarking
(Deepgram vs Groq) without having to change the abstraction.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class TranscriptionResult:
    """Structured transcription output, provider-agnostic.

    Fields not supported by a given provider are set to None.
    """
    text: str
    provider: str
    confidence: float | None = None
    detected_language: str | None = None
    raw_response_meta: dict | None = None

    def is_empty(self) -> bool:
        return not self.text.strip()


class STTProvider(ABC):
    """Abstract base class for all STT providers."""

    @abstractmethod
    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        filename: str,
        *,
        hint_language: str | None = None,
    ) -> TranscriptionResult | None:
        """Transcribe audio bytes and return a structured result.

        Returns None if transcription fails so callers can apply fallback logic.

        Args:
            audio_bytes: Raw audio data.
            filename: Original filename, used to hint MIME type to the provider.
            hint_language: Optional BCP-47 language tag to hint to the provider.
        """
        ...

    @abstractmethod
    async def translate_audio(
        self,
        audio_bytes: bytes,
        filename: str,
    ) -> TranscriptionResult | None:
        """Directly translate audio to English (audio-level fallback only).

        Only Groq/Whisper supports this today. Returns None if unavailable
        or if the call fails.
        """
        ...
