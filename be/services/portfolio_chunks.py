"""
Canonical portfolio chunking for Qdrant ingestion.
Each chunk carries project-scoped metadata so retrieval can filter and diversify by project.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any


def _chunk_id(*parts: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "|".join(parts)))


def _prefix(metadata: dict[str, Any], body: str) -> str:
    """Prefix embed text with structured tags — improves BM25 sparse retrieval."""
    tags = []
    if metadata.get("project_slug"):
        tags.append(f"project:{metadata['project_slug']}")
    if metadata.get("project_title"):
        tags.append(f"title:{metadata['project_title']}")
    if metadata.get("section"):
        tags.append(f"section:{metadata['section']}")
    if metadata.get("doc_type"):
        tags.append(f"type:{metadata['doc_type']}")
    if metadata.get("client"):
        tags.append(f"client:{metadata['client']}")
    header = " | ".join(tags)
    return f"[{header}]\n{body}" if header else body


def build_portfolio_chunks(portfolio: dict[str, Any]) -> list[dict[str, Any]]:
    """Return [{id, text, metadata}, ...] ready for Qdrant upsert."""
    chunks: list[dict[str, Any]] = []

    basics = portfolio.get("basics", {})
    if basics.get("summary"):
        meta = {
            "doc_type": "basics",
            "doc_id": "profile",
            "section": "summary",
            "keywords": ["profile", "summary", basics.get("label", "")],
        }
        text = _prefix(
            meta,
            f"Name: {basics.get('name')}\nRole: {basics.get('label')}\nSummary: {basics.get('summary')}",
        )
        chunks.append({"id": _chunk_id("basics", "profile"), "text": text, "metadata": meta})

    for category, skill_list in portfolio.get("skills", {}).items():
        meta = {
            "doc_type": "skills",
            "doc_id": category,
            "section": category,
            "keywords": skill_list[:8],
        }
        text = _prefix(
            meta,
            f"{category.replace('_', ' ').title()} Skills: {', '.join(skill_list)}",
        )
        chunks.append({"id": _chunk_id("skills", category), "text": text, "metadata": meta})

    for exp in portfolio.get("experience", []):
        company_id = exp.get("company", "").lower().replace(" ", "_")
        meta = {
            "doc_type": "experience",
            "doc_id": company_id,
            "section": "highlights",
            "company": exp.get("company"),
            "keywords": [exp.get("role", ""), exp.get("company", "")],
        }
        highlights = "\n".join(f"- {h}" for h in exp.get("highlights", []))
        text = _prefix(
            meta,
            f"Role: {exp.get('role')} at {exp.get('company')} ({exp.get('startDate')} - {exp.get('endDate')})\n"
            f"Highlights:\n{highlights}",
        )
        chunks.append({"id": _chunk_id("experience", company_id), "text": text, "metadata": meta})

    for proj in portfolio.get("projects", []):
        slug = proj.get("id", "")
        base = {
            "doc_type": "project",
            "doc_id": slug,
            "project_slug": slug,
            "project_title": proj.get("title"),
            "client": proj.get("client"),
            "company": proj.get("company"),
            "cloud": proj.get("cloud"),
            "tech_stack": proj.get("techStack", []),
        }

        sections = [
            (
                "context",
                f"Project: {proj.get('title')} for {proj.get('client')}\n"
                f"Metric: {proj.get('metric')}\nContext: {proj.get('context')}",
                ["context", proj.get("client", ""), proj.get("cloud", "")],
            ),
            (
                "architecture",
                f"Project Architecture ({proj.get('title')}): {proj.get('howItWorks')}",
                proj.get("techStack", [])[:8],
            ),
            (
                "roi",
                f"Project ROI & Impact ({proj.get('title')}):\n"
                + "\n".join(f"- {r}" for r in proj.get("roi", [])),
                ["roi", "impact", proj.get("metric", "")],
            ),
            (
                "tech_stack",
                f"Project Tech Stack ({proj.get('title')}): {', '.join(proj.get('techStack', []))}",
                proj.get("techStack", []),
            ),
        ]

        for section, body, keywords in sections:
            meta = {**base, "section": section, "keywords": keywords}
            chunks.append(
                {
                    "id": _chunk_id("project", slug, section),
                    "text": _prefix(meta, body),
                    "metadata": meta,
                }
            )

    return chunks


def chunk_resume_text(resume_text: str, chunk_size: int = 200, overlap: int = 50) -> list[dict[str, Any]]:
    words = resume_text.split()
    chunks: list[dict[str, Any]] = []
    idx = 0
    for i in range(0, len(words), chunk_size - overlap):
        body = " ".join(words[i : i + chunk_size])
        if not body.strip():
            continue
        meta = {
            "doc_type": "resume",
            "doc_id": f"resume_chunk_{idx}",
            "section": "resume",
            "keywords": ["resume", "cv"],
        }
        chunks.append(
            {
                "id": _chunk_id("resume", str(idx), body[:80]),
                "text": _prefix(meta, body),
                "metadata": meta,
            }
        )
        idx += 1
    return chunks


def load_portfolio_chunks(portfolio_path: Path | None = None) -> list[dict[str, Any]]:
    path = portfolio_path or Path(__file__).parent.parent / "data" / "portfolio.json"
    portfolio = json.loads(path.read_text(encoding="utf-8"))
    return build_portfolio_chunks(portfolio)


def format_chunks_for_llm(chunks: list[dict[str, Any]], max_chars: int = 600) -> str:
    """Group retrieved chunks by project for clearer LLM context."""
    if not chunks:
        return "No portfolio evidence retrieved."

    by_project: dict[str, list[dict[str, Any]]] = {}
    other: list[dict[str, Any]] = []

    for chunk in chunks:
        slug = chunk.get("project_slug") or chunk.get("doc_id")
        if chunk.get("doc_type") == "project" and slug:
            by_project.setdefault(slug, []).append(chunk)
        else:
            other.append(chunk)

    lines: list[str] = []
    for slug, project_chunks in by_project.items():
        title = project_chunks[0].get("project_title") or slug
        lines.append(f"## Project: {title} ({slug})")
        for c in project_chunks:
            section = c.get("section", "general")
            score = c.get("score", 0.0)
            lines.append(f"  [{section}] (score={score:.3f}) {c.get('text', '')[:max_chars]}")

    if other:
        lines.append("## General portfolio context")
        for c in other:
            doc_type = c.get("doc_type", "unknown")
            doc_id = c.get("doc_id", "")
            score = c.get("score", 0.0)
            lines.append(f"  [{doc_type}:{doc_id}] (score={score:.3f}) {c.get('text', '')[:max_chars]}")

    return "\n".join(lines)
