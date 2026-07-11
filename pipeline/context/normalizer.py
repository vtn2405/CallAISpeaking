"""
context/normalizer.py — light-weight transcript cleaner.

Design principle (from project plan):
  Transcript auto-generated captions can lack punctuation, capitalisation,
  and contain noise tokens like [Music] or [Applause].
  This normalizer does the MINIMUM needed to make text readable by the LLM.

  We do NOT aggressively merge or rephrase — timestamp boundaries must
  stay intact so the Fixed-time Chunker can use start/duration accurately.

What we clean:
  1. Remove known noise tokens: [Music], [Applause], (Music), etc.
  2. Strip excess whitespace within a segment.
  3. Drop segments that become empty after cleaning.

What we do NOT change:
  - start / duration values (chunker depends on these)
  - Word capitalisation (LLM handles that in its response)
  - Sentence boundaries (not reliable in auto-captions anyway)
"""
from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .extractor import TranscriptSegment

# Noise tokens that appear in auto-generated captions but carry no information
_NOISE_RE = re.compile(
    r"\[(?:Music|Applause|Laughter|Cheering|Inaudible|MUSIC|APPLAUSE)\]"
    r"|"
    r"\((?:Music|Applause|Laughter|Cheering|Inaudible|music|applause)\)",
    re.IGNORECASE,
)

# Collapse multiple spaces into one
_MULTI_SPACE_RE = re.compile(r" {2,}")


def normalize(segments: list["TranscriptSegment"]) -> list["TranscriptSegment"]:
    """
    Clean a list of transcript segments.

    Args:
        segments: Raw transcript segments from extractor.get_transcript().

    Returns:
        Filtered, lightly cleaned list. start/duration are unchanged.
        Empty segments (after cleaning) are dropped.
    """
    cleaned: list["TranscriptSegment"] = []
    for seg in segments:
        text = _clean_text(seg["text"])
        if not text:
            continue  # Drop empty segments (e.g. a segment that was only [Music])
        cleaned.append({"text": text, "start": seg["start"], "duration": seg["duration"]})
    return cleaned


def _clean_text(raw: str) -> str:
    text = _NOISE_RE.sub("", raw)       # Remove noise tokens
    text = _MULTI_SPACE_RE.sub(" ", text)  # Collapse spaces
    return text.strip()
