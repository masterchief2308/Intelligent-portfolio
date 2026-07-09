"""Shared SlowAPI limiter — one instance, real client IP behind Cloud Run."""

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def get_real_client_ip(request: Request) -> str:
    """Use X-Forwarded-For on Cloud Run; fall back to direct remote address."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


# Single limiter for the whole app — do not create per-router Limiters.
limiter = Limiter(key_func=get_real_client_ip)

# Generous defaults for a low-traffic portfolio (~5–10 visitors).
# Per real client IP, not shared across all users.
LIMIT_PERSONALIZE_PIPELINE = "30/minute"
LIMIT_RESUME_COMPARE = "30/minute"
LIMIT_RECRUITER_UPLOAD = "30/minute"
LIMIT_RECRUITER_MATCH = "30/minute"
LIMIT_RECRUITER_POOL_READ = "60/minute"
LIMIT_RECRUITER_POOL_CLEAR = "10/minute"
