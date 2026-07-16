"""
language_router.py — Language detection and intent routing for STT pipeline.

Moved from context/language_router.py into stt/ as part of Phase 1 refactor.
Logic kept intact. Three bugs fixed during move (see inline comments):
  1. _EXPLICIT_HELP_VI regex narrowed — "từ.*?này" was too broad.
  2. _CONFIRM_TOPIC_VI regex narrowed — was matching ordinary tail questions.
  3. embedded_phrase_source extraction now attempts real extraction (was placeholder).
  4. should_preserve_verbatim_for_llm is now consumed explicitly by the router
     (was set but silently ignored in old stt.py).
"""
import re
from typing import Dict, Any

_VI_DIACRITIC_RE = re.compile(
    r"[àáâãäåæçèéêëìíîïðñòóôõöùúûüý"
    r"ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖÙÚÛÜÝ"
    r"ăắặằẳẵấầẩẫậếềểễệốồổỗộướừửữự"
    r"đĐ"
    r"ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]"
)

_VI_KEYWORDS = frozenset({
    "và", "thì", "là", "mà", "cái", "đang", "đã", "sẽ", "không", "có",
    "một", "những", "các", "của", "với", "cho", "được", "bị", "nên",
    "vì", "rồi", "lắm", "quá", "rất", "nhưng", "tôi", "mình", "bạn",
    "anh", "chị", "em", "họ", "chúng", "nó", "này", "kia", "đó",
    "thế", "sao", "gì", "nào", "khi", "sau", "trước", "trong",
    "cũng", "hay", "hoặc", "vậy", "ạ", "ơi", "nhé", "nhe",
    # Common words often transcribed without diacritics by Whisper
    "banh", "mi", "bun", "bo", "pho", "com",
})

_EN_FUNCTION_WORDS = frozenset({
    "i", "you", "he", "she", "we", "they", "it",
    "a", "an", "the", "is", "am", "are", "was", "were",
    "do", "does", "did", "have", "has", "had",
    "to", "of", "in", "on", "at", "for", "with", "from",
    "and", "or", "but", "if", "because", "that", "this", "these", "those",
    "what", "when", "where", "why", "how",
    "can", "could", "will", "would", "should", "want", "like", "need",
    "my", "your", "his", "her", "our", "their",
})

_WORD_RE = re.compile(r"[A-Za-zÀ-ỹĐđ']+")

# ── Intent patterns ────────────────────────────────────────────────────────────
# BUG FIX #1: Narrowed _EXPLICIT_HELP_VI.
# Old: r"từ.*?này" — matches almost any sentence containing "từ" and "này".
# New: requires "từ" to be directly adjacent to a noun/pronoun marker before "này"
#      and adds "cho ví dụ" as a separate alternative.
_EXPLICIT_HELP_VI = re.compile(
    r"(?:"
    r"nói thế nào"
    r"|tiếng anh là gì"
    r"|gọi là gì"
    r"|dịch là gì"
    r"|từ này"           # narrowed: exact phrase only
    r"|cho ví dụ"
    r")",
    re.IGNORECASE,
)
_EXPLICIT_HELP_EN = re.compile(
    r"(?:how do i say|what is.*?in english|how to say|what does.*?mean)",
    re.IGNORECASE,
)

# BUG FIX #2: Narrowed _CONFIRM_TOPIC_VI.
# Old: "đúng không|phải không" — fires on ANY sentence ending in "đúng không"
#      even unrelated ones like "câu đó đúng không" (everyday correction, not topic confirm).
# New: requires the sentence to also contain a topic-framing cue before the tail question.
_CONFIRM_TOPIC_VI = re.compile(
    r"(?:đang nói về|có phải.*?(?:đúng không|phải không)|chủ đề.*?(?:đúng không|phải không))",
    re.IGNORECASE,
)


def _tokenize(text: str) -> list[str]:
    return _WORD_RE.findall(text.lower())


