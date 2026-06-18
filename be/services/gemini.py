"""
Gemini LLM setup via LangChain.
- Flash model: cheap/fast (planning, segmentation, validation, chat)
- Pro model: downgraded to flash since Pro is 0 limit on free tier.
"""

import logging
from typing import Optional, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from config import get_settings

logger = logging.getLogger(__name__)


class FallbackLLMWrapper:
    """Wraps a primary LLM and a list of fallbacks.
    Automatically applies .with_fallbacks() to base invocations and structured output."""
    def __init__(self, primary: ChatGoogleGenerativeAI, fallbacks: list[ChatGoogleGenerativeAI] = None):
        self.primary = primary
        self.fallbacks = fallbacks or []

    def with_structured_output(self, schema: Any, **kwargs):
        primary_struct = self.primary.with_structured_output(schema, **kwargs)
        if self.fallbacks:
            fallback_structs = [f.with_structured_output(schema, **kwargs) for f in self.fallbacks]
            return primary_struct.with_fallbacks(fallback_structs)
        return primary_struct

    def __getattr__(self, name: str):
        if self.fallbacks:
            runnable = self.primary.with_fallbacks(self.fallbacks)
            return getattr(runnable, name)
        return getattr(self.primary, name)


def _get_llm_with_fallbacks(model_name: str, temperature: float = 0.7) -> FallbackLLMWrapper:
    settings = get_settings()
    
    primary = ChatGoogleGenerativeAI(
        model=model_name,
        api_key=settings.GEMINI_API_KEY,
        temperature=temperature,
        max_retries=2, # Fail fast so we can bounce to the fallback key
    )
    fallbacks = []
    if settings.GEMINI_API_KEY_FALLBACK:
        fallbacks.append(ChatGoogleGenerativeAI(
            model=model_name,
            api_key=settings.GEMINI_API_KEY_FALLBACK,
            temperature=temperature,
            max_retries=2,
        ))
        
    if getattr(settings, "GEMINI_API_KEY_FALLBACK_2", ""):
        fallbacks.append(ChatGoogleGenerativeAI(
            model=model_name,
            api_key=settings.GEMINI_API_KEY_FALLBACK_2,
            temperature=temperature,
            max_retries=2,
        ))
        
    return FallbackLLMWrapper(primary, fallbacks)


def get_flash_llm(temperature: float = 0.7) -> FallbackLLMWrapper:
    """Gemini 2.5 Flash — fast + cheap. Used for planning, parsing, validation, chat."""
    return _get_llm_with_fallbacks("gemini-2.5-flash", temperature)


def get_pro_llm(temperature: float = 0.7) -> FallbackLLMWrapper:
    """Originally Gemini 2.5 Pro — but Google Free Tier sets limit to 0. Downgraded to Flash."""
    return _get_llm_with_fallbacks("gemini-2.5-flash", temperature)


from langchain_core.prompts import ChatPromptTemplate

def build_dynamic_chain_with_fallbacks(schema: Any, configs: list[dict], temperature: float = 0.7):
    """
    Builds a Runnable chain with fallbacks where each fallback has a DIFFERENT model and DIFFERENT prompt.
    `configs` is a list of dictionaries:
    [
        {
            "model_name": "gemini-2.5-flash",
            "api_key_env": "GEMINI_API_KEY",
            "messages": [("system", "..."), ("human", "...")] # ChatPromptTemplate tuples
        },
        ...
    ]
    """
    settings = get_settings()
    
    chains = []
    for cfg in configs:
        key_val = getattr(settings, cfg["api_key_env"], None)
        if not key_val:
            continue
            
        llm = ChatGoogleGenerativeAI(
            model=cfg["model_name"],
            api_key=key_val,
            temperature=temperature,
            max_retries=1, # Fail fast to trigger fallback
        )
        
        prompt = ChatPromptTemplate.from_messages(cfg["messages"])
        chain = prompt | llm.with_structured_output(schema)
        chains.append(chain)
        
    if not chains:
        raise ValueError("No valid LLM configurations provided with available API keys.")
        
    primary_chain = chains[0]
    if len(chains) > 1:
        return primary_chain.with_fallbacks(chains[1:])
    return primary_chain
