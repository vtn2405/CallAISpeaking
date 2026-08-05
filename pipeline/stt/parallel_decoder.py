"""
parallel_decoder.py — Parallel STT decoding for bilingual apps.

Shoots 3 concurrent requests to the STT provider (detect, en, vi)
and picks/reconstructs the most phonetically faithful transcript.

── PATCH v3-detect (2026-07) ────────────────────────────────────────────────
ROOT CAUSE FIXED. Production logs showed v2 effectively behaved as:

    "Take whatever the English model says — unless the English model
     is silent, in which case listen to the Vietnamese model."

Two code-level reasons:

  1. The AUTO branch was a duplicate of the EN branch. Deepgram does NOT
     auto-detect when `language` is omitted — it defaults to language=en.
     Therefore Jaccard(auto, en) was ALWAYS 1.0, and whenever forced-VI
     returned empty (Jaccard(auto, vi) = 0.0) the gate
     `s_en >= hi and s_vi < lo` fired and silently emitted English garbage
     ("No two pick" @ confidence 0.441) without consulting the arbiter.

  2. "VI returned empty" was treated as evidence of English. It is not:
     Deepgram's forced-language mode returns empty for any speech it cannot
     confidently map to that language — INCLUDING short/mumbled VIETNAMESE.
     Meanwhile forced-EN never returns empty: it hallucinates plausible
     English near-homophones instead.

v3 iron rules:
  RULE 1 — An empty VI transcript is NEVER evidence for choosing EN.
  RULE 2 — No fast-path selection below transcript-confidence thresholds.
           Ambiguity goes to the LLM arbiter, which now receives per-branch
           confidences, the detect verdict, and the session's recent language
           history, and may flag needs_clarification for the coach to handle.

Requires deepgram_provider.py v3 (detect_language=["en","vi"] on the auto
branch + language_confidence in raw_response_meta). Degrades gracefully for
providers without detect signals (e.g. Groq/Whisper fallback): those turns
simply rely on the conservative fast paths or the arbiter.

Backward-compatible call signature: `session_id` is a new OPTIONAL kwarg —
pass it from router.py to enable sticky-language history (recommended).

DEPLOY FINGERPRINT: v3-detect-2026-07
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from collections import deque
from typing import Any

from stt.providers.base import STTProvider, TranscriptionResult

logger = logging.getLogger(__name__)

# ── Tunables ──────────────────────────────────────────────────────────────────
_LANG_CONF_MIN = 0.70   # trust the detect verdict at/above this language_confidence
_EN_CONF_MIN = 0.80     # transcript confidence required to fast-path ENGLISH
_VI_CONF_MIN = 0.60     # transcript confidence required to fast-path VIETNAMESE
                        # (forced-VI is conservative: it returns empty rather than
                        #  hallucinate, so a non-empty diacritic VI needs less proof)
_JACCARD_HI = 0.85
_JACCARD_LO = 0.50
_HISTORY_MAXLEN = 3     # sticky-language window (turns)
_HISTORY_TTL_S = 30 * 60

# ── B2: FIRST_COMPLETED thresholds ────────────────────────────────────────────────
# A branch result is "first-completed confident" when its transcript confidence
# exceeds the threshold below. We cancel the other two tasks and use this result
# immediately, saving hundreds of ms on clear-signal audio.
#
# Conservative: these are HIGH thresholds. A branch must be very confident before
# we skip cross-checking. The disagreement check (_branches_agree) adds another
# safety layer: if the fast result disagrees strongly with any available sibling
# (even a partial), we still fall through to the full arbiter path.
_FIRST_COMPLETED_EN_CONF   = 0.85  # EN branch: chốt sớm khi conf ≥ 0.85
_FIRST_COMPLETED_VI_CONF   = 0.75  # VI branch: chốt sớm khi conf ≥ 0.75
_FIRST_COMPLETED_AUTO_CONF = 0.80  # AUTO branch: chốt sớm khi conf ≥ 0.80
_FIRST_COMPLETED_TIMEOUT_S = 2.5   # hard timeout: tổng thời gian chờ các nhánh STT

# Detects Vietnamese-specific diacritics (tô, ă, ư... and tone marks).
_VI_DIACRITIC_RE = re.compile(
    r"[àáâãèéêìíòóôõùúýđ"
    r"ăĂƯưƠơ"
    r"ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]",
)


def _has_vietnamese_diacritics(text: str) -> bool:
    """Return True if text contains Vietnamese-specific diacritic characters."""
    return bool(_VI_DIACRITIC_RE.search(text))


# Short ASCII tokens that appear in undiacritized Vietnamese but are NOT common
# English function words. If these appear in the EN/detect text, it likely means
# the engine is phonetizing Vietnamese speech as English-looking tokens.
_VI_PHONETIC_TOKENS: frozenset[str] = frozenset({
    "la", "gi", "nay", "vai", "nao", "nha", "oi", "ao", "biet", "khong",
    "duoc", "cung", "khi", "dau", "bay", "hon", "sao", "nhu", "roi",
    "di", "lai", "co", "da", "se", "bi", "thi", "ma", "ca",
    "vay", "nhe", "hen", "ban", "minh", "anh", "chi", "em",
    "cai", "mot", "cac", "nhung", "voi", "cho", "qua",
})

# Minimum ratio of VI-phonetic tokens in the text before we flag it as suspicious
_VI_PHONETIC_RATIO_THRESHOLD = 0.30


def _has_vi_phonetic_tokens(text: str) -> bool:
    """True if the text has a suspicious proportion of undiacritized Vietnamese tokens."""
    tokens = [t.lower().strip(".,?!") for t in text.split() if t.strip()]
    if not tokens:
        return False
    vi_phonetic_count = sum(1 for t in tokens if t in _VI_PHONETIC_TOKENS)
    return (vi_phonetic_count / len(tokens)) >= _VI_PHONETIC_RATIO_THRESHOLD


def _jaccard_similarity(a: str, b: str) -> float:
    """Token-set Jaccard similarity between two strings (case-insensitive)."""
    sa = set(a.lower().split())
    sb = set(b.lower().split())
    if not sa and not sb:
        return 1.0
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


# ── Signal extraction from TranscriptionResult ────────────────────────────────

def _extract_text(res: Any) -> str:
    if isinstance(res, TranscriptionResult) and not res.is_empty():
        return res.text
    return ""


def _meta(res: Any) -> dict:
    if isinstance(res, TranscriptionResult):
        return getattr(res, "raw_response_meta", None) or {}
    return {}


def _confidence(res: Any) -> float | None:
    if isinstance(res, TranscriptionResult):
        v = getattr(res, "confidence", None)
        return float(v) if isinstance(v, (int, float)) else None
    return None


def _detected_lang(res: Any) -> str | None:
    """Normalized detected language ("en-US" → "en")."""
    if isinstance(res, TranscriptionResult):
        raw = getattr(res, "detected_language", None)
        if raw:
            return str(raw).split("-")[0].lower()
    return None


def _lang_confidence(res: Any) -> float | None:
    v = _meta(res).get("language_confidence")
    return float(v) if isinstance(v, (int, float)) else None


def _fmt(v: float | None) -> str:
    return f"{v:.2f}" if isinstance(v, (int, float)) else "unknown"


# ── Sticky-language session history (PATCH v3) ────────────────────────────────
# In-memory, per-process. Fine for a single uvicorn worker; move to the session
# store / Redis if you scale to multiple workers.
_SESSION_LANG_HISTORY: dict[str, deque[str]] = {}
_SESSION_LAST_SEEN: dict[str, float] = {}


def _prune_history(now: float) -> None:
    stale = [sid for sid, ts in _SESSION_LAST_SEEN.items() if now - ts > _HISTORY_TTL_S]
    for sid in stale:
        _SESSION_LAST_SEEN.pop(sid, None)
        _SESSION_LANG_HISTORY.pop(sid, None)


def _get_language_history(session_id: str | None) -> list[str]:
    if not session_id:
        return []
    _prune_history(time.time())
    hist = _SESSION_LANG_HISTORY.get(session_id)
    return list(hist) if hist else []


def _record_language(session_id: str | None, lang: str | None) -> None:
    if not session_id or lang not in {"en", "vi", "mixed"}:
        return
    now = time.time()
    _prune_history(now)
    _SESSION_LAST_SEEN[session_id] = now
    _SESSION_LANG_HISTORY.setdefault(session_id, deque(maxlen=_HISTORY_MAXLEN)).append(lang)


def _final_language(text: str, arbiter_lang: str | None, auto_lang: str | None) -> str | None:
    """Best-effort language label for the chosen transcript (for history/meta)."""
    if arbiter_lang in {"en", "vi", "mixed"}:
        return arbiter_lang
    if _has_vietnamese_diacritics(text):
        return "vi"
    if auto_lang in {"en", "vi"}:
        return auto_lang
    return "en" if text else None


# ── Fast path (replaces v2 _should_skip_arbiter) ──────────────────────────────

def _fast_path_decision(
    auto_text: str,
    en_text: str,
    vi_text: str,
    *,
    auto_lang: str | None,
    lang_conf: float | None,
    auto_conf: float | None,
    en_conf: float | None,
    vi_conf: float | None,
) -> tuple[bool, str, str]:
    """Decide whether we can pick a transcript without the LLM arbiter.

    Returns (should_skip, choice, reason) with choice in {"AUTO","EN","VI",""}.

    v3 rules — every fast path now requires POSITIVE evidence:
      #0 all three transcripts agree textually            → AUTO
      #1 detect says VI (trusted)                         → VI (or AUTO)
      #2 detect says EN (trusted) + high transcript conf  → EN (or AUTO)
      #3 no detect signals (e.g. Groq): conservative VI path only
      otherwise → arbiter

    RULE 1 (root-cause fix): there is deliberately NO "VI empty ⇒ EN" path.
    An empty forced-VI transcript means "not confidently Vietnamese", which
    is exactly the signature of short/mumbled Vietnamese speech.
    """
    s_en = _jaccard_similarity(auto_text, en_text)
    s_vi = _jaccard_similarity(auto_text, vi_text)

    logger.debug(
        "[stt] fast-path check | s_en=%.2f s_vi=%.2f | auto_lang=%s lang_conf=%s "
        "| conf(auto/en/vi)=%s/%s/%s",
        s_en, s_vi, auto_lang, _fmt(lang_conf), _fmt(auto_conf), _fmt(en_conf), _fmt(vi_conf),
    )

    # #0 — All three agree (very short utterances, numbers, names).
    if auto_text and en_text and vi_text and s_en >= _JACCARD_HI and s_vi >= _JACCARD_HI:
        if _has_vi_phonetic_tokens(auto_text):
            # All three may be consistently phonetizing Vietnamese → arbiter.
            return False, "", ""
        return True, "AUTO", "all_three_agree"

    # #1 — Trusted detect verdict: VIETNAMESE.
    if auto_lang == "vi" and (lang_conf or 0.0) >= _LANG_CONF_MIN:
        best_vi_text = vi_text or auto_text
        best_vi_conf = vi_conf if vi_text else auto_conf
        if best_vi_text and (best_vi_conf is None or best_vi_conf >= _VI_CONF_MIN):
            # Forced-EN having produced text is NOT a counter-signal here —
            # forced-EN always produces something (see RULE 1 rationale).
            return True, ("VI" if vi_text else "AUTO"), "detected_vietnamese"

    # #2 — Trusted detect verdict: ENGLISH. Needs transcript confidence too
    #      (RULE 2): detect can be confident about the language while the
    #      transcript itself is garbage (accented short phrases).
    if auto_lang == "en" and (lang_conf or 0.0) >= _LANG_CONF_MIN:
        cand_text = en_text or auto_text
        cand_conf = en_conf if en_text else auto_conf
        if cand_text and cand_conf is not None and cand_conf >= _EN_CONF_MIN:
            if _has_vietnamese_diacritics(vi_text):
                # Forced-VI found real Vietnamese → possible code-switch → arbiter.
                return False, "", ""
            if _has_vi_phonetic_tokens(cand_text):
                # English-looking phonetization of Vietnamese → arbiter.
                return False, "", ""
            return True, ("EN" if en_text else "AUTO"), "detected_english"

    # #3 — No trusted detect signals (provider without detect, e.g. Groq).
    #      Only the conservative VI path survives from v2. The v2 EN path
    #      (`s_en high, s_vi low ⇒ EN`) is exactly the bug that shipped
    #      garbage at confidence 0.441 — it is intentionally GONE.
    if (
        vi_text
        and _has_vietnamese_diacritics(vi_text)
        and s_vi >= _JACCARD_HI
        and s_en < _JACCARD_LO
    ):
        return True, "VI", "clean_vietnamese_skip_arbiter"

    return False, "", ""


# ── LLM arbiter ───────────────────────────────────────────────────────────────

_ARBITER_MODEL = "llama-3.3-70b-versatile"

_ARBITER_SYSTEM_PROMPT = """\
You are the transcript arbiter for a bilingual English-Vietnamese conversation app.
The user is a Vietnamese learner practicing English. They may speak pure English,
pure Vietnamese, or code-switch (mix) — in ANY turn.

