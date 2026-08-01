"""
Download FastEmbed models at Docker build time so Cloud Run cold starts
do not hit Hugging Face on every new instance.
Keep model names in sync with services/qdrant.py.
"""

import os

# Must match services/qdrant.py
DENSE_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
SPARSE_MODEL = "Qdrant/bm25"

os.environ.setdefault("HF_HOME", "/app/.cache/huggingface")
os.environ.setdefault("FASTEMBED_CACHE_PATH", "/app/.cache/fastembed")


def main() -> None:
    from fastembed import SparseTextEmbedding, TextEmbedding

    print(f"Downloading dense model: {DENSE_MODEL}")
    dense = TextEmbedding(model_name=DENSE_MODEL)
    # Touch the model once so weights are fully loaded
    list(dense.embed(["warmup"]))

    print(f"Downloading sparse model: {SPARSE_MODEL}")
    sparse = SparseTextEmbedding(model_name=SPARSE_MODEL)
    list(sparse.embed(["warmup"]))

    print("Embedding models cached successfully.")


if __name__ == "__main__":
    main()
