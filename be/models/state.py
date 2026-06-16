from typing import TypedDict, Optional, Any


class PersonalizationState(TypedDict, total=False):
    """Shared state flowing through the LangGraph agent pipeline."""

    # Input
    email: str
    role: str
    company: Optional[str]
    domain: str

    # Agent 1: Research Planner output
    research_plan: dict[str, Any]

    # Agent 2: Company Researcher output
    company_data: dict[str, Any]
    scraped_pages: list[dict[str, str]]

    # Agent 3: Portfolio RAG output
    portfolio_chunks: list[dict[str, Any]]

    # Agent 4: Validator output
    validation_score: float
    visitor_profile: dict[str, Any]

    # Agent 5: Personalizer output
    website_config: dict[str, Any]

    # Metadata
    personalization_id: str
    errors: list[str]
