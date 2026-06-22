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
    │   personalizer    │  (Gemini Flash — swapped from Pro to fix 180s timeouts)
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


async def run_personalization_stream(
    email: str, role: str, company: str = ""
):
    """Execute the pipeline and yield server-sent events (SSE)."""
    import json
    
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

    logger.info("▶ Starting personalization stream for %s", email)
    start = time.time()
    graph = get_graph()

    msg_map = {
        "research_planner": {
            "running": "Research Planner defining intelligence strategy...",
            "done": "Research Planner defined intelligence strategy...",
            "calls": 1,
        },
        "company_researcher": {
            "running": "Company Researcher analyzing technical footprint...",
            "done": "Company Researcher analyzed technical footprint...",
            "calls": 3,
        },
        "portfolio_rag": {
            "running": "Portfolio Engine locating semantic matches...",
            "done": "Portfolio Engine located semantic matches...",
            "calls": 3,
        },
        "validator": {
            "running": "Validator scoring strategic alignment...",
            "done": "Validator scored strategic alignment...",
            "calls": 4,
        },
        "personalizer": {
            "running": "Executive Synthesis finalizing blueprints...",
            "done": "Executive Synthesis finalized blueprints...",
            "calls": 5,
        },
    }
    node_order = list(msg_map.keys())

    try:
        current_state = initial_state.copy()
        first = msg_map[node_order[0]]
        yield f"data: {json.dumps({'type': 'step', 'id': node_order[0], 'label': first['running'], 'status': 'running'})}\n\n"

        async for event in graph.astream(initial_state, stream_mode="updates"):
            for node_name, state_updates in event.items():
                logger.info("Completed node: %s", node_name)

                if isinstance(state_updates, dict):
                    for k, v in state_updates.items():
                        if k == "errors":
                            current_state["errors"].extend(v)
                        else:
                            current_state[k] = v

                step_info = msg_map.get(node_name, {"running": f"Running {node_name}...", "done": f"Completed {node_name}...", "calls": 0})
                yield f"data: {json.dumps({'type': 'step', 'id': node_name, 'label': step_info['done'], 'status': 'done', 'api_calls': step_info['calls']})}\n\n"

                next_idx = node_order.index(node_name) + 1 if node_name in node_order else -1
                if 0 <= next_idx < len(node_order):
                    next_node = node_order[next_idx]
                    next_info = msg_map[next_node]
                    yield f"data: {json.dumps({'type': 'step', 'id': next_node, 'label': next_info['running'], 'status': 'running'})}\n\n"
                
        # Pipeline finished, yield final result
        final_payload = {
            "result": {
                "personalization_id": current_state.get("personalization_id", ""),
                "visitor_profile": current_state.get("visitor_profile", {}),
                "website_config": current_state.get("website_config", {}),
            }
        }
        yield f"data: {json.dumps(final_payload)}\n\n"

    except Exception as e:
        logger.error("Pipeline stream failed for %s: %s", email, e)
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