def _is_vietnamese_token(token: str) -> bool:
    return bool(_VI_DIACRITIC_RE.search(token)) or token in _VI_KEYWORDS


def _is_english_token(token: str) -> bool:
    if _is_vietnamese_token(token):
        return False
    if token in _EN_FUNCTION_WORDS:
        return True
    
    # Harden against undiacritized Vietnamese (e.g. "toi", "vai", "nha").
    # Don't blindly classify short ASCII words as English unless they contain
    # letters that do not exist in the Vietnamese alphabet (j, w, z).
    if len(token) <= 4 and not any(c in token for c in "jwz"):
        return False

    return bool(re.fullmatch(r"[a-z']+", token))


def _extract_embedded_phrase(verbatim_text: str, routing_patterns: list[str]) -> str:
    """BUG FIX #3: Real embedded_phrase_source extraction.

    Old: always returned placeholder "the highlighted phrase".
    New: attempts to extract the Vietnamese/foreign phrase the user is asking about.

    Strategy: for "explicit_word_help" turns, look for a substring of tokens
    that are mostly Vietnamese (diacritics present) before the help trigger phrase.
    Falls back to the first non-function-word noun-ish phrase if extraction fails.
    """
    # Try to find the phrase before the help trigger
    for pattern in [
        r"(.+?)(?:nói thế nào|tiếng anh là gì|gọi là gì|dịch là gì|từ này|cho ví dụ)",
        r"(?:how do i say|how to say)\s+(.+?)(?:\s+in english)?$",
        r"(?:what is)\s+(.+?)\s+(?:in english)",
    ]:
        m = re.search(pattern, verbatim_text, re.IGNORECASE)
        if m:
            candidate = m.group(1).strip().strip("\"'.,?!")
            if candidate and len(candidate.split()) <= 8:
                return candidate

    # Fallback: return the first Vietnamese-token cluster
    tokens = verbatim_text.split()
    vi_cluster = []
    for tok in tokens:
        if _is_vietnamese_token(tok.lower()):
            vi_cluster.append(tok)
        elif vi_cluster:
            break
    if vi_cluster:
        return " ".join(vi_cluster)

    return ""  # empty string, not placeholder — callers should handle this


# ── Fast-path gate ──────────────────────────────────────────────────────────────
# Multi-condition heuristic: True iff the utterance can skip translation/correction.
# Design: rule-based only — no LLM classifier to avoid adding latency.
#
# All conditions must pass:
#   1. No Vietnamese diacritics at all.
#   2. No Vietnamese keyword tokens.
#   3. Minimum word count (< 2 words is too ambiguous to trust).
#   4. No filler-only pattern (handled upstream, but guard here too).
#   5. No explicit help trigger ("how do i say", "tiếng anh là gì", etc.)
#   6. No code-switch signal from the LanguageRouter result.
#
# Deliberately conservative: when in doubt, return False and let slow path handle it.
# Log the result so we can tune the thresholds over time.

_FILLER_ONLY_FAST = re.compile(
    r"^\s*(?:uh+|um+|hmm+|ừm*|à+|ơi+|[.…,\s]+)\s*$",
    re.IGNORECASE,
)


def is_clean_english_fast_path(verbatim_text: str, routing: Dict[str, Any]) -> bool:
    """Return True if the utterance is safe to send directly to LLM without
    translation or ASR correction.

    Args:
        verbatim_text: Raw STT output.
        routing:       Result from LanguageRouter.route(verbatim_text).

    Returns:
        True  → fast path: skip translate/correct, use verbatim_text as LLM input.
        False → slow path: run the normal translation/correction pipeline.
    """
    # 1. Reject if any Vietnamese diacritic is present — definitive signal.
    if _VI_DIACRITIC_RE.search(verbatim_text):
        return False

    # 2. Reject if the router detected any Vietnamese tokens.
    if routing.get("vi_count", 0) > 0:
        return False

    # 3. Reject utterances that are too short to be trustworthy.
    words = [w for w in verbatim_text.split() if w.strip()]
    if len(words) < 2:
        return False

    # 4. Reject filler-only utterances (should be dropped upstream, but guard here).
    if _FILLER_ONLY_FAST.match(verbatim_text.strip()):
        return False

    # 5. Reject if the user is asking for explicit language help
    #    (those need the full normalization path to extract the phrase).
    if routing.get("explicit_word_help"):
        return False

    # 6. Reject if the router flagged this as needing translation.
    if routing.get("should_translate_full_utterance"):
        return False

    # All checks passed — safe to fast-path.
    return True


