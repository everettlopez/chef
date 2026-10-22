from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET_KEY = "dev-only-change-me-dev-only-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "mysql+pymysql://pantry:pantry@127.0.0.1:3307/pantry?charset=utf8mb4"
    test_database_url: str = (
        "mysql+pymysql://pantry:pantry@127.0.0.1:3307/pantry_test?charset=utf8mb4"
    )
    # Scratch database for the Alembic upgrade/downgrade round-trip test.
    migrate_database_url: str = (
        "mysql+pymysql://pantry:pantry@127.0.0.1:3307/pantry_migrate?charset=utf8mb4"
    )
    cors_origins: list[str] = ["http://localhost:5173"]

    # Signs session tokens. Override in backend/.env for anything but local dev.
    secret_key: str = DEV_SECRET_KEY
    session_cookie_name: str = "chef_session"
    # Set true when served over HTTPS.
    session_cookie_secure: bool = False
    session_days: int = 14

    @model_validator(mode="after")
    def _real_secret_when_deployed(self) -> "Settings":
        # Secure cookies mean a real HTTPS deployment, where the public dev key would let
        # anyone forge a session.
        if self.session_cookie_secure and self.secret_key == DEV_SECRET_KEY:
            raise ValueError("Set SECRET_KEY when SESSION_COOKIE_SECURE is true")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
