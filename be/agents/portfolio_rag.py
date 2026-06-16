"""
Agent 3: Portfolio RAG
Uses the search_portfolio LangChain tool to retrieve relevant chunks from Qdrant.
No LLM call — pure tool-based retrieval.
"""

import logging
from models.state import PersonalizationState
from mcp_tools.tools import search_portfolio

logger = logging.getLogger(__name__)


async def portfolio_rag(state: PersonalizationState) -> PersonalizationState:
    """Retrieve relevant portfolio chunks using the search_portfolio tool."""
    role = state.get("role", "")
    company_data = state.get("company_data", {})
    research_plan = state.get("research_plan", {})

    # Build a rich query from all available context
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

    # Use the LangChain tool
    try:
        result = await search_portfolio.ainvoke({"query": query, "top_k": 8})

        # Also store raw chunks for downstream agents
        from services.qdrant import get_qdrant
        qdrant = get_qdrant()
        raw_chunks = await qdrant.search(query=query, top_k=8)
        state["portfolio_chunks"] = raw_chunks

        logger.info("Retrieved %d portfolio chunks for: %s", len(raw_chunks), query[:80])
    except Exception as e:
        logger.error("Portfolio RAG tool failed: %s", e)
        state["portfolio_chunks"] = []
        state.setdefault("errors", []).append(f"portfolio_rag: {e}")

    return state
