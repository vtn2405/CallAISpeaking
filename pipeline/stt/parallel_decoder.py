"""
parallel_decoder.py — Parallel STT decoding for bilingual apps.

Shoots 3 concurrent requests to the STT provider (auto, en, vi)
and uses a fast LLM arbiter to pick the most phonetically faithful transcript.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from stt.providers.base import STTProvider, TranscriptionResult

logger = logging.getLogger(__name__)

_ARBITER_MODEL = "llama-3.3-70b-versatile"
_ARBITER_SYSTEM_PROMPT = """You are a transcript arbiter for a bilingual English-Vietnamese app.
Audio was transcribed simultaneously in three modes:
- AUTO_MODE (Original auto-detect): {auto_text}
- EN_MODE (Forced English): {en_text}
- VI_MODE (Forced Vietnamese): {vi_text}

The user is a Vietnamese speaker practicing English. They might speak pure English, pure Vietnamese, or mix both (Code-switching).
Your ONLY goal is transcription fidelity (closest to the original spoken audio) and preserving code-switch tokens. Do NOT act as a grammar judge. Accept grammatically incorrect text if it faithfully represents the spoken audio.
- If the user spoke mostly Vietnamese but used an English word, VI_MODE usually captures this perfectly (e.g. "Tôi không biết từ destination nghĩa là gì"). EN_MODE will look like phonetic garbage.
- If the user spoke mostly English, EN_MODE will capture it perfectly. VI_MODE might look like Vietnamese phonetic spelling ("Ai goăn tu...").
- CRITICAL FOR PROPER NOUNS: If EN_MODE contains weird Anglicized words (e.g. "Dino city", "fur") but VI_MODE or AUTO_MODE contains correct Vietnamese proper nouns (e.g. "Đà Nẵng", "phở"), you MUST pick VI_MODE or AUTO_MODE. Do NOT let EN_MODE Anglify Vietnamese names!
- If EN_MODE and VI_MODE are equally valid or both look like garbage, you can pick AUTO_MODE or UNCERTAIN.

Output ONLY a JSON object with two keys:
- "choice": must be one of "AUTO", "EN", "VI", or "UNCERTAIN".
- "reason_code": a short snake_case string explaining the choice (e.g. "vi_preserves_proper_noun", "auto_best", "vi_preserves_codeswitch", "en_more_faithful", "all_low_confidence").
"""

async def _choose_best_transcript(
    groq_client: Any,
    auto_text: str,
    en_text: str,
    vi_text: str,
) -> tuple[str, str]:
    """Ask LLM to arbiter between the three transcripts. Returns (choice, reason_code)."""
    if auto_text == en_text == vi_text:
        return "AUTO", "all_identical"

    prompt = _ARBITER_SYSTEM_PROMPT.format(
        auto_text=auto_text or "<empty>",
        en_text=en_text or "<empty>",
        vi_text=vi_text or "<empty>",
    )
    try:
        response = await groq_client.chat.completions.create(
            model=_ARBITER_MODEL,
            temperature=0,
            max_completion_tokens=256,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": prompt}],
        )
        content = (response.choices[0].message.content or "").strip()
        data = json.loads(content)
        choice = data.get("choice", "UNCERTAIN")
        reason = data.get("reason_code", "unknown")
        if choice not in ("AUTO", "EN", "VI", "UNCERTAIN"):
            choice = "UNCERTAIN"
        return choice, reason
    except Exception as exc:
        logger.warning("[stt] Parallel arbiter failed: %s", exc)
        return "UNCERTAIN", "arbiter_error"

async def parallel_transcribe(
    provider: STTProvider,
    audio_bytes: bytes,
    filename: str,
    groq_client: Any,
) -> tuple[TranscriptionResult | None, str, str]:
    """Runs 3 STT calls in parallel and picks the best one using an LLM arbiter.
    Returns (result, provider_name, fallback_reason).
    """
    logger.info("[stt] Starting parallel STT tasks...")
    auto_task = asyncio.create_task(provider.transcribe_audio(audio_bytes, filename, hint_language=None))
    en_task = asyncio.create_task(provider.transcribe_audio(audio_bytes, filename, hint_language="en"))
    vi_task = asyncio.create_task(provider.transcribe_audio(audio_bytes, filename, hint_language="vi"))

    auto_res, en_res, vi_res = await asyncio.gather(auto_task, en_task, vi_task, return_exceptions=True)

    def _extract_text(res) -> str:
        if isinstance(res, TranscriptionResult) and not res.is_empty():
            return res.text
        return ""

    auto_text = _extract_text(auto_res)
    en_text = _extract_text(en_res)
    vi_text = _extract_text(vi_res)
    
    if not auto_text and not en_text and not vi_text:
        return None, "", "all_parallel_stt_failed"

    choice, reason = await _choose_best_transcript(groq_client, auto_text, en_text, vi_text)
    logger.info("[stt] Arbiter selected %s | reason=%s | AUTO=%r EN=%r VI=%r", choice, reason, auto_text, en_text, vi_text)

    # Resolve chosen result
    chosen_res = auto_res
    if choice == "EN" and isinstance(en_res, TranscriptionResult) and not en_res.is_empty():
        chosen_res = en_res
    elif choice == "VI" and isinstance(vi_res, TranscriptionResult) and not vi_res.is_empty():
        chosen_res = vi_res
    elif choice == "AUTO" and isinstance(auto_res, TranscriptionResult) and not auto_res.is_empty():
        chosen_res = auto_res
    else:
        # Fallback to whatever is not empty
        if isinstance(auto_res, TranscriptionResult) and not auto_res.is_empty(): chosen_res = auto_res
        elif isinstance(en_res, TranscriptionResult) and not en_res.is_empty(): chosen_res = en_res
        elif isinstance(vi_res, TranscriptionResult) and not vi_res.is_empty(): chosen_res = vi_res
        else: chosen_res = None

    provider_name = provider.__class__.__name__.lower().replace("provider", "")
    if isinstance(chosen_res, TranscriptionResult):
        return chosen_res, provider_name, reason
    return None, "", "resolution_failed"
