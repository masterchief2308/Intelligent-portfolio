"""
Qdrant vector search service for portfolio RAG.
Uses all-MiniLM-L6-v2 (384-dim) for embeddings.
"""

import logging
from typing import Any, Optional
# pyrefly: ignore [missing-import]
from qdrant_client import QdrantClient
# pyrefly: ignore [missing-import]
from qdrant_client.models import Distance, VectorParams, PointStruct
# pyrefly: ignore [missing-import]
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)


class QdrantService:
    def __init__(self, url: str = "http://localhost:6333", api_key: str = "", collection: str = "portfolio"):
        self._url = url
        self._api_key = api_key
        self._collection = collection
        self._client = None
        self._model = None

    def _ensure_client(self):
        if self._client is None:
            try:
                self._client = QdrantClient(
                    url=self._url,
                    api_key=self._api_key if self._api_key else None,
                )
                logger.info("Connected to Qdrant at %s", self._url)
            except Exception as e:
                logger.warning("Qdrant unavailable: %s", e)

    def _ensure_model(self):
        if self._model is None:
            try:
                self._model = SentenceTransformer("all-MiniLM-L6-v2")
                logger.info("Loaded embedding model: all-MiniLM-L6-v2")
            except Exception as e:
                logger.warning("Embedding model unavailable: %s", e)

    def embed(self, text: str) -> list[float]:
        """Embed a text string into a 384-dim vector."""
        self._ensure_model()
        if self._model is None:
            return [0.0] * 384
        return self._model.encode(text).tolist()

    def ensure_collection(self, vector_size: int = 384):
        """Create the collection if it doesn't exist."""
        self._ensure_client()
        if self._client is None:
            return

        collections = [c.name for c in self._client.get_collections().collections]
        if self._collection not in collections:
            self._client.create_collection(
                collection_name=self._collection,
                vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
            )
            logger.info("Created Qdrant collection: %s", self._collection)

    def upsert(self, points: list[dict[str, Any]]):
        """Upsert points into the collection.
        Each point: { "id": int, "vector": [...], "payload": {...} }
        """
        self._ensure_client()
        if self._client is None:
            logger.warning("Qdrant not available, skipping upsert")
            return

        self._client.upsert(
            collection_name=self._collection,
            points=[
                PointStruct(id=p["id"], vector=p["vector"], payload=p.get("payload", {}))
                for p in points
            ],
        )
        logger.info("Upserted %d points into %s", len(points), self._collection)

    async def search(self, query: str, top_k: int = 5) -> list[dict[str, Any]]:
        """Embed query and search for similar portfolio chunks."""
        self._ensure_client()
        if self._client is None:
            logger.warning("Qdrant not available, returning empty results")
            return []

        vector = self.embed(query)

        try:
            results = self._client.query_points(
                collection_name=self._collection,
                query=vector,
                limit=top_k,
            )
            return [
                {
                    "id": hit.id,
                    "score": hit.score,
                    "text": hit.payload.get("text", ""),
                    "doc_type": hit.payload.get("doc_type", ""),
                    "doc_id": hit.payload.get("doc_id", ""),
                    "keywords": hit.payload.get("keywords", []),
                }
                for hit in results.points
            ]
        except Exception as e:
            logger.error("Qdrant search failed: %s", e)
            return []


# Singleton
_instance: Optional[QdrantService] = None


def get_qdrant(url: str = "http://localhost:6333", api_key: str = "", collection: str = "portfolio") -> QdrantService:
    global _instance
    if _instance is None:
        _instance = QdrantService(url=url, api_key=api_key, collection=collection)
    return _instance
