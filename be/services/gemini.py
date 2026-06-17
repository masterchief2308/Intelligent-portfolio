"""
Gemini LLM setup via LangChain.
- Flash model: cheap/fast (planning, segmentation, validation, chat)
- Pro model: quality (personalization generation only)
"""

import logging
import itertools
from langchain_google_genai import ChatGoogleGenerativeAI
from config import get_settings

logger = logging.getLogger(__name__)

# Round-robin generator for API keys to double throughput
_key_cycle = None

def _get_next_api_key() -> str:
    global _key_cycle
    if _key_cycle is None:
        settings = get_settings()
        keys = [settings.GEMINI_API_KEY]
        if settings.GEMINI_API_KEY_FALLBACK:
            keys.append(settings.GEMINI_API_KEY_FALLBACK)
        _key_cycle = itertools.cycle(keys)
    return next(_key_cycle)


def get_flash_llm(temperature: float = 0.7) -> ChatGoogleGenerativeAI:
    """Gemini 2.5 Flash — fast + cheap. Used for planning, parsing, validation, chat."""
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        api_key=_get_next_api_key(),
        temperature=temperature,
        max_retries=5,
    )


def get_pro_llm(temperature: float = 0.7) -> ChatGoogleGenerativeAI:
    """Gemini 2.5 Pro — higher quality. Used for personalization generation only."""
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-pro",
        api_key=_get_next_api_key(),
        temperature=temperature,
        max_retries=5,
    )
