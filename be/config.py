from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_API_KEY_FALLBACK: str = ""

    # Firestore
    FIRESTORE_PROJECT_ID: str = ""
    USE_FIRESTORE: bool = False  # False = in-memory fallback for local dev

    # Qdrant
    QDRANT_URL: str = "http://qdrant:6333"
    QDRANT_API_KEY: str = ""
    QDRANT_COLLECTION: str = "portfolio"

    # Admin
    ADMIN_PASSPHRASE: str = "admin_dev_2026"
    JWT_SECRET: str = "dev-secret-change-in-prod"
    JWT_EXPIRY_HOURS: int = 24

    # Scraping
    SCRAPING_TIMEOUT_MS: int = 5000
    FALLBACK_ENABLED: bool = True

    # App
    BACKEND_VERSION: str = "0.1.0"
    CORS_ORIGINS: str = "http://localhost:3000"
    
    # Defaults
    @property
    def scraping_config(self):
        # Local import to avoid circular dependency if schemas imports config
        from models.schemas import ScrapeTokenConfig
        return ScrapeTokenConfig()

    model_config = {"env_file": [".env", "/secrets/.env"], "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
