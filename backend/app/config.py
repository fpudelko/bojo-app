from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables / .env file."""

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # External APIs
    google_places_api_key: str = ""

    # Redis
    redis_url: str = "redis://localhost:6379"

    # CORS — comma-separated in env, parsed as list by pydantic
    allowed_origins: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


# Singleton — import this object everywhere
settings = Settings()
