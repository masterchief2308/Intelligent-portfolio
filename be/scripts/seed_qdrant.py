"""
Script to permanently seed Qdrant with portfolio data and resume embeddings.

Deletes the existing collection and re-seeds from scratch:

    python scripts/seed_qdrant.py

Requires QDRANT_URL and QDRANT_API_KEY in be/.env (or environment).
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.append(str(Path(__file__).parent.parent))

import PyPDF2

from services.portfolio_chunks import chunk_resume_text, load_portfolio_chunks
from services.qdrant import get_qdrant

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

load_dotenv(Path(__file__).parent.parent / ".env")


def extract_pdf_text(pdf_path: Path) -> str:
    if not pdf_path.exists():
        logger.warning("Resume PDF not found at %s", pdf_path)
        return ""
    text = ""
    try:
        with open(pdf_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        logger.error("Failed to read PDF: %s", e)
        return ""


def _resume_paths() -> list[Path]:
    root = Path(__file__).parent.parent
    return [
        root / "data" / "Aditya_katkar_resume.pdf",
        root.parent / "Aditya_katkar_resume.pdf",
    ]


async def seed():
    qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key = os.getenv("QDRANT_API_KEY", "")
    collection = os.getenv("QDRANT_COLLECTION", "portfolio")

    logger.info("Connecting to Qdrant at %s", qdrant_url)
    qdrant = get_qdrant(
        url=qdrant_url,
        api_key=qdrant_api_key,
        collection=collection,
        force_new=True,
    )

    logger.info("Deleting existing collection and recreating hybrid index...")
    qdrant.recreate_collection()

    chunks = load_portfolio_chunks()
    logger.info("Built %d portfolio chunks with project-scoped metadata", len(chunks))

    resume_text = ""
    for path in _resume_paths():
        resume_text = extract_pdf_text(path)
        if resume_text:
            logger.info("Loaded resume from %s", path)
            break

    if resume_text:
        resume_chunks = chunk_resume_text(resume_text)
        chunks.extend(resume_chunks)
        logger.info("Added %d resume chunks", len(resume_chunks))

    if not chunks:
        logger.warning("No data found to seed.")
        return

    batch_size = 25
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        qdrant.upsert_chunks(batch)
        logger.info(
            "Upserted batch %d/%d",
            i // batch_size + 1,
            (len(chunks) + batch_size - 1) // batch_size,
        )

    logger.info("Seeding complete (%d total chunks).", len(chunks))


if __name__ == "__main__":
    asyncio.run(seed())
