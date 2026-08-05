"""
main.py — FastAPI entry point for the ChatboxAI Pipecat WS shim.

Responsibilities:
  - CORS middleware (allow Next.js dev server)
  - Mount the WebSocket bridge router
  - Expose a /health endpoint for smoke testing
  - Expose a /api/sessions/register endpoint so the Next.js init route
    can pre-register a session record before the browser opens the WS
  - Expose a /api/speech-token endpoint that issues short-lived Azure
    Cognitive Services Speech tokens so the browser never holds a raw key.

Context pipeline (new in Phase 1):
  /api/sessions/register now runs the full context pipeline synchronously:
    parse URL → extract transcript → normalize → chunk → generate summary
  This means the Next.js init route (and therefore the browser loading spinner)
  waits until context is ready before returning sessionId.
  Timeout is capped by CONTEXT_PIPELINE_TIMEOUT_SEC (default 10s).
  If transcript is unavailable → returns ok: false with clear error.
  If summary times out → falls back to transcript-only context (session proceeds).
"""
from __future__ import annotations

import hmac
import os
import logging

import httpx

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from context import build_context, ContextPipelineError
from session_store import store
from ws_bridge import router as ws_router
from stt import router as stt_router, legacy_router as stt_legacy_router

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Secrets ───────────────────────────────────────────────────────────────────
# PIPELINE_SECRET — authenticates Next.js → Pipeline REST calls.
# WORKER_SECRET   — authenticates Pipeline → Ingestion Worker calls.
_ENV = os.getenv("ENV", "development")
PIPELINE_SECRET: str = os.getenv("PIPELINE_SECRET", "dev-pipeline-secret")
WORKER_SECRET: str   = os.getenv("WORKER_SECRET",   "dev-worker-secret")

_bearer_scheme = HTTPBearer(auto_error=True)


def verify_pipeline_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> None:
    """FastAPI dependency: rejects any request without a valid PIPELINE_SECRET Bearer token."""
    if not hmac.compare_digest(credentials.credentials, PIPELINE_SECRET):
        raise HTTPException(status_code=403, detail="Forbidden")


def _worker_headers() -> dict:
    """Authorization header for outbound Pipeline → Worker requests."""
    return {"Authorization": f"Bearer {WORKER_SECRET}"}


app = FastAPI(title="ChatboxAI Pipecat WS Shim", version="0.2.0")


@app.on_event("startup")
async def _startup_checks() -> None:
    """Fail fast in production if secrets are still at their insecure defaults."""
    if _ENV == "production":
        if PIPELINE_SECRET in ("dev-pipeline-secret", ""):
            raise RuntimeError(
                "PIPELINE_SECRET must be set to a secure value in production. "
                "Set the PIPELINE_SECRET environment variable."
            )
        if WORKER_SECRET in ("dev-worker-secret", ""):
            raise RuntimeError(
                "WORKER_SECRET must be set to a secure value in production. "
                "Set the WORKER_SECRET environment variable."
            )
    logger.info(
        "[startup] Security: ENV=%s | PIPELINE_SECRET=%s | WORKER_SECRET=%s",
        _ENV,
        "(default — INSECURE)" if PIPELINE_SECRET == "dev-pipeline-secret" else "(set)",
        "(default — INSECURE)" if WORKER_SECRET == "dev-worker-secret" else "(set)",
    )
    logger.warning(
        "[startup] WS frame limit: ensure '--ws-max-size 32768' is set in your "
        "production uvicorn CLI command. The __main__ block sets ws_max_size=32768 "
        "but this is ignored when launched via 'uvicorn main:app' directly."
    )

# ── Worker error code mapping ─────────────────────────────────────────────────
# Worker-internal codes → stable frontend-facing codes.
# Frontend never depends on Worker implementation details.
_WORKER_ERROR_MAP: dict[str, str] = {
    "VIDEO_HAS_NO_CAPTIONS":              "TRANSCRIPT_NOT_AVAILABLE",
    "VIDEO_NOT_FOUND":                    "TRANSCRIPT_NOT_AVAILABLE",
    "PROVIDER_TEMPORARILY_UNAVAILABLE":   "TRANSCRIPT_PROVIDER_DOWN",
    "TRANSCRIPT_PROVIDER_DOWN":           "TRANSCRIPT_PROVIDER_DOWN",
}

