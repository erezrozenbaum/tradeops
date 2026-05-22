from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str
    SECRET_KEY: str
    ANTHROPIC_API_KEY: str = ""
    ALPHA_VANTAGE_API_KEY: str = ""
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    WORKERS_ENABLED: bool = True
    # Comma-separated list of allowed CORS origins.
    # Example: ALLOWED_ORIGINS=http://localhost:3000,https://tradeops.example.com
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    # Per-investor AI spend cap over a rolling 30-day window (USD). 0 = unlimited.
    AI_MONTHLY_BUDGET_USD: float = 0.0
    # Redis URL for distributed rate limiting. Leave empty to use in-memory fallback.
    # Example: redis://redis:6379/0
    REDIS_URL: str = ""

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    ALERT_FROM_EMAIL: str = ""

    # Langfuse — AI observability (all optional; tracing is silently disabled when unset)
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"

    # OpenTelemetry OTLP gRPC endpoint (optional; leave empty to skip export)
    OTEL_EXPORTER_OTLP_ENDPOINT: str = ""

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def langfuse_enabled(self) -> bool:
        return bool(self.LANGFUSE_PUBLIC_KEY and self.LANGFUSE_SECRET_KEY)

    @property
    def otel_enabled(self) -> bool:
        return bool(self.OTEL_EXPORTER_OTLP_ENDPOINT)


settings = Settings()
