"""
Gemini LLM setup via LangChain.
- Flash model: cheap/fast (planning, segmentation, validation, chat)
- Pro model: quality (personalization generation only)
"""

import logging
from functools import lru_cache
from langchain_google_genai import ChatGoogleGenerativeAI
from config import get_settings

logger = logging.getLogger(__name__)


@lru_cache
def get_flash_llm() -> ChatGoogleGenerativeAI:
    """Gemini 2.5 Flash — fast + cheap. Used for planning, parsing, validation, chat."""
    settings = get_settings()
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        api_key=settings.GEMINI_API_KEY,
        temperature=0.7,
        max_retries=5,
    )


@lru_cache
def get_pro_llm() -> ChatGoogleGenerativeAI:
    """Gemini 2.5 Pro — higher quality. Used for personalization generation only."""
    settings = get_settings()
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-pro",
        api_key=settings.GEMINI_API_KEY,
        temperature=0.7,
        max_retries=5,
    )
