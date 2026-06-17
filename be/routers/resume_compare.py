"""POST /api/resume/compare — Upload a resume and compare against portfolio projects."""

import logging
import io
from fastapi import APIRouter, UploadFile, File, Request, Depends, HTTPException
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from services.qdrant import get_qdrant
from services.gemini import get_flash_llm
from langchain_core.messages import SystemMessage, HumanMessage

logger = logging.getLogger(__name__)
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class RelevancyMatch(BaseModel):
    project_id: str = Field(description="Matched project ID")
    project_title: str = Field(description="Matched project title")
    relevancy_score: float = Field(description="0.0-1.0 relevancy score")
    matching_skills: list[str] = Field(default_factory=list, description="Overlapping skills")
    explanation: str = Field(description="Why this project is relevant")


class ResumeCompareResponse(BaseModel):
    overall_score: float = Field(description="Overall relevancy 0.0-1.0")
    matches: list[RelevancyMatch] = Field(default_factory=list)
    extracted_skills: list[str] = Field(default_factory=list)
    summary: str = Field(description="1-2 sentence summary")


class ResumeCompareResult(BaseModel):
    """Structured output for resume comparison."""
    overall_score: float = Field(description="Overall relevancy score 0.0 to 1.0")
    matches: list[RelevancyMatch] = Field(default_factory=list)
    extracted_skills: list[str] = Field(default_factory=list, description="Skills extracted from resume")
    summary: str = Field(description="Brief summary of the comparison")


async def _extract_text_from_pdf(file: UploadFile) -> str:
    """Extract text from uploaded PDF."""
    try:
        from PyPDF2 import PdfReader
        content = await file.read()
        reader = PdfReader(io.BytesIO(content))
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text.strip()
    except Exception as e:
        logger.error("PDF extraction failed: %s", e)
        return ""


async def _extract_text_from_txt(file: UploadFile) -> str:
    """Extract text from uploaded text file."""
    content = await file.read()
    return content.decode("utf-8", errors="ignore").strip()


@router.post("/api/resume/compare", response_model=ResumeCompareResponse)
@limiter.limit("10/minute")
async def compare_resume(
    request: Request,
    file: UploadFile = File(...),
):
    """Upload a resume (PDF or TXT) and compare against portfolio projects.
    Returns relevancy scores, matched skills, and explanations.
    """
    # Step 1: Extract text from upload
    if file.content_type == "application/pdf" or file.filename.endswith(".pdf"):
        resume_text = await _extract_text_from_pdf(file)
    elif file.content_type in ("text/plain",) or file.filename.endswith(".txt"):
        resume_text = await _extract_text_from_txt(file)
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload PDF or TXT."
        )

    if not resume_text:
        raise HTTPException(status_code=400, detail="Could not extract text from file.")

    # Step 2: Search portfolio for relevant chunks
    qdrant = get_qdrant()
    try:
        chunks = await qdrant.search(query=resume_text[:2000], top_k=10)
    except Exception as e:
        logger.error("Qdrant search failed: %s", e)
        chunks = []

    portfolio_context = "\n".join(
        f"- [{c.get('doc_type', '')}:{c.get('doc_id', '')}] {c.get('text', '')[:300]}"
        for c in chunks
    ) or "No portfolio data available."

    # Step 3: Use LLM for structured comparison
    llm = get_flash_llm()
    structured_llm = llm.with_structured_output(ResumeCompareResult)

    messages = [
        SystemMessage(content=(
            "You are comparing a candidate's resume against a portfolio of projects. "
            "Score the relevancy (0.0 to 1.0) of the resume to each portfolio project. "
            "Extract skills from the resume. Be honest and specific.\n"
            "- CONFIDENTIALITY & LEGAL COMPLIANCE: Do not reveal proprietary source code, internal IP, raw database schemas, explicit internal client metrics/financials that are not public, or project-specific sensitive data that would violate the India Information Technology Act or corporate NDAs. Generalize sensitive details when necessary."
        )),
        HumanMessage(content=(
            f"RESUME TEXT (first 3000 chars):\n{resume_text[:3000]}\n\n"
            f"PORTFOLIO PROJECTS:\n{portfolio_context}\n\n"
            "Compare the resume against these projects and score relevancy."
        )),
    ]

    try:
        result: ResumeCompareResult = await structured_llm.ainvoke(messages)
        return ResumeCompareResponse(
            overall_score=result.overall_score,
            matches=result.matches,
            extracted_skills=result.extracted_skills,
            summary=result.summary,
        )
    except Exception as e:
        logger.error("Resume comparison LLM failed: %s", e)
        return ResumeCompareResponse(
            overall_score=0.0,
            matches=[],
            extracted_skills=[],
            summary="Comparison failed. Please try again.",
        )
