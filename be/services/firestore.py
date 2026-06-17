"""
Firestore service — production-ready, no in-memory fallback.
Collections: personalizations, chat_sessions, visits, admin_config
TTL: 5 days for personalizations and chat sessions.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

try:
    from google.cloud import firestore
except ImportError:
    firestore = None

logger = logging.getLogger(__name__)

SESSION_TTL_DAYS = 5


class FirestoreService:
    """Firestore-backed persistence. Requires USE_FIRESTORE=True and valid project_id."""

    def __init__(self, use_firestore: bool = False, project_id: str = ""):
        self._use_firestore = use_firestore
        self._db = None

        if use_firestore and project_id:
            if firestore is None:
                logger.error("google-cloud-firestore not installed. pip install google-cloud-firestore")
                raise ImportError("google-cloud-firestore is required when USE_FIRESTORE=True")
            try:
                self._db = firestore.Client(project=project_id)
                logger.info("Connected to Firestore project: %s", project_id)
            except Exception as e:
                logger.error("Failed to connect to Firestore: %s", e)
                raise
        else:
            logger.warning("Firestore disabled. Data will NOT persist across restarts.")
            # Minimal in-memory store for local dev only
            self._mem: dict[str, dict[str, Any]] = {
                "personalizations": {},
                "chat_sessions": {},
                "visits": {},
                "admin_config": {},
            }

    # ── Personalization Cache (5-day TTL) ────────────────────────

    async def get_personalization(self, email: str) -> Optional[dict]:
        """Check cache for existing personalization (5-day TTL)."""
        key = email.lower().strip()
        ttl = timedelta(days=SESSION_TTL_DAYS)

        if self._db:
            doc = self._db.collection("personalizations").document(key).get()
            if doc.exists:
                data = doc.to_dict()
                created = data.get("created_at", datetime.min)
                if isinstance(created, str):
                    created = datetime.fromisoformat(created)
                if datetime.now(timezone.utc) - created.replace(tzinfo=timezone.utc) < ttl:
                    return data
            return None

        # In-memory fallback (local dev)
        data = self._mem["personalizations"].get(key)
        if data:
            created = data.get("created_at", "")
            if isinstance(created, str) and created:
                created_dt = datetime.fromisoformat(created)
                if datetime.now(timezone.utc) - created_dt.replace(tzinfo=timezone.utc) < ttl:
                    return data
        return None

    async def save_personalization(self, email: str, data: dict) -> None:
        """Store personalization result with timestamp."""
        key = email.lower().strip()
        data["created_at"] = datetime.now(timezone.utc).isoformat()

        if self._db:
            self._db.collection("personalizations").document(key).set(data)
        else:
            self._mem["personalizations"][key] = data

    async def clear_personalizations(self) -> int:
        """Clear all cached personalizations. Returns count cleared."""
        if self._db:
            docs = self._db.collection("personalizations").stream()
            count = 0
            for doc in docs:
                doc.reference.delete()
                count += 1
            return count

        count = len(self._mem["personalizations"])
        self._mem["personalizations"].clear()
        return count

    # ── Chat Sessions (5-day TTL) ────────────────────────────────

    async def save_chat_message(
        self, session_id: str, role: str, content: str
    ) -> None:
        """Append a message to a chat session."""
        msg = {
            "role": role,
            "content": content,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        if self._db:
            doc_ref = self._db.collection("chat_sessions").document(session_id)
            doc = doc_ref.get()
            if doc.exists:
                doc_ref.update({
                    "messages": firestore.ArrayUnion([msg]),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
            else:
                doc_ref.set({
                    "session_id": session_id,
                    "messages": [msg],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
        else:
            sessions = self._mem["chat_sessions"]
            if session_id not in sessions:
                sessions[session_id] = {
                    "session_id": session_id,
                    "messages": [],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            sessions[session_id]["messages"].append(msg)
            sessions[session_id]["updated_at"] = datetime.now(timezone.utc).isoformat()

    async def get_chat_history(
        self, session_id: str, max_messages: int = 20
    ) -> list[dict]:
        """Retrieve chat history for a session (within 5-day TTL)."""
        ttl = timedelta(days=SESSION_TTL_DAYS)

        if self._db:
            doc = self._db.collection("chat_sessions").document(session_id).get()
            if doc.exists:
                data = doc.to_dict()
                created = data.get("created_at", datetime.min)
                if isinstance(created, str):
                    created = datetime.fromisoformat(created)
                if datetime.now(timezone.utc) - created.replace(tzinfo=timezone.utc) < ttl:
                    return data.get("messages", [])[-max_messages:]
            return []

        # In-memory
        session = self._mem["chat_sessions"].get(session_id, {})
        if session:
            created = session.get("created_at", "")
            if isinstance(created, str) and created:
                created_dt = datetime.fromisoformat(created)
                if datetime.now(timezone.utc) - created_dt.replace(tzinfo=timezone.utc) < ttl:
                    return session.get("messages", [])[-max_messages:]
        return []

    # ── Visits / Analytics ───────────────────────────────────────

    async def track_visit(self, visit: dict) -> None:
        """Record a visitor."""
        visit_id = f"{visit['email']}_{visit.get('timestamp', datetime.now(timezone.utc).isoformat())}"

        if self._db:
            self._db.collection("visits").document(visit_id).set(visit)
        else:
            self._mem["visits"][visit_id] = visit

    async def get_analytics(self) -> dict:
        """Aggregate visitor analytics."""
        if self._db:
            docs = list(self._db.collection("visits").stream())
            visits = [doc.to_dict() for doc in docs]
        else:
            visits = list(self._mem["visits"].values())

        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)

        by_role: dict[str, int] = {}
        this_week = 0

        for v in visits:
            role = v.get("role", "other")
            by_role[role] = by_role.get(role, 0) + 1

            ts = v.get("timestamp", "")
            if isinstance(ts, str) and ts:
                try:
                    visit_dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    if visit_dt > week_ago:
                        this_week += 1
                except ValueError:
                    pass

        recent = sorted(visits, key=lambda x: x.get("timestamp", ""), reverse=True)[:10]

        return {
            "total_visitors": len(visits),
            "visitors_this_week": this_week,
            "by_role": by_role,
            "recent_visitors": [
                {
                    "email": v.get("email"),
                    "role": v.get("role"),
                    "company": v.get("company"),
                    "timestamp": v.get("timestamp"),
                }
                for v in recent
            ],
            "top_projects_viewed": [],
        }

    # ── Admin Config ─────────────────────────────────────────────

    async def get_admin_config(self) -> Optional[dict]:
        if self._db:
            doc = self._db.collection("admin_config").document("current").get()
            return doc.to_dict() if doc.exists else None
        return self._mem["admin_config"].get("current")

    async def save_admin_config(self, config: dict) -> None:
        if self._db:
            self._db.collection("admin_config").document("current").set(config)
        else:
            self._mem["admin_config"]["current"] = config


    # ── Dynamic Generation Cache ─────────────────────────────────

    async def get_dynamic_project(self, email: str, slug: str) -> Optional[dict]:
        if not email or not slug:
            return None
        key = email.lower().strip()
        if self._db:
            doc = self._db.collection("personalizations").document(key).collection("projects").document(slug).get()
            return doc.to_dict() if doc.exists else None
        
        # In-memory fallback
        return self._mem.setdefault("dynamic_projects", {}).get(f"{key}_{slug}")

    async def save_dynamic_project(self, email: str, slug: str, data: dict) -> None:
        if not email or not slug:
            return
        key = email.lower().strip()
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        if self._db:
            self._db.collection("personalizations").document(key).collection("projects").document(slug).set(data)
        else:
            self._mem.setdefault("dynamic_projects", {})[f"{key}_{slug}"] = data

    async def get_dynamic_architecture(self, email: str, slug: str) -> Optional[dict]:
        if not email or not slug:
            return None
        key = email.lower().strip()
        if self._db:
            doc = self._db.collection("personalizations").document(key).collection("architectures").document(slug).get()
            return doc.to_dict() if doc.exists else None
        
        # In-memory fallback
        return self._mem.setdefault("dynamic_architectures", {}).get(f"{key}_{slug}")

    async def save_dynamic_architecture(self, email: str, slug: str, data: dict) -> None:
        if not email or not slug:
            return
        key = email.lower().strip()
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        if self._db:
            self._db.collection("personalizations").document(key).collection("architectures").document(slug).set(data)
        else:
            self._mem.setdefault("dynamic_architectures", {})[f"{key}_{slug}"] = data

    async def get_dynamic_portfolio(self, email: str) -> Optional[dict]:
        if not email:
            return None
        key = email.lower().strip()
        if self._db:
            doc = self._db.collection("personalizations").document(key).collection("portfolio").document("main").get()
            return doc.to_dict() if doc.exists else None
        
        # In-memory fallback
        return self._mem.setdefault("dynamic_portfolio", {}).get(key)

    async def save_dynamic_portfolio(self, email: str, data: dict) -> None:
        if not email:
            return
        key = email.lower().strip()
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        if self._db:
            self._db.collection("personalizations").document(key).collection("portfolio").document("main").set(data)
        else:
            self._mem.setdefault("dynamic_portfolio", {})[key] = data

# Singleton
_instance: Optional[FirestoreService] = None


def get_firestore(use_firestore: bool = False, project_id: str = "") -> FirestoreService:
    global _instance
    if _instance is None:
        _instance = FirestoreService(use_firestore=use_firestore, project_id=project_id)
    return _instance
