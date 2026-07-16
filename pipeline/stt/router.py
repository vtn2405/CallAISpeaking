"""
router.py — Provider-agnostic STT normalization endpoint.

POST /api/stt/normalize

Fallback policy:
  1. Deepgram Nova-3 (primary)
  2. Groq Whisper transcription (fallback if Deepgram fails)
  3. Groq Whisper audio.translations (last-resort if transcription path fails entirely)

Feature flags (set in .env):
  STT_ENABLE_EN_ASR_CORRECTION=false   (default Phase 1 — conservative)
  STT_ENABLE_VI_ASR_CORRECTION=true    (default Phase 1 — guards in place, fixes bug)
  DEEPGRAM_API_KEY                     (required for primary path)
  GROQ_API_KEY                         (required for fallback path + LLM translation)

JSON response extends the legacy stt.py envelope with:
  provider_used             — which STT provider delivered the transcript
  translation_provider_used — "groq_llm" | "groq_whisper" | null
  fallback_reason           — why fallback was triggered, or null
"""
from __future__ import annotations

import logging
import os
import re

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

from stt.providers.deepgram_provider import DeepgramProvider
from stt.providers.groq_provider import GroqProvider
from stt.parallel_decoder import parallel_transcribe
from stt.language_router import LanguageRouter, is_clean_english_fast_path
from stt.normalization_policy import NormalizationPolicy
from stt.prompt_hints import PromptHintsGenerator
from stt.translation import call_llm_translation
from stt.asr_correction import call_groq_asr_correction, call_groq_vi_asr_correction

try:
    from groq import AsyncGroq
except ImportError:
    AsyncGroq = None

logger = logging.getLogger(__name__)
router = APIRouter()

_FILLER_ONLY_PATTERN = re.compile(
    r"^\s*(?:"
    r"uh+|um+|hmm+|ừm+|ừ+|à+|ơi+|ơ+"
    r"|[.…,\s]+"
    r")\s*$",
    re.IGNORECASE,
)


def _is_filler_only(text: str) -> bool:
    return bool(_FILLER_ONLY_PATTERN.match(text.strip()))


def _empty_error_response(status: str) -> JSONResponse:
    return JSONResponse(content={
        "verbatim_text": "",
        "provider_text": "",
        "normalized_english": "",
        "source_language_mode": "unknown",
        "mode_used": "transcription",
        "normalization_status": status,
        "provider_used": None,
        "translation_provider_used": None,
        "fallback_reason": status,
        "arbiter_reason": None,
        "notes": {
            "contains_code_switch": False,
            "contains_fillers_only": False,
            "contains_proper_noun": False,
            "needs_clarification": True,
            "normalization_applied": False,
            "asr_correction_applied": False,
            "turn_handling_mode": "natural_followup",
            "user_intent": "general_chat",
            "embedded_phrase_source": "",
        },
    })


