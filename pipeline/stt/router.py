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
import time

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

from stt.providers.deepgram_provider import DeepgramProvider
from stt.providers.groq_provider import GroqProvider
from stt.parallel_decoder import parallel_transcribe
from stt.language_router import LanguageRouter, is_clean_english_fast_path
from stt.normalization_policy import NormalizationPolicy
from stt.prompt_hints import PromptHintsGenerator
from stt.translation import call_llm_translation
from stt.asr_correction import (
    call_groq_asr_correction,
    call_groq_vi_asr_correction,
    call_groq_vi_correct_and_translate,
)

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
async def normalize_speech(audio: UploadFile = File(...), session_id: str = "") -> JSONResponse:
    # ── Feature flags ──────────────────────────────────────────────────────────────────
    # A6: EN ASR correction is now enabled by default.
    # Gate: only activate on turns where branches disagreed (branch_divergence high)
    # OR where stt_low_confidence is True. Avoids the latency cost on clean turns.
    enable_en_asr = os.getenv("STT_ENABLE_EN_ASR_CORRECTION", "true").lower() == "true"
    enable_vi_asr = os.getenv("STT_ENABLE_VI_ASR_CORRECTION", "true").lower() == "true"
    # Merged VI-correction+translation: only active when vi_asr is also on.
    # Setting MERGED=true but VI_ASR=false would silently correct despite the flag — prevent this.
    _merged_flag = os.getenv("STT_ENABLE_MERGED_VI_CORRECTION", "true").lower() == "true"
    enable_merged_vi = _merged_flag and enable_vi_asr

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

    # ── Extract keyterms from session outline (Phase 1B biasing) ───────────────────────
    # session_id is optional (sent by frontend in FormData). If missing or the
    # session has no outline yet, keyterms defaults to [] (no crash).
    #
    # A2: Extended extraction — character names + title words were just Phase 1.
    # Now we also pull keyword nouns from key_events, outline.parts/summary so
    # domain-specific words like "museum", "jewelry", "Jakarta" reach Deepgram.
    keyterms: list[str] = []
    if session_id:
        try:
            from session_store import store as _store
            _record = await _store.get(session_id)
            if _record and _record.context and _record.context.outline:
                outline = _record.context.outline
                _terms: list[str] = []

                # 1. Character names (unchanged)
                for c in (outline.characters or []):
                    if c.name and c.name.strip():
                        _terms.append(c.name.strip())

                # 2. Title words: proper nouns only (unchanged)
                if outline.title:
                    _terms.extend(
                        w for w in outline.title.split()
                        if len(w) > 3 and w[0].isupper()
                    )

                # 3. A2: Key-event descriptions — extract capitalized words
                # (proper nouns, place names, objects) from short event labels.
                # These are the most common topic-specific words a user will say.
                _STOPWORDS = frozenset({
                    "The", "A", "An", "And", "But", "In", "On", "At", "To", "Of",
                    "For", "With", "By", "From", "Is", "Are", "Was", "Were",
                    "This", "That", "He", "She", "They", "It", "His", "Her",
                    "Their", "Has", "Have", "Had", "Be", "Been",
                })
                for event in (outline.key_events or []):
                    desc = getattr(event, "description", "") or getattr(event, "label", "") or ""
                    for w in desc.split():
                        word = w.strip(".,;:!?'\"()")
                        if (
                            len(word) > 3
                            and word[0].isupper()
                            and word not in _STOPWORDS
                            and word.isalpha()
                        ):
                            _terms.append(word)

                # 4. A2: Summary words — extract domain nouns (lower-cased,
                # longer than 4 chars, not stop-words). These anchor Deepgram on
                # the video's content domain (e.g. "museum", "jewelry", "statues").
                _EN_STOPWORDS_LOWER = frozenset({
                    "about", "above", "after", "again", "also", "another", "before",
                    "being", "between", "could", "during", "each", "every", "first",
                    "from", "have", "here", "into", "just", "like", "make", "more",
                    "most", "much", "must", "only", "other", "over", "same", "some",
                    "such", "than", "that", "their", "them", "then", "there", "these",
                    "they", "this", "through", "time", "under", "very", "were", "what",
                    "when", "where", "which", "while", "with", "would", "your",
                })
                summary = getattr(outline, "summary", "") or ""
                if summary:
                    for w in summary.split():
                        word = w.strip(".,;:!?'\"()").lower()
                        if (
                            len(word) > 4
                            and word not in _EN_STOPWORDS_LOWER
                            and word.isalpha()
                        ):
                            _terms.append(word.capitalize())

                # 5. A2: Parts/section titles if outline has them
                for part in (getattr(outline, "parts", None) or []):
                    part_title = getattr(part, "title", "") or ""
                    for w in part_title.split():
                        word = w.strip(".,;:!?\'\"()")
                        if len(word) > 3 and word[0].isupper() and word.isalpha():
                            _terms.append(word)

                # Deduplicate and cap at 40 (generous but still within Deepgram budget)
                seen: set[str] = set()
                for t in _terms:
                    if t.lower() not in seen:
                        seen.add(t.lower())
                        keyterms.append(t)
                    if len(keyterms) >= 40:
                        break
                if keyterms:
                    logger.info("[stt] keyterm biasing | session=%s | terms=%s", session_id, keyterms[:15])
        except Exception as _kt_exc:
            logger.debug("[stt] keyterm extraction failed (non-fatal): %s", _kt_exc)

    # Try Deepgram parallel first
    try:
        result, p_name, reason = await parallel_transcribe(deepgram, audio_bytes, filename, groq_client, keyterms=keyterms)
    except Exception as exc:
        logger.error("[stt] Deepgram parallel_transcribe raised exception: %s", exc)
        result = None
        p_name = None
        reason = str(exc)

    if result and not result.is_empty():
        verbatim_text = result.text
        provider_used = "deepgram"
        if reason != "unknown":
            logger.info("[stt] Arbiter reason: %s", reason)
            arbiter_reason = reason
    else:
        fallback_reason = "deepgram_failed"
        logger.info("[stt] Deepgram failed, falling back to Groq parallel transcription")
        try:
            result, p_name, reason = await parallel_transcribe(groq, audio_bytes, filename, groq_client, keyterms=keyterms)
        except Exception as exc:
            logger.error("[stt] Groq parallel_transcribe raised exception: %s", exc)
            result = None
            p_name = None
            reason = str(exc)
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
    # A6: Compute _stt_low_confidence early so Step 6 (EN ASR gate) can use it.
    # Low confidence when: audio fallback was used, translation fallback triggered,
    # or normalization couldn't produce a clean result.
    _stt_low_confidence = bool(
        fallback_reason  # any STT fallback chain was triggered
        or normalization_status == "fallback_used"  # translation both failed
        or (arbiter_reason and "error" in arbiter_reason)  # arbiter itself errored
    )

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

        # ── Step 3+4: VI correction + translation ─────────────────────────────
        # Merged path: 1 LLM hop instead of 2 (saves ~400 ms).
        # Conditions: merged flag on, VI content present, not already translated.
        merged_ok = False
        translated_text: str | None = None  # initialised here; assigned in merged or fallback path

        if (
            enable_merged_vi
            and routing.get("should_translate_full_utterance")
            and not needs_clarification
            and mode_used != "translation"
        ):
            t_merged = time.monotonic()
            merged = await call_groq_vi_correct_and_translate(groq_client, verbatim_text)
            merged_ms = (time.monotonic() - t_merged) * 1000
            if merged is not None:
                corrected_vi, translated_text = merged
                verbatim_text = corrected_vi
                translation_provider_used = "groq_llm"
                merged_ok = True
                logger.info(
                    "[stt] path=merged_vi_hop | merged_ms=%.0f | corrected_vi=%r | translated=%r",
                    merged_ms, corrected_vi[:60], translated_text[:60] if translated_text else "",
                )
            else:
                logger.info(
                    "[stt] merged_vi guard/fail in %.0f ms — falling back to 2-hop", merged_ms
                )

        if not merged_ok:
            # ── Fallback: 2-hop (original behaviour) ──────────────────────────
            translated_text = None

            # Step 3: VI ASR correction (feature-flagged)
            if enable_vi_asr and routing.get("should_translate_full_utterance") and not needs_clarification:
                t3 = time.monotonic()
                vi_corrected = await call_groq_vi_asr_correction(groq_client, verbatim_text)
                logger.info("[stt] path=vi_asr_correction | hop_ms=%.0f", (time.monotonic() - t3) * 1000)
                if vi_corrected:
                    verbatim_text = vi_corrected

            # Step 4: Translation
            if not needs_clarification and mode_used != "translation":
                if routing["should_translate_full_utterance"] or routing.get("explicit_word_help"):
                    t4 = time.monotonic()
                    translated_text = await call_llm_translation(groq_client, verbatim_text)
                    logger.info("[stt] path=llm_translation | hop_ms=%.0f", (time.monotonic() - t4) * 1000)
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

        # \u2500\u2500 Step 6: EN ASR correction (A6 \u2014 enabled by default, disagreement-gated) \u2500\u2500
        # Gate logic (disagreement trigger, not just static confidence threshold):
        #   Activate when EITHER:
        #     (a) branch_divergence > 0.25: branches disagreed strongly.
        #         Even a high-confidence result may be a confident-wrong hallucination
        #         (e.g. EN returns "Yes Allied" at 0.88 while AUTO/VI disagree).
        #     (b) stt_low_confidence is True: provider fallback chain triggered.
        #   Skip: divergence is low AND high confidence \u2014 clean audio, no LLM hop needed.
        _branch_divergence = float(
            (result.raw_response_meta or {}).get("branch_divergence", 0.0)
        ) if result else 0.0
        _en_asr_should_run = (
            enable_en_asr
            and normalization_status in ("ok", "fallback_used")
            and not needs_clarification
            and normalized_english.strip()
            and (
                _branch_divergence > 0.25    # disagreement trigger (main A6 fix)
                or _stt_low_confidence       # fallback-chain signal
            )
        )
        if _en_asr_should_run:
            if groq_client:
                logger.info(
                    "[stt] EN ASR correction triggered | branch_divergence=%.2f | stt_low_confidence=%s",
                    _branch_divergence, _stt_low_confidence,
                )
                en_corrected = await call_groq_asr_correction(groq_client, normalized_english)
                if en_corrected:
                    logger.info(
                        "[stt] EN ASR correction applied | before=%r | after=%r",
                        normalized_english, en_corrected,
                    )
                    normalized_english = en_corrected
                    asr_correction_applied = True
                    normalization_applied = True
        elif enable_en_asr:
            logger.debug(
                "[stt] EN ASR correction skipped (clean turn) | branch_divergence=%.2f | stt_low_confidence=%s",
                _branch_divergence, _stt_low_confidence,
            )

    # \u2500\u2500 Step 7: Prompt hints \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    hints = PromptHintsGenerator.generate(routing)

    logger.info(
        "[stt] Done | provider=%s | mode=%s | status=%s | lang=%s | vi_ratio=%.2f | en_ratio=%.2f | "
        "code_switch=%s | explicit_help=%s | norm_applied=%s | fallback=%s",
        provider_used, mode_used, normalization_status, source_language_mode,
        routing["vi_ratio"], routing["en_ratio"], contains_code_switch,
        routing.get("explicit_word_help", False), normalization_applied, fallback_reason,
    )

    # ── STT confidence signal (already computed at Step 2, documented here) ───
    # _stt_low_confidence is computed early (before Step 2) so Step 6 can gate
    # EN ASR correction on it. The value is re-referenced here for the response.

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
        "stt_low_confidence": _stt_low_confidence,
        "notes": {
            "contains_code_switch": contains_code_switch,
            "contains_fillers_only": contains_fillers_only,
            "contains_proper_noun": contains_proper_noun,
            "needs_clarification": needs_clarification,
            "normalization_applied": normalization_applied,
            "asr_correction_applied": asr_correction_applied,
            "stt_low_confidence": _stt_low_confidence,
            "turn_handling_mode": hints["turn_handling_mode"],
            "user_intent": hints["user_intent"],
            "embedded_phrase_source": hints["embedded_phrase_source"],
        },
    })

