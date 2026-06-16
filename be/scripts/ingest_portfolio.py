"""
Script to chunk and ingest portfolio.json into Qdrant.
Run this once to populate the vector database.
"""

import json
import logging
import sys
from pathlib import Path

# Ensure project root is in path
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.qdrant import get_qdrant

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def load_portfolio() -> dict:
    path = Path(__file__).parent.parent / "data" / "portfolio.json"
    if not path.exists():
        logger.error("portfolio.json not found")
        sys.exit(1)
    return json.loads(path.read_text(encoding="utf-8"))


def chunk_portfolio(data: dict) -> list[dict]:
    """Chunk portfolio data into embeddable segments."""
    chunks = []
    chunk_id = 1

    # 1. Basics summary
    basics = data.get("basics", {})
    if basics.get("summary"):
        chunks.append({
            "id": chunk_id,
            "text": f"Summary for {basics.get('name', 'Developer')}: {basics['summary']}",
            "payload": {"doc_type": "summary", "doc_id": "basics"}
        })
        chunk_id += 1

    # 2. Skills
    for category, skills in data.get("skills", {}).items():
        chunks.append({
            "id": chunk_id,
            "text": f"Skills ({category.replace('_', ' ').title()}): {', '.join(skills)}",
            "payload": {"doc_type": "skills", "doc_id": category, "keywords": skills[:5]}
        })
        chunk_id += 1

    # 3. Experience
    for exp in data.get("experience", []):
        text = f"Role: {exp['role']} at {exp['company']} ({exp['startDate']} - {exp['endDate']}). "
        text += "Highlights: " + " ".join(exp.get("highlights", []))
        chunks.append({
            "id": chunk_id,
            "text": text,
            "payload": {"doc_type": "experience", "doc_id": exp['company']}
        })
        chunk_id += 1

    # 4. Projects
    for proj in data.get("projects", []):
        # Context chunk
        chunks.append({
            "id": chunk_id,
            "text": f"Project: {proj['title']} for {proj['client']}. Context: {proj['context']}",
            "payload": {"doc_type": "project", "doc_id": proj['id']}
        })
        chunk_id += 1
        
        # Architecture chunk
        chunks.append({
            "id": chunk_id,
            "text": f"Project Architecture ({proj['title']}): {proj['howItWorks']}",
            "payload": {"doc_type": "project", "doc_id": proj['id'], "keywords": proj.get("techStack", [])[:5]}
        })
        chunk_id += 1

        # ROI chunk
        chunks.append({
            "id": chunk_id,
            "text": f"Project ROI & Impact ({proj['title']}): {' '.join(proj['roi'])}",
            "payload": {"doc_type": "project", "doc_id": proj['id']}
        })
        chunk_id += 1

    return chunks


def main():
    logger.info("Loading portfolio data...")
    data = load_portfolio()
    
    logger.info("Chunking data...")
    chunks = chunk_portfolio(data)
    logger.info("Generated %d chunks", len(chunks))

    logger.info("Connecting to Qdrant...")
    qdrant = get_qdrant()
    qdrant.ensure_collection()

    logger.info("Embedding and upserting chunks...")
    points = []
    for chunk in chunks:
        vector = qdrant.embed(chunk["text"])
        points.append({
            "id": chunk["id"],
            "vector": vector,
            "payload": {
                "text": chunk["text"],
                "doc_type": chunk["payload"]["doc_type"],
                "doc_id": chunk["payload"]["doc_id"],
                "keywords": chunk["payload"].get("keywords", []),
            }
        })

    qdrant.upsert(points)
    logger.info("Ingestion complete!")


if __name__ == "__main__":
    main()
