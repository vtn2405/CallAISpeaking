"""
ai_turn.py — AI turn handler for the WS shim.

Architecture (per-turn):
  - Gemini is NOT called here. Only Azure OpenAI gpt-5-mini is used for turn generation.
  - Context mode is read from ctx.use_full_context (set once at ingest by pipeline.py).
  - Full-transcript injection is capped at FULL_CONTEXT_MAX_TURNS env var (default 6).
    After that cap, even short-video sessions switch to TF-IDF retrieval.

Retrieval flow:
  1. Build a rich query from recent conversation history + current user text.
  2. find_relevant_chunks returns (chunks, confidence).
  3. If confidence == "low_confidence": inject conservative prompt instruction.
  4. Progress tracking: mark visited chunk IDs and event IDs (by time overlap).
     Progress is NEVER derived from parsing the AI reply text.

Chat mode:
  - Read from record.metadata.get("mode", "video_chat") each turn.
  - "video_chat" (default): strict grounding, 1–3 sentences, answer-relevance check.
  - "beginner": same grounding + sentence starters, keyword hints, no proactive correction.
  - Safely defaults to "video_chat" if mode is missing or unrecognised.

First-turn scene-setting:
  - Detected when the session history is empty (before the first user turn).
  - Passed as is_first_turn=True to build_system_prompt so the template injects
    a scene-setting block (characters + setting) before the first question.

Per-turn observability log:
  [ai_turn] turn | session=%s | retrieval_mode=%s | chat_mode=%s | confidence=%s
            | chunk_ids=%s | visited_events=%d | full_ctx_turns=%d

Fallback:
  _FALLBACK_MESSAGE is a single honest message. The old rotating canned responses
  (_FALLBACK_RESPONSES) are removed — they broke topic grounding when Azure failed.

Event sequence emitted:
    1. ai.thinking              — backend processing begins
    2. ai.speaking              — carries clean reply text
    3. transcript.update        — isFinal=False, sender="ai"
    (isFinal=True sent by ws_bridge after tts.done from frontend)
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

from event_emitter import (
    send_ai_thinking,
    send_ai_speaking,
    send_transcript_update,
)

logger = logging.getLogger(__name__)

# Single honest fallback — replaces the old rotating canned responses that broke
# topic grounding when Azure failed mid-session.
_FALLBACK_MESSAGE = (
    "I'm having trouble connecting right now. "
    "Could you repeat that, or shall we continue talking about the video?"
)

# Per-session conversation history: session_id → list[{role, content}] (OpenAI format)
_session_history: dict[str, list[dict]] = {}


async def run_turn(ws: Any, session_id: str, user_text: str) -> str:
    """
    Handle one full AI turn for a given user utterance.

    Emits ai.thinking, then fetches a reply from Azure OpenAI (or fallback),
    then emits ai.speaking + transcript.update(isFinal=False).

    isFinal=True is NOT sent here. ws_bridge will send it after the frontend
    signals TTS playback completion via { type: "tts.done" }.

    Args:
        ws:          Active WebSocket connection.
        session_id:  Session identifier used to look up context + history.
        user_text:   The user's utterance that triggered this turn.

    Returns:
        The text of the generated response.
    """
    await send_ai_thinking(ws)
    response = await _generate_response(session_id, user_text)
    await send_ai_speaking(ws, response)
    await send_transcript_update(ws, response, is_final=False, sender="ai")
    return response


async def send_turn_final(ws: Any, response_text: str) -> None:
    """
    Commit the AI turn transcript as final.

    Called by ws_bridge when it receives a { type: "tts.done" } frame from
    the frontend, signalling that TTS audio playback has completed.
    """
    await send_transcript_update(ws, response_text, is_final=True, sender="ai")


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _generate_response(session_id: str, user_text: str) -> str:
    try:
        response = await _grounded_response(session_id, user_text)
        if response:
            return response
    except Exception as exc:
        logger.warning(
            "[ai_turn] Grounded response failed for session %s: %s — using fallback",
            session_id, exc,
        )

    await asyncio.sleep(0.5)
    return _FALLBACK_MESSAGE


async def _grounded_response(session_id: str, user_text: str) -> str | None:
    """
    Call Azure OpenAI gpt-5-mini with a grounded prompt built from session context.

    Context mode logic (read-only — computed at ingest):
      - Full-transcript mode: inject ctx.full_transcript directly for first
        FULL_CONTEXT_MAX_TURNS turns, then switch to retrieval.
      - Retrieval mode: TF-IDF + window expansion on ctx.chunks.

    Progress is tracked per turn via chunk IDs and event time overlap.
    No temperature parameter is passed to Azure (avoids 400 errors).
    """
    api_key     = os.getenv("AZURE_OPENAI_API_KEY", "")
    endpoint    = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    deployment  = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-5-mini")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01")

    if not api_key or not endpoint:
        return None

    from openai import AsyncAzureOpenAI
    from session_store import store
    from context.retrieval import find_relevant_chunks, build_retrieval_query
    from context.prompt_builder import build_system_prompt, build_messages, format_chunks

    record = await store.get(session_id)
    if record is None or record.context is None or not record.context.transcript_ready:
        return None

    ctx = record.context
    history = _session_history.get(session_id, [])

    max_full_turns = int(os.getenv("FULL_CONTEXT_MAX_TURNS", "6"))
    use_full = ctx.use_full_context and ctx.full_context_turns_used < max_full_turns

    # ── Determine local context and retrieval confidence ──────────────────────
    if use_full:
        local_context_text = ctx.full_transcript
        retrieval_mode = "full_transcript"
        confidence = "ok"
        chunk_ids_used: list[int] = []
        chunks_used: list[dict] = []
        ctx.full_context_turns_used += 1
    else:
        query = build_retrieval_query(user_text, history, lookback=3)
        chunks_used, confidence = find_relevant_chunks(query, ctx.chunks, top_n=3)  # type: ignore[arg-type]
        local_context_text = format_chunks(chunks_used) if chunks_used else ""
        retrieval_mode = "retrieval"
        chunk_ids_used = [c["id"] for c in chunks_used]

    # ── Progress tracking (chunk IDs + event time overlap) ────────────────────
    record.progress.mark_chunks(chunk_ids_used)

    # Mark events whose timestamps overlap with the retrieved chunks' time ranges
    if chunks_used and ctx.outline.key_events:
        matched_event_ids = _events_in_chunks(ctx.outline.key_events, chunks_used)
        record.progress.mark_events(matched_event_ids)

    # ── Build progress context string ─────────────────────────────────────────
    progress_context = record.progress.coverage_summary(ctx.outline)

    # ── Chat mode and first-turn detection ───────────────────────────────────
    chat_mode = record.metadata.get("mode", "video_chat")
    is_first_turn = len(history) == 0

    # ── Per-turn observability log ────────────────────────────────────────────
    logger.info(
        "[ai_turn] turn | session=%s | retrieval_mode=%s | chat_mode=%s "
        "| confidence=%s | chunk_ids=%s | visited_events=%d | full_ctx_turns=%d",
        session_id,
        retrieval_mode,
        chat_mode,
        confidence,
        chunk_ids_used,
        len(record.progress.visited_event_ids),
        ctx.full_context_turns_used,
    )

    # ── Build grounded system prompt ──────────────────────────────────────────
    system_prompt = build_system_prompt(
        outline=ctx.outline,
        local_context_text=local_context_text,
        progress_context=progress_context,
        retrieval_confident=(confidence == "ok"),
        summary_ready=ctx.summary_ready,
        chat_mode=chat_mode,
        is_first_turn=is_first_turn,
    )

    messages = build_messages(system_prompt, history, user_text)

    # ── Azure OpenAI call (no temperature parameter) ──────────────────────────
    client = AsyncAzureOpenAI(
        api_key=api_key,
        azure_endpoint=endpoint,
        api_version=api_version,
    )

    completion = await client.chat.completions.create(
        model=deployment,
        messages=messages,           # type: ignore[arg-type]
        # No temperature — omitted intentionally to avoid 400 errors
        # No max_completion_tokens — Azure 2024-12-01-preview returns empty strings when set
    )

    reply = (completion.choices[0].message.content or "").strip()
    if not reply:
        return None

    # ── Update conversation history ───────────────────────────────────────────
    if session_id not in _session_history:
        _session_history[session_id] = []
    _session_history[session_id].append({"role": "user",      "content": user_text})
    _session_history[session_id].append({"role": "assistant", "content": reply})

    # Trim to last 16 entries (= 8 turns)
    if len(_session_history[session_id]) > 16:
        _session_history[session_id] = _session_history[session_id][-16:]

    logger.info(
        "[ai_turn] Azure reply | session=%s | deployment=%s | reply_chars=%d",
        session_id, deployment, len(reply),
    )
    return reply


# ── Progress helper ───────────────────────────────────────────────────────────

def _parse_mmss(time_str: str) -> float:
    """Parse 'MM:SS' string to seconds. Returns 0.0 on parse failure."""
    try:
        parts = time_str.strip().split(":")
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        return 0.0
    except (ValueError, AttributeError):
        return 0.0


def _events_in_chunks(key_events: list, chunks: list[dict]) -> list[int]:
    """
    Return event_ids of KeyEvents whose timestamp falls within any retrieved chunk's
    time range [start, end]. Progress marking is done by time overlap, not AI text parsing.
    """
    matched = []
    for event in key_events:
        event_sec = _parse_mmss(event.time)
        for chunk in chunks:
            if chunk.get("start", 0) <= event_sec <= chunk.get("end", 0):
                matched.append(event.event_id)
                break
    return matched
