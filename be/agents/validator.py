"""
Agent 4: Validator
Uses ChatGoogleGenerativeAI with structured output.
Gemini Flash call #3 — scores confidence and builds visitor profile.
Cost: ~$0.00075 | No tools needed (pure reasoning).
"""

import logging
from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage

from models.state import PersonalizationState
from services.gemini import get_flash_llm

logger = logging.getLogger(__name__)


class VisitorProfileOutput(BaseModel):
    """Structured visitor profile."""
    email: str = Field(description="Visitor email")
    domain: str = Field(default="", description="Email domain")
    name: str | None = Field(default=None, description="Inferred name")
    role: str = Field(description="Visitor role")
    current_company: str = Field(default="", description="Company name")
    years_experience: int | None = Field(default=None, description="Years of experience")
    skills: list[str] = Field(default_factory=list, description="Known skills")
    seniority: str | None = Field(default=None, description="junior|mid|senior|lead|manager")
    hiring_for: list[str] = Field(default_factory=list, description="Roles they're hiring for")


class ValidationResult(BaseModel):
    """Structured validation output."""
    validation_score: float = Field(description="Confidence score 0.0-1.0")
    visitor_profile: VisitorProfileOutput
    confidence_reasons: list[str] = Field(default_factory=list, description="Why this score")


async def validator(state: PersonalizationState) -> PersonalizationState:
    """Validate research quality and build visitor profile with structured output."""
    email = state.get("email", "")
    role = state.get("role", "")
    company = state.get("company", "")
    domain = state.get("domain", "")
    company_data = state.get("company_data", {})
    scraped_pages = state.get("scraped_pages", [])

    llm = get_flash_llm(temperature=0.0)
    structured_llm = llm.with_structured_output(ValidationResult)

    messages = [
        SystemMessage(content=(
            "You are validating research results for a portfolio personalization system. "
            "Score the confidence of the company research (0.0 to 1.0) and build a "
            "structured visitor profile. Be conservative with your score — only give "
            "high scores when you have rich, verified data."
        )),
        HumanMessage(content=(
            f"Visitor email: {email}\n"
            f"Role: {role}\n"
            f"Company (from form): {company or 'Not provided'}\n"
            f"Domain: {domain}\n"
            f"Pages scraped: {len(scraped_pages)}\n\n"
            f"Company research results:\n{company_data}\n\n"
            f"Score the confidence and build the visitor profile."
        )),
    ]

    try:
        result: ValidationResult = await structured_llm.ainvoke(messages)
        state["validation_score"] = result.validation_score
        state["visitor_profile"] = result.visitor_profile.model_dump()
        logger.info("Validation: score=%.2f for %s", result.validation_score, email)
    except Exception as e:
        logger.error("Validator failed: %s", e)
        state["validation_score"] = 0.3
        state["visitor_profile"] = {
            "email": email,
            "domain": domain,
            "role": role,
            "current_company": company or domain,
        }
        state.setdefault("errors", []).append(f"validator: {e}")

    return state
