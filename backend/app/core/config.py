from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "mysql+pymysql://pantry:pantry@127.0.0.1:3307/pantry?charset=utf8mb4"
    test_database_url: str = (
        "mysql+pymysql://pantry:pantry@127.0.0.1:3307/pantry_test?charset=utf8mb4"
    )
    cors_origins: list[str] = ["http://localhost:5173"]

    # Signs session tokens. Override in backend/.env for anything but local dev.
    secret_key: str = "dev-only-change-me-dev-only-change-me"
    session_cookie_name: str = "chef_session"
    # Set true when served over HTTPS.
    session_cookie_secure: bool = False
    session_days: int = 14


@lru_cache
def get_settings() -> Settings:
    return Settings()
