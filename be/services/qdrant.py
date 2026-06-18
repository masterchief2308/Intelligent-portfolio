"""
Qdrant vector search service for portfolio RAG.
Uses all-MiniLM-L6-v2 (384-dim) for embeddings.
"""

import logging
from typing import Any, Optional
# pyrefly: ignore [missing-import]
from qdrant_client import QdrantClient

logger = logging.getLogger(__name__)


class QdrantService:
    def __init__(self, url: str = "http://localhost:6333", api_key: str = "", collection: str = "portfolio"):
        self._url = url
        self._api_key = api_key
        self._collection = collection
        self._client = None

    def _ensure_client(self):
        if self._client is None:
            try:
                self._client = QdrantClient(
                    url=self._url,
                    api_key=self._api_key if self._api_key else None,
                )
                
                # Configure native FastEmbed integration for Hybrid Search (Dense + Sparse)
                self._client.set_model("sentence-transformers/all-MiniLM-L6-v2")
                self._client.set_sparse_model("Qdrant/bm25")
                
                logger.info("Connected to Qdrant at %s with Hybrid FastEmbed", self._url)
            except Exception as e:
                logger.warning("Qdrant unavailable: %s", e)

    def ensure_collection(self):
        """Create the collection if it doesn't exist."""
        self._ensure_client()
        if self._client is None:
            return

        collections = [c.name for c in self._client.get_collections().collections]
        if self._collection not in collections:
            # Tell Qdrant to create the collection using the Dense + Sparse configs we set!
            self._client.create_collection(
                collection_name=self._collection,
                vectors_config=self._client.get_fastembed_vector_params(),
                sparse_vectors_config=self._client.get_fastembed_sparse_vector_params(),
            )
            logger.info("Created Qdrant collection: %s with FastEmbed configs", self._collection)

    def upsert_documents(self, documents: list[str], metadata: list[dict[str, Any]], ids: list[str]):
        """Upsert raw text documents. FastEmbed automatically handles vectorization!"""
        self._ensure_client()
        if self._client is None:
            logger.warning("Qdrant not available, skipping upsert")
            return

        self._client.add(
            collection_name=self._collection,
            documents=documents,
            metadata=metadata,
            ids=ids
        )
        logger.info("Upserted %d documents into %s (Hybrid Embedding Complete)", len(documents), self._collection)

    async def search(self, query: str, top_k: int = 5) -> list[dict[str, Any]]:
        """Search using native Reciprocal Rank Fusion (Hybrid Search)."""
        self._ensure_client()
        if self._client is None:
            logger.warning("Qdrant not available, returning empty results")
            return []

        try:
            # client.query() automatically embeds the query sparsely and densely, 
            # sends both to the server, and executes an RRF fusion.
            results = self._client.query(
                collection_name=self._collection,
                query_text=query,
                limit=top_k,
            )
            return [
                {
                    "id": hit.id,
                    "score": hit.score,
                    "text": hit.document,
                    "doc_type": hit.metadata.get("doc_type", ""),
                    "doc_id": hit.metadata.get("doc_id", ""),
                    "keywords": hit.metadata.get("keywords", []),
                }
                for hit in results
            ]
        except Exception as e:
            logger.error("Qdrant hybrid search failed: %s", e)
            return []


# Singleton
_instance: Optional[QdrantService] = None


def get_qdrant(url: str = "http://localhost:6333", api_key: str = "", collection: str = "portfolio") -> QdrantService:
    global _instance
    if _instance is None:
        _instance = QdrantService(url=url, api_key=api_key, collection=collection)
    return _instance
