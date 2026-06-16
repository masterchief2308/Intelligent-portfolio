from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ── Configuration & Token Management ─────────────────────────────

class ScrapeTokenConfig(BaseModel):
    global_llm_call_limit: int = 50_000
    max_links_to_scrape: int = 2
    importance_budgets: dict[str, int] = {
        "high": 15_000,
        "medium": 8_000,
        "low": 3_000
    }

# ── Personalization ──────────────────────────────────────────────

class PersonalizeRequest(BaseModel):
    email: str
    role: str
    company: Optional[str] = None


class HeroConfig(BaseModel):
    intro: str
    subheading: Optional[str] = None
    cta_text: Optional[str] = None


class FeaturedProject(BaseModel):
    id: str
    title: str
    highlight: Optional[str] = None
    metrics: Optional[list[str]] = None
    why_relevant: str
    metric: Optional[str] = None


class SkillPriority(BaseModel):
    skill: str
    priority: int
    proof: Optional[str] = None


class JourneyHighlight(BaseModel):
    milestone: str
    relevance: str


class ChatContext(BaseModel):
    opener: str
    focus_areas: Optional[list[str]] = None
    avoid: Optional[list[str]] = None


class WebsiteConfig(BaseModel):
    hero: HeroConfig
    featured_projects: list[FeaturedProject] = []
    skills_priority: list[SkillPriority] = []
    journey_highlights: list[JourneyHighlight] = []
    chat_context: ChatContext
    suggested_queries: list[str] = []


class VisitorProfile(BaseModel):
    email: Optional[str] = None
    domain: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    current_company: Optional[str] = None
    years_experience: Optional[int] = None
    skills: Optional[list[str]] = None
    seniority: Optional[str] = None
    hiring_for: Optional[list[str]] = None


class PersonalizeResponse(BaseModel):
    personalization_id: str
    visitor_profile: VisitorProfile
    website_config: WebsiteConfig


# ── Chat ─────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: str
    personalization_id: str
    visitor_profile: Optional[VisitorProfile] = None
    website_config: Optional[WebsiteConfig] = None


class ChatSource(BaseModel):
    project: str
    section: str


class ChatResponse(BaseModel):
    response: str
    sources: list[ChatSource] = []
    suggested_followups: list[str] = []


# ── Analytics ────────────────────────────────────────────────────

class VisitRequest(BaseModel):
    email: str
    role: str
    company: Optional[str] = None
    timestamp: str
    referrer: Optional[str] = None
    user_agent: Optional[str] = None


class AnalyticsDashboard(BaseModel):
    total_visitors: int = 0
    visitors_this_week: int = 0
    by_role: dict[str, int] = {}
    recent_visitors: list[dict] = []
    top_projects_viewed: list[dict] = []


# ── Admin ────────────────────────────────────────────────────────

class AdminAuthRequest(BaseModel):
    passphrase: str


class AdminAuthResponse(BaseModel):
    token: str
    expires_at: str


class RagPrompt(BaseModel):
    id: str
    name: str
    template: str
    model: str = "gemini-2.5-flash"
    temperature: float = 0.7
    max_tokens: int = 1024
    description: str = ""
    updated_at: Optional[str] = None


class AdminConfig(BaseModel):
    scraping_timeout_ms: int = 5000
    fallback_enabled: bool = True
    api_keys: dict[str, str] = {}
    backend_version: str = "0.1.0"
    last_sync: Optional[str] = None
    rag_prompts: list[RagPrompt] = []


class AdminConfigUpdate(BaseModel):
    scraping_timeout_ms: Optional[int] = None
    fallback_enabled: Optional[bool] = None
    rag_prompts: Optional[list[RagPrompt]] = None
