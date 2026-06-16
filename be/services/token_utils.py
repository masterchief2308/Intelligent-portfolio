"""
Token management utilities: estimation, semantic deduplication, smart truncation.
"""

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Average tokens per character for English text (Gemini tokenizer approximation)
CHARS_PER_TOKEN = 4


def estimate_tokens(text: str) -> int:
    """Estimate token count. ~4 chars per token for English."""
    return len(text) // CHARS_PER_TOKEN


def truncate_to_budget(text: str, budget_tokens: int) -> str:
    """Smart truncation that preserves sentence boundaries."""
    char_limit = budget_tokens * CHARS_PER_TOKEN
    if len(text) <= char_limit:
        return text

    # Find the last sentence boundary before the limit
    truncated = text[:char_limit]
    last_period = truncated.rfind(".")
    last_newline = truncated.rfind("\n")
    cut_point = max(last_period, last_newline)

    if cut_point > char_limit * 0.7:  # Don't cut too aggressively
        truncated = truncated[:cut_point + 1]

    return truncated + "\n...[TRUNCATED TO TOKEN BUDGET]"


def deduplicate_paragraphs(text: str, threshold: float = 0.85) -> str:
    """Remove near-duplicate paragraphs using simple text similarity.
    Uses Jaccard similarity on word sets (no ML model needed — saves tokens).
    """
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    if len(paragraphs) <= 1:
        return text

    unique = [paragraphs[0]]
    for para in paragraphs[1:]:
        is_dup = False
        para_words = set(para.lower().split())
        if not para_words:
            continue

        for existing in unique:
            existing_words = set(existing.lower().split())
            if not existing_words:
                continue
            intersection = para_words & existing_words
            union = para_words | existing_words
            jaccard = len(intersection) / len(union) if union else 0

            if jaccard >= threshold:
                is_dup = True
                break

        if not is_dup:
            unique.append(para)

    deduped = "\n\n".join(unique)
    removed = len(paragraphs) - len(unique)
    if removed > 0:
        logger.info("Deduplication removed %d/%d paragraphs", removed, len(paragraphs))
    return deduped


def clean_scraped_text(text: str, budget_tokens: Optional[int] = None) -> str:
    """Full pipeline: clean whitespace → deduplicate → truncate to budget."""
    # Normalize whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()

    # Deduplicate
    text = deduplicate_paragraphs(text)

    # Truncate to budget if specified
    if budget_tokens:
        text = truncate_to_budget(text, budget_tokens)

    return text
