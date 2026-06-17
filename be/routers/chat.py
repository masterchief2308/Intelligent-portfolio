"""POST /api/chat — RAG chat with persistent conversation history."""

import hashlib
import logging
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from fastapi import APIRouter

from models.schemas import ChatRequest, ChatResponse
from services.gemini import get_flash_llm
from services.firestore import get_firestore
from mcp_tools.tools import search_portfolio

logger = logging.getLogger(__name__)
router = APIRouter()


def _make_session_id(email: str, session_id: str) -> str:
    """Deterministic session ID from email so same user resumes chat."""
    if session_id:
        return session_id
    return f"chat_{hashlib.sha256(email.encode()).hexdigest()[:16]}"


@router.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Handle a chat message with persistent conversation history:
    1. Load chat history from Firestore.
    2. Load personalization context.
    3. Use search_portfolio tool for RAG retrieval.
    4. Generate response with full conversation context.
    5. Save both user message and response to history.
    """
    firestore = get_firestore()

    # Determine session ID (deterministic from email if not provided)
    visitor_email = request.visitor_profile.email if request.visitor_profile else ""
    session_id = _make_session_id(visitor_email or request.session_id, request.session_id)

    # Step 1: Load chat history
    history = await firestore.get_chat_history(session_id, max_messages=10)

    # Step 2: Save user message
    await firestore.save_chat_message(session_id, "user", request.message)

    # Step 3: Load personalization context
    personalization_context = ""
    if visitor_email:
        cached = await firestore.get_personalization(visitor_email)
        if cached:
            featured = [
                p.get("title", "")
                for p in cached.get("website_config", {}).get("featured_projects", [])
            ]
            personalization_context = (
                f"Company: {cached.get('visitor_profile', {}).get('current_company', 'Unknown')}\n"
                f"Role: {cached.get('visitor_profile', {}).get('role', 'Unknown')}\n"
                f"Featured projects shown: {featured}"
            )

    # Step 4: Retrieve portfolio chunks using the LangChain tool
    try:
        portfolio_context = await search_portfolio.ainvoke(
            {"query": request.message, "top_k": 5}
        )
    except Exception as e:
        logger.warning("Portfolio search failed: %s", e)
        portfolio_context = "Portfolio search unavailable."

    # Step 5: Build visitor context
    visitor_context = ""
    if request.visitor_profile:
        vp = request.visitor_profile
        visitor_context = f"Visitor: {vp.role or 'Unknown'} at {vp.current_company or 'Unknown'}"

    # Step 6: Build messages with history
    llm = get_flash_llm()

    messages = [
        SystemMessage(content=(
            "You are an AI assistant for Aditya Katkar's portfolio website. "
            "Answer questions about his projects, skills, experience, and technical decisions. "
            "Be conversational, specific, and reference actual project details. Don't be generic.\n"
            "- CONFIDENTIALITY & LEGAL COMPLIANCE: Do not reveal proprietary source code, internal IP, raw database schemas, explicit internal client metrics/financials that are not public, or project-specific sensitive data that would violate the India Information Technology Act or corporate NDAs. Generalize sensitive details when necessary.\n\n"
            f"VISITOR: {visitor_context}\n"
            f"PERSONALIZATION: {personalization_context}\n"
            f"PORTFOLIO CONTEXT:\n{portfolio_context}"
        )),
    ]

    # Add conversation history
    for msg in history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            messages.append(AIMessage(content=msg["content"]))

    # Add current message
    messages.append(HumanMessage(content=request.message))

    try:
        response = await llm.ainvoke(messages)
        response_text = response.content
    except Exception as e:
        logger.error("Chat LLM failed: %s", e)
        response_text = "I'm having trouble connecting right now. Please try again."

    # Step 7: Save assistant response to history
    await firestore.save_chat_message(session_id, "assistant", response_text)

    # Extract sources from portfolio context
    sources = []
    if "portfolio" in portfolio_context.lower() and ":" in portfolio_context:
        for line in portfolio_context.split("\n"):
            if ":" in line and "[" in line:
                try:
                    doc_part = line.split("]")[0].split("[")[-1]
                    if ":" in doc_part:
                        doc_type, doc_id = doc_part.split(":", 1)
                        sources.append({"project": doc_id.strip(), "section": doc_type.strip()})
                except (IndexError, ValueError):
                    pass

    return ChatResponse(
        response=response_text,
        sources=sources[:3],
        suggested_followups=[],
    )
