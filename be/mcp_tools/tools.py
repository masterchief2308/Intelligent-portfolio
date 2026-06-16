"""
LangChain tool definitions.
These are used directly by LangGraph agents AND exposed via the MCP server.
"""

import json
from langchain_core.tools import tool
from services.scraper import get_scraper
from services.qdrant import get_qdrant
from services.firestore import get_firestore


# ── Scraping Tools ───────────────────────────────────────────────

@tool
async def scrape_website(url: str) -> str:
    """Scrape a single website URL and return its cleaned text content.
    Use this to research a company's website, careers page, or blog.
    Returns the page title and main text content.
    """
    scraper = get_scraper()
    result = await scraper.scrape_url(url)

    if result["status"] != "ok" or not result["text"]:
        return f"Failed to scrape {url} — page not accessible or empty."

    return f"TITLE: {result['title']}\n\nCONTENT:\n{result['text']}"


@tool
async def scrape_company(domain: str) -> str:
    """Scrape a company's website to gather information about them.
    Automatically tries homepage, /careers, /jobs, /blog, /about.
    Returns combined text from all accessible pages.
    """
    scraper = get_scraper()
    results = await scraper.scrape_company(domain)

    if not results:
        return f"Could not scrape any pages from {domain}."

    combined = "\n\n---\n\n".join(
        f"PAGE: {r['title']} ({r['url']})\n{r['text']}"
        for r in results
    )
    return combined

@tool
async def discover_links_tool(domain: str) -> str:
    """Discover available internal links on a company's homepage.
    Returns a JSON list of URLs.
    """
    scraper = get_scraper()
    links = await scraper.discover_links(domain)
    if not links:
        return "No links discovered."
    return json.dumps(links)


# ── Portfolio RAG Tools ──────────────────────────────────────────

@tool
async def search_portfolio(query: str, top_k: int = 5) -> str:
    """Search the portfolio vector database for relevant projects, skills,
    and experience. Use this to find portfolio evidence that matches a
    visitor's background or interests.
    Returns ranked chunks with relevance scores.
    """
    qdrant = get_qdrant()
    chunks = await qdrant.search(query=query, top_k=top_k)

    if not chunks:
        return "No portfolio chunks found. Qdrant may not be available or the collection is empty."

    result_lines = []
    for i, chunk in enumerate(chunks, 1):
        result_lines.append(
            f"[{i}] (score: {chunk['score']:.3f}) "
            f"[{chunk['doc_type']}:{chunk['doc_id']}]\n"
            f"{chunk['text'][:500]}"
        )

    return "\n\n".join(result_lines)


# ── Firestore Cache Tools ────────────────────────────────────────

@tool
async def get_personalization_cache(email: str) -> str:
    """Check if a personalization result is already cached for this email.
    Returns the cached JSON if found (within 24h), or 'CACHE_MISS' if not.
    """
    firestore = get_firestore()
    cached = await firestore.get_personalization(email)

    if cached:
        return json.dumps(cached, default=str)
    return "CACHE_MISS"


@tool
async def save_personalization_cache(email: str, data: str) -> str:
    """Save a personalization result to the cache for this email.
    Data should be a JSON string with personalization_id, visitor_profile, and website_config.
    """
    firestore = get_firestore()
    try:
        parsed = json.loads(data)
        await firestore.save_personalization(email, parsed)
        return "Saved to cache successfully."
    except json.JSONDecodeError:
        return "Error: data must be valid JSON."


# ── Tool Collections ─────────────────────────────────────────────

def get_scraping_tools():
    """Tools for the Company Researcher agent."""
    return [scrape_website, scrape_company, discover_links_tool]


def get_rag_tools():
    """Tools for the Portfolio RAG agent."""
    return [search_portfolio]


def get_cache_tools():
    """Tools for cache operations."""
    return [get_personalization_cache, save_personalization_cache]


def get_all_tools():
    """All available tools."""
    return [
        scrape_website,
        scrape_company,
        discover_links_tool,
        search_portfolio,
        get_personalization_cache,
        save_personalization_cache,
    ]
