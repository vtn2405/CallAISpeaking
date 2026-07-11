import asyncio
import os
import json
import logging
from dotenv import load_dotenv

# Enable INFO logging to see the pipeline and retrieval logs
logging.basicConfig(level=logging.INFO)

# Load environment variables
load_dotenv()

from context.pipeline import build_context
from session_store import store, SessionStatus
from ai_turn import _grounded_response

async def run_test():
    # Provide a test YouTube URL (short video to test full_transcript mode)
    # This is "Me at the zoo", the first YouTube video ever.
    video_url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"
    session_id = "test-session-001"
    
    print("\n\n" + "="*50)
    print("1. BUILDING CONTEXT (INGEST)")
    print("="*50)
    try:
        context = await build_context(video_url)
        print(f"\n[Result] Context built successfully.")
        print(f"Mode: {'full_transcript' if context.use_full_context else 'retrieval'}")
        print(f"Transcript ready: {context.transcript_ready}")
        print(f"Summary ready: {context.summary_ready}")
        print(f"Outline events count: {len(context.outline.key_events)}")
    except Exception as e:
        print(f"Failed to build context: {e}")
        return

    # Register session
    await store.register(session_id, video_url, context=context)
    await store.transition(session_id, SessionStatus.READY)
    await store.transition(session_id, SessionStatus.ACTIVE)

    print("\n\n" + "="*50)
    print("2. AI TURN 1 (FULL CONTEXT MODE)")
    print("="*50)
    reply1 = await _grounded_response(session_id, "What is this video about?")
    print(f"\n[Result] Turn 1 Reply:\n{reply1}")

    print("\n\n" + "="*50)
    print("3. AI TURN 2 (RETRIEVAL MODE FORCED)")
    print("="*50)
    # Fast-forward full_context_turns_used to trigger retrieval mode
    context.full_context_turns_used = int(os.getenv("FULL_CONTEXT_MAX_TURNS", "6"))
    
    reply2 = await _grounded_response(session_id, "What does he say about the elephants?")
    print(f"\n[Result] Turn 2 Reply:\n{reply2}")
    
    print("\n\n" + "="*50)
    print("4. SESSION PROGRESS")
    print("="*50)
    record = await store.get(session_id)
    if record:
        print(record.progress.coverage_summary(context.outline))

if __name__ == "__main__":
    asyncio.run(run_test())
