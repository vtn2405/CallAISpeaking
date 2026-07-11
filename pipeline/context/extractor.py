"""
context/extractor.py — YouTube transcript fetcher.

Uses youtube-transcript-api to fetch subtitles with timestamps.

Output format (list of dicts):
    [{ "text": str, "start": float, "duration": float }, ...]

Language preference order:
    1. "en"             (manual English captions — highest quality)
    2. "en-*" variants  (e.g. en-US, en-GB)
    3. First auto-generated entry available

If no transcript is available at all, raises TranscriptUnavailableError.
"""
from __future__ import annotations

import logging
from typing import TypedDict

from youtube_transcript_api import (
    YouTubeTranscriptApi,
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
)

logger = logging.getLogger(__name__)


class TranscriptSegment(TypedDict):
    text: str
    start: float
    duration: float


class TranscriptUnavailableError(Exception):
    """Raised when no transcript can be fetched for the given videoId."""
    pass


def get_transcript(video_id: str) -> list[TranscriptSegment]:
    """
    Fetch the transcript for a YouTube video.

    Args:
        video_id: 11-character YouTube videoId.

    Returns:
        List of TranscriptSegment dicts ordered by start time.

    Raises:
        TranscriptUnavailableError: if subtitles are disabled or unavailable.
    """
    try:
        transcript_list = YouTubeTranscriptApi().list(video_id)
    except (TranscriptsDisabled, VideoUnavailable, Exception) as exc:
        raise TranscriptUnavailableError(
            f"Cannot list transcripts for video {video_id!r}: {exc}"
        ) from exc

    transcript = _select_best_transcript(transcript_list, video_id)

    try:
        raw = transcript.fetch()
    except Exception as exc:
        raise TranscriptUnavailableError(
            f"Failed to fetch transcript for video {video_id!r}: {exc}"
        ) from exc

    # Normalise to our TypedDict shape — youtube-transcript-api returns
    # FetchedTranscript objects with .text / .start / .duration attributes.
    segments: list[TranscriptSegment] = []
    for seg in raw:
        segments.append(
            TranscriptSegment(
                text=str(getattr(seg, "text", "")),
                start=float(getattr(seg, "start", 0.0)),
                duration=float(getattr(seg, "duration", 0.0)),
            )
        )

    logger.info(
        "Fetched %d transcript segments for video %s (lang=%s, generated=%s)",
        len(segments),
        video_id,
        transcript.language_code,
        transcript.is_generated,
    )
    return segments


# ── Internal helpers ──────────────────────────────────────────────────────────

def _select_best_transcript(transcript_list, video_id: str):
    """
    Select the best available transcript in order of preference:
      1. Manual English ("en")
      2. Manual English variants ("en-*")
      3. Auto-generated English ("en" or "en-*")
      4. Any available transcript (last resort)
    """
    # 1. Manual English
    try:
        return transcript_list.find_manually_created_transcript(["en"])
    except NoTranscriptFound:
        pass

    # 2. Manual English variants
    try:
        available = list(transcript_list)
        manual_en = [
            t for t in available
            if not t.is_generated and t.language_code.startswith("en")
        ]
        if manual_en:
            return manual_en[0]
    except Exception:
        pass

    # 3. Auto-generated English
    try:
        return transcript_list.find_generated_transcript(["en"])
    except NoTranscriptFound:
        pass

    # 4. Any transcript (translate to English if possible)
    try:
        available = list(transcript_list)
        if not available:
            raise TranscriptUnavailableError(
                f"No transcripts of any language found for video {video_id!r}"
            )
        # If a non-English transcript can be translated, do so
        first = available[0]
        if first.is_translatable:
            logger.info(
                "Translating transcript from %s to English for video %s",
                first.language_code,
                video_id,
            )
            return first.translate("en")
        return first
    except TranscriptUnavailableError:
        raise
    except Exception as exc:
        raise TranscriptUnavailableError(
            f"No usable transcript for video {video_id!r}: {exc}"
        ) from exc
