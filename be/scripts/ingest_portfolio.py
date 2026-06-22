"""
Script to chunk and ingest portfolio.json into Qdrant.
Run: python scripts/ingest_portfolio.py
"""

import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.portfolio_chunks import build_portfolio_chunks
from services.qdrant import get_qdrant

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    path = Path(__file__).parent.parent / "data" / "portfolio.json"
    if not path.exists():
        logger.error("portfolio.json not found")
        sys.exit(1)

    portfolio = json.loads(path.read_text(encoding="utf-8"))
    chunks = build_portfolio_chunks(portfolio)
    logger.info("Generated %d project-scoped chunks", len(chunks))

    qdrant = get_qdrant()
    qdrant.ensure_collection()
    qdrant.upsert_chunks(chunks)
    logger.info("Ingestion complete!")


if __name__ == "__main__":
    main()
