"""
Resume pool ingestion service.
Parses uploaded resumes (PDF, TXT, DOCX), chunks them, and upserts into Qdrant resume_pool collection.
"""

import hashlib
import io
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import UploadFile

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500  # characters per chunk
CHUNK_OVERLAP = 100  # overlap between chunks


async def parse_resume(file: UploadFile) -> str:
    """Extract raw text from a PDF, TXT, or DOCX resume file."""
    filename = (file.filename or "").lower()
    content = await file.read()

    if filename.endswith(".pdf") or file.content_type == "application/pdf":
        return _parse_pdf(content)
    elif filename.endswith(".txt") or file.content_type in ("text/plain",):
        return content.decode("utf-8", errors="ignore").strip()
    elif filename.endswith(".docx") or file.content_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ):
        return _parse_docx(content)
    else:
        logger.warning("Unsupported resume format: %s (%s)", filename, file.content_type)
        return ""


def _parse_pdf(content: bytes) -> str:
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(content))
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text.strip()
    except Exception as e:
        logger.error("PDF parsing failed: %s", e)
        return ""


def _parse_docx(content: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(content))
        text = "\n".join(para.text for para in doc.paragraphs)
        return text.strip()
    except Exception as e:
        logger.error("DOCX parsing failed: %s", e)
        return ""


def _extract_candidate_name(filename: str) -> str:
    """Best-effort candidate name extraction from filename.
    e.g. 'John_Doe_Resume.pdf' -> 'John Doe'
    """
    stem = Path(filename).stem
    # Remove common suffixes
    stem = re.sub(r"(?i)[-_\s]*(resume|cv|curriculum[\s_-]*vitae|application)[-_\s]*", " ", stem)
    # Replace underscores/hyphens with spaces
    name = re.sub(r"[_\-]+", " ", stem).strip()
    # Title-case and collapse whitespace
    name = re.sub(r"\s+", " ", name).strip().title()
    return name if name else filename


def chunk_resume(
    text: str,
    candidate_name: str,
    filename: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[dict[str, Any]]:
    """Split resume text into overlapping chunks with metadata."""
    if not text:
        return []

    chunks = []
    start = 0
    idx = 0
    now = datetime.now(timezone.utc).isoformat()

    while start < len(text):
        end = start + chunk_size
        chunk_text = text[start:end].strip()
        if not chunk_text:
            break

        chunk_id = hashlib.md5(
            f"{filename}:{idx}:{chunk_text[:50]}".encode()
        ).hexdigest()

        chunks.append({
            "id": chunk_id,
            "text": chunk_text,
            "metadata": {
                "candidate_name": candidate_name,
                "filename": filename,
                "chunk_index": idx,
                "uploaded_at": now,
                "text": chunk_text,
            },
        })
        start += chunk_size - overlap
        idx += 1

    return chunks


async def ingest_resumes(
    files: list[UploadFile],
    qdrant_service: Any,
    max_resumes: int = 100,
) -> dict[str, Any]:
    """Parse, chunk, and upsert a batch of resume files into Qdrant.
    Returns {ingested: int, failed: list[str], warnings: list[str]}.
    """
    from services.qdrant import get_qdrant

    qdrant = qdrant_service or get_qdrant()
    stats = qdrant.get_resume_pool_stats()
    current_count = len(stats.get("filenames", []))

    ingested = 0
    failed: list[str] = []
    warnings: list[str] = []
    all_documents: list[str] = []
    all_metadata: list[dict[str, Any]] = []
    all_ids: list[str] = []

    for file in files:
        if current_count + ingested >= max_resumes:
            warnings.append(
                f"Pool limit ({max_resumes}) reached. Skipped: {file.filename}"
            )
            continue

        filename = file.filename or f"resume_{ingested}"
        text = await parse_resume(file)

        if not text:
            failed.append(filename)
            continue

        candidate_name = _extract_candidate_name(filename)
        chunks = chunk_resume(text, candidate_name, filename)

        if not chunks:
            failed.append(filename)
            continue

        for c in chunks:
            all_documents.append(c["text"])
            all_metadata.append(c["metadata"])
            all_ids.append(c["id"])

        ingested += 1

    # Batch upsert all chunks
    if all_documents:
        try:
            qdrant.upsert_resume_documents(
                documents=all_documents,
                metadata=all_metadata,
                ids=all_ids,
            )
        except Exception as e:
            logger.error("Batch resume upsert failed: %s", e)
            return {"ingested": 0, "failed": [f.filename for f in files], "warnings": warnings}

    return {"ingested": ingested, "failed": failed, "warnings": warnings}
