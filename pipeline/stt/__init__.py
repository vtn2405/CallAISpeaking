"""
stt/ — Provider-Agnostic Speech Normalization Package.

Exports the FastAPI router (POST /api/stt/normalize) and the legacy shim
(POST /api/stt/groq kept as migration bridge until frontend rollout is complete).
"""
from stt.router import router
from stt.legacy_shim import legacy_router

__all__ = ["router", "legacy_router"]
