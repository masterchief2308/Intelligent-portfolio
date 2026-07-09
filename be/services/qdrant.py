"""
Qdrant vector search service for portfolio RAG.
Hybrid dense (MiniLM) + sparse (BM25) retrieval with RRF fusion and project-wise diversification.
"""

import logging
import os
import time
from typing import Any, Optional

from qdrant_client import QdrantClient, models

# Use image-baked caches when present (see Dockerfile warmup_embed_models.py)
os.environ.setdefault("HF_HOME", "/app/.cache/huggingface")
os.environ.setdefault("FASTEMBED_CACHE_PATH", "/app/.cache/fastembed")

from config import get_settings
from services.retrieval_profiles import RetrievalUseCase, get_retrieval_profile

logger = logging.getLogger(__name__)

DENSE_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
SPARSE_MODEL = "Qdrant/bm25"


class QdrantService:
    def __init__(
        self,
        url: str = "http://localhost:6333",
        api_key: str = "",
        collection: str = "portfolio",
    ):
        self._url = url
        self._api_key = api_key
        self._collection = collection
        self._client: QdrantClient | None = None
        self._dense_vector_name: str | None = None
        self._sparse_vector_name: str | None = None
        self._ready = False

    def is_ready(self) -> bool:
        return self._ready

    def _ensure_client(self):
        if self._client is not None:
            return

        started = time.perf_counter()
        try:
            self._client = QdrantClient(
                url=self._url,
                api_key=self._api_key if self._api_key else None,
            )
            self._client.set_model(DENSE_MODEL)
            self._client.set_sparse_model(SPARSE_MODEL)

            dense_params = self._client.get_fastembed_vector_params()
            sparse_params = self._client.get_fastembed_sparse_vector_params()
            self._dense_vector_name = next(iter(dense_params.keys()), None)
            self._sparse_vector_name = next(iter(sparse_params.keys()), None)
            self._ready = True

            logger.info(
                "Qdrant ready in %.1fs at %s (dense=%s, sparse=%s)",
                time.perf_counter() - started,
                self._url,
                self._dense_vector_name,
                self._sparse_vector_name,
            )
        except Exception as e:
            self._ready = False
            logger.warning("Qdrant unavailable: %s", e)

    def recreate_collection(self):
        """Drop and recreate the hybrid collection (use before full re-seed)."""
        self._ensure_client()
        if self._client is None:
            raise RuntimeError("Qdrant client unavailable")

        existing = [c.name for c in self._client.get_collections().collections]
        if self._collection in existing:
            self._client.delete_collection(collection_name=self._collection)
            logger.info("Deleted Qdrant collection: %s", self._collection)

        self._client.create_collection(
            collection_name=self._collection,
            vectors_config=self._client.get_fastembed_vector_params(),
            sparse_vectors_config=self._client.get_fastembed_sparse_vector_params(),
        )
        logger.info("Created fresh hybrid Qdrant collection: %s", self._collection)

    def ensure_collection(self):
        """Create the hybrid collection if it doesn't exist."""
        self._ensure_client()
        if self._client is None:
            return

        collections = [c.name for c in self._client.get_collections().collections]
        if self._collection in collections:
            return

        self._client.create_collection(
            collection_name=self._collection,
            vectors_config=self._client.get_fastembed_vector_params(),
            sparse_vectors_config=self._client.get_fastembed_sparse_vector_params(),
        )
        logger.info("Created hybrid Qdrant collection: %s", self._collection)

    def upsert_documents(
        self,
        documents: list[str],
        metadata: list[dict[str, Any]],
        ids: list[str],
    ):
        """Upsert raw text — FastEmbed handles dense + sparse vectorization."""
        self._ensure_client()
        if self._client is None:
            logger.warning("Qdrant not available, skipping upsert")
            return

        self._client.add(
            collection_name=self._collection,
            documents=documents,
            metadata=metadata,
            ids=ids,
        )
        logger.info("Upserted %d hybrid documents into %s", len(documents), self._collection)

    def upsert_chunks(self, chunks: list[dict[str, Any]]):
        """Upsert canonical chunk dicts from portfolio_chunks.build_portfolio_chunks()."""
        if not chunks:
            return
        documents = [c["text"] for c in chunks]
        metadata = [{**c["metadata"], "text": c["text"]} for c in chunks]
        ids = [c["id"] for c in chunks]
        self.upsert_documents(documents=documents, metadata=metadata, ids=ids)

    def _build_filter(
        self,
        project_slug: str | None = None,
        doc_type: str | None = None,
    ) -> models.Filter | None:
        conditions = []
        if project_slug:
            conditions.append(
                models.FieldCondition(
                    key="project_slug",
                    match=models.MatchValue(value=project_slug),
                )
            )
        if doc_type:
            conditions.append(
                models.FieldCondition(
                    key="doc_type",
                    match=models.MatchValue(value=doc_type),
                )
            )
        if not conditions:
            return None
        return models.Filter(must=conditions)

    def _hit_to_chunk(self, hit: Any) -> dict[str, Any]:
        payload = hit.payload or {}
        return {
            "id": hit.id,
            "score": hit.score,
            "text": payload.get("text") or getattr(hit, "document", "") or "",
            "doc_type": payload.get("doc_type", ""),
            "doc_id": payload.get("doc_id", ""),
            "project_slug": payload.get("project_slug"),
            "project_title": payload.get("project_title"),
            "client": payload.get("client"),
            "section": payload.get("section"),
            "cloud": payload.get("cloud"),
            "tech_stack": payload.get("tech_stack", []),
            "keywords": payload.get("keywords", []),
            # Resume pool fields
            "candidate_name": payload.get("candidate_name"),
            "filename": payload.get("filename"),
            "uploaded_at": payload.get("uploaded_at"),
        }

    def _diversify_by_project(
        self,
        hits: list[dict[str, Any]],
        top_k: int,
        max_per_project: int,
    ) -> list[dict[str, Any]]:
        """Prevent one project from dominating mixed retrieval results."""
        selected: list[dict[str, Any]] = []
        project_counts: dict[str, int] = {}

        for hit in hits:
            if len(selected) >= top_k:
                break
            slug = hit.get("project_slug") or hit.get("doc_id") or "_general"
            if hit.get("doc_type") == "project":
                count = project_counts.get(slug, 0)
                if count >= max_per_project:
                    continue
                project_counts[slug] = count + 1
            selected.append(hit)

        if len(selected) < top_k:
            seen = {h["id"] for h in selected}
            for hit in hits:
                if len(selected) >= top_k:
                    break
                if hit["id"] not in seen:
                    selected.append(hit)
                    seen.add(hit["id"])

        return selected

    def _hybrid_query(
        self,
        query: str,
        fetch_k: int,
        query_filter: models.Filter | None,
        collection_override: str | None = None,
    ) -> list[Any]:
        self._ensure_client()
        if self._client is None:
            return []

        target = collection_override or self._collection

        if self._dense_vector_name and self._sparse_vector_name:
            try:
                response = self._client.query_points(
                    collection_name=target,
                    prefetch=[
                        models.Prefetch(
                            query=models.Document(text=query, model=SPARSE_MODEL),
                            using=self._sparse_vector_name,
                            limit=fetch_k,
                            filter=query_filter,
                        ),
                        models.Prefetch(
                            query=models.Document(text=query, model=DENSE_MODEL),
                            using=self._dense_vector_name,
                            limit=fetch_k,
                            filter=query_filter,
                        ),
                    ],
                    query=models.FusionQuery(fusion=models.Fusion.RRF),
                    limit=fetch_k,
                    with_payload=True,
                )
                return response.points
            except Exception as e:
                logger.warning("Hybrid RRF query failed, falling back to query(): %s", e)

        try:
            results = self._client.query(
                collection_name=target,
                query_text=query,
                query_filter=query_filter,
                limit=fetch_k,
            )
            return results
        except Exception as e:
            logger.error("Qdrant search failed: %s", e)
            return []

    async def search(
        self,
        query: str,
        use_case: RetrievalUseCase = "default",
        top_k: int | None = None,
        fetch_k: int | None = None,
        score_threshold: float | None = None,
        project_slug: str | None = None,
        doc_type: str | None = None,
        max_per_project: int | None = None,
        collection_override: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Hybrid retrieval with over-fetch + project diversification.

        use_case: workflow preset (chat, personalization, resume_compare, recruiter_match, tool, default).
        Explicit kwargs override the profile. top_p is LLM sampling — not used here.
        collection_override: if set, search this collection instead of self._collection.
        """
        profile = get_retrieval_profile(use_case)
        final_k = top_k if top_k is not None else profile.top_k
        candidate_k = fetch_k if fetch_k is not None else profile.fetch_k
        threshold = score_threshold if score_threshold is not None else profile.score_threshold
        per_project = max_per_project if max_per_project is not None else profile.max_per_project
        effective_doc_type = doc_type if doc_type is not None else profile.doc_type

        query_filter = self._build_filter(project_slug=project_slug, doc_type=effective_doc_type)

        target_collection = collection_override or self._collection
        points = self._hybrid_query(
            query,
            fetch_k=max(candidate_k, final_k),
            query_filter=query_filter,
            collection_override=target_collection,
        )

        chunks = [self._hit_to_chunk(p) for p in points if p.score is None or p.score >= threshold]
        return self._diversify_by_project(chunks, top_k=final_k, max_per_project=per_project)

    # ── Resume Pool Collection ──────────────────────────────────────

    def _resume_pool_collection(self) -> str:
        from config import get_settings
        return get_settings().QDRANT_RESUME_POOL_COLLECTION

    def ensure_resume_pool_collection(self):
        """Create the resume_pool hybrid collection if it doesn't exist."""
        self._ensure_client()
        if self._client is None:
            return

        pool = self._resume_pool_collection()
        collections = [c.name for c in self._client.get_collections().collections]
        if pool in collections:
            return

        self._client.create_collection(
            collection_name=pool,
            vectors_config=self._client.get_fastembed_vector_params(),
            sparse_vectors_config=self._client.get_fastembed_sparse_vector_params(),
        )
        logger.info("Created resume_pool collection: %s", pool)

    def upsert_resume_documents(
        self,
        documents: list[str],
        metadata: list[dict[str, Any]],
        ids: list[str],
    ):
        """Upsert resume chunks into the resume_pool collection."""
        self._ensure_client()
        if self._client is None:
            logger.warning("Qdrant not available, skipping resume upsert")
            return

        self.ensure_resume_pool_collection()
        pool = self._resume_pool_collection()
        self._client.add(
            collection_name=pool,
            documents=documents,
            metadata=metadata,
            ids=ids,
        )
        logger.info("Upserted %d resume chunks into %s", len(documents), pool)

    async def search_resume_pool(
        self,
        query: str,
        top_k: int = 20,
    ) -> list[dict[str, Any]]:
        """Hybrid search against the resume_pool collection."""
        self.ensure_resume_pool_collection()
        pool = self._resume_pool_collection()
        return await self.search(
            query=query,
            use_case="recruiter_match",
            top_k=top_k,
            collection_override=pool,
        )

    def clear_resume_pool(self):
        """Drop and recreate the resume_pool collection."""
        self._ensure_client()
        if self._client is None:
            raise RuntimeError("Qdrant client unavailable")

        pool = self._resume_pool_collection()
        existing = [c.name for c in self._client.get_collections().collections]
        if pool in existing:
            self._client.delete_collection(collection_name=pool)
        self._client.create_collection(
            collection_name=pool,
            vectors_config=self._client.get_fastembed_vector_params(),
            sparse_vectors_config=self._client.get_fastembed_sparse_vector_params(),
        )
        logger.info("Cleared and recreated resume_pool collection: %s", pool)

    def get_resume_pool_stats(self) -> dict[str, Any]:
        """Return count and list of unique filenames in the pool."""
        self._ensure_client()
        if self._client is None:
            return {"count": 0, "filenames": [], "candidates": []}

        pool = self._resume_pool_collection()
        try:
            info = self._client.get_collection(collection_name=pool)
            count = info.points_count or 0
        except Exception:
            return {"count": 0, "filenames": [], "candidates": []}

        # Scroll a sample to extract unique filenames & candidate names
        filenames: set[str] = set()
        candidates: set[str] = set()
        try:
            points, _ = self._client.scroll(
                collection_name=pool,
                limit=500,
                with_payload=True,
            )
            for p in points:
                payload = p.payload or {}
                if payload.get("filename"):
                    filenames.add(payload["filename"])
                if payload.get("candidate_name"):
                    candidates.add(payload["candidate_name"])
        except Exception as e:
            logger.warning("Failed to scroll resume_pool: %s", e)

        return {
            "count": count,
            "filenames": sorted(filenames),
            "candidates": sorted(candidates),
        }

    def purge_expired_resumes(self, ttl_hours: int = 24):
        """Delete resume chunks older than ttl_hours from the pool."""
        import time
        self._ensure_client()
        if self._client is None:
            return 0

        pool = self._resume_pool_collection()
        cutoff = time.time() - (ttl_hours * 3600)

        try:
            collections = [c.name for c in self._client.get_collections().collections]
            if pool not in collections:
                return 0

            self._client.delete(
                collection_name=pool,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="uploaded_at",
                                range=models.Range(lt=cutoff),
                            )
                        ]
                    )
                ),
            )
            logger.info("Purged resume chunks older than %dh from %s", ttl_hours, pool)
        except Exception as e:
            logger.warning("Resume purge failed: %s", e)


_instance: Optional[QdrantService] = None


def get_qdrant(
    url: str = "http://localhost:6333",
    api_key: str = "",
    collection: str = "portfolio",
    force_new: bool = False,
) -> QdrantService:
    global _instance
    if force_new or _instance is None:
        _instance = QdrantService(url=url, api_key=api_key, collection=collection)
    return _instance
