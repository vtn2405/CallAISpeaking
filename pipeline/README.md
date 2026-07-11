# ChatboxAI — Pipecat WS Shim

A minimal Python WebSocket bridge that implements the Pipecat realtime event
contract for the ChatboxAI frontend.

**This is a shim/bridge service**, not a full Pipecat pipeline. The AI turn
simulation lives in `mock_ai.py` and is the single swap point for real
Pipecat processors.

## What this service does

| Responsibility | File |
|---|---|
| Session lifecycle (CREATED → READY → ACTIVE → ENDED \| ERROR) | `session_store.py` |
| WS endpoint, auth, event loop | `ws_bridge.py` |
| Event serialisation (6-event contract) | `event_emitter.py` |
| AI turn simulation (swap point for real pipeline) | `mock_ai.py` |
| App entry point, CORS, /health | `main.py` |

## What this service does NOT do

- Does **not** handle `POST /api/sessions/init` or `POST /api/sessions/end` —
  those live in the Next.js app.
- Does **not** do STT, LLM, or TTS — `mock_ai.py` simulates the turn cycle.

## Quick start

```bash
cd pipeline
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
```

Service runs at `http://localhost:8000`.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8000` | Listen port |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed CORS origins (comma-separated) |

## Frontend env vars (in `frontend/.env.local`)

```env
# Point to this shim's WS endpoint
NEXT_PUBLIC_PIPECAT_WS_URL=ws://localhost:8000/ws/sessions

# Point to this shim for REST pre-registration (server-side only)
PIPECAT_SHIM_URL=http://localhost:8000
```

Leave both empty to fall back to `MockTransport` + Next.js mock routes.

## Event contract (backend → frontend)

All WebSocket messages are JSON with a `type` field:

| type | payload |
|---|---|
| `session.ready` | `{ sessionId, metadata: { title, duration, thumbnailUrl? } }` |
| `transcript.update` | `{ text, isFinal, sender: "user"\|"ai" }` |
| `ai.thinking` | `{}` |
| `ai.speaking` | `{ text }` |
| `session.ended` | `{}` |
| `error` | `{ message, code? }` |

## Inbound client frames (frontend → backend)

| type | payload | description |
|---|---|---|
| `user.turn` | `{ text }` | User spoke; triggers AI turn |
| `ping` | `{}` | Keep-alive; ignored |

## Smoke test

```bash
# Terminal 1 — start shim
uvicorn main:app --reload

# Terminal 2 — start frontend with real transport
cd frontend
NEXT_PUBLIC_PIPECAT_WS_URL=ws://localhost:8000/ws/sessions \
PIPECAT_SHIM_URL=http://localhost:8000 \
npm run dev
```

Then open `http://localhost:3000/call?url=https://youtu.be/dQw4w9WgXcQ`:

1. `POST /api/sessions/init` → Next.js → pre-registers with shim → returns `{ sessionId }`
2. Browser opens `ws://localhost:8000/ws/sessions/{sessionId}`
3. Shim validates → CREATED → READY → sends `session.ready`
4. UI transitions `initializing → idle` ✓
5. Click mic → `user.turn` frame sent → shim runs `mock_ai.run_turn()`
6. Events: `ai.thinking` → `ai.speaking` → `transcript.update(isFinal=True)` ✓
7. End session → WS closes → `session.ended` ✓

## Replacing mock_ai.py with a real pipeline

```python
# mock_ai.py — run_turn() body
async def run_turn(ws, user_text: str) -> None:
    # TODO: replace with real Pipecat frame processors
    # e.g.:
    #   stt_result = await stt_pipeline.transcribe(audio_bytes)
    #   llm_response = await llm_pipeline.generate(context + stt_result)
    #   await tts_pipeline.speak(llm_response, ws)
    ...
```

The WS bridge, event emitter, session store, and all frontend code stay
identical when the pipeline is swapped.
