"""GET /api/portfolio — Return static portfolio data."""

import json
import logging
from pathlib import Path
from fastapi import APIRouter, Query
from langchain_core.messages import SystemMessage, HumanMessage
from services.firestore import get_firestore
from services.gemini import get_pro_llm
from models.schemas import DynamicPortfolioConfig

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
            logger.warning("portfolio.json not found at %s", data_path)
            _portfolio_data = {}
    return _portfolio_data


@router.get("/api/portfolio")
async def get_portfolio(email: str | None = Query(None)):
    """Return the complete portfolio data. Dynamically rewritten if email is provided."""
    static_portfolio = _load_portfolio()
    
    if not email:
        return static_portfolio

    firestore = get_firestore()

    # 1. Check dynamic cache
    try:
        cached = await firestore.get_dynamic_portfolio(email)
        if cached:
            logger.info("Dynamic portfolio cache hit for %s", email)
            # Merge cached dynamic data into static baseline
            merged = dict(static_portfolio)
            merged["experience"] = cached.get("experience", static_portfolio.get("experience", []))
            merged["education"] = cached.get("education", static_portfolio.get("education", []))
            return merged
    except Exception as e:
        logger.error("Failed to read dynamic portfolio cache: %s", e)

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
        logger.warning("Failed to fetch visitor profile for portfolio: %s", e)

    if not visitor_profile:
        return static_portfolio

    # 3. Generate via Gemini Pro
    logger.info("Generating dynamic portfolio timeline for %s", email)
    llm = get_pro_llm()
    structured_llm = llm.with_structured_output(DynamicPortfolioConfig)

    # We only send experience and education to keep the prompt focused
    static_timeline = {
        "experience": static_portfolio.get("experience", []),
        "education": static_portfolio.get("education", []),
    }

    messages = [
        SystemMessage(content=(
            "You are an AI personalizing a candidate's resume/portfolio timeline for a specific visitor. "
            "Rewrite the 'experience' and 'education' arrays to specifically appeal to the visitor's role, industry, and background. "
            "For each experience, write 4-6 detailed bullet points highlighting the achievements, technical skills, and metrics "
            "that matter most to THIS visitor. Do NOT hallucinate jobs or degrees that don't exist in the original. "
            "Keep dates, companies, and roles strictly accurate, but change the focus of the bullet points.\n"
            "- CONFIDENTIALITY & LEGAL COMPLIANCE: Do not reveal proprietary source code, internal IP, raw database schemas, explicit internal client metrics/financials that are not public, or project-specific sensitive data that would violate the India Information Technology Act or corporate NDAs. Generalize sensitive details when necessary."
        )),
        HumanMessage(content=(
            f"VISITOR PROFILE:\n{json.dumps(visitor_profile, indent=2)}\n\n"
            f"ORIGINAL STATIC TIMELINE:\n{json.dumps(static_timeline, indent=2)}\n\n"
            "Generate the personalized DynamicPortfolioConfig."
        ))
    ]

    try:
        result: DynamicPortfolioConfig = await structured_llm.ainvoke(messages)
        result_dict = result.model_dump()
        
        # 4. Save to cache
        await firestore.save_dynamic_portfolio(email, result_dict)
        
        # Merge and return
        merged = dict(static_portfolio)
        merged["experience"] = result_dict.get("experience", static_portfolio.get("experience", []))
        merged["education"] = result_dict.get("education", static_portfolio.get("education", []))
        return merged

    except Exception as e:
        logger.error("Failed to generate dynamic portfolio for %s: %s", email, e)
        return static_portfolio
