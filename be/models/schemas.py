from pydantic import Field
from pydantic import BaseModel
from typing import Optional, Literal
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


class TimelineItem(BaseModel):
    type: Literal["experience", "education"]
    role: str
    company: str
    startDate: str
    endDate: str
    location: Optional[str] = None
    highlights: list[str]
    relevance: Optional[str] = None


class ChatContext(BaseModel):
    opener: str
    focus_areas: Optional[list[str]] = None
    avoid: Optional[list[str]] = None


class WebsiteConfig(BaseModel):
    hero: HeroConfig
    featured_projects: list[FeaturedProject] = []
    skills_priority: list[SkillPriority] = []
    journey_highlights: list[JourneyHighlight] = []  # Deprecated in favor of timeline
    timeline: list[TimelineItem] = []
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
    project_slug: Optional[str] = Field(
        default=None,
        description="Optional project slug to scope RAG retrieval (e.g. iocl-tender-evaluation)",
    )


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


# ── Dynamic Generation ───────────────────────────────────────────

class DynamicProjectConfig(BaseModel):
    id: str
    title: str
    client: str
    date: str
    cloud: str
    metric: str
    context: str = Field(description="The business context or problem statement, rewritten to emphasize aspects relevant to the visitor's industry or role.")
    howItWorks: str = Field(description="The technical implementation details, customized to highlight tools/architecture the visitor cares about.")
    roi: list[str] = Field(description="A list of 3-4 bullet points detailing ROI, tailored to what the visitor values (e.g. cost savings for business, latency for engineers).")
    techStack: list[str] = Field(description="The core technologies used in the project.")


class ArchitectureNode(BaseModel):
    id: str = Field(description="Unique lowercase ID for the node")
    type: str = Field(description="Must be 'custom' for regular nodes or 'group' for a bounding box container")
    label: str = Field(description="Display text for the node")
    badge: Optional[str] = Field(default=None, description="Short tag (e.g. 'RUN', 'DB', 'GCP')")
    isExternal: Optional[bool] = Field(default=False, description="True if it represents a user/external actor")
    parentId: Optional[str] = Field(default=None, description="ID of the group node this node belongs inside")
    layer: Optional[int] = Field(
        default=None,
        ge=0,
        le=4,
        description="Optional vertical ordering hint for the FE layout engine: 0=external, 1=frontend, 2=API/compute, 3=workers, 4=data/storage. Do NOT output x/y/width/height.",
    )


class ArchitectureEdge(BaseModel):
    source: str = Field(description="ID of the source node")
    target: str = Field(description="ID of the target node")
    animated: Optional[bool] = Field(default=True, description="Whether the edge should animate")
    label: Optional[str] = Field(default=None, description="Text label to display on the edge")
    dashed: Optional[bool] = Field(default=False, description="Whether the edge should be dashed (typically for DB/Storage)")
    sourceHandle: Optional[str] = Field(default=None, description="React Flow source handle id (e.g. 's-bottom', 's-right')")
    targetHandle: Optional[str] = Field(default=None, description="React Flow target handle id (e.g. 't-top', 't-left')")


class DynamicArchitectureConfig(BaseModel):
    slug: str
    nodes: list[ArchitectureNode]
    edges: list[ArchitectureEdge]


class DynamicExperienceConfig(BaseModel):
    company: str
    location: str
    role: str
    startDate: str
    endDate: str
    highlights: list[str] = Field(description="List of 4-6 detailed bullet points highlighting achievements, metrics, and technical contributions specifically tailored to impress the visitor.")


class DynamicEducationConfig(BaseModel):
    institution: str
    degree: str
    startDate: str
    endDate: str
    cgpa: str = Field(description="CGPA or academic achievements rewritten to emphasize analytical or relevant coursework.")


class DynamicProjectGraphConfig(BaseModel):
    id: str = Field(description="Project ID (must exactly match the original)")
    title: str = Field(description="Project title, slightly tailored if needed")
    cloud: str = Field(description="Cloud provider used")
    techStack: list[str] = Field(description="List of technologies used in the project, prioritized or customized for the visitor's tech interests")


class DynamicPortfolioConfig(BaseModel):
    experience: list[DynamicExperienceConfig]
    education: list[DynamicEducationConfig]
    projects: list[DynamicProjectGraphConfig]
