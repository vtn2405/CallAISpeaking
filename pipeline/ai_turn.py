"""
ai_turn.py — AI turn handler for the WS shim.

Architecture (per-turn):
  - Groq STT (stt.py) pre-processes user audio into `normalized_english`.
    Only `normalized_english` is passed to this function as `user_text`.
    Raw provider text is logged/stored by the caller, NOT injected here.
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
import json
import logging
import os
import re
import time
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

# ── Vietnamese language guard ─────────────────────────────────────────────────
# Letters used in Vietnamese that never appear in standard English text.
# Matching any of them in the AI reply is a reliable signal that the model
# replied in Vietnamese instead of English.
_VI_CHARS = re.compile(r"[đĐăĂâÂêÊôÔơƠưƯẠ-ỹ]")

def _looks_vietnamese(text: str) -> bool:
    """Return True if text contains Vietnamese-specific diacritics (đ, ă, â, ê, ô, ơ, ư and tonal marks)."""
    return bool(_VI_CHARS.search(text))


async def _force_english_if_vietnamese(client: Any, deployment: str, text: str) -> str:
    """
    If text looks Vietnamese, call the model once more with an explicit English-only
    system message and return the English rewrite. Used by both the streaming path
    and the unary _grounded_response path so no Vietnamese slips through on fallback.
    """
    if not text or not _looks_vietnamese(text):
        return text
    logger.warning("[ai_turn] reply looked Vietnamese — forcing English regen")
    msgs = [
        {"role": "system", "content": (
            "You are an English-only assistant. Your previous reply was in Vietnamese, which is WRONG "
            "for this English-practice app. Rewrite it entirely in natural English, same meaning and length."
        )},
        {"role": "user", "content": text},
    ]
    kw: dict = {"model": deployment, "messages": msgs}
    if _REASONING_EFFORT_SUPPORTED:
        kw["reasoning_effort"] = "minimal"
    try:
        comp = await client.chat.completions.create(**kw)
        out = (comp.choices[0].message.content or "").strip()
        return out or text
    except Exception as exc:
        logger.warning("[ai_turn] VN regen failed: %s", exc)
        return text


# Per-session conversation history: session_id → list[{role, content}] (OpenAI format)
_session_history: dict[str, list[dict]] = {}

# Per-session rolling summary of turns that have rolled off the verbatim window.
# Only turns older than MAX_HISTORY_TURNS are summarised here — no overlap with history.
_session_summary: dict[str, str] = {}

# Per-session topic anchor: extracted once from outline.summary_text on first turn, then cached.
_session_topic_anchor: dict[str, str] = {}

# ── reasoning_effort capability probe ────────────────────────────────────────
# Tried once at runtime. If Azure returns 400 (param unsupported for this
# deployment / api-version), we set this False and never pass it again.
# This prevents double-call regression: we probe, cache result, done.
# None = not yet probed. True = supported. False = rejected by Azure.
_REASONING_EFFORT_SUPPORTED: bool | None = None


def _build_create_kwargs(extra: dict | None = None) -> dict:
    """Return kwargs for chat.completions.create, injecting reasoning_effort
    only when it is known to be supported by this deployment."""
    kwargs: dict = {"reasoning_effort": "minimal"} if _REASONING_EFFORT_SUPPORTED else {}
    if extra:
        kwargs.update(extra)
    return kwargs


async def run_turn(ws: Any, session_id: str, user_text: str, *, meta: dict | None = None, turn_id: str | None = None) -> str:
    """
    Handle one full AI turn for a given user utterance.

    Emits ai.thinking, then fetches a reply from Azure OpenAI (or fallback),
    then emits ai.speaking + transcript.update(isFinal=False).

    isFinal=True is NOT sent here. ws_bridge will send it after the frontend
    signals TTS playback completion via { type: "tts.done" }.

    Args:
        ws:          Active WebSocket connection.
        session_id:  Session identifier used to look up context + history.
        user_text:   The normalized English utterance that triggered this turn.
        meta:        Optional code-switch metadata from the frontend STT layer.
                     Passed to build_system_prompt to generate a CODE-SWITCH SIGNAL
                     block. NEVER used as user-facing text or stored in history.
        turn_id:     Unique identifier for this turn, used to match TTS acks.

    Returns:
        The text of the generated response.
    """
    await send_ai_thinking(ws)
    response = await _generate_response(session_id, user_text, meta=meta)
    await send_ai_speaking(ws, response, turn_id=turn_id)
    await send_transcript_update(ws, response, is_final=False, sender="ai", turn_id=turn_id)
    return response


# ── Sentence boundary pattern for streaming flush (Removed in v3) ───────────────
# We no longer flush per-sentence. Reply is gathered fully to avoid TTS gaps.


async def run_turn_streaming(
    ws: Any,
    session_id: str,
    user_text: str,
    *,
    meta: dict | None = None,
    t0_stt_done: float | None = None,
    turn_id: str | None = None,
) -> str:
    """
    Streaming variant of run_turn().

    Emits:
      1. ai.thinking   immediately (before LLM call)
      2. ai.speaking   ONCE at the end of generation with the full text.
      3. transcript.update(isFinal=False) after the full reply is assembled.

    Uses create(stream=True) + delta.content iteration, NOT stream.text_stream
    (which does not exist in the current SDK version).

    reasoning_effort is probed once globally (_REASONING_EFFORT_SUPPORTED).
    On first use it tries "minimal"; if Azure returns 400 the flag flips to
    False and subsequent turns skip the param entirely (no double-call).

    Args:
        t0_stt_done: Optional perf_counter timestamp from the moment STT
                     completed (set by ws_bridge). Used for telemetry only.
        turn_id:     Unique identifier for this turn, used to match TTS acks.
    """
    global _REASONING_EFFORT_SUPPORTED  # noqa: PLW0603

    t_thinking = time.perf_counter()
    await send_ai_thinking(ws)

    api_key     = os.getenv("AZURE_OPENAI_API_KEY", "")
    endpoint    = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    deployment  = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-5-mini")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

    if not api_key or not endpoint:
        # Fallback: delegate to unary path
        response = await _generate_response(session_id, user_text, meta=meta)
        if not response:
            response = _FALLBACK_MESSAGE
        await send_ai_speaking(ws, response)
        await send_transcript_update(ws, response, is_final=False, sender="ai")
        return response

    from openai import AsyncAzureOpenAI
    from session_store import store
    from context.retrieval import find_relevant_chunks, build_retrieval_query
    from context.prompt_builder import build_system_prompt, build_messages, format_chunks

    record = await store.get(session_id)
    if record is None or record.context is None or not record.context.transcript_ready:
        response = _FALLBACK_MESSAGE
        await send_ai_speaking(ws, response)
        await send_transcript_update(ws, response, is_final=False, sender="ai")
        return response

    ctx = record.context
    history = _session_history.get(session_id, [])
    conversation_summary = _session_summary.get(session_id, "")
    topic_anchor = _get_topic_anchor(session_id, ctx.outline)
    max_full_turns = int(os.getenv("FULL_CONTEXT_MAX_TURNS", "6"))
    use_full = ctx.use_full_context and ctx.full_context_turns_used < max_full_turns
    chat_mode = record.metadata.get("mode", "video_chat") if record.metadata else "video_chat"
    if chat_mode not in ("video_chat", "beginner"):
        chat_mode = "video_chat"
    is_first_turn = not history
    turn_count = len(history) // 2

    needs_clarification = bool(meta and meta.get("needs_clarification"))
    if use_full:
        local_context_text = ctx.full_transcript
        retrieval_mode, confidence = "full_transcript", "ok"
        chunk_ids_used: list[int] = []
        ctx.full_context_turns_used += 1
    else:
        query = build_retrieval_query(user_text, history, lookback=3)
        chunks_used, confidence = find_relevant_chunks(
            query=query,
            chunks=ctx.chunks,  # type: ignore[arg-type]
            visited_indices=record.progress.visited_chunk_indices,
            force_progression=needs_clarification,
        )
        chunk_ids_used = [c["id"] for c in chunks_used if "id" in c]
        local_context_text = format_chunks(chunks_used)
        retrieval_mode = "retrieval"

    progress_context = record.progress.format_progress(ctx.outline) if hasattr(record.progress, "format_progress") else ""
    system_prompt = build_system_prompt(
        outline=ctx.outline,
        local_context_text=local_context_text,
        progress_context=progress_context,
        retrieval_confident=(confidence in ("ok", "progression")),
        summary_ready=ctx.summary_ready,
        chat_mode=chat_mode,
        is_first_turn=is_first_turn,
        meta=meta,
        turn_count=turn_count,
        cefr_level=ctx.outline.cefr_level,
        conversation_summary=conversation_summary,
        topic_anchor=topic_anchor,
    )
    messages = build_messages(system_prompt, history, user_text)

    client = AsyncAzureOpenAI(api_key=api_key, azure_endpoint=endpoint, api_version=api_version)

    # ── Stream from Azure via create(stream=True) + delta.content ───────────────
    # We do NOT use client.chat.completions.stream() / stream.text_stream because
    # that API does not exist in the SDK version deployed here.
    full_reply = ""
    buffer = ""
    sentence_count = 0
    t_first_token: float | None = None

    async def _do_stream(use_reasoning: bool) -> tuple[str, float | None, bool]:
        """Run the streaming call. Returns (full_text, t_first_token, had_400)."""
        _reply = ""
        _buf = ""
        _tfirst: float | None = None
        _had_400 = False
        _sent = 0  # sentences emitted so far

        create_kwargs: dict = {"model": deployment, "messages": messages, "stream": True}
        if use_reasoning:
            create_kwargs["reasoning_effort"] = "minimal"

        try:
            stream = await client.chat.completions.create(**create_kwargs)  # type: ignore[arg-type]
            async for chunk in stream:  # type: ignore[union-attr]
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta is None:
                    continue
                text = delta.content or ""
                if not text:
                    continue
                if _tfirst is None:
                    _tfirst = time.perf_counter()
                _reply += text
                
                # Stream the subtitle live to the frontend (transient)
                await send_transcript_update(ws, _reply, is_final=False, sender="ai", turn_id=turn_id)

        except Exception as exc:
            err_str = str(exc)
            if "400" in err_str or "reasoning_effort" in err_str.lower():
                _had_400 = True
            else:
                raise

        return _reply, _tfirst, _had_400

    try:
        # Decide whether to include reasoning_effort based on cached probe result.
        # None = first call ever → try with it; True = known good; False = known bad.
        attempt_reasoning = (_REASONING_EFFORT_SUPPORTED is not False)

        raw_reply, t_first_token, had_400 = await _do_stream(use_reasoning=attempt_reasoning)

        if had_400 and attempt_reasoning:
            # Azure rejected reasoning_effort — cache the result and retry clean.
            _REASONING_EFFORT_SUPPORTED = False
            logger.warning(
                "[ai_turn] reasoning_effort rejected (400) — disabling globally and retrying"
            )
            raw_reply, t_first_token, _ = await _do_stream(use_reasoning=False)
        elif not had_400 and attempt_reasoning and _REASONING_EFFORT_SUPPORTED is None:
            _REASONING_EFFORT_SUPPORTED = True
            logger.info("[ai_turn] reasoning_effort=minimal confirmed supported")

        full_reply = raw_reply.strip()

        # ── Vietnamese safety guard ───────────────────────────────────────────
        # If the model produced a Vietnamese reply despite the prompt rule, force
        # one more generation with an explicit English-only system message.
        full_reply = await _force_english_if_vietnamese(client, deployment, full_reply)

        await send_ai_speaking(ws, full_reply, turn_id=turn_id)

    except Exception as exc:
        logger.warning("[ai_turn] Streaming failed (%s) — falling back to unary", exc)
        full_reply = await _generate_response(session_id, user_text, meta=meta) or _FALLBACK_MESSAGE
        # Unary path: emit once
        await send_ai_speaking(ws, full_reply, turn_id=turn_id)

    if not full_reply:
        full_reply = _FALLBACK_MESSAGE
        await send_ai_speaking(ws, full_reply, turn_id=turn_id)

    await send_transcript_update(ws, full_reply, is_final=False, sender="ai", turn_id=turn_id)

    # History update is deferred until TTS completion via commit_history().

    # ── Per-turn telemetry ───────────────────────────────────────────────────────
    t_end = time.perf_counter()
    t_stt_ms   = round((t_thinking  - t0_stt_done) * 1000) if t0_stt_done else None
    t_ttft_ms  = round((t_first_token - t_thinking) * 1000) if t_first_token else None
    t_total_ms = round((t_end - (t0_stt_done or t_thinking)) * 1000)
    logger.info(
        "[Perf] session=%s | STT→LLM=%s ms | TTFT=%s ms | total=%d ms | words=%d | reasoning_ok=%s",
        session_id,
        t_stt_ms if t_stt_ms is not None else "n/a",
        t_ttft_ms if t_ttft_ms is not None else "n/a",
        t_total_ms,
        len(full_reply.split()),
        _REASONING_EFFORT_SUPPORTED,
    )

    return full_reply


async def send_turn_final(ws: Any, response_text: str, turn_id: str | None = None) -> None:
    """
    Commit the AI turn transcript as final.

    Called by ws_bridge when it receives a { type: "tts.done" } frame from
    the frontend, signalling that TTS audio playback has completed.
    """
    await send_transcript_update(ws, response_text, is_final=True, sender="ai", turn_id=turn_id)


# ── Public History Commit ──────────────────────────────────────────────────────

def commit_history(session_id: str, user_text: str, ai_text: str) -> None:
    """
    Commit a turn to the session history.
    Called by ws_bridge ONLY when TTS acknowledges it played successfully.

    When the verbatim window is full, the oldest turn rolls off and is folded
    synchronously into _session_summary (buffer + summary model, zero overlap).
    This is pure string work (~µs) — no async needed, no race conditions.
    """
    from context.prompt_builder import MAX_HISTORY_TURNS
    max_messages = MAX_HISTORY_TURNS * 2  # 6 turns = 12 messages

    if session_id not in _session_history:
        _session_history[session_id] = []
    _session_history[session_id].append({"role": "user",      "content": user_text})
    _session_history[session_id].append({"role": "assistant", "content": ai_text})

    if len(_session_history[session_id]) > max_messages:
        # Oldest turn falls off the verbatim window → fold it into running summary
        old_user = _session_history[session_id][0]["content"]
        old_ai   = _session_history[session_id][1]["content"]
        _roll_into_summary(session_id, old_user, old_ai)
        _session_history[session_id] = _session_history[session_id][-max_messages:]

    logger.info(
        "[ai_turn] Committed turn to history for %s (history_len=%d)",
        session_id, len(_session_history[session_id]),
    )


# ── Session Memory & Anchor Helpers ───────────────────────────────────────────

def _roll_into_summary(session_id: str, user_text: str, ai_text: str) -> None:
    """
    Fold a rolled-off verbatim turn into the session's running summary.

    Called synchronously inside commit_history (pure string ops, ~µs).
    Only turns that fall OFF the verbatim window are summarised — the window
    itself is already included in full via build_messages(). No overlap.
    """
    try:
        new_line = f"- U: {user_text[:100].strip()} | A: {ai_text[:100].strip()}"
        existing = _session_summary.get(session_id, "")
        lines = [ln for ln in existing.split("\n") if ln.strip()] if existing else []
        lines.append(new_line)
        _session_summary[session_id] = "\n".join(lines[-10:])  # cap at 10 rolled turns
    except Exception:
        logger.warning("[ai_turn] _roll_into_summary failed for %s — skipping", session_id)


def _extract_topic_anchor(summary_text: str, title: str = "") -> str:
    """
    Extract a 1-sentence topic anchor from the outline's summary text.
    Fallback chain: summary_text → title → "" (empty → prompt_builder uses generic text).
    """
    if summary_text and summary_text.strip():
        first_sent = re.split(r'(?<=[.!?])\s', summary_text.strip(), maxsplit=1)
        candidate = first_sent[0][:150].strip()
        if candidate:
            return candidate
    if title and title.strip():
        return title.strip()[:150]
    return ""


def _get_topic_anchor(session_id: str, outline: Any) -> str:
    """Return the cached topic anchor for this session, extracting it on first call."""
    if session_id not in _session_topic_anchor:
        title = getattr(outline, "title", "") or ""
        _session_topic_anchor[session_id] = _extract_topic_anchor(
            getattr(outline, "summary_text", "") or "", title
        )
    return _session_topic_anchor[session_id]


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _generate_response(session_id: str, user_text: str, meta: dict | None = None) -> str:
    try:
        response = await _grounded_response(session_id, user_text, meta=meta)
        if response:
            return response
    except Exception as exc:
        logger.warning(
            "[ai_turn] Grounded response failed for session %s: %s — using fallback",
            session_id, exc,
        )

    await asyncio.sleep(0.5)
    return _FALLBACK_MESSAGE


async def _grounded_response(session_id: str, user_text: str, meta: dict | None = None) -> str | None:
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
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

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
    conversation_summary = _session_summary.get(session_id, "")
    topic_anchor = _get_topic_anchor(session_id, ctx.outline)

    max_full_turns = int(os.getenv("FULL_CONTEXT_MAX_TURNS", "6"))
    use_full = ctx.use_full_context and ctx.full_context_turns_used < max_full_turns

    # ── Determine local context and retrieval confidence ──────────────────────
    needs_clarification = bool(meta and meta.get("needs_clarification"))
    force_progression = needs_clarification

    if use_full:
        local_context_text = ctx.full_transcript
        retrieval_mode = "full_transcript"
        confidence = "ok"
        chunk_ids_used: list[int] = []
        chunks_used: list[Any] = []
        ctx.full_context_turns_used += 1
    else:
        query = build_retrieval_query(user_text, history, lookback=3)
        visited_indices = record.progress.visited_chunk_indices
        chunks_used, confidence = find_relevant_chunks(
            query=query,
            chunks=ctx.chunks,  # type: ignore[arg-type]
            visited_indices=visited_indices,
            force_progression=force_progression,
            top_n=3
        )
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

    turn_count = len(history) // 2

    # ── Build grounded system prompt ──────────────────────────────────────────
    system_prompt = build_system_prompt(
        outline=ctx.outline,
        local_context_text=local_context_text,
        progress_context=progress_context,
        retrieval_confident=(confidence in ("ok", "progression")),
        summary_ready=ctx.summary_ready,
        chat_mode=chat_mode,
        is_first_turn=is_first_turn,
        meta=meta,
        turn_count=turn_count,
        cefr_level=ctx.outline.cefr_level,
        conversation_summary=conversation_summary,
        topic_anchor=topic_anchor,
    )

    messages = build_messages(system_prompt, history, user_text)

    # ── Azure OpenAI call ─────────────────────────────────────────────────────
    # temperature is intentionally NOT sent to Azure.
    # gpt-5-mini (and other o-series / preview deployments) only accept the
    # model default (1). Passing any explicit value — including 0.0 — causes a
    # 400 "unsupported_value" error. Omitting it is the correct behaviour per
    # Azure docs for these models.
    #
    # reasoning_effort: uses the globally-cached capability flag. If this is the
    # first unary call and streaming hasn't probed yet, we try it here too.
    # A 400 flips the flag False; subsequent calls skip it entirely.
    global _REASONING_EFFORT_SUPPORTED  # noqa: PLW0603

    client = AsyncAzureOpenAI(
        api_key=api_key,
        azure_endpoint=endpoint,
        api_version=api_version,
    )

    create_kwargs: dict = {"model": deployment, "messages": messages}  # type: ignore[arg-type]
    if _REASONING_EFFORT_SUPPORTED is not False:
        create_kwargs["reasoning_effort"] = "minimal"

    try:
        completion = await client.chat.completions.create(**create_kwargs)
        if _REASONING_EFFORT_SUPPORTED is None:
            _REASONING_EFFORT_SUPPORTED = True
            logger.info("[ai_turn] reasoning_effort=minimal confirmed supported (unary path)")
    except Exception as exc:
        err_str = str(exc)
        if ("400" in err_str or "reasoning_effort" in err_str.lower()) and _REASONING_EFFORT_SUPPORTED is not False:
            _REASONING_EFFORT_SUPPORTED = False
            logger.warning(
                "[ai_turn] reasoning_effort rejected (400) on unary — disabling globally, retrying"
            )
            create_kwargs.pop("reasoning_effort", None)
            completion = await client.chat.completions.create(**create_kwargs)
        else:
            raise

    reply = (completion.choices[0].message.content or "").strip()  # type: ignore[union-attr]
    if not reply:
        return None

    # ── Vietnamese safety guard (unary path) ─────────────────────────────────
    reply = await _force_english_if_vietnamese(client, deployment, reply)

    # ── Update conversation history ───────────────────────────────────────────
    # Removed auto-commit here. Handled by commit_history() on tts.done.

    logger.info(
        "[ai_turn] Azure reply | session=%s | deployment=%s | reply_chars=%d",
        session_id, deployment, len(reply),
    )

    # ── Turn Metrics Logging ──────────────────────────────────────────────────
    user_words = len(user_text.split())
    ai_words = len(reply.split())
    meta_dict = meta or {}
    metrics = {
        "event": "turn_completed",
        "session_id": session_id,
        "chat_mode": chat_mode,
        "retrieval_mode": retrieval_mode,
        "confidence": confidence,
        "chunk_ids_used": chunk_ids_used,
        "user_word_count": user_words,
        "ai_word_count": ai_words,
        "ratio_ai_to_user": round(ai_words / user_words, 2) if user_words > 0 else float('inf'),
        "code_switch_detected": meta_dict.get("contains_code_switch", False),
        "needs_clarification": meta_dict.get("needs_clarification", False),
        "full_ctx_turns_used": ctx.full_context_turns_used,
        "visited_events_count": len(record.progress.visited_event_ids),
    }
    logger.info("[METRICS] %s", json.dumps(metrics))

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


def _events_in_chunks(key_events: list, chunks: list[Any]) -> list[int]:
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
