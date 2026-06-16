"""Analytics endpoints:
- POST /api/analytics/visit — Track visitor (public)
- GET /api/admin/analytics — Dashboard stats (JWT protected)
"""

import logging
from fastapi import APIRouter, Depends, HTTPException

from models.schemas import VisitRequest, AnalyticsDashboard
from services.firestore import get_firestore
from routers.admin import verify_token

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/analytics/visit")
async def track_visit(visit: VisitRequest):
    """Silently track a visitor after personalization."""
    firestore = get_firestore()
    await firestore.track_visit(visit.model_dump())
    return {"tracked": True}


@router.get("/api/admin/analytics", response_model=AnalyticsDashboard)
async def get_analytics(_: str = Depends(verify_token)):
    """Admin-only: return aggregated visitor analytics."""
    firestore = get_firestore()
    data = await firestore.get_analytics()
    return AnalyticsDashboard(**data)