The same audio clip was transcribed three ways by the STT engine:
- DETECT_MODE (engine identified language={auto_lang}, id_confidence={lang_conf}, transcript_confidence={auto_conf}): {auto_text}
- EN_MODE (forced English, transcript_confidence={en_conf}): {en_text}
- VI_MODE (forced Vietnamese, transcript_confidence={vi_conf}): {vi_text}

Language of the user's recent turns, oldest to newest: {history}

CRITICAL SIGNAL SEMANTICS:
- An empty VI_MODE means "the audio was not confidently decodable as Vietnamese".
  It is NOT evidence the user spoke English — short or mumbled VIETNAMESE often
  comes back empty in VI_MODE.
- EN_MODE never returns empty for unclear audio; it produces plausible-looking
  English near-homophones instead (e.g. Vietnamese speech becoming
  "we load on a way to lazy"). Treat low-confidence English that does not fit
  the conversation as suspect.
- The recent-turn history is a PRIOR, not a rule — the user may switch language
  at any turn.

Task: reconstruct the single most faithful transcript of what was actually spoken.
Rules:
1. FIDELITY ABOVE ALL: reconstruct what was actually spoken. Do NOT correct
   grammar, fill in words not present in any mode, or invent details.
2. For proper nouns: if VI_MODE/DETECT_MODE has Vietnamese proper nouns (Đà Nẵng,
   phở, Điện Máy Xanh), prefer those over Anglicized EN_MODE equivalents.
