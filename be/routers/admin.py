"""Admin endpoints:
- POST /api/admin/auth — Login with passphrase
- GET /api/admin/config — Get config (JWT protected)
- PUT /api/admin/config — Update config (JWT protected)
- POST /api/admin/cache/clear — Clear personalization cache (JWT protected)
"""

import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from config import get_settings
from models.schemas import (
    AdminAuthRequest,
    AdminAuthResponse,
    AdminConfig,
    AdminConfigUpdate,
    RagPrompt,
)
from services.firestore import get_firestore

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()


# ── JWT Helpers ──────────────────────────────────────────────────

def create_token(data: dict) -> tuple[str, str]:
    """Create a JWT token and return (token, expires_at)."""
    settings = get_settings()
    expires = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRY_HOURS)
    payload = {**data, "exp": expires}
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
    return token, expires.isoformat()


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Verify JWT token from Authorization header. Returns subject."""
    settings = get_settings()
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=["HS256"])
        return payload.get("sub", "admin")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Endpoints ────────────────────────────────────────────────────

@router.post("/api/admin/auth", response_model=AdminAuthResponse)
async def admin_auth(request: AdminAuthRequest):
    """Authenticate admin with passphrase."""
    settings = get_settings()

    if request.passphrase != settings.ADMIN_PASSPHRASE:
        raise HTTPException(status_code=401, detail="Invalid passphrase")

    token, expires_at = create_token({"sub": "admin"})
    return AdminAuthResponse(token=token, expires_at=expires_at)


@router.get("/api/admin/config", response_model=AdminConfig)
async def get_config(_: str = Depends(verify_token)):
    """Get current admin configuration."""
    settings = get_settings()
    firestore = get_firestore()
    stored = await firestore.get_admin_config()

    if stored:
        return AdminConfig(**stored)

    # Default config
    return AdminConfig(
        scraping_timeout_ms=settings.SCRAPING_TIMEOUT_MS,
        fallback_enabled=settings.FALLBACK_ENABLED,
        api_keys={
            "gemini": settings.GEMINI_API_KEY[:8] + "****" if settings.GEMINI_API_KEY else "",
        },
        backend_version=settings.BACKEND_VERSION,
        last_sync=datetime.now(timezone.utc).isoformat(),
        rag_prompts=[
            RagPrompt(
                id="recruiter_personalization",
                name="Recruiter Personalization",
                template="You are personalizing a portfolio for a recruiter at {company}...",
                model="gemini-2.5-flash",
                temperature=0.7,
                max_tokens=1024,
                description="Generates personalized landing page content for recruiters",
                updated_at=datetime.now(timezone.utc).isoformat(),
            ),
            RagPrompt(
                id="engineer_personalization",
                name="Engineer Personalization",
                template="You are personalizing a portfolio for a fellow engineer...",
                model="gemini-2.5-flash",
                temperature=0.5,
                max_tokens=1024,
                description="Generates tech-focused content for visiting engineers",
                updated_at=datetime.now(timezone.utc).isoformat(),
            ),
            RagPrompt(
                id="manager_personalization",
                name="Manager Personalization",
                template="You are personalizing for an engineering manager...",
                model="gemini-2.5-flash",
                temperature=0.6,
                max_tokens=1024,
                description="Generates impact-focused content for managers",
                updated_at=datetime.now(timezone.utc).isoformat(),
            ),
        ],
    )


@router.put("/api/admin/config", response_model=AdminConfig)
async def update_config(
    update: AdminConfigUpdate,
    _: str = Depends(verify_token),
):
    """Partially update admin configuration."""
    firestore = get_firestore()

    # Get current config
    current = await get_config()
    current_dict = current.model_dump()

    # Apply updates
    if update.scraping_timeout_ms is not None:
        current_dict["scraping_timeout_ms"] = update.scraping_timeout_ms
    if update.fallback_enabled is not None:
        current_dict["fallback_enabled"] = update.fallback_enabled
    if update.rag_prompts is not None:
        current_dict["rag_prompts"] = [p.model_dump() for p in update.rag_prompts]

    current_dict["last_sync"] = datetime.now(timezone.utc).isoformat()

    # Save
    await firestore.save_admin_config(current_dict)

    return AdminConfig(**current_dict)


@router.post("/api/admin/cache/clear")
async def clear_cache(_: str = Depends(verify_token)):
    """Clear all cached personalizations."""
    firestore = get_firestore()
    count = await firestore.clear_personalizations()
    return {"cleared": count, "message": f"Cleared {count} cached personalizations"}
