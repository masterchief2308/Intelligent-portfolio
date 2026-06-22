"""
Per-workflow Qdrant retrieval settings.

Different jobs need different trade-offs:
- chat: narrow, fast, 1-2 chunks per project
- personalization: broad coverage across all projects for the personalizer LLM
- resume_compare: project sections only, more chunks per project for scoring
- tool: balanced default for agent tool calls

Global QDRANT_* env vars in config.py override the `default` profile only.
Explicit kwargs to qdrant.search() always win over profile defaults.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

RetrievalUseCase = Literal["chat", "personalization", "resume_compare", "tool", "default"]


@dataclass(frozen=True)
class RetrievalProfile:
    top_k: int
    fetch_k: int
    score_threshold: float = 0.0
    max_per_project: int = 2
    doc_type: str | None = None


# fetch_k should be ~3× top_k so RRF has enough candidates before diversification
PROFILES: dict[RetrievalUseCase, RetrievalProfile] = {
    # User question → concise, mixed portfolio context
    "chat": RetrievalProfile(
        top_k=6,
        fetch_k=18,
        max_per_project=2,
    ),
    # Personalizer must see evidence from every featured project
    "personalization": RetrievalProfile(
        top_k=12,
        fetch_k=36,
        max_per_project=3,
    ),
    # Compare resume against each project in depth
    "resume_compare": RetrievalProfile(
        top_k=10,
        fetch_k=30,
        max_per_project=4,
        doc_type="project",
    ),
    # LangChain / MCP tool — caller may pass top_k override
    "tool": RetrievalProfile(
        top_k=8,
        fetch_k=24,
        max_per_project=2,
    ),
    "default": RetrievalProfile(
        top_k=8,
        fetch_k=24,
        max_per_project=2,
    ),
}


def get_retrieval_profile(use_case: RetrievalUseCase = "default") -> RetrievalProfile:
    """Return profile for a workflow, applying global env overrides on `default` only."""
    from config import get_settings

    settings = get_settings()
    base = PROFILES.get(use_case, PROFILES["default"])

    if use_case != "default":
        return base

    return RetrievalProfile(
        top_k=settings.QDRANT_TOP_K,
        fetch_k=settings.QDRANT_FETCH_K,
        score_threshold=settings.QDRANT_SCORE_THRESHOLD,
        max_per_project=settings.QDRANT_MAX_CHUNKS_PER_PROJECT,
        doc_type=base.doc_type,
    )
