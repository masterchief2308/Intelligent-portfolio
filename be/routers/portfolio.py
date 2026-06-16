"""GET /api/portfolio — Return static portfolio data."""

import json
import logging
from pathlib import Path
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter()

_portfolio_data = None


def _load_portfolio() -> dict:
    global _portfolio_data
    if _portfolio_data is None:
        data_path = Path(__file__).parent.parent / "data" / "portfolio.json"
        if data_path.exists():
            _portfolio_data = json.loads(data_path.read_text(encoding="utf-8"))
        else:
            logger.warning("portfolio.json not found at %s", data_path)
            _portfolio_data = {}
    return _portfolio_data


@router.get("/api/portfolio")
async def get_portfolio():
    """Return the complete portfolio/resume data. Cached on first load."""
    return _load_portfolio()