@router.post("/api/stt/normalize")
async def normalize_speech(audio: UploadFile = File(...)) -> JSONResponse:
    # ── Feature flags ─────────────────────────────────────────────────────────
    enable_en_asr = os.getenv("STT_ENABLE_EN_ASR_CORRECTION", "false").lower() == "true"
    enable_vi_asr = os.getenv("STT_ENABLE_VI_ASR_CORRECTION", "true").lower() == "true"

    # ── Read audio ────────────────────────────────────────────────────────────
    try:
        audio_bytes = await audio.read()
    except Exception as exc:
        logger.error("[stt] Failed to read uploaded audio: %s", exc)
        raise HTTPException(status_code=400, detail="Could not read audio file") from exc

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file received")

    filename = audio.filename or "utterance.webm"
    logger.info("[stt] normalize_speech entered | filename=%s bytes=%d", filename, len(audio_bytes))

    # ── Providers ─────────────────────────────────────────────────────────────
    deepgram = DeepgramProvider()
    groq = GroqProvider()

    # ── Step 1: Transcription with fallback ───────────────────────────────────
    verbatim_text = ""
    provider_used: str | None = None
    fallback_reason: str | None = None
    mode_used = "transcription"
    normalization_status = "ok"
    normalization_applied = False
    asr_correction_applied = False
    translation_provider_used: str | None = None
    arbiter_reason: str | None = None

    if AsyncGroq is None:
        logger.error("[stt] groq package is missing, cannot initialize arbiter")
        raise HTTPException(status_code=500, detail="STT internal error (groq pkg)")
    groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY", ""))

    # Try Deepgram parallel first
    result, p_name, reason = await parallel_transcribe(deepgram, audio_bytes, filename, groq_client)
    if result and not result.is_empty():
        verbatim_text = result.text
        provider_used = "deepgram"
        if reason != "unknown":
            logger.info("[stt] Arbiter reason: %s", reason)
            arbiter_reason = reason
    else:
        fallback_reason = "deepgram_failed"
        logger.info("[stt] Deepgram failed, falling back to Groq parallel transcription")
        result, p_name, reason = await parallel_transcribe(groq, audio_bytes, filename, groq_client)
        if result and not result.is_empty():
            verbatim_text = result.text
            provider_used = "groq"
            if reason != "unknown":
                logger.info("[stt] Arbiter reason: %s", reason)
                arbiter_reason = reason
        else:
            # Final fallback: Groq audio-translate (role a)
            fallback_reason = "transcription_failed_audio_translate_fallback"
            logger.info("[stt] Groq transcription failed, falling back to audio translation")
            result = await groq.translate_audio(audio_bytes, filename)
            if result and not result.is_empty():
                verbatim_text = result.text
                provider_used = "groq"
                mode_used = "translation"
                normalization_status = "fallback_used"
                translation_provider_used = "groq_whisper"
            else:
                logger.error("[stt] All STT paths failed for %s", filename)
                return _empty_error_response("provider_error")

    # ── Step 2: Language routing ──────────────────────────────────────────────
    routing = LanguageRouter.route(verbatim_text)
    source_language_mode = routing["language_mode"]
    contains_code_switch = routing["vi_count"] > 0
    contains_fillers_only = _is_filler_only(verbatim_text)

    words = verbatim_text.split()
    contains_proper_noun = any(
        w[0].isupper() for w in words[1:] if w and len(w) > 1 and w[0].isalpha()
    )

    needs_clarification = contains_fillers_only or not verbatim_text.strip()
    if needs_clarification:
        normalization_status = "clarification_needed"

    # ── Step 3–6: Fast-path vs. slow-path routing ──────────────────────────────
    # fast_path: True  → skip all LLM normalization, use verbatim_text directly.
    # fast_path: False → run the full translate/correct pipeline.
    # The gate is deliberately conservative — see is_clean_english_fast_path() docs.
    fast_path = not needs_clarification and is_clean_english_fast_path(verbatim_text, routing)
    logger.info(
        "[stt] %s | lang=%s | vi_count=%d | words=%d",
        "[fast-path] skipping normalization" if fast_path else "[slow-path] running normalization",
        source_language_mode, routing["vi_count"], len(verbatim_text.split()),
    )

    if fast_path:
        # Fast path: use verbatim_text directly as LLM input — no round trips.
        normalized_english = verbatim_text
        normalization_applied = False
    else:
        # Slow path: run correction / translation / normalization policy as before.

        # ── Step 3: VI ASR correction (feature-flagged) ────────────────────────
        if enable_vi_asr and routing.get("should_translate_full_utterance") and not needs_clarification:
            vi_corrected = await call_groq_vi_asr_correction(groq_client, verbatim_text)
            if vi_corrected:
                verbatim_text = vi_corrected

        # ── Step 4: Translation ────────────────────────────────────────────────
        translated_text: str | None = None
        if not needs_clarification and mode_used != "translation":
            if routing["should_translate_full_utterance"] or routing.get("explicit_word_help"):
                translated_text = await call_llm_translation(groq_client, verbatim_text)
                if translated_text:
                    translation_provider_used = "groq_llm"
                else:
                    # LLM translation failed → audio fallback
                    logger.info("[stt] LLM translation failed; falling back to Whisper audio translation")
                    audio_tr = await groq.translate_audio(audio_bytes, filename)
                    if audio_tr and not audio_tr.is_empty():
                        translated_text = audio_tr.text
                        translation_provider_used = "groq_whisper"
                    else:
                        logger.warning("[stt] Both translation paths failed — fallback_used")

        # ── Step 5: Normalization policy ───────────────────────────────────────
        policy_result = NormalizationPolicy.apply(routing, verbatim_text, translated_text)
        normalized_english = policy_result["llm_input_text"]
        if policy_result["normalization_status"] != "ok" and normalization_status == "ok":
            normalization_status = policy_result["normalization_status"]
        normalization_applied = policy_result["normalization_applied"]
        if policy_result["mode_used"] != "transcription":
            mode_used = policy_result["mode_used"]

        # ── Step 6: EN ASR correction (feature-flagged, off in Phase 1) ────────
        if enable_en_asr and normalization_status in ("ok", "fallback_used") and not needs_clarification and normalized_english.strip():
            if groq_client:
                en_corrected = await call_groq_asr_correction(groq_client, normalized_english)
                if en_corrected:
                    logger.info("[stt] EN ASR correction applied | before=%r | after=%r", normalized_english, en_corrected)
                    normalized_english = en_corrected
                    asr_correction_applied = True
                    normalization_applied = True

    # ── Step 7: Prompt hints ──────────────────────────────────────────────────
    hints = PromptHintsGenerator.generate(routing)

    logger.info(
        "[stt] Done | provider=%s | mode=%s | status=%s | lang=%s | vi_ratio=%.2f | en_ratio=%.2f | "
        "code_switch=%s | explicit_help=%s | norm_applied=%s | fallback=%s",
        provider_used, mode_used, normalization_status, source_language_mode,
        routing["vi_ratio"], routing["en_ratio"], contains_code_switch,
        routing.get("explicit_word_help", False), normalization_applied, fallback_reason,
    )

    return JSONResponse(content={
        "verbatim_text": verbatim_text,
        "provider_text": verbatim_text,           # backward-compat alias
        "normalized_english": normalized_english,
        "source_language_mode": source_language_mode,
        "mode_used": mode_used,
        "normalization_status": normalization_status,
        "provider_used": provider_used,
        "translation_provider_used": translation_provider_used,
        "fallback_reason": fallback_reason,
        "arbiter_reason": arbiter_reason,
        "notes": {
            "contains_code_switch": contains_code_switch,
            "contains_fillers_only": contains_fillers_only,
            "contains_proper_noun": contains_proper_noun,
            "needs_clarification": needs_clarification,
            "normalization_applied": normalization_applied,
            "asr_correction_applied": asr_correction_applied,
            "turn_handling_mode": hints["turn_handling_mode"],
            "user_intent": hints["user_intent"],
            "embedded_phrase_source": hints["embedded_phrase_source"],
        },
    })
