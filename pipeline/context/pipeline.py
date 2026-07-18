"""
context/pipeline.py — Orchestrates the full context pipeline.

Public API:
    context = await build_context(video_url, timeout_sec=30)

Pipeline steps:
    1. parse_youtube_url(video_url)       → video_id
    2. get_transcript(video_id)           → raw segments
    3. normalize(raw_segments)            → clean segments
    4. fixed_time_chunk(segments)         → chunks
    5. Compute full_transcript + mode     → use_full_context (set ONCE here)
    6. generate_outline(chunks, ...)      → VideoOutline  ← Gemini call (with timeout)

Context mode decision (computed once, never re-evaluated per turn):
    use_full_context = len(full_transcript) < SHORT_VIDEO_TRANSCRIPT_CHAR_THRESHOLD
    Logged alongside chunk count and char count for observability.

Failure modes:
    - If transcript is unavailable → raises ContextPipelineError (fail fast).
    - If outline times out or fails → fallback to degraded VideoOutline
      (summary_ready=False). Session still proceeds; AI will work from chunks only.
"""
from __future__ import annotations

import asyncio
import logging
import os
from concurrent.futures import ThreadPoolExecutor

from .chunker import fixed_time_chunk
from .extractor import get_transcript, TranscriptUnavailableError
from .normalizer import normalize
from .parser import parse_youtube_url
from .summarizer import generate_outline
from .outline_schema import VideoOutline

logger = logging.getLogger(__name__)

# Thread pool for blocking I/O (transcript fetch is synchronous)
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="ctx-pipeline")


class ContextPipelineError(Exception):
    """
    Raised when the pipeline cannot produce usable context.
    This happens when:
      - URL is not a valid YouTube link
      - Transcript is disabled or unavailable for the video
    """
    pass


async def build_context(
    video_url: str,
    timeout_sec: float | None = None,
) -> "SessionContext":  # type: ignore[name-defined]  # noqa: F821
    """
    Run the full context pipeline for a YouTube video.

    Args:
        video_url:   Raw URL from the user (from /api/sessions/register body).
        timeout_sec: Hard timeout in seconds. If None, reads CONTEXT_PIPELINE_TIMEOUT_SEC
                     env var (default: 30 s).

    Returns:
        SessionContext instance populated with video_id, outline, full_transcript, chunks,
        use_full_context (computed once), and summary_ready flag.

    Raises:
        ContextPipelineError: if the URL is invalid or transcript is unavailable.
    """
    # Resolve timeout (increased default to 30 s for Gemini ingest)
    if timeout_sec is None:
        timeout_sec = float(os.getenv("CONTEXT_PIPELINE_TIMEOUT_SEC", "30"))

    # Late import to avoid circular dependency with session_store
    from session_store import SessionContext

    # ── Step 1: Parse URL → video_id ─────────────────────────────────────────
    try:
        video_id = parse_youtube_url(video_url)
    except ValueError as exc:
        raise ContextPipelineError(f"Invalid YouTube URL: {exc}") from exc

    logger.info("[pipeline] Starting context build for video_id=%s", video_id)

    # ── Steps 2-4: Extract + Normalize + Chunk ───────
    try:
        # get_transcript is now async and handles its own polling/timeouts
        raw_segments = await asyncio.wait_for(
            get_transcript(video_id),
            timeout=timeout_sec * 0.8,  # Give 80% of budget to transcript fetch since it can be slow (ASR)
        )
    except asyncio.TimeoutError:
        raise ContextPipelineError(
            f"Transcript fetch timed out after {timeout_sec * 0.5:.1f}s "
            f"for video {video_id!r}"
        )
    except TranscriptUnavailableError as exc:
        raise ContextPipelineError(str(exc)) from exc

    clean_segments = normalize(raw_segments)
    chunks = fixed_time_chunk(clean_segments, duration_sec=60.0)

    logger.info(
        "[pipeline] Transcript ready: %d segments → %d chunks",
        len(raw_segments),
        len(chunks),
    )

    # ── Step 5: Compute full_transcript and context mode (set ONCE) ───────────
    full_transcript = " ".join(c["text"] for c in chunks)
    threshold = int(os.getenv("SHORT_VIDEO_TRANSCRIPT_CHAR_THRESHOLD", "25000"))
    use_full_context = len(full_transcript) < threshold

    logger.info(
        "[pipeline] Context mode=%s | chunks=%d | chars=%d | threshold=%d",
        "full_transcript" if use_full_context else "retrieval",
        len(chunks),
        len(full_transcript),
        threshold,
    )

    # ── Step 6: Outline generation (Gemini, async, with remaining timeout) ────
    outline: VideoOutline
    summary_ready = False
    remaining_timeout = timeout_sec * 0.5  # ~50% of budget for Gemini

    try:
        outline = await asyncio.wait_for(
            generate_outline(chunks, full_transcript),
            timeout=remaining_timeout,
        )
        summary_ready = True
        logger.info(
            "[pipeline] Outline ready: %d parts, %d characters, %d events",
            len(outline.parts), len(outline.characters), len(outline.key_events),
        )
    except asyncio.TimeoutError:
        logger.warning(
            "[pipeline] Outline generation timed out after %.1fs — "
            "proceeding with degraded outline",
            remaining_timeout,
        )
        outline = VideoOutline(summary_text="[Outline unavailable — generation timed out]")
    except Exception as exc:
        logger.warning(
            "[pipeline] Outline generation failed (%s) — proceeding with degraded outline",
            exc,
        )
        outline = VideoOutline(summary_text="[Outline unavailable — generation error]")

    return SessionContext(
        video_id=video_id,
        outline=outline,
        full_transcript=full_transcript,
        chunks=[dict(c) for c in chunks],
        transcript_ready=True,
        summary_ready=summary_ready,
        use_full_context=use_full_context,
        full_context_turns_used=0,
    )
