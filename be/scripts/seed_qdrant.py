"""
Script to permanently seed Qdrant with portfolio data and resume embeddings.
Run this script to embed and upload your portfolio chunks to the cloud Qdrant cluster.
"""

import os
import sys
import json
import uuid
import logging
from pathlib import Path
from dotenv import load_dotenv

# Add the 'be' directory to Python path so we can import services
sys.path.append(str(Path(__file__).parent.parent))

from services.qdrant import get_qdrant
import PyPDF2

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Load environment variables from .env
load_dotenv(Path(__file__).parent.parent / ".env")


def extract_pdf_text(pdf_path: Path) -> str:
    """Extract all text from a PDF file."""
    if not pdf_path.exists():
        logger.warning(f"Resume PDF not found at {pdf_path}")
        return ""
    
    text = ""
    try:
        with open(pdf_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        logger.error(f"Failed to read PDF: {e}")
        return ""


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Simple sliding window chunker."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks


async def seed():
    qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
    qdrant_api_key = os.getenv("QDRANT_API_KEY", "")
    
    logger.info(f"Connecting to Qdrant at {qdrant_url}")
    qdrant = get_qdrant(url=qdrant_url, api_key=qdrant_api_key)
    qdrant.ensure_collection()

    documents = []
    metadata = []
    ids = []
    
    # 1. Process portfolio.json
    data_path = Path(__file__).parent.parent / "data" / "portfolio.json"
    if data_path.exists():
        logger.info("Processing portfolio.json...")
        portfolio = json.loads(data_path.read_text(encoding="utf-8"))
        
        # Basics
        basics = portfolio.get("basics", {})
        basics_text = f"Name: {basics.get('name')}\nRole: {basics.get('label')}\nSummary: {basics.get('summary')}"
        documents.append(basics_text)
        metadata.append({"doc_type": "basics", "doc_id": "profile"})
        ids.append(str(uuid.uuid4()))
        
        # Skills
        skills = portfolio.get("skills", {})
        for category, skill_list in skills.items():
            skill_text = f"{category.replace('_', ' ').title()} Skills: {', '.join(skill_list)}"
            documents.append(skill_text)
            metadata.append({"doc_type": "skills", "doc_id": category})
            ids.append(str(uuid.uuid4()))
            
        # Experience
        for exp in portfolio.get("experience", []):
            exp_text = f"Role: {exp.get('role')} at {exp.get('company')} ({exp.get('startDate')} - {exp.get('endDate')})\nHighlights:\n" + "\n".join([f"- {h}" for h in exp.get('highlights', [])])
            documents.append(exp_text)
            metadata.append({"doc_type": "experience", "doc_id": exp.get("company", "").lower().replace(" ", "_")})
            ids.append(str(uuid.uuid4()))
            
        # Projects
        for proj in portfolio.get("projects", []):
            proj_text = f"Project: {proj.get('title')}\nContext: {proj.get('context')}\nHow it works: {proj.get('howItWorks')}\nROI:\n" + "\n".join([f"- {r}" for r in proj.get('roi', [])]) + f"\nTech Stack: {', '.join(proj.get('techStack', []))}"
            documents.append(proj_text)
            metadata.append({"doc_type": "project", "doc_id": proj.get("id")})
            ids.append(str(uuid.uuid4()))
            
    # 2. Process Resume PDF
    resume_path = Path(__file__).parent.parent.parent / "Aditya_katkar_resume.pdf"
    resume_text = extract_pdf_text(resume_path)
    if resume_text:
        logger.info("Processing Aditya_katkar_resume.pdf...")
        chunks = chunk_text(resume_text, chunk_size=200, overlap=50)
        for i, chunk in enumerate(chunks):
            documents.append(chunk)
            metadata.append({"doc_type": "resume", "doc_id": f"resume_chunk_{i}"})
            ids.append(str(uuid.uuid4()))
            
    # Upsert all documents
    if documents:
        logger.info(f"Upserting {len(documents)} total documents to Qdrant...")
        qdrant.upsert_documents(documents=documents, metadata=metadata, ids=ids)
        logger.info("Seeding complete! ✨")
    else:
        logger.warning("No data found to seed.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(seed())