def _map_error_code(worker_code: str | None) -> str:
    if not worker_code:
        return "TRANSCRIPT_PROVIDER_DOWN"
    return _WORKER_ERROR_MAP.get(worker_code, "TRANSCRIPT_PROVIDER_DOWN")

# ── CORS ──────────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000")
origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(ws_router)
app.include_router(stt_router)          # POST /api/stt/normalize — provider-agnostic
app.include_router(stt_legacy_router)   # POST /api/stt/groq     — migration shim (keep until frontend rollout)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


# ── Azure Speech token exchange ───────────────────────────────────────────────
@app.get("/api/speech-token", dependencies=[Depends(verify_pipeline_token)])
async def get_speech_token() -> dict:
    """
    Exchange the server-side Azure Speech key for a short-lived access token.

    The token is valid for ~10 minutes and is scoped to a single Speech region.
    The frontend uses it to initialise SpeechConfig.fromAuthorizationToken()
    so the raw AZURE_SPEECH_KEY is never sent to the browser.

    Required env vars:
        AZURE_SPEECH_KEY    — Azure Cognitive Services Speech resource key
        AZURE_SPEECH_REGION — Azure region, e.g. "eastus" or "southeastasia"

    Returns:
        { "token": "...", "region": "eastus" }   on success
        { "error": "..." }                        on misconfiguration / failure
    """
    key    = os.getenv("AZURE_SPEECH_KEY", "")
    region = os.getenv("AZURE_SPEECH_REGION", "")

    if not key or not region:
        logger.warning("/api/speech-token called but AZURE_SPEECH_KEY or AZURE_SPEECH_REGION not set")
        return {"error": "Speech service not configured on server"}

    token_url = f"https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.post(
                token_url,
                headers={"Ocp-Apim-Subscription-Key": key},
            )
            resp.raise_for_status()
            token = resp.text
        logger.info("Azure Speech token issued for region %s", region)
        return {"token": token, "region": region}
    except Exception as exc:
        details = ""
        if isinstance(exc, httpx.HTTPStatusError):
            try:
                details = f" - Body: {exc.response.text}"
            except Exception:
                pass
        logger.error("Failed to issue Azure Speech token: %r%s", exc, details)
        return {"error": "Failed to issue Speech token"}


# ── Session pre-registration + context pipeline ───────────────────────────────
@app.post("/api/sessions/register", dependencies=[Depends(verify_pipeline_token)])
async def register_session(body: dict) -> dict:
    """
    Pre-create a CREATED session record with full video context.

    Called by the Next.js /api/sessions/init route after it creates the
    sessionId, before returning to the browser. The browser's loading spinner
    is visible during this call.

    Request:
        {
            "sessionId": "sess-...",
            "videoUrl":  "https://youtu.be/...",
            "metadata":  { "title": "...", "duration": 900 }
        }

    Response (success):
        { "ok": true, "contextReady": true, "summaryReady": true }

    Response (transcript unavailable — fail fast):
        { "ok": false, "error": "..." }

    Response (summary timeout — session still proceeds):
        { "ok": true, "contextReady": true, "summaryReady": false }
    """
    session_id = body.get("sessionId", "")
    video_url  = body.get("videoUrl", "")
    metadata   = body.get("metadata", {})

    if not session_id:
        return {"ok": False, "error": "sessionId is required"}

    if not video_url:
        return {"ok": False, "error": "videoUrl is required"}

    # ── Run context pipeline ──────────────────────────────────────────────────
    context = None
    context_error: str | None = None

    try:
        context = await build_context(video_url)
        logger.info(
            "Context ready for session %s: %d chunks, summary_ready=%s",
            session_id,
            len(context.chunks),
            context.summary_ready,
        )
    except ContextPipelineError as exc:
        logger.error("Context build failed for %s: %s", session_id, exc)
        context_error = str(exc)

    if context_error or not context:
        return {"ok": False, "error": context_error or "Unknown error generating context"}

    # ── Register session in store ─────────────────────────────────────────────
    try:
        await store.register(session_id, video_url, metadata, context=context)
        logger.info("Session pre-registered: %s", session_id)
    except ValueError as exc:
        # Already registered — idempotent
        logger.debug("Session already registered: %s (%s)", session_id, exc)

    return {
        "ok": True,
        "contextReady": True,
        "summaryReady": context.summary_ready
    }


