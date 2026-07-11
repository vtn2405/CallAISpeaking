"""
ws_bridge.py — WebSocket endpoint for the Pipecat shim.

Endpoint: GET /ws/sessions/{session_id}
          (upgraded to WebSocket by the client)

Connect flow:
    1. Extract session_id from path.
    2. Look up in SessionStore — if CREATED → transition to READY.
       If not found or already ENDED/ERROR → send error and close.
    3. Send session.ready.
    4. Enter receive loop:
       - Text frame: JSON with { type, ... }
           "user.turn"  → transition READY→ACTIVE, call ai_turn.run_turn()
                          Stores the reply text in _pending_reply for this session.
           "tts.done"   → frontend signals TTS audio finished; emit isFinal=True.
                          { type: "tts.done", text: "<echo of reply text>" }
           "ping"       → keep-alive (ignored)
           any other type: echo back as error (unrecognised)
       - Disconnect (WebSocketDisconnect): transition → ENDED, clear ws ref.
    5. On any unhandled exception: transition → ERROR, send error event, close.

Inbound client frame types (frontend → backend):
    { "type": "user.turn", "text": "..." }   — user spoke, trigger AI turn
    { "type": "tts.done",  "text": "..." }   — TTS playback ended; commit final transcript
    { "type": "ping" }                        — keep-alive (ignored)

All outbound events are emitted via event_emitter.py.
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from event_emitter import send_error, send_session_ended, send_session_ready
from ai_turn import run_turn, send_turn_final
from session_store import SessionStatus, TransitionError, store

logger = logging.getLogger(__name__)
router = APIRouter()

# Per-session storage for the last AI reply text, so tts.done can echo it back
# as isFinal without requiring the frontend to re-send the full text.
_pending_reply: dict[str, str] = {}


@router.websocket("/ws/sessions/{session_id}")
async def ws_session(ws: WebSocket, session_id: str) -> None:
    await ws.accept()

    # ── 1. Validate session ───────────────────────────────────────────────────
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

    # ── 2. Transition CREATED → READY, attach ws ref ─────────────────────────
    try:
        await store.transition(session_id, SessionStatus.READY, ws=ws)
    except TransitionError as exc:
        await send_error(ws, str(exc), code="TRANSITION_ERROR")
        await ws.close(code=4009)
        return

    # ── 3. Send session.ready (only now — not on HTTP init) ───────────────────
    await send_session_ready(ws, session_id, record.metadata)
    logger.info("session.ready sent for %s", session_id)

    # ── 4. Receive loop ───────────────────────────────────────────────────────
    try:
        while True:
            raw = await ws.receive_text()

            try:
                frame = json.loads(raw)
            except json.JSONDecodeError:
                await send_error(ws, "Malformed JSON frame", code="BAD_FRAME")
                continue

            frame_type = frame.get("type")

            if frame_type == "user.turn":
                user_text = frame.get("text", "").strip()
                if not user_text:
                    await send_error(ws, "Empty user turn", code="EMPTY_TURN")
                    continue

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

                # run_turn emits: ai.thinking → ai.speaking + transcript.update(isFinal=False)
                # It also returns the reply text which we store for tts.done.
                reply = await run_turn(ws, session_id, user_text)
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

            else:
                frame_type_str = str(frame_type) if frame_type is not None else "(none)"
                logger.debug("Unrecognised frame type %r for %s", frame_type, session_id)
                await send_error(
                    ws,
                    f"Unrecognised frame type: {frame_type_str}",
                    code="UNKNOWN_FRAME_TYPE",
                )

    except WebSocketDisconnect:
        logger.info("Client disconnected from session %s", session_id)

    except Exception as exc:  # noqa: BLE001
        exc_msg = repr(exc) or "Internal server error"
        logger.exception("Unhandled error in session %s: %s", session_id, exc_msg)
        try:
            await send_error(ws, exc_msg, code="INTERNAL_ERROR")
        except Exception:
            pass

    finally:
        # ── 5. Cleanup ────────────────────────────────────────────────────────
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


