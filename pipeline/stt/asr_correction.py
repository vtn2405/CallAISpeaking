"""
asr_correction.py — ASR post-correction helpers.

Moved as-is from stt.py. Two independent paths:
  - EN: _call_groq_asr_correction — fixes English mis-transcriptions.
  - VI: _call_groq_vi_asr_correction — fixes Vietnamese mis-transcriptions,
        with special protection against Vietnamesizing English names (Jenny etc.).

Feature flags in router.py gate whether each path is called:
  STT_ENABLE_EN_ASR_CORRECTION (default: false in Phase 1)
  STT_ENABLE_VI_ASR_CORRECTION (default: true  in Phase 1)

Both functions return None on guard failure so callers always get a safe fallback.
"""
from __future__ import annotations

import difflib
import json
import logging

logger = logging.getLogger(__name__)

# ── English ASR correction ────────────────────────────────────────────────────
_ASR_CORRECTION_MODEL = "openai/gpt-oss-20b"
_ASR_CORRECTION_MAX_CHANGED_WORDS_RATIO = 0.15
_ASR_CORRECTION_MAX_CHANGED_WORDS_ABS_FLOOR = 2
_ASR_CORRECTION_MAX_WORD_COUNT_DELTA = 1

_ASR_CORRECTION_SYSTEM_PROMPT = (
    "You fix speech-recognition (ASR) errors in a transcript of spoken English. "
    "The speaker may have low English fluency — their grammar, tense, articles, and "
    "word order must be preserved EXACTLY as given, even if imperfect or non-native. "
    "Your ONLY job is to fix individual words that are almost certainly mis-transcribed "
    "by the recognizer: wrong homophones, garbled tokens, or words that make no sense "
    "in context. Do NOT fix grammar. Do NOT change tense, articles, or word order. "
    "Do NOT rephrase, improve, or make the sentence more natural. "
    "If you are not highly confident a word is a mis-hearing rather than the speaker's "
    "real word choice, leave it unchanged. "
    "CRITICAL: The speaker may use non-English proper nouns (e.g., Vietnamese names, cities) "
    "or cultural loanwords (e.g., 'pho', 'banh mi'). You MUST preserve all proper nouns, "
    "brand names, places, and foreign words exactly as given. Do NOT attempt to 'Anglicize' "
    "or correct them into similar-sounding English words. "
    "Output ONLY the corrected transcript — no quotes, no explanation, no extra text."
)

# ── Vietnamese ASR correction (separate prompt + looser thresholds) ───────────
# Vietnamese is a monosyllabic language — one "concept" is often 2 adjacent syllables
# (e.g. "nấu ăn" = cook), each counted as a separate whitespace-delimited token.
# Using the same ratio as English would reject valid corrections that fix 1 concept
# but change 2 tokens. Thresholds below are starting estimates — tune with real data.
# TODO: tune _ASR_CORRECTION_VI_* thresholds against real Vietnamese audio cases.
_ASR_CORRECTION_VI_MAX_CHANGED_WORDS_RATIO = 0.25  # vs 0.15 for English
_ASR_CORRECTION_VI_MAX_CHANGED_WORDS_ABS_FLOOR = 3  # vs 2 for English
_ASR_CORRECTION_VI_MAX_WORD_COUNT_DELTA = 2          # vs 1 for English