@app.post("/api/sessions/prefetch", dependencies=[Depends(verify_pipeline_token)])
async def prefetch_session(body: dict) -> dict:
    """
    Prefetch context pipeline for a video to speed up later registration.
    Request: { "videoUrl": "..." }
    """
    video_url = body.get("videoUrl", "")
    if not video_url:
        return {"ok": False, "error": "videoUrl is required"}
        
    try:
        from context.parser import parse_youtube_url
        video_id = parse_youtube_url(video_url)
        from context.pipeline import prefetch_context
        prefetch_context(video_id, video_url)
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}



# ── Ingestion Facade API ──────────────────────────────────────────────────────
# Pipeline owns this API surface. Frontend has no knowledge of the Worker.
# Responsibilities: validate, authenticate, log, retry, translate errors.

class IngestRequest(BaseModel):
    video_id: str
    language_preference: str = "en"
    force_refresh: bool = False


def _worker_url() -> str:
    return os.environ.get("INGESTION_WORKER_URL", "http://localhost:8001").rstrip("/")


@app.post("/api/ingest", dependencies=[Depends(verify_pipeline_token)])
async def facade_ingest(req: IngestRequest) -> dict:
    """
    Facade endpoint: start a transcript ingestion job.

    Frontend calls this. The Worker's existence is an implementation detail.

    Response:
        { "job_id": "..." }
    """
    if not req.video_id or not req.video_id.strip():
        raise HTTPException(status_code=422, detail="video_id is required")

    url = _worker_url()
    logger.info("[ingest] Triggering job for video_id=%s lang=%s", req.video_id, req.language_preference)

    for attempt in range(1, 3):  # 1 retry on network failure
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.post(
                    f"{url}/api/ingest",
                    json={
                        "video_id": req.video_id,
                        "language_preference": req.language_preference,
                        "force_refresh": req.force_refresh,
                    },
                    headers=_worker_headers(),
                )
            if res.status_code == 200:
                data = res.json()
                logger.info("[ingest] Job started: job_id=%s", data.get("job_id"))
                return {"job_id": data["job_id"]}

            # Worker returned a non-200: map to frontend-facing error
            logger.warning("[ingest] Worker returned %d for video_id=%s", res.status_code, req.video_id)
            raise HTTPException(
                status_code=502,
                detail={"error_code": "TRANSCRIPT_PROVIDER_DOWN", "message": "Ingestion service unavailable"},
            )

        except httpx.RequestError as exc:
            logger.warning("[ingest] Network error (attempt %d): %s", attempt, exc)
            if attempt == 2:
                raise HTTPException(
                    status_code=503,
                    detail={"error_code": "TRANSCRIPT_PROVIDER_DOWN", "message": "Cannot reach ingestion service"},
                )

    raise HTTPException(status_code=503, detail={"error_code": "TRANSCRIPT_PROVIDER_DOWN"})


