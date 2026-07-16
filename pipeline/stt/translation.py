"""
translation.py — Shared text-translation step for all STT providers.

Moved as-is from stt.py. This is a post-transcription TEXT step,
not an audio-translation call (that role belongs to _call_groq_translations
in groq_provider.py as the audio fallback).

Guards (already implemented, unchanged from stt.py):
  - Rejects empty or whitespace-only output.
  - Rejects output if length ratio vs input is outside 0.1x–3.0x.
  - On any exception returns None so callers can fall back gracefully.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

_LLM_TRANSLATION_MODEL = "openai/gpt-oss-20b"
_LLM_TRANSLATION_SYSTEM_PROMPT = (
    "Translate the following Vietnamese (or mixed Vietnamese/English) text into English. "
    "Translate as literally as possible — preserve the speaker's original meaning and word choice. "
    "Do NOT paraphrase, improve phrasing, or make the output sound more natural. "
    "Preserve proper nouns, brand names, and place names in their original form. "
    "Output ONLY the translated English text — no explanation, no quotes, no extra text."
)


async def call_llm_translation(client, text: str) -> str | None:
    """Translate Vietnamese (or mixed VI/EN) text to English via LLM call.

    This replaces Whisper audio.translations for the main normalization path
    so we can apply VI ASR correction first and control the translation at text level.
    Whisper audio translation (_call_groq_translations in groq_provider.py) is kept
    only as the last-resort audio fallback.

    Guard: output must be non-empty and length ratio must be 0.1–3.0x input length.
    Returns None on guard failure or exception so the caller can fall back safely.
    """
    if not text.strip():
        return None
    try:
        response = await client.chat.completions.create(
            model=_LLM_TRANSLATION_MODEL,
            temperature=0,
            max_completion_tokens=512,
            messages=[
                {"role": "system", "content": _LLM_TRANSLATION_SYSTEM_PROMPT},
                {"role": "user",   "content": text},
            ],
        )
        translated = (response.choices[0].message.content or "").strip()
        if not translated:
            logger.warning("[stt] LLM translation returned empty output for: %r", text[:80])
            return None

        # Length sanity: translated English should be plausible vs. input length
        ratio = len(translated) / max(len(text), 1)
        if ratio < 0.1 or ratio > 3.0:
            logger.warning(
                "[stt] LLM translation length sanity check failed | ratio=%.2f | "
                "input_len=%d | output_len=%d | input=%r",
                ratio, len(text), len(translated), text[:60],
            )
            return None

        logger.info(
            "[stt] LLM translation accepted | ratio=%.2f | %r -> %r",
            ratio, text[:60], translated[:60],
        )
        return translated
    except Exception as exc:
        logger.warning("[stt] LLM translation failed: %s", exc)
        return None