_ASR_CORRECTION_VI_SYSTEM_PROMPT = (
    "Ban la mot he thong sua loi nhan dang giong noi (ASR) cho tieng Viet. "
    "Nhiem vu DUY NHAT cua ban la sua cac tu rieng le gan chac chan bi nghe sai boi "
    "bo nhan dang: am tiet sai thanh dieu, tu vo nghia trong ngu canh, hoac tu nghe sai. "
    "GIU NGUYEN: ngu phap, thu tu tu, cau truc cau, va y dinh cua nguoi noi. "
    "KHONG sua ngu phap, KHONG thay doi cach dien dat, KHONG lam cau 'tu nhien hon'. "
    "Neu khong chac chan mot tu la loi nghe, giu nguyen tu do. "
    "DAC BIET CHU Y: Nguoi noi thuong xuyen xen cac tu tieng Anh hoac ten rieng tieng Anh vao cau tieng Viet (code-switching). "
    "Ban phai GIU NGUYEN cac tu tieng Anh va ten rieng tieng Anh (vi du: Jenny, Jame, roleplay, video...). "
    "TUYET DOI KHONG 'Viet hoa' (chuyen doi phat am) cac tu/ten tieng Anh thanh cac tu tieng Viet co phat am tuong tu (vi du: KHONG bien 'Jenny' thanh 'dây nịt', KHONG bien 'trong vai Jenny' thanh 'trông vài giây'). "
    "Chi xuat ban phien da sua — khong giai thich, khong trich dan."
)


def _asr_correction_should_accept(original: str, corrected: str) -> tuple[bool, dict]:
    orig_tokens = original.lower().split()
    corr_tokens = corrected.lower().split()

    if not orig_tokens:
        return False, {"reason": "empty_original"}

    matcher = difflib.SequenceMatcher(None, orig_tokens, corr_tokens)

    changed_words = 0
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag != "equal":
            changed_words += max(i2 - i1, j2 - j1)

    max_changed_words_allowed = max(
        _ASR_CORRECTION_MAX_CHANGED_WORDS_ABS_FLOOR,
        round(len(orig_tokens) * _ASR_CORRECTION_MAX_CHANGED_WORDS_RATIO),
    )
    word_count_delta = abs(len(corr_tokens) - len(orig_tokens))

    stats = {
        "changed_words": changed_words,
        "max_changed_words_allowed": max_changed_words_allowed,
        "word_count_delta": word_count_delta,
        "orig_word_count": len(orig_tokens),
    }

    # Guard: Do not allow 100% rewrite for very short utterances (overrides the floor)
    if changed_words >= len(orig_tokens):
        return False, {**stats, "reason": "full_rewrite_rejected"}

    if changed_words > max_changed_words_allowed:
        return False, {**stats, "reason": "too_many_words_changed"}
    if word_count_delta > _ASR_CORRECTION_MAX_WORD_COUNT_DELTA:
        return False, {**stats, "reason": "word_count_delta_too_large"}

    return True, stats