@app.get("/api/ingest/{job_id}", dependencies=[Depends(verify_pipeline_token)])
async def facade_ingest_status(job_id: str) -> dict:
    """
    Facade endpoint: poll job status.

    Returns a stable schema that the frontend can depend on:
        {
            "status": "queued" | "processing" | "completed" | "failed",
            "progress": 0-100,
            "error_code": "TRANSCRIPT_NOT_AVAILABLE" | "TRANSCRIPT_PROVIDER_DOWN" | null
        }

    Worker's raw status values and error codes are mapped here.
    Pipeline does NOT forward the transcript — extractor.py handles that separately.
    """
    url = _worker_url()
    logger.debug("[ingest] Polling job_id=%s", job_id)

    # Worker status → Frontend status mapping
    _STATUS_MAP = {
        "pending":  "queued",
        "fetching": "processing",
        "ready":    "completed",
        "failed":   "failed",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(
                f"{url}/api/ingest/{job_id}",
                headers=_worker_headers(),
            )

        if res.status_code == 404:
            raise HTTPException(status_code=404, detail="Job not found")

        if res.is_error:
            raise HTTPException(
                status_code=502,
                detail={"error_code": "TRANSCRIPT_PROVIDER_DOWN", "message": "Worker unreachable"},
            )

        worker_data = res.json()
        worker_status = worker_data.get("status", "pending")
        frontend_status = _STATUS_MAP.get(worker_status, "processing")

        # Estimate progress from status for a smooth UX
        _PROGRESS_MAP = {"queued": 5, "processing": 50, "completed": 100, "failed": 0}
        progress = _PROGRESS_MAP.get(frontend_status, 20)

        response: dict = {
            "job_id":     job_id,
            "status":     frontend_status,
            "progress":   progress,
            "error_code": None,
        }

        if frontend_status == "failed":
            raw_code = worker_data.get("error_code")
            response["error_code"] = _map_error_code(raw_code)
            logger.warning(
                "[ingest] Job %s failed: worker_code=%s → frontend_code=%s",
                job_id, raw_code, response["error_code"],
            )

        return response

    except httpx.RequestError as exc:
        logger.error("[ingest] Cannot reach worker while polling job %s: %s", job_id, exc)
        raise HTTPException(
            status_code=503,
            detail={"error_code": "TRANSCRIPT_PROVIDER_DOWN", "message": "Cannot reach ingestion service"},
        )


# ── Beginner Support API ──────────────────────────────────────────────────────

class HintsRequest(BaseModel):
    aiSentence: str
    mode: str = "beginner"


class LookupRequest(BaseModel):
    sessionId: str | None = None
    messageId: str | None = None
    tappedTerm: str
    originalSentence: str
    forceLlm: bool = False


@app.post("/api/sessions/{session_id}/hints", dependencies=[Depends(verify_pipeline_token)])
async def get_hints(session_id: str, body: HintsRequest):
    """
    Lazily generate beginner hints for the most recent AI turn.

    Called ONLY when user taps "Tôi nên nói gì?" or "Câu đó nghĩa là gì?".
    Returns ONE JSON that feeds BOTH buttons (cache it on the frontend per turn).
    """
    from assistant import generate_hints

    record = await store.get(session_id)
    summary_digest = ""
    history: list[dict] = []

    if record and record.context:
        outline = record.context.outline
        title = outline.title or ""
        events = [getattr(e, "label", getattr(e, "description", "")) for e in (outline.key_events or [])]
        events_str = ", ".join(e for e in events if e)
        summary_digest = f"Topic: {title}. Keywords: {events_str}"

    # Get recent conversation history from ai_turn's in-memory store
    from ai_turn import _session_history
    full_history = _session_history.get(session_id, [])
    # Only keep the very last user message to save tokens (AI sentence is already passed separately)
    for msg in reversed(full_history):
        if msg.get("role") == "user":
            history = [msg]
            break

    result = await generate_hints(
        ai_sentence=body.aiSentence,
        history=history,
        summary_digest=summary_digest,
        mode=body.mode,
    )
    return result


@app.post("/api/lookup", dependencies=[Depends(verify_pipeline_token)])
async def lookup_word_endpoint(body: LookupRequest):
    """
    Contextual word/phrase lookup with collocation detection.

    Returns startChar/endChar offsets computed by Gemini into the originalSentence.
    These MUST be used for highlighting (not the tapped word length) because
    Gemini may expand the span to cover the full collocation.
    """
    from assistant import lookup_word

    session_id = body.sessionId or ""
    summary = ""

    if session_id:
        record = await store.get(session_id)
        if record and record.context:
            summary = record.context.outline.summary_text or ""

    result = await lookup_word(
        tapped_term=body.tappedTerm,
        original_sentence=body.originalSentence,
        summary=summary,
        force_llm=body.forceLlm,
        session_id=session_id,
    )
    return result


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    # ws_max_size: ASGI-level WebSocket frame size limit (bytes).
    # IMPORTANT: when deploying via CLI, add: --ws-max-size 32768
    uvicorn.run("main:app", host=host, port=port, reload=True, ws_max_size=32_768)
