"""
MCP Tool Server — exposes scraping, Qdrant, and Firestore tools
via Model Context Protocol for external agent access.

Run standalone: python -m mcp_tools.server
"""

import asyncio
import json
import sys
from pathlib import Path

# Ensure the project root is in the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from mcp.server.fastmcp import FastMCP
from services.scraper import get_scraper
from services.qdrant import get_qdrant
from services.portfolio_chunks import format_chunks_for_llm
from services.firestore import get_firestore

# Initialize MCP server
mcp = FastMCP("portfolio-tools", instructions="Tools for the Intelligent Portfolio personalization pipeline.")


# ── Scraping Tools ───────────────────────────────────────────────

@mcp.tool()
async def scrape_website(url: str) -> str:
    """Scrape a single website URL and return its cleaned text content.
    Use this to research a company's website, careers page, or blog.
    """
    scraper = get_scraper()
    result = await scraper.scrape_url(url)

    if result["status"] != "ok" or not result["text"]:
        return f"Failed to scrape {url} — page not accessible or empty."

    return f"TITLE: {result['title']}\n\nCONTENT:\n{result['text'][:4000]}"


@mcp.tool()
async def scrape_company(domain: str) -> str:
    """Scrape a company's website to gather information about them.
    Automatically tries homepage, /careers, /jobs, /blog, /about.
    """
    scraper = get_scraper()
    results = await scraper.scrape_company(domain)

    if not results:
        return f"Could not scrape any pages from {domain}."

    combined = "\n\n---\n\n".join(
        f"PAGE: {r['title']} ({r['url']})\n{r['text'][:2000]}"
        for r in results
    )
    return combined[:8000]


# ── Portfolio RAG Tools ──────────────────────────────────────────

@mcp.tool()
async def search_portfolio(query: str, top_k: int | None = None, project_slug: str | None = None) -> str:
    """Hybrid search over portfolio projects, skills, and experience.
    Results are diversified by project to avoid mixed-context retrieval.
    """
    qdrant = get_qdrant()
    chunks = await qdrant.search(
        query=query,
        use_case="tool",
        top_k=top_k,
        project_slug=project_slug,
    )

    if not chunks:
        return "No portfolio chunks found."

    return format_chunks_for_llm(chunks)


# ── Firestore Cache Tools ────────────────────────────────────────

@mcp.tool()
async def get_personalization_cache(email: str) -> str:
    """Check if a personalization result is cached for this email (24h TTL).
    Returns the cached JSON if found, or 'CACHE_MISS'.
    """
    firestore = get_firestore()
    cached = await firestore.get_personalization(email)

    if cached:
        return json.dumps(cached, default=str)
    return "CACHE_MISS"


@mcp.tool()
async def save_personalization_cache(email: str, data: str) -> str:
    """Save a personalization result to the cache for this email.
    Data must be a JSON string with personalization_id, visitor_profile, and website_config.
    """
    firestore = get_firestore()
    try:
        parsed = json.loads(data)
        await firestore.save_personalization(email, parsed)
        return "Saved to cache successfully."
    except json.JSONDecodeError:
        return "Error: data must be valid JSON."


# ── Run as standalone MCP server ─────────────────────────────────

if __name__ == "__main__":
    mcp.run(transport="stdio")
