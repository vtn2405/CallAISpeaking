"""
event_emitter.py — formats and sends the 6 Pipecat realtime events over a WebSocket.

Contract (mirrors frontend types/call.ts PipecatRealtimeEvent union):

  session.ready      { type, sessionId, metadata: { title, duration, thumbnailUrl? } }
  transcript.update  { type, text, isFinal, sender: "user"|"ai", turnId? }
  ai.thinking        { type }
  ai.speaking        { type, text, turnId? }
  session.ended      { type }
  error              { type, message, code? }

This module is pure serialisation — zero business logic.
"""
from __future__ import annotations

import json
from typing import Any


async def _send(ws: Any, payload: dict) -> None:
    """Send a JSON-serialised payload over the WebSocket."""
    await ws.send_text(json.dumps(payload))


async def send_session_ready(
    ws: Any,
    session_id: str,
    metadata: dict,
) -> None:
    await _send(ws, {
        "type": "session.ready",
        "sessionId": session_id,
        "metadata": {
            "title":        metadata.get("title", ""),
            "duration":     metadata.get("duration", 0),
            "thumbnailUrl": metadata.get("thumbnailUrl"),
        },
    })


async def send_transcript_update(
    ws: Any,
    text: str,
    is_final: bool,
    sender: str,          # "user" | "ai"
    turn_id: str | None = None,
) -> None:
    payload = {
        "type":    "transcript.update",
        "text":    text,
        "isFinal": is_final,
        "sender":  sender,
    }
    if turn_id:
        payload["turnId"] = turn_id
    await _send(ws, payload)


async def send_ai_thinking(ws: Any) -> None:
    await _send(ws, {"type": "ai.thinking"})


async def send_ai_speaking(ws: Any, text: str, turn_id: str | None = None) -> None:
    payload = {"type": "ai.speaking", "text": text}
    if turn_id:
        payload["turnId"] = turn_id
    await _send(ws, payload)


async def send_session_ended(ws: Any) -> None:
    await _send(ws, {"type": "session.ended"})


async def send_error(ws: Any, message: str, code: str | None = None) -> None:
    # Guard: never emit an error frame without a human-readable message.
    # str(bare Exception()) returns "", which would produce { "type": "error", "message": "" }.
    safe_message = message.strip() if message else "Unknown error"
    payload: dict = {"type": "error", "message": safe_message}
    if code is not None:
        payload["code"] = code
    await _send(ws, payload)
