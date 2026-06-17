"""GET /api/architecture/{slug} — Return React Flow graph definitions."""

import json
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from langchain_core.messages import SystemMessage, HumanMessage

from services.firestore import get_firestore
from services.gemini import get_pro_llm
from models.schemas import DynamicArchitectureConfig

logger = logging.getLogger(__name__)
router = APIRouter()

_architecture_data: dict = {}

def _load_architectures() -> dict:
    global _architecture_data
    if not _architecture_data:
        data_path = Path(__file__).parent.parent / "data" / "architectures.json"
        if data_path.exists():
            _architecture_data = json.loads(data_path.read_text(encoding="utf-8"))
        else:
            # Fallback
            _architecture_data = {}
    return _architecture_data

@router.get("/api/architecture/{slug}")
async def get_architecture(slug: str, email: str | None = Query(None)):
    """Return React Flow graph definitions. Dynamically generated if email is provided."""
    architectures = _load_architectures()
    static_arch = architectures.get(slug)

    if not static_arch:
        raise HTTPException(status_code=404, detail=f"Architecture not found: {slug}")

    if not email:
        return static_arch

    firestore = get_firestore()
    
    # 1. Check dynamic cache
    try:
        cached = await firestore.get_dynamic_architecture(email, slug)
        if cached:
            logger.info("Dynamic architecture cache hit for %s/%s", email, slug)
            return cached
    except Exception as e:
        logger.error("Failed to read dynamic architecture cache: %s", e)

    # 2. Fetch visitor profile
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
        logger.warning("Failed to fetch visitor profile: %s", e)

    if not visitor_profile:
        return static_arch

    # 3. Generate via Gemini Pro
    logger.info("Generating dynamic architecture %s for %s", slug, email)
    llm = get_pro_llm()
    structured_llm = llm.with_structured_output(DynamicArchitectureConfig)

    messages = [
        SystemMessage(content=(
            "You are an AI designing a system architecture diagram for a portfolio website. "
            "Your output will be rendered using React Flow. "
            "Analyze the original static architecture diagram and the visitor's profile. "
            "Modify the diagram's nodes and edges to emphasize technologies and flows "
            "that matter to this visitor. "
            "For example, for a Frontend Engineer, you might expand on the React node. "
            "For a Manager, you might simplify the backend microservices into a single 'Business Logic' group. "
            "Do NOT hallucinate technologies that weren't in the original."
        )),
        HumanMessage(content=(
            f"VISITOR PROFILE:\n{json.dumps(visitor_profile, indent=2)}\n\n"
            f"ORIGINAL STATIC DIAGRAM:\n{json.dumps(static_arch, indent=2)}\n\n"
            "Generate the personalized DynamicArchitectureConfig."
        ))
    ]

    try:
        result: DynamicArchitectureConfig = await structured_llm.ainvoke(messages)
        result_dict = result.model_dump()
        
        # 4. Save to cache
        await firestore.save_dynamic_architecture(email, slug, result_dict)
        return result_dict

    except Exception as e:
        logger.error("Failed to generate dynamic architecture %s: %s", slug, e)
        return static_arch
