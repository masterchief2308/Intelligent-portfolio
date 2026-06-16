"""GET /api/architecture/{slug} — Return React Flow graph definitions."""

import json
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter()

_architecture_data: dict = {}


def _load_architectures() -> dict:
    global _architecture_data
    if not _architecture_data:
        data_path = Path(__file__).parent.parent / "data" / "architectures.json"
        if data_path.exists():
            _architecture_data = json.loads(data_path.read_text(encoding="utf-8"))
        else:
            # Inline default architectures from the portfolio
            _architecture_data = {
                "iocl-tender-evaluation": {
                    "slug": "iocl-tender-evaluation",
                    "nodes": [
                        {"id": "user", "type": "custom", "x": -400, "y": 200, "label": "User / IOCL Officer", "isExternal": True},
                        {"id": "gcp", "type": "group", "x": 0, "y": -50, "width": 1200, "height": 900, "label": "Google Cloud Platform", "badge": "GCP"},
                        {"id": "frontend", "type": "custom", "x": 50, "y": 50, "label": "React Frontend", "badge": "RUN", "parentId": "gcp"},
                        {"id": "api", "type": "custom", "x": 50, "y": 250, "label": "FastAPI Gateway", "badge": "RUN", "parentId": "gcp"},
                        {"id": "pubsub", "type": "custom", "x": 400, "y": 250, "label": "Pub/Sub Queue", "badge": "MSG", "parentId": "gcp"},
                        {"id": "ocr", "type": "custom", "x": 400, "y": 450, "label": "Qwen2-VL OCR", "badge": "AI", "parentId": "gcp"},
                        {"id": "classifier", "type": "custom", "x": 700, "y": 450, "label": "Llama 4 Scout", "badge": "AI", "parentId": "gcp"},
                        {"id": "rag", "type": "custom", "x": 700, "y": 250, "label": "BM25 + FAISS RAG", "badge": "AI", "parentId": "gcp"},
                        {"id": "generator", "type": "custom", "x": 700, "y": 50, "label": "Qwen 32B Report Gen", "badge": "AI", "parentId": "gcp"},
                        {"id": "db", "type": "custom", "x": 50, "y": 650, "label": "PostgreSQL + Redis", "badge": "DB", "parentId": "gcp"},
                        {"id": "storage", "type": "custom", "x": 400, "y": 650, "label": "Cloud Storage", "badge": "GCS", "parentId": "gcp"},
                    ],
                    "edges": [
                        {"source": "user", "target": "frontend", "animated": True},
                        {"source": "frontend", "target": "api", "animated": True},
                        {"source": "api", "target": "pubsub", "label": "Upload Event"},
                        {"source": "pubsub", "target": "ocr", "animated": True, "label": "Celery"},
                        {"source": "ocr", "target": "classifier", "label": "Classified Docs"},
                        {"source": "classifier", "target": "rag", "label": "Extraction"},
                        {"source": "rag", "target": "generator", "label": "Extracted Data"},
                        {"source": "api", "target": "db", "dashed": True},
                        {"source": "ocr", "target": "storage", "dashed": True, "label": "Raw PDFs"},
                    ],
                },
                "km-tech-int-forensics": {
                    "slug": "km-tech-int-forensics",
                    "nodes": [
                        {"id": "investigator", "type": "custom", "x": -400, "y": 200, "label": "Investigator", "isExternal": True},
                        {"id": "gcp", "type": "group", "x": 0, "y": -50, "width": 1000, "height": 700, "label": "Google Cloud Platform", "badge": "GCP"},
                        {"id": "frontend", "type": "custom", "x": 50, "y": 50, "label": "React + D3.js", "badge": "RUN", "parentId": "gcp"},
                        {"id": "api", "type": "custom", "x": 50, "y": 250, "label": "Django API", "badge": "RUN", "parentId": "gcp"},
                        {"id": "gemini", "type": "custom", "x": 400, "y": 250, "label": "Gemini 2.5 Flash", "badge": "AI", "parentId": "gcp"},
                        {"id": "neo4j", "type": "custom", "x": 400, "y": 450, "label": "Neo4j Graph DB", "badge": "DB", "parentId": "gcp"},
                        {"id": "pgvector", "type": "custom", "x": 700, "y": 250, "label": "pgvector Search", "badge": "DB", "parentId": "gcp"},
                        {"id": "postgres", "type": "custom", "x": 700, "y": 450, "label": "PostgreSQL", "badge": "DB", "parentId": "gcp"},
                    ],
                    "edges": [
                        {"source": "investigator", "target": "frontend", "animated": True},
                        {"source": "frontend", "target": "api", "animated": True},
                        {"source": "api", "target": "gemini", "label": "Entity Extraction"},
                        {"source": "gemini", "target": "neo4j", "label": "Graph Ingest"},
                        {"source": "api", "target": "pgvector", "label": "Semantic Search"},
                        {"source": "pgvector", "target": "postgres", "dashed": True},
                        {"source": "neo4j", "target": "frontend", "label": "Graph Viz", "dashed": True},
                    ],
                },
                "azolla-casper": {
                    "slug": "azolla-casper",
                    "nodes": [
                        {"id": "user", "type": "custom", "x": -400, "y": 200, "label": "Fleet Manager", "isExternal": True},
                        {"id": "aws", "type": "group", "x": 0, "y": -50, "width": 900, "height": 600, "label": "Amazon Web Services", "badge": "AWS"},
                        {"id": "frontend", "type": "custom", "x": 50, "y": 50, "label": "React (Amplify)", "badge": "RUN", "parentId": "aws"},
                        {"id": "api", "type": "custom", "x": 50, "y": 250, "label": "Django API", "badge": "RUN", "parentId": "aws"},
                        {"id": "ml", "type": "custom", "x": 400, "y": 250, "label": "scikit-learn ML", "badge": "AI", "parentId": "aws"},
                        {"id": "celery", "type": "custom", "x": 400, "y": 50, "label": "Celery + Redis", "badge": "MSG", "parentId": "aws"},
                        {"id": "ses", "type": "custom", "x": 650, "y": 50, "label": "AWS SES Alerts", "badge": "MSG", "parentId": "aws"},
                        {"id": "db", "type": "custom", "x": 400, "y": 450, "label": "MSSQL", "badge": "DB", "parentId": "aws"},
                    ],
                    "edges": [
                        {"source": "user", "target": "frontend", "animated": True},
                        {"source": "frontend", "target": "api", "animated": True},
                        {"source": "api", "target": "ml", "label": "Forecast Request"},
                        {"source": "ml", "target": "db", "dashed": True, "label": "Vessel Data"},
                        {"source": "celery", "target": "ses", "label": "Nightly Alerts"},
                        {"source": "api", "target": "celery", "label": "Pool Dive"},
                    ],
                },
            }
    return _architecture_data


@router.get("/api/architecture/{slug}")
async def get_architecture(slug: str):
    """Return React Flow node/edge definitions for a project."""
    architectures = _load_architectures()

    if slug not in architectures:
        raise HTTPException(status_code=404, detail=f"Architecture not found: {slug}")

    return architectures[slug]
