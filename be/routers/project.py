"""GET /api/project/{slug} — Return dynamic LLM-generated project details."""

import json
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from langchain_core.messages import SystemMessage, HumanMessage

from models.schemas import DynamicProjectConfig
from services.firestore import get_firestore
from services.gemini import get_pro_llm

logger = logging.getLogger(__name__)
router = APIRouter()

_portfolio_data = None


def _load_portfolio() -> dict:
    global _portfolio_data
    if _portfolio_data is None:
        data_path = Path(__file__).parent.parent / "data" / "portfolio.json"
        if data_path.exists():
            _portfolio_data = json.loads(data_path.read_text(encoding="utf-8"))
        else:
            _portfolio_data = {"projects": []}
    return _portfolio_data


@router.get("/api/project/{slug}")
async def get_project(slug: str, email: str | None = Query(None)):
    """Return project details. Dynamically generated if email is provided."""
    portfolio = _load_portfolio()
    static_project = next((p for p in portfolio.get("projects", []) if p["id"] == slug), None)

    if not static_project:
        raise HTTPException(status_code=404, detail=f"Project not found: {slug}")

    # Fallback early if no email
    if not email:
        return static_project

    firestore = get_firestore()
    
    # 1. Check dynamic cache
    try:
        cached = await firestore.get_dynamic_project(email, slug)
        if cached:
            logger.info("Dynamic project cache hit for %s/%s", email, slug)
            return cached
    except Exception as e:
        logger.error("Failed to read dynamic project cache: %s", e)

    # 2. Cache miss -> We need the visitor profile to personalize it
    visitor_profile = {}
    try:
        key = email.lower().strip()
        if firestore._db:
            doc = firestore._db.collection("personalizations").document(key).get()
            if doc.exists:
                visitor_profile = doc.to_dict().get("visitor_profile", {})
        else:
            data = firestore._mem["personalizations"].get(key)
            if data:
                visitor_profile = data.get("visitor_profile", {})
    except Exception as e:
        logger.warning("Failed to fetch visitor profile for dynamic generation: %s", e)

    if not visitor_profile:
        # If we can't find the profile, just return static
        return static_project

    # 3. Generate via Gemini Pro
    logger.info("Generating dynamic project %s for %s", slug, email)
    llm = get_pro_llm()
    structured_llm = llm.with_structured_output(DynamicProjectConfig)

    messages = [
        SystemMessage(content=(
            "You are an AI personalizing a portfolio project case study. "
            "Rewrite the project details to specifically appeal to the visitor's role, industry, and background. "
            "Keep the core facts and metrics truthful to the original static project, but change the focus. "
            "For example, if the visitor is a 'Business Executive', focus on ROI, timeline, and cost savings. "
            "If the visitor is a 'Backend Engineer', emphasize architecture, scale, latency, and tools used. "
            "Do NOT hallucinate metrics that aren't in the original text.\n"
            "- CONFIDENTIALITY & LEGAL COMPLIANCE: Do not reveal proprietary source code, internal IP, raw database schemas, explicit internal client metrics/financials that are not public, or project-specific sensitive data that would violate the India Information Technology Act or corporate NDAs. Generalize sensitive details when necessary."
        )),
        HumanMessage(content=(
            f"VISITOR PROFILE:\n{json.dumps(visitor_profile, indent=2)}\n\n"
            f"ORIGINAL STATIC PROJECT:\n{json.dumps(static_project, indent=2)}\n\n"
            "Generate the personalized DynamicProjectConfig."
        ))
    ]

    try:
        result: DynamicProjectConfig = await structured_llm.ainvoke(messages)
        result_dict = result.model_dump()
        
        # 4. Save to cache
        await firestore.save_dynamic_project(email, slug, result_dict)
        return result_dict

    except Exception as e:
        logger.error("Failed to generate dynamic project %s: %s", slug, e)
        # 5. Fallback on failure
        return static_project