async def call_groq_asr_correction(client, text: str) -> str | None:
    """English ASR correction. Returns None if guard fails or call throws."""
    if not text.strip():
        return None
    try:
        response = await client.chat.completions.create(
            model=_ASR_CORRECTION_MODEL,
            temperature=0,
            max_completion_tokens=512,
            messages=[
                {"role": "system", "content": _ASR_CORRECTION_SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
        )
        corrected = (response.choices[0].message.content or "").strip()
        if not corrected or corrected == text:
            return None

        accept, stats = _asr_correction_should_accept(text, corrected)
        if not accept:
            logger.warning(
                "[stt] ASR correction rejected by guard | reason=%s | stats=%s | original=%r | corrected=%r",
                stats.get("reason"), stats, text, corrected,
            )
            return None

        logger.info("[stt] ASR correction accepted | stats=%s", stats)
        return corrected
    except Exception as exc:
        logger.warning("[stt] Groq ASR correction failed: %s", exc)
        return None


async def call_groq_vi_asr_correction(client, text: str) -> str | None:
    """Vietnamese-specific ASR correction with looser word-change thresholds.

    Vietnamese is monosyllabic — one concept often spans 2 whitespace tokens
    (e.g. "nau an"). The standard English thresholds are too tight and would
    reject valid single-concept corrections. Uses a separate Vietnamese system
    prompt and _ASR_CORRECTION_VI_* constants.
    """
    if not text.strip():
        return None
    try:
        response = await client.chat.completions.create(
            model=_ASR_CORRECTION_MODEL,
            temperature=0,
            max_completion_tokens=512,
            messages=[
                {"role": "system", "content": _ASR_CORRECTION_VI_SYSTEM_PROMPT},
                {"role": "user",   "content": text},
            ],
        )
        corrected = (response.choices[0].message.content or "").strip()
        if not corrected or corrected == text:
            return None

        orig_tokens = text.lower().split()
        corr_tokens = corrected.lower().split()
        if not orig_tokens:
            return None

        matcher = difflib.SequenceMatcher(None, orig_tokens, corr_tokens)
        changed_words = sum(
            max(i2 - i1, j2 - j1)
            for tag, i1, i2, j1, j2 in matcher.get_opcodes()
            if tag != "equal"
        )
        max_allowed = max(
            _ASR_CORRECTION_VI_MAX_CHANGED_WORDS_ABS_FLOOR,
            round(len(orig_tokens) * _ASR_CORRECTION_VI_MAX_CHANGED_WORDS_RATIO),
        )
        word_count_delta = abs(len(corr_tokens) - len(orig_tokens))
        
        # Guard: Do not allow 100% rewrite for very short utterances (overrides the floor)
        if changed_words >= len(orig_tokens):
            logger.warning(
                "[stt] VI ASR correction rejected: full_rewrite_rejected | changed=%d | %r -> %r",
                changed_words, text, corrected,
            )
            return None

        if changed_words > max_allowed:
            logger.warning(
                "[stt] VI ASR correction rejected: too_many_words_changed | changed=%d max=%d | %r -> %r",
                changed_words, max_allowed, text, corrected,
            )
            return None
        if word_count_delta > _ASR_CORRECTION_VI_MAX_WORD_COUNT_DELTA:
            logger.warning(
                "[stt] VI ASR correction rejected: word_count_delta_too_large | delta=%d | %r -> %r",
                word_count_delta, text, corrected,
            )
            return None

        logger.info(
            "[stt] VI ASR correction accepted | changed=%d/%d | %r -> %r",
            changed_words, len(orig_tokens), text, corrected,
        )
        return corrected
    except Exception as exc:
        logger.warning("[stt] Groq VI ASR correction failed: %s", exc)
        return None


# ── Merged VI-correction + Translation (1 hop instead of 2) ──────────────────
# Only active when BOTH STT_ENABLE_MERGED_VI_CORRECTION and
# STT_ENABLE_VI_ASR_CORRECTION are true. Falls back to the caller's 2-hop logic
# when the output fails guards or JSON cannot be parsed.
#
# Model: llama-3.1-8b-instant — single short sentence, don't need 70b quality.
# Benchmark and upgrade to llama-3.3-70b if quality drops on real audio.
_MERGED_VI_MODEL = "llama-3.1-8b-instant"

_MERGED_VI_CORRECT_TRANSLATE_PROMPT = (
    "Ban la chuyen gia ket hop (1) sua loi ASR tieng Viet va (2) dich sang tieng Anh "
    "cho mot ung dung luyen tieng Anh viet-anh song ngu.\n\n"
    "Nhiem vu:\n"
    "1. SUA LOI ASR (corrected_vi): Chi sua cac tu bi nghe sai boi may nhan dang giong noi. "
    "GIU NGUYEN: ngu phap, thu tu tu, cau truc, y dinh nguoi noi, cac tu tieng Anh chen vao (code-switch). "
    "TUYET DOI KHONG Viet-hoa ten tieng Anh (Jenny != 'day nit'). "
    "Neu khong co loi nao can sua, tra lai nguyen van.\n"
    "2. DICH (translated_en): Dich 'corrected_vi' sang tieng Anh. "
    "Dich sat nghia, giu ten rieng nguyen ban, KHONG bien tap hay lam dep them.\n\n"
    "Chi xuat JSON dung dinh dang sau, khong giai thich gi them:\n"
    "{\"corrected_vi\": \"<ban tieng Viet da sua>\", \"translated_en\": \"<ban dich tieng Anh>\"}"
)


async def call_groq_vi_correct_and_translate(
    client,
    text: str,
) -> tuple[str, str] | None:
    """Merge VI ASR correction + translation into a single LLM call.

    Returns (corrected_vi, translated_en) on success, or None if:
      - JSON parse fails
      - corrected_vi guard rejects (too many words changed)
      - translated_en length ratio is implausible
      - Any exception is raised

    Caller must fall back to the 2-hop path (call_groq_vi_asr_correction +
    call_llm_translation) when this returns None.

    Precedence: only call this when BOTH STT_ENABLE_MERGED_VI_CORRECTION and
    STT_ENABLE_VI_ASR_CORRECTION are true (enforced by router.py).
    """
    if not text.strip():
        return None
    try:
        response = await client.chat.completions.create(
            model=_MERGED_VI_MODEL,
            temperature=0,
            max_completion_tokens=512,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _MERGED_VI_CORRECT_TRANSLATE_PROMPT},
                {"role": "user",   "content": text},
            ],
        )
        raw = (response.choices[0].message.content or "").strip()
        try:
            data = json.loads(raw)
        except Exception:
            logger.warning(
                "[stt] merged_vi: JSON parse failed | raw=%r", raw[:120]
            )
            return None

        corrected_vi = (data.get("corrected_vi") or "").strip()
        translated_en = (data.get("translated_en") or "").strip()

        if not corrected_vi or not translated_en:
            logger.warning(
                "[stt] merged_vi: missing key in JSON | corrected_vi=%r translated_en=%r",
                corrected_vi[:60], translated_en[:60],
            )
            return None

        # ── Guard 1: corrected_vi must not be a full rewrite ─────────────────
        orig_tokens = text.lower().split()
        corr_tokens = corrected_vi.lower().split()
        changed_words = 0
        if orig_tokens:
            matcher = difflib.SequenceMatcher(None, orig_tokens, corr_tokens)
            changed_words = sum(
                max(i2 - i1, j2 - j1)
                for tag, i1, i2, j1, j2 in matcher.get_opcodes()
                if tag != "equal"
            )
            max_allowed = max(
                _ASR_CORRECTION_VI_MAX_CHANGED_WORDS_ABS_FLOOR,
                round(len(orig_tokens) * _ASR_CORRECTION_VI_MAX_CHANGED_WORDS_RATIO),
            )
            word_count_delta = abs(len(corr_tokens) - len(orig_tokens))

            if changed_words >= len(orig_tokens):
                logger.warning(
                    "[stt] merged_vi rejected: full_rewrite | changed=%d/%d | %r -> %r",
                    changed_words, len(orig_tokens), text, corrected_vi,
                )
                return None
            if changed_words > max_allowed:
                logger.warning(
                    "[stt] merged_vi rejected: too_many_changed | changed=%d max=%d | %r -> %r",
                    changed_words, max_allowed, text, corrected_vi,
                )
                return None
            if word_count_delta > _ASR_CORRECTION_VI_MAX_WORD_COUNT_DELTA:
                logger.warning(
                    "[stt] merged_vi rejected: word_count_delta=%d | %r -> %r",
                    word_count_delta, text, corrected_vi,
                )
                return None

        # ── Guard 2: translated_en length ratio must be plausible ─────────────
        ratio = len(translated_en) / max(len(corrected_vi), 1)
        if ratio < 0.1 or ratio > 3.0:
            logger.warning(
                "[stt] merged_vi rejected: translation length ratio=%.2f | "
                "corrected_vi=%r translated_en=%r",
                ratio, corrected_vi[:60], translated_en[:60],
            )
            return None

        logger.info(
            "[stt] merged_vi accepted | changed=%d/%d | corrected_vi=%r | translated_en=%r",
            changed_words if orig_tokens else 0,
            len(orig_tokens) if orig_tokens else 0,
            corrected_vi[:60],
            translated_en[:60],
        )
        return corrected_vi, translated_en

    except Exception as exc:
        logger.warning("[stt] merged_vi call failed: %s", exc)
        return None
