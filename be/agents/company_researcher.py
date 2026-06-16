"""
Agent 2: Company Researcher
Uses ChatGoogleGenerativeAI + scraping tools (LangChain @tool).
Gemini Flash call #2 — intelligently selects links and scrapes company pages.
"""

import json
import logging
from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage

from models.state import PersonalizationState
from services.gemini import get_flash_llm
from mcp_tools.tools import discover_links_tool, scrape_website
from config import get_settings

logger = logging.getLogger(__name__)


class CompanyData(BaseModel):
    """Structured output for company research."""
    company_name: str = Field(description="Official company name")
    industry: str = Field(description="e.g. AI/ML, Cloud, FinTech")
    tech_stack: list[str] = Field(default_factory=list, description="Technologies they use")
    open_roles: list[str] = Field(default_factory=list, description="Job titles hiring for")
    company_size: str = Field(default="Unknown", description="Startup, Mid-size, Enterprise")
    description: str = Field(default="", description="1-2 sentence summary")
    key_challenges: list[str] = Field(default_factory=list, description="Technical challenges")
    culture_values: list[str] = Field(default_factory=list, description="Company values")


class SelectedLinks(BaseModel):
    urls: list[str] = Field(description="URLs selected to scrape with highest probability of containing required info")


async def company_researcher(state: PersonalizationState) -> PersonalizationState:
    """Intelligently discover, select, and scrape company links."""
    research_plan = state.get("research_plan", {})
    domain = state.get("domain", "")
    
    if not domain:
        state["company_data"] = _empty_company_data(state)
        return state

    config = get_settings().scraping_config
    llm = get_flash_llm()

    # Step 1: Discover available links
    available_links = []
    try:
        links_json = await discover_links_tool.ainvoke({"domain": domain})
        available_links = json.loads(links_json) if links_json.startswith("[") else []
    except Exception as e:
        logger.warning("Discover links failed: %s", e)

    urls_to_scrape = [f"https://{domain}"]
    if available_links:
        # Step 2: Use LLM to select best links
        link_selector = llm.with_structured_output(SelectedLinks)
        max_links = config.max_links_to_scrape
        criteria = research_plan.get("link_selection_criteria", "")
        req_info = research_plan.get("required_information", [])
        
        prompt = (
            f"Available links on {domain}:\n{json.dumps(available_links, indent=2)}\n\n"
            f"Required Info: {req_info}\n"
            f"Criteria: {criteria}\n"
            f"Select up to {max_links} links that have the HIGHEST PROBABILITY of containing this info."
        )
        try:
            selection = await link_selector.ainvoke([HumanMessage(content=prompt)])
            urls_to_scrape = selection.urls[:max_links]
            if not urls_to_scrape:
                urls_to_scrape = [f"https://{domain}"]
        except Exception as e:
            logger.warning("Link selection failed: %s", e)

    # Step 3: Scrape selected links
    scraped_content = ""
    scraped_pages = []
    for url in urls_to_scrape:
        try:
            result = await scrape_website.ainvoke({"url": url})
            if "Failed to scrape" not in result:
                scraped_content += f"\n\n---\n\n{result}"
                scraped_pages.append({"url": url, "status": "ok"})
        except Exception as e:
            logger.warning("Scrape tool failed for %s: %s", url, e)

    state["scraped_pages"] = scraped_pages

    if not scraped_content:
        state["company_data"] = _empty_company_data(state)
        return state

    # Step 4: Token Truncation based on Importance Level
    importance = research_plan.get("importance_level", "medium").lower()
    budget_tokens = config.importance_budgets.get(importance, config.importance_budgets.get("medium", 8000))
    
    # Global LLM Call Limit check (leave room for prompt)
    budget_tokens = min(budget_tokens, config.global_llm_call_limit - 2000)
    
    # Rough approximation: 1 token ≈ 4 characters
    char_limit = budget_tokens * 4
    if len(scraped_content) > char_limit:
        scraped_content = scraped_content[:char_limit] + "\n...[TRUNCATED TO BUDGET]"

    # Step 5: Parse scraped content with structured LLM output
    structured_llm = llm.with_structured_output(CompanyData)
    messages = [
        SystemMessage(content=(
            "You are analyzing a company website. Extract structured information "
            "from the scraped content. Be factual — only include what you can "
            "verify from the text. If something isn't mentioned, leave it empty."
        )),
        HumanMessage(content=(
            f"Domain: {domain}\n\n"
            f"SCRAPED CONTENT:\n{scraped_content}"
        )),
    ]

    try:
        result: CompanyData = await structured_llm.ainvoke(messages)
        state["company_data"] = result.model_dump()
        logger.info("Company research complete: %s", result.company_name)
    except Exception as e:
        logger.error("Company researcher LLM failed: %s", e)
        state["company_data"] = _empty_company_data(state)
        state.setdefault("errors", []).append(f"company_researcher: {e}")

    return state


def _empty_company_data(state: PersonalizationState) -> dict:
    return {
        "company_name": state.get("company", state.get("domain", "Unknown")),
        "industry": "Unknown",
        "tech_stack": [],
        "open_roles": [],
        "company_size": "Unknown",
        "description": "",
        "key_challenges": [],
        "culture_values": [],
    }
