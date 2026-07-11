"""
context/chunker.py — Fixed-time transcript chunker (Phase 1 strategy).

Strategy (from project plan):
  Group consecutive transcript segments into "chunks" of approximately
  TARGET_DURATION_SEC seconds based on the start + duration timestamps.
  This is intentionally NOT sentence-boundary splitting — auto-generated
  captions rarely have reliable sentence breaks, so time-based grouping
  is more predictable and easier to debug.

Chunk output format:
    {
        "id":    int,         # 0-indexed chunk number
        "text":  str,         # Concatenated segment texts (space-joined)
        "start": float,       # Start time of first segment (seconds)
        "end":   float,       # End time of last segment (seconds)
    }
"""
from __future__ import annotations

from typing import TYPE_CHECKING, TypedDict

if TYPE_CHECKING:
    from .extractor import TranscriptSegment

# Target window per chunk in seconds (project plan: 45–60 s)
TARGET_DURATION_SEC: float = 60.0


class Chunk(TypedDict):
    id: int
    text: str
    start: float
    end: float


def fixed_time_chunk(
    segments: list["TranscriptSegment"],
    duration_sec: float = TARGET_DURATION_SEC,
) -> list[Chunk]:
    """
    Group transcript segments into fixed-time chunks.

    Args:
        segments:     Normalised transcript segments (from normalizer.normalize).
        duration_sec: Target chunk duration in seconds (default 60).

    Returns:
        List of Chunk dicts ordered by start time.
        Returns [] if segments is empty.
    """
    if not segments:
        return []

    chunks: list[Chunk] = []
    current_texts: list[str] = []
    current_start: float = segments[0]["start"]
    current_duration: float = 0.0
    chunk_id = 0

    for seg in segments:
        current_texts.append(seg["text"])
        current_duration += seg["duration"]

        if current_duration >= duration_sec:
            end = seg["start"] + seg["duration"]
            chunks.append(
                Chunk(
                    id=chunk_id,
                    text=" ".join(current_texts),
                    start=current_start,
                    end=end,
                )
            )
            chunk_id += 1
            current_texts = []
            current_start = end
            current_duration = 0.0

    # Flush any remaining segments as a final (possibly shorter) chunk
    if current_texts:
        last = segments[-1]
        chunks.append(
            Chunk(
                id=chunk_id,
                text=" ".join(current_texts),
                start=current_start,
                end=last["start"] + last["duration"],
            )
        )

    return chunks
