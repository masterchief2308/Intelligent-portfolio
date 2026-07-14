"""
FastAPI application entrypoint for the Intelligent Portfolio backend.
Provides all REST API routes with rate limiting and security hardening.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from config import get_settings
from rate_limit import limiter
from services.firestore import get_firestore
from services.scraper import get_scraper
from services.qdrant import get_qdrant

# Routers
from routers.portfolio import router as portfolio_router
from routers.personalize import router as personalize_router
from routers.chat import router as chat_router
from routers.architecture import router as architecture_router
from routers.analytics import router as analytics_router
from routers.admin import router as admin_router
from routers.resume_compare import router as resume_compare_router
from routers.project import router as project_router
from routers.recruiter import router as recruiter_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ── Rate Limiter (shared — see rate_limit.py) ────────────────────
from slowapi import _rate_limit_exceeded_handler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events: startup and shutdown.

    Keep startup CHEAP: do not load embedding models here.
    Every cold start that eagerly warmed MiniLM+BM25 billed 30–60s+ of 2Gi CPU
    even for light traffic (/api/portfolio). Qdrant/FastEmbed init on first RAG use.
    """
    settings = get_settings()
    logger.info("Starting up Intelligent Portfolio backend v%s", settings.BACKEND_VERSION)

    import os
    os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY
    os.environ["GOOGLE_API_KEY"] = settings.GEMINI_API_KEY

    get_firestore(
        use_firestore=settings.USE_FIRESTORE,
        project_id=settings.FIRESTORE_PROJECT_ID,
    )
    # Qdrant + resume purge: deferred until first retrieval/upload (see services/qdrant.py)

    yield

    logger.info("Shutting down backend...")
    scraper = get_scraper()
    await scraper.close()


# Initialize FastAPI app
app = FastAPI(
    title="Intelligent Portfolio API",
    version=get_settings().BACKEND_VERSION,
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining"],
)


# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


# Include all routers
app.include_router(portfolio_router, tags=["Portfolio"])
app.include_router(personalize_router, tags=["Personalization"])
app.include_router(chat_router, tags=["Chat"])



app.include_router(architecture_router, tags=["Architecture"])
app.include_router(analytics_router, tags=["Analytics"])
app.include_router(admin_router, tags=["Admin"])
app.include_router(resume_compare_router, tags=["Resume Compare"])
app.include_router(project_router, tags=["Project"])
app.include_router(recruiter_router, tags=["Recruiter"])


@app.get("/health", tags=["Health"])
async def health_check():
    """Liveness / Cloud Run startup probe — process accepts traffic (cheap, no model load)."""
    return {"status": "ok", "version": get_settings().BACKEND_VERSION}


@app.get("/ready", tags=["Health"])
async def readiness_check():
    """Optional deep check: embeddings + Qdrant initialized.

    Not used as Cloud Run startup probe (that would force model load on every cold start).
    Returns ready=true once a RAG path has warmed the client; otherwise warming.
    """
    settings = get_settings()
    qdrant = get_qdrant(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY)
    if not qdrant.is_ready():
        return JSONResponse(
            status_code=200,
            content={
                "status": "warming",
                "embeddings": False,
                "version": settings.BACKEND_VERSION,
            },
        )
    return {
        "status": "ready",
        "embeddings": True,
        "version": settings.BACKEND_VERSION,
    }
