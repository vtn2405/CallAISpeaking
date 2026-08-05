"""
ws_bridge.py — WebSocket endpoint for the Pipecat shim.

Endpoint: GET /ws/sessions/{session_id}
          (upgraded to WebSocket by the client)

Connect flow:
    1. Extract session_id from path.
    2. Validate Origin header (CSWSH protection).
    3. Look up in SessionStore — if CREATED → proceed to auth.
       If not found or already ENDED/ERROR → send error and close.
    4. Accept the WebSocket connection.
    5. Wait up to 5 seconds for the client to send an auth frame:
         { "type": "auth", "token": "<sessionToken>" }
       Validate token via HMAC-safe comparison and TTL check.
       Invalidate the token after first use (single-use).
    6. Transition CREATED → READY, send session.ready.
    7. Enter receive loop (max 32 KB per frame):
       - Text frame: JSON with { type, ... }
           "user.turn"  → transition READY→ACTIVE, call ai_turn.run_turn()
           "tts.done"   → frontend signals TTS audio finished; emit isFinal=True.
           "ping"       → keep-alive (ignored)
           any other type: echo back as error (unrecognised)
       - Disconnect (WebSocketDisconnect): transition → ENDED, clear ws ref.
    8. On any unhandled exception: transition → ERROR, send error event, close.

Inbound client frame types (frontend → backend):
    { "type": "auth",     "token": "..." }  — first frame; must arrive within 5s
    { "type": "user.turn", "text": "..." }  — user spoke, trigger AI turn
    { "type": "tts.done",  "text": "..." }  — TTS playback ended; commit final transcript
    { "type": "ping" }                       — keep-alive (ignored)

All outbound events are emitted via event_emitter.py.
"""
from __future__ import annotations

import asyncio
import hmac
import json
import logging
import os
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from event_emitter import send_error, send_session_ended, send_session_ready
from ai_turn import run_turn, run_turn_streaming, send_turn_final
from session_store import SessionStatus, TransitionError, store

logger = logging.getLogger(__name__)
router = APIRouter()

# Per-session storage for the last AI reply text, so tts.done can echo it back
# as isFinal without requiring the frontend to re-send the full text.
_pending_reply: dict[str, str] = {}

# Maximum WebSocket frame size after authentication (defence-in-depth on top of
# the ASGI-level ws_max_size configured in main.py / uvicorn CLI flags).
_MAX_FRAME_BYTES = 32_768  # 32 KB

# ── Origin validation ─────────────────────────────────────────────────────────
# CSWSH (Cross-Site WebSocket Hijacking) protection.
# Parse the CORS_ORIGINS env var (same source of truth as the CORS middleware).
_ALLOWED_ORIGINS: set[str] = set()

def _build_allowed_origins() -> None:
    """Populate _ALLOWED_ORIGINS from CORS_ORIGINS env var."""
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    for origin in raw.split(","):
        o = origin.strip().rstrip("/")
        if o:
            _ALLOWED_ORIGINS.add(o)

_build_allowed_origins()


def _is_origin_allowed(ws: WebSocket) -> bool:
    """
    Returns True if the WS handshake Origin header is in the allowed set.
    Missing Origin (e.g. server-to-server / curl) is rejected; callers that
    need to bypass this must set an explicit allowed origin.
    """
    origin = ws.headers.get("origin", "").rstrip("/")
    if not origin:
        return False
    return origin in _ALLOWED_ORIGINS