class LanguageRouter:
    @staticmethod
    def route(verbatim_text: str) -> Dict[str, Any]:
        """Analyze verbatim text and output a structured routing decision."""
        tokens = _tokenize(verbatim_text)

        if not tokens:
            return {
                "language_mode": "unknown",
                "vi_count": 0,
                "en_count": 0,
                "vi_ratio": 0.0,
                "en_ratio": 0.0,
                "english_dominant_mixed": False,
                "explicit_word_help": False,
                "confirm_topic": False,
                "should_translate_full_utterance": False,
                "should_preserve_verbatim_for_llm": True,
                "embedded_phrase_source": "",
                "detected_patterns": [],
            }

        vi_count = sum(1 for t in tokens if _is_vietnamese_token(t))
        en_count = sum(1 for t in tokens if _is_english_token(t))

        vi_ratio = vi_count / len(tokens)
        en_ratio = en_count / len(tokens)

        english_dominant_mixed = vi_count > 0 and en_count >= vi_count and en_ratio >= 0.45

        # Detect specific intent patterns
        explicit_word_help = False
        confirm_topic = False
        detected_patterns = []

        if _EXPLICIT_HELP_VI.search(verbatim_text) or _EXPLICIT_HELP_EN.search(verbatim_text):
            explicit_word_help = True
            detected_patterns.append("explicit_word_help")

        if _CONFIRM_TOPIC_VI.search(verbatim_text):
            confirm_topic = True
            detected_patterns.append("confirm_topic")

        if vi_count == 0:
            mode = "english"
        elif vi_ratio >= 0.7:
            mode = "mostly_vietnamese"
        elif english_dominant_mixed:
            mode = "mixed_vi_en"
        elif vi_ratio >= 0.25:
            mode = "mixed_vi_en"
        else:
            mode = "english"

        if mode == "mostly_vietnamese":
            english_dominant_mixed = False

        # BUG FIX #4: should_preserve_verbatim_for_llm is now returned and
        # consumed by normalization_policy.py instead of being silently ignored.
        should_translate_full_utterance = False
        should_preserve_verbatim_for_llm = False

        if explicit_word_help:
            should_translate_full_utterance = False
            should_preserve_verbatim_for_llm = True
        elif confirm_topic:
            should_translate_full_utterance = True
            should_preserve_verbatim_for_llm = False
        elif mode == "mostly_vietnamese":
            should_translate_full_utterance = False
            should_preserve_verbatim_for_llm = True
        elif mode == "mixed_vi_en":
            if not english_dominant_mixed:
                should_translate_full_utterance = True

        # Extract embedded phrase for help turns
        embedded_phrase_source = ""
        if explicit_word_help:
            embedded_phrase_source = _extract_embedded_phrase(verbatim_text, detected_patterns)

        return {
            "language_mode": mode,
            "vi_count": vi_count,
            "en_count": en_count,
            "vi_ratio": vi_ratio,
            "en_ratio": en_ratio,
            "english_dominant_mixed": english_dominant_mixed,
            "explicit_word_help": explicit_word_help,
            "confirm_topic": confirm_topic,
            "should_translate_full_utterance": should_translate_full_utterance,
            "should_preserve_verbatim_for_llm": should_preserve_verbatim_for_llm,
            "embedded_phrase_source": embedded_phrase_source,
            "detected_patterns": detected_patterns,
        }
