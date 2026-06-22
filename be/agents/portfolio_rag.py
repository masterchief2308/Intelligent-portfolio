"""
Agent 3: Portfolio RAG
Uses hybrid Qdrant retrieval with project-wise diversification.
"""

import logging
from models.state import PersonalizationState
from services.qdrant import get_qdrant

logger = logging.getLogger(__name__)


async def portfolio_rag(state: PersonalizationState) -> PersonalizationState:
    """Retrieve relevant portfolio chunks grouped by project."""
    role = state.get("role", "")
    company_data = state.get("company_data", {})
    research_plan = state.get("research_plan", {})

    query_parts = [role]
    if company_data.get("industry"):
        query_parts.append(company_data["industry"])
    if company_data.get("tech_stack"):
        query_parts.extend(company_data["tech_stack"][:5])
    if company_data.get("open_roles"):
        query_parts.extend(company_data["open_roles"][:3])
    if research_plan.get("portfolio_query"):
        query_parts.append(research_plan["portfolio_query"])

    query = " ".join(query_parts)

    try:
        qdrant = get_qdrant()
        raw_chunks = await qdrant.search(query=query, use_case="personalization")
        state["portfolio_chunks"] = raw_chunks
        logger.info(
            "Retrieved %d diversified portfolio chunks (%d projects represented) for: %s",
            len(raw_chunks),
            len({c.get("project_slug") for c in raw_chunks if c.get("project_slug")}),
            query[:80],
        )
    except Exception as e:
        logger.error("Portfolio RAG failed: %s", e)
        state["portfolio_chunks"] = []
        state.setdefault("errors", []).append(f"portfolio_rag: {e}")

    return state
