"""
Optional local helper: download FastEmbed models into HF/FastEmbed caches.

NOT used in Docker/Cloud Build — baking models at build time timed out on Hugging Face.
Production loads MiniLM + BM25 lazily on the first RAG request (see services/qdrant.py).

Keep model names in sync with services/qdrant.py.

Usage (local only):
  python scripts/warmup_embed_models.py
"""

from __future__ import annotations

import os
import time

DENSE_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
SPARSE_MODEL = "Qdrant/bm25"

os.environ.setdefault("HF_HOME", os.path.expanduser("~/.cache/huggingface"))
os.environ.setdefault("FASTEMBED_CACHE_PATH", os.path.expanduser("~/.cache/fastembed"))
os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "120")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")

MAX_ATTEMPTS = 5
RETRY_SLEEP_S = 15


def _download_once() -> None:
    from fastembed import SparseTextEmbedding, TextEmbedding

    print(f"Downloading dense model: {DENSE_MODEL}")
    dense = TextEmbedding(model_name=DENSE_MODEL)
    list(dense.embed(["warmup"]))

    print(f"Downloading sparse model: {SPARSE_MODEL}")
    sparse = SparseTextEmbedding(model_name=SPARSE_MODEL)
    list(sparse.embed(["warmup"]))

    print("Embedding models cached successfully.")


def main() -> None:
    last_err: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            print(f"Warmup attempt {attempt}/{MAX_ATTEMPTS}")
            _download_once()
            return
        except Exception as e:
            last_err = e
            print(f"Warmup attempt {attempt} failed: {e}")
            if attempt < MAX_ATTEMPTS:
                print(f"Retrying in {RETRY_SLEEP_S}s...")
                time.sleep(RETRY_SLEEP_S)

    raise RuntimeError(
        f"Failed to cache embedding models after {MAX_ATTEMPTS} attempts: {last_err}"
    ) from last_err


if __name__ == "__main__":
    main()
