"""GET /api/resume/pdf — Serve the static resume PDF."""

import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/resume/pdf")
async def get_resume():
    """Download the resume PDF."""
    # Look for resume PDF in project root and data dir
    search_paths = [
        Path(__file__).parent.parent / "data" / "Aditya_katkar_resume.pdf",
    ]

    for path in search_paths:
        if path.exists():
            return FileResponse(
                path=str(path),
                media_type="application/pdf",
                filename="Aditya_katkar_resume.pdf",
            )

    raise HTTPException(status_code=404, detail="Resume PDF not found")
