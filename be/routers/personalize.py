"""POST /api/personalize — Run the LangGraph pipeline or return cached result."""

import json
import logging

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from models.schemas import PersonalizeRequest
from services.firestore import get_firestore
from rate_limit import LIMIT_PERSONALIZE_PIPELINE, limiter

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/personalize")
async def personalize(request: Request, personalize_request: PersonalizeRequest):
    """Personalize the website for a visitor using Server-Sent Events (SSE)."""
    firestore = get_firestore()

    # Cache hits are cheap — no rate limit (avoids 429 on page refresh)
    cached = await firestore.get_personalization(personalize_request.email)
    if cached:
        logger.info("Cache hit for %s", personalize_request.email)

        async def cache_stream():
            yield f"data: {json.dumps({'type': 'step', 'id': 'cache', 'label': 'Cache hit. Loading blueprints...', 'status': 'done'})}\n\n"
            payload = {
                "result": {
                    "personalization_id": cached.get("personalization_id", ""),
                    "visitor_profile": cached.get("visitor_profile", {}),
                    "website_config": cached.get("website_config", {}),
                }
            }
            yield f"data: {json.dumps(payload)}\n\n"

        return StreamingResponse(cache_stream(), media_type="text/event-stream")

    return await _personalize_pipeline(request, personalize_request)


@limiter.limit(LIMIT_PERSONALIZE_PIPELINE)
async def _personalize_pipeline(request: Request, personalize_request: PersonalizeRequest):
    """Expensive LangGraph run — rate limited per visitor IP."""
    firestore = get_firestore()
    logger.info("Cache miss for %s, running streaming pipeline", personalize_request.email)

    from agents.supervisor import run_personalization_stream

    async def pipeline_stream():
        final_payload = None
        async for chunk in run_personalization_stream(
            email=personalize_request.email,
            role=personalize_request.role,
            company=personalize_request.company or "",
        ):
            yield chunk

            if "result" in chunk:
                try:
                    data = json.loads(chunk.replace("data: ", "").strip())
                    if "result" in data:
                        final_payload = data["result"]
                except Exception:
                    pass

        if final_payload:
            try:
                await firestore.save_personalization(personalize_request.email, final_payload)
            except Exception as e:
                logger.error("Failed to save to firestore: %s", e)

    return StreamingResponse(pipeline_stream(), media_type="text/event-stream")
