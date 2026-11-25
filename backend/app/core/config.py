"""Typed application settings loaded from the environment."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

MIN_SECRET_LENGTH = 32
_PLACEHOLDER_PREFIX = "cambia_esto"
_REPO_ROOT = Path(__file__).resolve().parents[3]
_ENV_FILE = _REPO_ROOT / ".env"


class Settings(BaseSettings):
    """Application configuration.

    Secrets have no defaults: startup fails if they are missing.
    """

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    ENV: Literal["development", "production", "test"] = "development"
    SITE_NAME: str = "dev/null"
    # URL pública del blog (canonical, RSS, sitemap y detección de referrers internos).
    SITE_URL: str = "http://localhost:3000"

    DATABASE_URL: str
    REDIS_URL: str

    JWT_SECRET: SecretStr
    REFRESH_SECRET: SecretStr
    METRICS_SALT_SECRET: SecretStr
    REVALIDATE_SECRET: SecretStr

    ACCESS_TOKEN_TTL_MINUTES: int = 15
    REFRESH_TOKEN_TTL_DAYS: int = 7
    COOKIE_SECURE: bool = False

    # URL interna de Next.js para el webhook de revalidación.
    WEB_URL: str
    REVALIDATE_MAX_ATTEMPTS: int = 3
    REVALIDATE_BACKOFF_SECONDS: float = 1.0

    MEDIA_DIR: Path = Path("media")
    MEDIA_URL_PREFIX: str = "/media"
    MEDIA_MAX_BYTES: int = 10 * 1024 * 1024

    # Rate limiting (peticiones por ventana de 60 s, por IP).
    RATE_LIMIT_LOGIN_PER_MINUTE: int = 5
    RATE_LIMIT_EVENTS_PER_MINUTE: int = 60
    RATE_LIMIT_PUBLIC_PER_MINUTE: int = 300
    # Confía en X-Forwarded-For (Caddy / Next.js delante de la API). Desactivado por
    # defecto: solo actívalo si la API NO es accesible sin pasar por el proxy.
    TRUST_PROXY_HEADERS: bool = False
    # Número de proxies de confianza encadenados delante de la API.
    TRUSTED_PROXY_HOPS: int = Field(default=1, ge=1, le=5)

    PUBLIC_CACHE_TTL_SECONDS: int = 60

    # Hora UTC de la agregación nocturna de métricas.
    METRICS_AGGREGATION_HOUR_UTC: int = 0
    METRICS_AGGREGATION_MINUTE_UTC: int = 15
    METRICS_RETENTION_MONTHS: int = 13

    @model_validator(mode="after")
    def _check_production_secrets(self) -> "Settings":
        """In production, refuse placeholder, short or reused secrets and insecure cookies."""
        if self.ENV != "production":
            return self
        secrets = {
            "JWT_SECRET": self.JWT_SECRET.get_secret_value(),
            "REFRESH_SECRET": self.REFRESH_SECRET.get_secret_value(),
            "METRICS_SALT_SECRET": self.METRICS_SALT_SECRET.get_secret_value(),
            "REVALIDATE_SECRET": self.REVALIDATE_SECRET.get_secret_value(),
        }
        problems: list[str] = []
        for name, value in secrets.items():
            if len(value) < MIN_SECRET_LENGTH:
                problems.append(f"{name} debe tener al menos {MIN_SECRET_LENGTH} caracteres")
            if value.lower().startswith(_PLACEHOLDER_PREFIX):
                problems.append(f"{name} usa el valor de ejemplo")
        if len(set(secrets.values())) != len(secrets):
            problems.append("los secretos deben ser distintos entre sí")
        if not self.COOKIE_SECURE:
            problems.append("COOKIE_SECURE debe ser true en producción")
        if problems:
            raise ValueError("Configuración insegura en producción: " + "; ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings instance."""
    # Los campos requeridos se resuelven desde el entorno o el archivo .env.
    return Settings()  # type: ignore[call-arg]
