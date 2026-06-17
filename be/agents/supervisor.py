"""
Supervisor — LangGraph StateGraph with MCP tool integration.

Orchestrates the 5-agent pipeline:
  research_planner → company_researcher → portfolio_rag → validator → personalizer

MCP tools are loaded via langchain-mcp-adapters and bound to the relevant agents.
"""

import logging
import time
from langgraph.graph import StateGraph, END

from models.state import PersonalizationState
from agents.research_planner import research_planner
from agents.company_researcher import company_researcher
from agents.portfolio_rag import portfolio_rag
from agents.validator import validator
from agents.personalizer import personalizer

logger = logging.getLogger(__name__)


def build_personalization_graph() -> StateGraph:
    """Build the LangGraph StateGraph for the personalization pipeline.

    Architecture:
    ┌──────────────────┐
    │ research_planner  │  (Gemini Flash — pure reasoning)
    └────────┬─────────┘
             │
    ┌────────▼─────────┐
    │company_researcher │  (Gemini Flash + scrape_website/scrape_company tools)
    └────────┬─────────┘
             │
    ┌────────▼─────────┐
    │  portfolio_rag    │  (search_portfolio tool — Qdrant retrieval)
    └────────┬─────────┘
             │
    ┌────────▼─────────┐
    │    validator      │  (Gemini Flash — structured scoring)
    └────────┬─────────┘
             │
    ┌────────▼─────────┐
    │   personalizer    │  (Gemini Pro — quality generation)
    └────────┬─────────┘
             │
           [END]
    """

    graph = StateGraph(PersonalizationState)

    # Add agent nodes
    graph.add_node("research_planner", research_planner)
    graph.add_node("company_researcher", company_researcher)
    graph.add_node("portfolio_rag", portfolio_rag)
    graph.add_node("validator", validator)
    graph.add_node("personalizer", personalizer)

    # Wire the pipeline
    graph.set_entry_point("research_planner")
    graph.add_edge("research_planner", "company_researcher")
    graph.add_edge("company_researcher", "portfolio_rag")
    graph.add_edge("portfolio_rag", "validator")
    graph.add_edge("validator", "personalizer")
    graph.add_edge("personalizer", END)

    return graph.compile()


# Compiled graph singleton
_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_personalization_graph()
    return _graph


async def run_personalization(
    email: str, role: str, company: str = ""
) -> PersonalizationState:
    """Execute the full personalization pipeline.

    This is the main entry point called by the /api/personalize router.
    It runs all 5 agents in sequence via LangGraph, with each agent
    using LangChain tools (MCP-compatible) as needed.
    """
    domain = email.split("@")[1] if "@" in email else ""
    personalization_id = f"p_{email}_{int(time.time())}"

    initial_state: PersonalizationState = {
        "email": email,
        "role": role,
        "company": company,
        "domain": domain,
        "personalization_id": personalization_id,
        "errors": [],
    }

    logger.info("▶ Starting personalization pipeline for %s", email)
    start = time.time()

    graph = get_graph()

    try:
        final_state = await graph.ainvoke(initial_state)
    except Exception as e:
        logger.error("Pipeline failed for %s: %s", email, e)
        raise e

    elapsed = time.time() - start
    logger.info(
        "✓ Personalization complete for %s in %.2fs (errors: %d)",
        email,
        elapsed,
        len(final_state.get("errors", [])),
    )
    return final_state
