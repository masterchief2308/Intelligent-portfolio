"""
Playwright-based web scraper for company research.
Scrapes website homepage, careers page, and blog.
"""

import logging
from typing import Optional

try:
    from playwright.async_api import async_playwright
except ImportError:
    async_playwright = None

logger = logging.getLogger(__name__)


class ScraperService:
    def __init__(self, timeout_ms: int = 5000):
        self._timeout_ms = timeout_ms
        self._browser = None
        self._playwright = None

    async def _ensure_browser(self):
        if self._browser is None:
            try:
                self._playwright = await async_playwright().start()
                self._browser = await self._playwright.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-dev-shm-usage"],
                )
                logger.info("Playwright browser launched")
            except Exception as e:
                logger.warning("Playwright unavailable: %s", e)

    async def scrape_url(self, url: str) -> dict[str, str]:
        """Scrape a single URL and return cleaned text content.
        Returns: {"url": ..., "title": ..., "text": ..., "status": "ok"|"error"}
        """
        await self._ensure_browser()

        if self._browser is None:
            return {"url": url, "title": "", "text": "", "status": "error"}

        try:
            page = await self._browser.new_page()
            await page.goto(url, timeout=self._timeout_ms, wait_until="domcontentloaded")

            title = await page.title()

            # Extract main text content, skip nav/footer/scripts
            text = await page.evaluate("""
                () => {
                    const selectors = ['main', 'article', '[role="main"]', '.content', '#content', 'body'];
                    for (const sel of selectors) {
                        const el = document.querySelector(sel);
                        if (el && el.innerText.trim().length > 100) {
                            return el.innerText.trim();
                        }
                    }
                    return document.body?.innerText?.trim() || '';
                }
            """)

            await page.close()
            return {"url": url, "title": title, "text": text, "status": "ok"}

        except Exception as e:
            logger.warning("Scrape failed for %s: %s", url, e)
            return {"url": url, "title": "", "text": "", "status": "error"}

    async def discover_links(self, domain: str) -> list[str]:
        """Visit homepage and extract unique internal links."""
        await self._ensure_browser()
        if self._browser is None:
            return []

        base_url = f"https://{domain}"
        try:
            page = await self._browser.new_page()
            await page.goto(base_url, timeout=self._timeout_ms, wait_until="domcontentloaded")
            
            links = await page.evaluate("""
                () => {
                    const anchors = Array.from(document.querySelectorAll('a[href]'));
                    const hrefs = anchors.map(a => a.href).filter(href => href.startsWith(window.location.origin));
                    return [...new Set(hrefs)];
                }
            """)
            await page.close()
            return links[:30]
        except Exception as e:
            logger.warning("Link discovery failed for %s: %s", domain, e)
            return [base_url]

    async def scrape_company(self, domain: str) -> list[dict[str, str]]:
        """DEPRECATED: Use discover_links + scrape_url instead.
        Scrape company website, careers page, and blog."""
        base_url = f"https://{domain}"
        urls = [
            base_url,
            f"{base_url}/careers",
            f"{base_url}/jobs",
            f"{base_url}/blog",
            f"{base_url}/about",
        ]

        results = []
        for url in urls:
            result = await self.scrape_url(url)
            if result["status"] == "ok" and result["text"]:
                results.append(result)

        return results

    async def close(self):
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        self._browser = None
        self._playwright = None


# Singleton
_instance: Optional[ScraperService] = None


def get_scraper(timeout_ms: int = 5000) -> ScraperService:
    global _instance
    if _instance is None:
        _instance = ScraperService(timeout_ms=timeout_ms)
    return _instance
