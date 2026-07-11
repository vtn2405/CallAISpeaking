"""context/ — YouTube transcript context pipeline.

Public API (called by main.py and ai_turn.py):
    from context.pipeline import build_context, ContextPipelineError
    from context.outline_schema import VideoOutline
    from context.retrieval import find_relevant_chunks, build_retrieval_query
    from context.prompt_builder import build_system_prompt, build_messages, format_chunks

    context = await build_context(video_url, timeout_sec=30)
    # Returns SessionContext or raises ContextPipelineError
"""
from .pipeline import build_context, ContextPipelineError
from .outline_schema import VideoOutline

__all__ = ["build_context", "ContextPipelineError", "VideoOutline"]
