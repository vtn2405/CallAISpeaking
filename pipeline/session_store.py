"""
session_store.py — in-memory session registry for the WS shim.

Lifecycle (enforced by transition()):
    CREATED → READY → ACTIVE → ENDED
                            ↘ ERROR (from any state)

session.ready is emitted by ws_bridge.py only after CREATED → READY succeeds.

SessionContext is kept separate from metadata deliberately:
  - metadata: lightweight dict sent to the frontend via session.ready
              (title, duration, thumbnailUrl — nothing private)
  - context:  internal only, never exposed over WS.
              Contains the typed VideoOutline, full transcript, and chunks.

SessionProgress tracks which outline events and chunk indices the conversation
has touched. It is keyed off event_id integers (from VideoOutline.key_events)
and chunk id integers (from chunker.fixed_time_chunk), never off AI reply text.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class SessionStatus(str, Enum):
    CREATED = "CREATED"
    READY   = "READY"
    ACTIVE  = "ACTIVE"
    ENDED   = "ENDED"
    ERROR   = "ERROR"


# Valid forward transitions (ERROR is reachable from any state)
_VALID_TRANSITIONS: dict[SessionStatus, set[SessionStatus]] = {
    SessionStatus.CREATED: {SessionStatus.READY,  SessionStatus.ERROR},
    SessionStatus.READY:   {SessionStatus.ACTIVE, SessionStatus.ENDED, SessionStatus.ERROR},
    SessionStatus.ACTIVE:  {SessionStatus.ENDED,  SessionStatus.ERROR},
    SessionStatus.ENDED:   set(),
    SessionStatus.ERROR:   set(),
}


@dataclass
class SessionProgress:
    """
    Session-level coverage tracker.

    Progress is marked from:
      1. The chunk IDs present in every retrieval result (retrieval mode).
      2. The event_ids of KeyEvents whose time range overlaps retrieved chunks.
    It is NEVER derived from parsing AI reply text (too fragile, paraphrasing breaks it).

    Chunk ID contract: all chunks from fixed_time_chunk() carry a stable integer `id`
    field (0-indexed, set at chunk creation). This id is used here unchanged.
    """
    visited_chunk_indices: set[int] = field(default_factory=set)
    visited_event_ids: set[int] = field(default_factory=set)

    def mark_chunks(self, indices: list[int]) -> None:
        self.visited_chunk_indices.update(indices)

    def mark_events(self, event_ids: list[int]) -> None:
        self.visited_event_ids.update(event_ids)

    def unvisited_events(self, outline: "VideoOutline") -> list:  # type: ignore[name-defined]
        return [e for e in outline.key_events if e.event_id not in self.visited_event_ids]

    def coverage_summary(self, outline: "VideoOutline") -> str:  # type: ignore[name-defined]
        """Return a short string for the prompt's == Coverage Progress == section."""
        total_events = len(outline.key_events)
        if total_events == 0:
            return "No key events tracked."
        visited = len(self.visited_event_ids)
        unvisited = self.unvisited_events(outline)
        visited_parts = sorted({
            e.part for e in outline.key_events if e.event_id in self.visited_event_ids
        })
        unvisited_parts = sorted({
            e.part for e in unvisited
        })
        lines = [
            f"Events discussed: {visited}/{total_events}.",
            f"Parts touched: {visited_parts if visited_parts else 'none yet'}.",
            f"Parts not yet covered: {unvisited_parts if unvisited_parts else 'all covered'}.",
        ]
        if unvisited:
            sample = unvisited[:3]
            lines.append("Uncovered events (sample): " + "; ".join(
                f"[{e.time}] {e.description}" for e in sample
            ))
        return "\n".join(lines)


@dataclass
class SessionContext:
    """
    Internal AI context — never sent to the frontend.

    Fields:
        video_id:              YouTube videoId extracted from the URL.
        outline:               Typed VideoOutline from Gemini (degraded mode if Gemini failed).
        full_transcript:       Full joined transcript text (all chunk texts space-joined).
        chunks:                Fixed-time transcript chunks for retrieval mode.
                               Each chunk is a dict: { "id": int, "text": str,
                               "start": float, "end": float }
                               Chunk id is the stable 0-indexed integer from chunker.py.
        transcript_ready:      True once extraction + chunking succeeded.
        summary_ready:         True once the Gemini outline was generated successfully.
                               False = degraded mode (outline.summary_text is fallback text).
        use_full_context:      Computed once at build_context() from transcript char count
                               vs. SHORT_VIDEO_TRANSCRIPT_CHAR_THRESHOLD env var.
                               Never recomputed per turn.
        full_context_turns_used: Counter incremented by ai_turn.py each time the full
                               transcript is injected. Capped at FULL_CONTEXT_MAX_TURNS.
    """
    video_id: str
    outline: "VideoOutline"      # type: ignore[name-defined]
    full_transcript: str
    chunks: list[dict]
    transcript_ready: bool = False
    summary_ready: bool = False
    use_full_context: bool = False
    full_context_turns_used: int = 0


@dataclass
class SessionRecord:
    session_id: str
    video_url:  str
    status:     SessionStatus = SessionStatus.CREATED
    ws:         Any = field(default=None, repr=False)   # starlette WebSocket | None
    # Lightweight dict — safe to include in session.ready and return to browser.
    metadata:   dict = field(default_factory=dict)
    # Internal AI context — never exposed over WS.
    context:    SessionContext | None = field(default=None, repr=False)
    # Session-level progress tracker — never exposed over WS.
    progress:   SessionProgress = field(default_factory=SessionProgress, repr=False)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class TransitionError(Exception):
    pass


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionRecord] = {}
        self._lock = asyncio.Lock()

    async def register(
        self,
        session_id: str,
        video_url: str,
        metadata: dict = {},
        context: SessionContext | None = None,
    ) -> SessionRecord:
        """Create a new CREATED session record."""
        async with self._lock:
            if session_id in self._sessions:
                raise ValueError(f"Session {session_id!r} already registered")
            record = SessionRecord(
                session_id=session_id,
                video_url=video_url,
                metadata=metadata,
                context=context,
            )
            self._sessions[session_id] = record
            return record

    async def get(self, session_id: str) -> SessionRecord | None:
        async with self._lock:
            return self._sessions.get(session_id)

    async def transition(
        self,
        session_id: str,
        new_status: SessionStatus,
        *,
        ws=None,
    ) -> SessionRecord:
        """
        Advance a session to new_status.
        Raises TransitionError if the transition is not valid.
        Optionally attaches/clears the ws reference.
        """
        async with self._lock:
            record = self._sessions.get(session_id)
            if record is None:
                raise KeyError(f"Session {session_id!r} not found")
            allowed = _VALID_TRANSITIONS[record.status]
            if new_status not in allowed:
                raise TransitionError(
                    f"Cannot transition {record.status} → {new_status} "
                    f"for session {session_id!r}"
                )
            record.status = new_status
            if ws is not None:
                record.ws = ws
            if new_status in (SessionStatus.ENDED, SessionStatus.ERROR):
                record.ws = None
            return record

    async def remove(self, session_id: str) -> None:
        async with self._lock:
            self._sessions.pop(session_id, None)


# Module-level singleton used by ws_bridge and main
store = SessionStore()
