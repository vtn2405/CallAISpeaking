"""
context/summarizer.py — Gemini-powered full-video outline generator.

Role in the pipeline:
  - Called ONCE at ingest time by pipeline.build_context().
  - Uses gemini-2.5-flash to read the full transcript and generate a structured
    VideoOutline (parts, characters, key events, summary paragraph).
  - NOT called per conversation turn — Gemini is ingest-only.

Output:
  Returns a VideoOutline (Pydantic model). On any failure (API error, JSON parse
  error, empty response), returns a degraded VideoOutline(summary_text="...") so
  the session still proceeds.

Safety cap:
  Transcripts longer than GEMINI_INGEST_MAX_CHARS (default 80,000) are truncated
  before sending. This is a cost guard — Gemini 2.5 Flash supports much more, but
  extremely long videos should trigger a warning rather than silent max-cost ingest.

Fallback:
  If GEMINI_API_KEY is unset, returns a degraded outline immediately so the
  pipeline can run in offline/dev mode.
"""
from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .chunker import Chunk

from .outline_schema import VideoOutline

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

_GEMINI_MODEL = "gemini-2.5-flash"

_SYSTEM_INSTRUCTION = """\
You are a video analysis assistant for a language-learning app.
You will receive the full transcript of a YouTube video (from auto-generated captions).
Captions may lack proper punctuation, capitalization, or have occasional transcription errors.

Your task: Analyze the transcript thoroughly and return a JSON object that matches exactly this schema:

{
  "summary_text": "<A clear, 3–5 sentence paragraph summarizing the full video topic and main message>",
  "parts": [
    { "part": 1, "title": "<part title>", "start_time": "MM:SS", "end_time": "MM:SS", "summary_text": "<what happens in this part>" }
  ],
  "characters": [
    { "name": "<character name>", "role": "<their role, e.g. store employee, customer, narrator>" }
  ],
  "key_events": [
    { "event_id": 1, "time": "MM:SS", "description": "<what happened>", "characters": ["Name1", "Name2"], "part": 1 }
  ]
}

Rules:
- event_id must be unique sequential integers starting at 1.
- part in key_events must match a part number from the parts list.
- Only include characters and events that are actually present in the transcript.
- Do NOT invent details not supported by the transcript.
- Return ONLY the JSON object — no markdown fences, no extra text.
"""

_PROMPT_TEMPLATE = """\
Here is the full transcript of the YouTube video:

Transcript start time reference — each segment is shown as [MM:SS]: text

{transcript_with_timestamps}

Please analyze and return the full JSON outline as instructed.
"""

# ── Public API ────────────────────────────────────────────────────────────────

async def generate_outline(chunks: list["Chunk"], full_transcript: str) -> VideoOutline:
    """
    Generate a full-video outline using Gemini 2.5 Flash.

    Args:
        chunks:          Fixed-time transcript chunks (used for timestamp hints).
        full_transcript: Full joined transcript text (from pipeline.build_context).

    Returns:
        VideoOutline — structured outline. On any failure, returns a degraded
        VideoOutline so the session still proceeds.
    """
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        logger.warning("[summarizer] GEMINI_API_KEY not set — returning degraded outline")
        return _fallback_outline(chunks)

    # Apply soft safety cap
    max_chars = int(os.getenv("GEMINI_INGEST_MAX_CHARS", "80000"))
    if len(full_transcript) > max_chars:
        logger.warning(
            "[summarizer] Transcript (%d chars) exceeds GEMINI_INGEST_MAX_CHARS=%d — truncating",
            len(full_transcript), max_chars,
        )
        full_transcript = full_transcript[:max_chars] + "\n[transcript truncated]"

    transcript_with_timestamps = _build_timestamped_transcript(chunks)
    prompt = _PROMPT_TEMPLATE.format(transcript_with_timestamps=transcript_with_timestamps)

    try:
        from google import genai
        from google.genai import types  # type: ignore[attr-defined]

        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model=_GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=_SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                # No temperature parameter — omitted intentionally
            ),
        )

        # Extract text — inspect candidates on failure for better debug logging
        raw_text = ""
        if response.text:
            raw_text = response.text.strip()
        else:
            logger.warning(
                "[summarizer] response.text was empty — candidates: %s",
                _inspect_candidates(response),
            )

        if not raw_text:
            return _fallback_outline(chunks, reason="empty response from Gemini")

        try:
            outline = VideoOutline.model_validate_json(raw_text)
            logger.info(
                "[summarizer] Gemini outline generated: %d parts, %d characters, %d events",
                len(outline.parts), len(outline.characters), len(outline.key_events),
            )
            return outline
        except Exception as parse_exc:
            logger.warning(
                "[summarizer] JSON parse/validation failed: %s\nRaw response (first 500 chars): %s",
                parse_exc, raw_text[:500],
            )
            # Try to extract summary_text from raw text for partial degraded mode
            return _fallback_outline(chunks, reason=f"JSON parse error: {parse_exc}")

    except Exception as exc:
        logger.warning("[summarizer] Gemini call failed: %s — returning degraded outline", exc)
        return _fallback_outline(chunks)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _build_timestamped_transcript(chunks: list["Chunk"]) -> str:
    """Build a human-readable transcript with MM:SS timestamps per chunk."""
    lines = []
    for c in chunks:
        start_min = int(c["start"] // 60)
        start_sec = int(c["start"] % 60)
        lines.append(f"[{start_min:02d}:{start_sec:02d}] {c['text']}")
    return "\n".join(lines)


def _inspect_candidates(response: object) -> str:
    """Safely inspect raw response candidates for debug logging when response.text is empty."""
    try:
        candidates = getattr(response, "candidates", [])
        if not candidates:
            return "no candidates"
        parts = getattr(candidates[0].content, "parts", [])
        return repr(parts[:2]) if parts else "empty parts"
    except Exception as e:
        return f"inspection failed: {e}"


def _fallback_outline(chunks: list["Chunk"], reason: str = "no API key") -> VideoOutline:
    """
    Return a degraded VideoOutline so sessions can still proceed without Gemini.
    summary_text provides a minimal transcript preview for the prompt.
    """
    if not chunks:
        summary = f"[Outline unavailable — {reason}. No transcript available.]"
    else:
        preview = " ".join(c["text"] for c in chunks[:3])[:300]
        summary = f"[Outline unavailable — {reason}. Transcript preview: {preview}…]"

    return VideoOutline(summary_text=summary)
