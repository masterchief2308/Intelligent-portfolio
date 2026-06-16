"""
Agent 1: Research Planner
Uses ChatGoogleGenerativeAI with structured output.
Gemini Flash call #1 — plans what to research about the visitor.
Cost: ~$0.00075 | No tools needed (pure reasoning).
"""

import logging
from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage

from models.state import PersonalizationState
from services.gemini import get_flash_llm

logger = logging.getLogger(__name__)


class ResearchPlan(BaseModel):
    """Structured output for research planning."""
    company_name: str = Field(description="Detected company name")
    company_domain: str = Field(description="Company domain from email")
    link_selection_criteria: str = Field(description="Instructions on what links are relevant to our website's needs")
    required_information: list[str] = Field(description="Specific data points absolutely necessary to extract (e.g., Tech Stack, Values)")
    importance_level: str = Field(description="Importance of this information to our website (high, medium, low)")
    research_focus: list[str] = Field(description="What to look for during research")
    visitor_intent: str = Field(description="What this visitor likely wants")
    portfolio_query: str = Field(description="Search query for relevant portfolio projects")


async def research_planner(state: PersonalizationState) -> PersonalizationState:
    """Analyze the visitor's email and plan research strategy using structured output."""
    email = state["email"]
    domain = state.get("domain", "")
    role = state.get("role", "")
    company = state.get("company", "")

    llm = get_flash_llm()
    structured_llm = llm.with_structured_output(ResearchPlan)

    messages = [
        SystemMessage(content=(
            "You are a research planner for a portfolio personalization system. "
            "Given visitor info, plan what to research about their company. "
            "Define the link selection criteria to find the absolute most relevant pages. "
            "Assign an 'importance_level' (high/medium/low) based strictly on how "
            "important this information is for OUR portfolio's personalization goals, "
            "not the user's status. Tech stack/engineering challenges = 'high'. "
            "Basic company size/culture = 'low' or 'medium'."
        )),
        HumanMessage(content=(
            f"Visitor email: {email}\n"
            f"Domain: {domain}\n"
            f"Role: {role}\n"
            f"Company: {company or 'Unknown'}\n\n"
            f"Plan the research strategy. Define exact information required and its importance."
        )),
    ]

    try:
        result: ResearchPlan = await structured_llm.ainvoke(messages)
        state["research_plan"] = result.model_dump()
        logger.info("Research plan created for %s → %s", email, result.company_name)
    except Exception as e:
        logger.error("Research planner failed: %s", e)
        state["research_plan"] = {
            "company_name": company or domain,
            "company_domain": domain,
            "link_selection_criteria": "Find technical blogs or career pages to identify stack",
            "required_information": ["tech stack", "open roles", "industry"],
            "importance_level": "medium",
            "research_focus": ["tech stack", "open roles", "industry"],
            "visitor_intent": f"Visitor is a {role}, evaluating technical skills",
            "portfolio_query": f"{role} relevant projects cloud infrastructure AI",
        }
        state.setdefault("errors", []).append(f"research_planner: {e}")

    return state