@router.websocket("/ws/sessions/{session_id}")
async def ws_session(ws: WebSocket, session_id: str) -> None:

    # ── 0. Origin check (CSWSH protection) ───────────────────────────────────
    if not _is_origin_allowed(ws):
        # Must reject before accept() so the browser sees a proper close.
        await ws.close(code=4403)
        logger.warning(
            "[ws_bridge] Rejected WS from disallowed origin %r for session %s",
            ws.headers.get("origin", "(none)"), session_id,
        )
        return

    await ws.accept()
    logger.info("[gstack] session accepted for %s", session_id)

    # ── 1. Validate session exists and is CREATED ─────────────────────────────
    record = await store.get(session_id)

    if record is None:
        await send_error(ws, f"Session {session_id!r} not found", code="SESSION_NOT_FOUND")
        await ws.close(code=4004)
        return

    if record.status not in (SessionStatus.CREATED,):
        await send_error(
            ws,
            f"Session {session_id!r} is {record.status.value}, cannot connect",
            code="SESSION_INVALID_STATE",
        )
        await ws.close(code=4009)
        return

    # ── 2. Auth frame (must arrive within 5 seconds) ──────────────────────────
    # Token is generated at session init and stored in metadata["sessionToken"].
    # It is valid until metadata["sessionTokenExpiresAt"] (ms since epoch) and
    # is single-use: we clear it from metadata after the first successful auth so
    # a second connection attempt with the same token is rejected.
    expected_token: str = record.metadata.get("sessionToken", "")
    expires_at_ms: int  = record.metadata.get("sessionTokenExpiresAt", 0)

    try:
        raw_auth = await asyncio.wait_for(ws.receive_text(), timeout=5.0)
    except asyncio.TimeoutError:
        logger.warning("[ws_bridge] Auth timeout for session %s", session_id)
        await ws.close(code=4003)
        return

    try:
        auth_frame = json.loads(raw_auth)
    except json.JSONDecodeError:
        await ws.close(code=4003)
        return

    if auth_frame.get("type") != "auth":
        logger.warning("[ws_bridge] First frame was not auth for session %s", session_id)
        await ws.close(code=4003)
        return

    provided_token: str = auth_frame.get("token", "")

    # Timing-safe comparison
    token_valid = bool(
        expected_token
        and provided_token
        and hmac.compare_digest(provided_token, expected_token)
    )

    # TTL check — 5-minute window for initial connect only
    ttl_valid = (expires_at_ms > 0) and (int(time.time() * 1000) < expires_at_ms)

    if not token_valid or not ttl_valid:
        logger.warning(
            "[ws_bridge] Auth failed for session %s (token_valid=%s, ttl_valid=%s)",
            session_id, token_valid, ttl_valid,
        )
        await ws.close(code=4003)
        return

    # Invalidate token after first successful use (single-use enforcement).
    # Subsequent reconnects need a new token from /api/sessions/{id}/token/refresh.
    record.metadata.pop("sessionToken", None)
    record.metadata.pop("sessionTokenExpiresAt", None)
    logger.info("[ws_bridge] Auth successful for session %s (token consumed)", session_id)

    # ── 3. Transition CREATED → READY, attach ws ref ──────────────────────────
    try:
        await store.transition(session_id, SessionStatus.READY, ws=ws)
    except TransitionError as exc:
        await send_error(ws, str(exc), code="TRANSITION_ERROR")
        await ws.close(code=4009)
        return

    # ── 4. Send session.ready ─────────────────────────────────────────────────
    await send_session_ready(ws, session_id, record.metadata)
    logger.info("session.ready sent for %s", session_id)
    logger.info("[gstack] session.ready sent for %s", session_id)

    first_frame_received = False

    # ── 5. Receive loop ───────────────────────────────────────────────────────
    try:
        while True:
            raw = await ws.receive_text()

            # Frame size guard (defence-in-depth; primary limit is at ASGI layer)
            if len(raw) > _MAX_FRAME_BYTES:
                logger.warning(
                    "[ws_bridge] Oversized frame (%d bytes) from session %s — dropped",
                    len(raw), session_id,
                )
                await send_error(ws, "Frame too large", code="FRAME_TOO_LARGE")
                continue

            try:
                frame = json.loads(raw)
                if not first_frame_received:
                    logger.info("[gstack] first client frame received after ready for %s: %s", session_id, frame.get("type"))
                    first_frame_received = True
            except json.JSONDecodeError:
                await send_error(ws, "Malformed JSON frame", code="BAD_FRAME")
                continue

            frame_type = frame.get("type")

            if frame_type == "user.turn":
                user_text = frame.get("text", "").strip()
                if not user_text:
                    await send_error(ws, "Empty user turn", code="EMPTY_TURN")
                    continue

                # meta carries code-switch signals from the frontend STT layer.
                # It is intentionally kept separate from user_text so it never
                # enters TF-IDF retrieval or the session history.
                meta: dict = frame.get("meta") or {}

                # Auto-commit previous turn on barge-in (user interrupted the AI)
                if session_id in _pending_reply:
                    interrupted_reply = _pending_reply.pop(session_id)
                    await send_turn_final(ws, interrupted_reply)
                    logger.info("[ws_bridge] Barge-in detected! Auto-committed previous turn for %s", session_id)

                # Transition READY → ACTIVE on first user turn
                current = await store.get(session_id)
                if current and current.status == SessionStatus.READY:
                    try:
                        await store.transition(session_id, SessionStatus.ACTIVE, ws=ws)
                    except TransitionError:
                        pass  # already ACTIVE from a previous turn — fine

                # run_turn / run_turn_streaming:
                #   emits ai.thinking → ai.speaking + transcript.update(isFinal=False)
                #   returns full reply text for tts.done.
                # LLM_STREAMING_ENABLED=false  → fallback to unary (safe rollback).
                t0_stt_done = time.perf_counter()  # timestamp right after STT, for telemetry
                _streaming = os.getenv("LLM_STREAMING_ENABLED", "true").lower() == "true"
                if _streaming:
                    reply = await run_turn_streaming(
                        ws, session_id, user_text, meta=meta, t0_stt_done=t0_stt_done
                    )
                else:
                    reply = await run_turn(ws, session_id, user_text, meta=meta)
                if reply:
                    _pending_reply[session_id] = reply

            elif frame_type == "tts.done":
                # Frontend signals that TTS audio playback has finished.
                # Now we commit the AI turn with isFinal=True.
                pending = _pending_reply.pop(session_id, "")
                # Accept the echoed text from the frame as a fallback if we somehow lost it.
                reply_text = pending or frame.get("text", "").strip()
                if reply_text:
                    await send_turn_final(ws, reply_text)
                    logger.info("[ws_bridge] tts.done received for session %s — committed isFinal", session_id)
                else:
                    logger.warning("[ws_bridge] tts.done received but no pending reply for session %s", session_id)

            elif frame_type == "ping":
                pass  # keep-alive — no response needed

            elif frame_type == "start_call":
                # For Phase 1: frontend handles greeting via start_call interception.
                # Backend just ignores this frame to avoid UNKNOWN_FRAME_TYPE errors.
                pass

            else:
                frame_type_str = str(frame_type) if frame_type is not None else "(none)"
                logger.debug("Unrecognised frame type %r for %s", frame_type, session_id)
                await send_error(
                    ws,
                    f"Unrecognised frame type: {frame_type_str}",
                    code="UNKNOWN_FRAME_TYPE",
                )

    except WebSocketDisconnect as e:
        logger.info("Client disconnected from session %s", session_id)
        logger.info("[gstack] disconnect code/reason: code=%s, reason=%s", e.code, e.reason)

    except Exception as exc:  # noqa: BLE001
        exc_msg = repr(exc) or "Internal server error"
        logger.exception("Unhandled error in session %s: %s", session_id, exc_msg)
        try:
            await send_error(ws, exc_msg, code="INTERNAL_ERROR")
        except Exception:
            logger.debug("[ws_bridge] Could not send error frame during cleanup for %s", session_id)

    finally:
        # ── 6. Cleanup ────────────────────────────────────────────────────────
        _pending_reply.pop(session_id, None)

        current = await store.get(session_id)
        if current and current.status not in (SessionStatus.ENDED, SessionStatus.ERROR):
            try:
                await store.transition(session_id, SessionStatus.ENDED)
            except TransitionError:
                await store.transition(session_id, SessionStatus.ERROR)

        try:
            await send_session_ended(ws)
        except Exception:
            pass  # ws may already be closed

        try:
            await ws.close()
        except Exception:
            pass

        logger.info("Session %s cleaned up", session_id)
