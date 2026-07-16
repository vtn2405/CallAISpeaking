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
    overlap_sec: float = 8.0,
) -> list[Chunk]:
    """
    Group transcript segments into fixed-time chunks with optional overlap.

    Args:
        segments:     Normalised transcript segments (from normalizer.normalize).
        duration_sec: Target chunk duration in seconds (default 60).
        overlap_sec:  Seconds of tail segments from the previous chunk to seed
                      the next chunk with (default 8). Prevents ideas that span
                      exactly the 60-second boundary from being silently cut.
                      Set to 0.0 to disable overlap (original behaviour).

    Returns:
        List of Chunk dicts ordered by start time.
        Returns [] if segments is empty.
    """
    if not segments:
        return []

    chunks: list[Chunk] = []
    # Collect all segments for the current chunk window
    current_texts: list[str] = []
    current_start: float = segments[0]["start"]
    current_duration: float = 0.0
    chunk_id = 0
    # Track the segments that formed the previous chunk for overlap seeding
    prev_chunk_segments: list["TranscriptSegment"] = []

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

            # Collect the segments for overlap seeding
            # (we need the actual segment list, not just texts)
            prev_chunk_segments = _collect_overlap_segments(
                segments, current_start, end, overlap_sec
            )

            # Seed next chunk with overlap tail segments
            current_texts = [s["text"] for s in prev_chunk_segments]
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


def _collect_overlap_segments(
    segments: list["TranscriptSegment"],
    chunk_start: float,
    chunk_end: float,
    overlap_sec: float,
) -> list["TranscriptSegment"]:
    """
    Return segments from the tail of the given chunk window that fall within
    `overlap_sec` before `chunk_end`. These are used to seed the next chunk
    so that context spanning the boundary is not lost.
    """
    if overlap_sec <= 0.0:
        return []
    overlap_start = chunk_end - overlap_sec
    return [
        s for s in segments
        if s["start"] >= chunk_start
        and s["start"] >= overlap_start
        and s["start"] < chunk_end
    ]