3. For English vocabulary words: if EN_MODE has a clear English word that
   VI_MODE mangled phonetically, use the EN_MODE version.
4. If all modes are nearly identical, return DETECT_MODE verbatim.
5. Do NOT add, invent, or translate — only reconstruct from what is there.
6. If NO mode is trustworthy (all low-confidence, mutually contradictory, or
   phonetic garbage), set needs_clarification to true — still provide your
   best guess in "text".

Output ONLY a JSON object with exactly these keys:
- "text": the best reconstructed transcript string.
- "language": one of "en", "vi", "mixed" — the language of "text".
- "reason_code": a short snake_case string (e.g. "en_reconstructed",
  "vi_frame_en_word", "auto_verbatim", "vi_verbatim", "code_switch_merged",
  "untrustworthy_input").
- "needs_clarification": true or false.
"""


async def _choose_best_transcript(
    groq_client: Any,
    auto_text: str,
    en_text: str,
    vi_text: str,
    *,
    auto_lang: str | None = None,
    lang_conf: float | None = None,
    auto_conf: float | None = None,
    en_conf: float | None = None,
    vi_conf: float | None = None,
    history: list[str] | None = None,
) -> tuple[str, str, str | None, bool]:
    """Ask the LLM arbiter to reconstruct the best transcript.

    Returns (text, reason_code, language|None, needs_clarification).

    PATCH v3: the arbiter now receives per-branch confidences, the detect
    verdict, the session language history, and explicit semantics for what an
    empty VI_MODE means. It may flag needs_clarification so the coach can ask
    the user to repeat instead of chatting with garbage.
    """
    if auto_text == en_text == vi_text:
        return auto_text, "all_identical", None, False

    prompt = _ARBITER_SYSTEM_PROMPT.format(
        auto_text=auto_text or "<empty>",
        en_text=en_text or "<empty>",
        vi_text=vi_text or "<empty>",
        auto_lang=auto_lang or "unknown",
        lang_conf=_fmt(lang_conf),
        auto_conf=_fmt(auto_conf),
        en_conf=_fmt(en_conf),
        vi_conf=_fmt(vi_conf),
        history=", ".join(history) if history else "unknown",
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

        reconstructed = (data.get("text") or "").strip()
        reason = data.get("reason_code", "unknown")
        language = data.get("language")
        if language not in {"en", "vi", "mixed"}:
            language = None
        needs_clarification = bool(data.get("needs_clarification", False))

        if not reconstructed:
            logger.warning("[stt] Arbiter returned empty text — falling back to AUTO")
            return auto_text, "arbiter_empty_fallback", None, True

        # ── Anti-hallucination guard ───────────────────────────────────────────
        best_src_sim = max(
            _jaccard_similarity(reconstructed, auto_text),
            _jaccard_similarity(reconstructed, en_text),
            _jaccard_similarity(reconstructed, vi_text),
        )
        if best_src_sim < 0.25 and len(reconstructed.split()) > 3:
            best_source = auto_text
            if _jaccard_similarity(auto_text, vi_text) > _jaccard_similarity(auto_text, en_text):
                best_source = vi_text or auto_text
            else:
                best_source = en_text or auto_text
            logger.warning(
                "[stt] Arbiter hallucination guard triggered (sim=%.2f) — falling back to source | "
                "reconstructed=%r | fallback=%r",
                best_src_sim, reconstructed[:60], best_source[:60],
            )
            return best_source, f"hallucination_guard_{reason}", None, needs_clarification

        return reconstructed, reason, language, needs_clarification

    except Exception as exc:
        logger.warning("[stt] Parallel arbiter failed: %s", exc)
        # PATCH v3: use the sticky-language prior instead of blindly taking
        # AUTO (which, on providers without detect, may be forced-EN garbage).
        hist = history or []
        if hist and hist[-1] == "vi" and vi_text:
            return vi_text, "arbiter_error_vi_prior", "vi", False
        return (auto_text or en_text or vi_text), "arbiter_error", None, False


# ── B2: FIRST_COMPLETED parallel transcription ──────────────────────────────────────

async def _first_completed_transcribe(
    provider: STTProvider,
    audio_bytes: bytes,
    filename: str,
    *,
    keyterms: list[str] | None = None,
) -> tuple[
    Any,  # auto_res
    Any,  # en_res
    Any,  # vi_res
    str | None,  # early_winner: "auto" | "en" | "vi" | None
]:
    """
    B2: Run 3 STT branches concurrently and return as soon as one branch
    finishes with sufficiently high confidence.

    If a branch is confident early (confidence >= threshold) AND the current
    text does not look like VI-phonetic garbage (for EN branch), we cancel the
    remaining tasks and return immediately.

    Otherwise we wait for all three up to _FIRST_COMPLETED_TIMEOUT_S.

    Returns (auto_res, en_res, vi_res, early_winner) where:
      - Results not yet finished are returned as None (exception-safe).
      - early_winner is a string identifying which branch won early, or None
        if we waited for all three (or they all timed out).
    """
    auto_task = asyncio.create_task(
        provider.transcribe_audio(audio_bytes, filename, hint_language=None, keyterms=keyterms),
        name="auto",
    )
    en_task = asyncio.create_task(
        provider.transcribe_audio(audio_bytes, filename, hint_language="en", keyterms=keyterms),
        name="en",
    )
    vi_task = asyncio.create_task(
        provider.transcribe_audio(audio_bytes, filename, hint_language="vi", keyterms=keyterms),
        name="vi",
    )
    tasks = {"auto": auto_task, "en": en_task, "vi": vi_task}
    results: dict[str, Any] = {}
    early_winner: str | None = None

    deadline = asyncio.get_event_loop().time() + _FIRST_COMPLETED_TIMEOUT_S
    pending = set(tasks.values())

    try:
        while pending:
            remaining = deadline - asyncio.get_event_loop().time()
            if remaining <= 0:
                logger.warning("[stt] FIRST_COMPLETED hard timeout (%.1fs) — collecting what's done",
                               _FIRST_COMPLETED_TIMEOUT_S)
                break

            done, pending = await asyncio.wait(
                pending, timeout=remaining, return_when=asyncio.FIRST_COMPLETED
            )

            for task in done:
                name = task.get_name()
                try:
                    result = task.result()
                except Exception as exc:
                    result = exc
                results[name] = result

                # B2: Check if this branch can be the early winner.
                # Safety rules:
                #   1. Must have non-empty text.
                #   2. Must exceed the per-branch confidence threshold.
                #   3. For the EN branch: must NOT look like VI-phonetic hallucination.
                #      (Deepgram forced-EN returns confident garbage on Vietnamese audio;
                #       the VI-phonetic token check is the "disagreement detector" here.)
                if early_winner is None and isinstance(result, TranscriptionResult) and not result.is_empty():
                    conf = _confidence(result)
                    thresholds = {
                        "auto": _FIRST_COMPLETED_AUTO_CONF,
                        "en":   _FIRST_COMPLETED_EN_CONF,
                        "vi":   _FIRST_COMPLETED_VI_CONF,
                    }
                    threshold = thresholds.get(name, _FIRST_COMPLETED_EN_CONF)

                    if conf is not None and conf >= threshold:
                        # Extra safety for EN: reject if text looks like phonetized Vietnamese
                        # (confident-wrong scenario: "Yes Allied" has high EN confidence but is garbage)
                        if name == "en" and _has_vi_phonetic_tokens(result.text):
                            logger.info(
                                "[stt] FIRST_COMPLETED: EN conf=%.2f but VI-phonetic tokens detected — not chosing early",
                                conf,
                            )
                        else:
                            early_winner = name
                            logger.info(
                                "[stt] FIRST_COMPLETED: %s branch won early | conf=%.2f | text=%r",
                                name, conf, result.text[:60],
                            )
                            # Cancel the remaining tasks
                            for other_name, t in tasks.items():
                                if other_name != name and not t.done():
                                    t.cancel()
                            # Brief wait for cancellations to propagate
                            if pending:
                                cancel_done, _ = await asyncio.wait(
                                    pending, timeout=0.05, return_when=asyncio.ALL_COMPLETED
                                )
                                for ct in cancel_done:
                                    cname = ct.get_name()
                                    try:
                                        results[cname] = ct.result()
                                    except Exception:
                                        results[cname] = None
                            pending = set()  # exit loop
                            break
    except Exception as exc:
        logger.warning("[stt] _first_completed_transcribe unexpected error: %s", exc)
    finally:
        # Cancel any still-running tasks on exit
        for t in tasks.values():
            if not t.done():
                t.cancel()

    return (
        results.get("auto"),
        results.get("en"),
        results.get("vi"),
        early_winner,
    )


# ── Main entry point ─────────────────────────────────────────────────────────

async def parallel_transcribe(
    provider: STTProvider,
    audio_bytes: bytes,
    filename: str,
    groq_client: Any,
    *,
    keyterms: list[str] | None = None,
    session_id: str | None = None,
) -> tuple[TranscriptionResult | None, str, str]:
    """Runs 3 STT calls in parallel and picks/reconstructs the best transcript.

    PATCH v3: the auto branch is now a REAL detect branch (see
    deepgram_provider v3). Decision logic uses detected_language,
    language_confidence and transcript confidence; sticky per-session language
    history feeds the arbiter as a prior. `session_id` is optional and the
    signature stays backward compatible with router.py.

    B2 PATCH: Uses _first_completed_transcribe instead of asyncio.gather.
    A branch with sufficiently high confidence (and passing safety checks)
    short-circuits the wait for the other two branches. Falls back to
    waiting all three if no branch is confident enough.

    Returns (result, provider_name, fallback_reason).
    The returned TranscriptionResult may carry raw_response_meta:
      - "needs_clarification": True  → the coach should ask the user to repeat
                                       (in Vietnamese) instead of answering.
      - "language": "en"|"vi"|"mixed" → decided language of the transcript.
      - "branch_divergence": float   → max Jaccard divergence between branches
                                       (0=identical, 1=totally different).
                                       High divergence = EN ASR correction gate
                                       should trigger even at high confidence.
    """
    logger.info(
        "[stt] parallel_decoder v3-detect+B2-first-completed | keyterms=%d | session=%s",
        len(keyterms or []), session_id or "-",
    )
    t0 = time.monotonic()

    # B2: Run branches concurrently with FIRST_COMPLETED short-circuit
    auto_res, en_res, vi_res, early_winner = await _first_completed_transcribe(
        provider, audio_bytes, filename, keyterms=keyterms
    )
    stt_ms = (time.monotonic() - t0) * 1000

    auto_text = _extract_text(auto_res)
    en_text   = _extract_text(en_res)
    vi_text   = _extract_text(vi_res)

    if not auto_text and not en_text and not vi_text:
        return None, "", "all_parallel_stt_failed"

    # ── Routing signals (PATCH v3) ────────────────────────────────────────────
    auto_lang = _detected_lang(auto_res)
    lang_conf = _lang_confidence(auto_res)
    auto_conf = _confidence(auto_res)
    en_conf   = _confidence(en_res)
    vi_conf   = _confidence(vi_res)

    # ── Branch divergence score (for A6 gate in router.py) ───────────────────
    # Measures how much the three branches disagree with each other.
    # 0.0 = all identical, 1.0 = completely different.
    # High divergence means even a high-confidence branch might be wrong
    # (e.g. EN confidently returns "Yes Allied" while AUTO/VI say something
    # completely different — the classic confident-wrong hallucination).
    _s_en    = _jaccard_similarity(auto_text, en_text)   if auto_text and en_text else 1.0
    _s_vi    = _jaccard_similarity(auto_text, vi_text)   if auto_text and vi_text else 1.0
    _s_en_vi = _jaccard_similarity(en_text,   vi_text)   if en_text   and vi_text else 1.0
    branch_divergence = 1.0 - min(_s_en, _s_vi, _s_en_vi)

    logger.info(
        "[stt] Parallel STT done in %.0f ms | early=%s | AUTO=%r (lang=%s lang_conf=%s conf=%s) "
        "| EN=%r (conf=%s) | VI=%r (conf=%s) | branch_divergence=%.2f",
        stt_ms,
        early_winner or "none",
        auto_text[:60], auto_lang, _fmt(lang_conf), _fmt(auto_conf),
        en_text[:60], _fmt(en_conf),
        vi_text[:60], _fmt(vi_conf),
        branch_divergence,
    )

    provider_name = provider.__class__.__name__.lower().replace("provider", "")

    # ── Fast path: positive-evidence monolingual detection ────────────────────
    # B3: Only skip arbiter when branch_divergence is LOW (branches agree).
    # If branches diverge strongly, force the arbiter even on "fast path" results
    # — strong divergence overrides confidence-based fast paths.
    _allow_fast_path = branch_divergence <= (1.0 - _JACCARD_HI)  # i.e. divergence ≤ 0.15
    should_skip, skip_choice, skip_reason = _fast_path_decision(
        auto_text, en_text, vi_text,
        auto_lang=auto_lang, lang_conf=lang_conf,
        auto_conf=auto_conf, en_conf=en_conf, vi_conf=vi_conf,
    )
    if should_skip and _allow_fast_path:
        logger.info(
            "[stt] skip_arbiter | reason=%s | choice=%s | divergence=%.2f | AUTO=%r EN=%r VI=%r",
            skip_reason, skip_choice, branch_divergence, auto_text, en_text, vi_text,
        )
        chosen_res = auto_res
        if skip_choice == "EN" and isinstance(en_res, TranscriptionResult) and not en_res.is_empty():
            chosen_res = en_res
        elif skip_choice == "VI" and isinstance(vi_res, TranscriptionResult) and not vi_res.is_empty():
            chosen_res = vi_res
        elif isinstance(auto_res, TranscriptionResult) and not auto_res.is_empty():
            chosen_res = auto_res
        if isinstance(chosen_res, TranscriptionResult):
            lang = _final_language(chosen_res.text, {"VI": "vi", "EN": "en"}.get(skip_choice), auto_lang)
            _record_language(session_id, lang)
            # Inject branch_divergence into meta so router.py can gate A6 correction
            chosen_res.raw_response_meta = (chosen_res.raw_response_meta or {})
            chosen_res.raw_response_meta["branch_divergence"] = branch_divergence
            return chosen_res, provider_name, skip_reason
        return None, "", "resolution_failed"
    elif should_skip and not _allow_fast_path:
        logger.info(
            "[stt] fast_path overridden by branch_divergence=%.2f > %.2f — routing to arbiter",
            branch_divergence, 1.0 - _JACCARD_HI,
        )

    # ── Slow path: arbiter reconstructs (or selects) the best transcript ─────
    history = _get_language_history(session_id)
    t1 = time.monotonic()
    reconstructed_text, reason, arb_lang, needs_clarification = await _choose_best_transcript(
        groq_client, auto_text, en_text, vi_text,
        auto_lang=auto_lang, lang_conf=lang_conf,
        auto_conf=auto_conf, en_conf=en_conf, vi_conf=vi_conf,
        history=history,
    )
    arbiter_ms = (time.monotonic() - t1) * 1000
    logger.info(
        "[stt] arbiter_ms=%.0f | reason=%s | lang=%s | needs_clarification=%s | result=%r",
        arbiter_ms, reason, arb_lang, needs_clarification, reconstructed_text[:80],
    )

    base_meta = auto_res if isinstance(auto_res, TranscriptionResult) else None

    if reconstructed_text:
        final_lang = _final_language(reconstructed_text, arb_lang, auto_lang)
        _record_language(session_id, final_lang)
        chosen_res = TranscriptionResult(
            text=reconstructed_text,
            provider=provider_name,
            confidence=base_meta.confidence if base_meta else None,
            detected_language=final_lang or (base_meta.detected_language if base_meta else None),
            raw_response_meta={
                "arbiter_reason": reason,
                "arbiter_model": _ARBITER_MODEL,
                # ── PATCH v3: downstream signals ──────────────────────────────
                # router/coach: if needs_clarification is True, do NOT answer
                # the transcript — ask the user (in Vietnamese) to repeat.
                "needs_clarification": needs_clarification,
                "language": final_lang,
                "language_history": history,
                # A6 gate signal: high divergence triggers EN ASR correction
                # even when final confidence would otherwise skip it.
                "branch_divergence": branch_divergence,
            },
        )
        return chosen_res, provider_name, reason

    return None, "", "resolution_failed"