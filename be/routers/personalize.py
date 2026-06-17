"""POST /api/personalize — Run the LangGraph pipeline or return cached result."""

import logging
from fastapi import APIRouter, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from models.schemas import PersonalizeRequest, PersonalizeResponse
from services.firestore import get_firestore
from agents.supervisor import run_personalization

logger = logging.getLogger(__name__)
router = APIRouter()

limiter = Limiter(key_func=get_remote_address)


@router.post("/api/personalize", response_model=PersonalizeResponse)
@limiter.limit("5/minute")
async def personalize(request: Request, personalize_request: PersonalizeRequest):
    """Personalize the website for a visitor.
    1. Check Firestore cache (24h TTL).
    2. If miss, run the full LangGraph 5-agent pipeline.
    3. Cache and return result.
    """
    firestore = get_firestore()

    # Check cache first
    cached = await firestore.get_personalization(personalize_request.email)
    if cached:
        logger.info("Cache hit for %s", personalize_request.email)
        return PersonalizeResponse(
            personalization_id=cached.get("personalization_id", ""),
            visitor_profile=cached.get("visitor_profile", {}),
            website_config=cached.get("website_config", {}),
        )

    # Cache miss — run pipeline
    logger.info("Cache miss for %s, running pipeline", personalize_request.email)
    state = await run_personalization(
        email=personalize_request.email,
        role=personalize_request.role,
        company=personalize_request.company or "",
    )

    # Build response
    response = PersonalizeResponse(
        personalization_id=state.get("personalization_id", ""),
        visitor_profile=state.get("visitor_profile", {}),
        website_config=state.get("website_config", {}),
    )

    # Cache result
    await firestore.save_personalization(personalize_request.email, {
        "personalization_id": response.personalization_id,
        "visitor_profile": response.visitor_profile.model_dump() if hasattr(response.visitor_profile, 'model_dump') else response.visitor_profile,
        "website_config": response.website_config.model_dump() if hasattr(response.website_config, 'model_dump') else response.website_config,
    })

    return response
