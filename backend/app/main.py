"""FastAPI application entry point."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.db import engine
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.core.redis import close_redis
from app.modules.auth.router import router as auth_router
from app.modules.career.router import router as career_router
from app.modules.health.router import router as health_router
from app.modules.media.router import router as media_router
from app.modules.metrics.router import router as metrics_router
from app.modules.posts.router import router as posts_router
from app.modules.projects.router import router as projects_router
from app.modules.public.router import router as public_router
from app.modules.settings.router import router as settings_router
from app.modules.taxonomy.router import router as taxonomy_router

API_PREFIX = "/api/v1"

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Open shared resources on startup and release them on shutdown."""
    settings = get_settings()
    logger.info("Application starting (env=%s)", settings.ENV)
    yield
    await close_redis()
    await engine.dispose()
    logger.info("Application stopped")


def _register_extra_schemas(app: FastAPI) -> None:
    """Add schemas referenced manually (e.g. the beacon body) to the OpenAPI document."""
    from typing import Any

    from pydantic.json_schema import models_json_schema

    from app.modules.public.router import OPENAPI_EXTRA_MODELS

    original = app.openapi

    def openapi() -> dict[str, Any]:
        if app.openapi_schema is None:
            schema = original()
            components = schema.setdefault("components", {}).setdefault("schemas", {})
            _, definitions = models_json_schema(
                [(model, "validation") for model in OPENAPI_EXTRA_MODELS],
                ref_template="#/components/schemas/{model}",
            )
            components.update(definitions.get("$defs", {}))
            app.openapi_schema = schema
        return app.openapi_schema

    app.openapi = openapi  # type: ignore[method-assign]


def create_app() -> FastAPI:
    """Build the FastAPI application."""
    configure_logging()
    settings = get_settings()

    app = FastAPI(
        title=f"{settings.SITE_NAME} API",
        version="1.0.0",
        lifespan=lifespan,
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=f"{API_PREFIX}/docs" if settings.ENV != "production" else None,
        redoc_url=None,
    )
    for router in (
        health_router,
        auth_router,
        public_router,
        posts_router,
        taxonomy_router,
        projects_router,
        career_router,
        settings_router,
        media_router,
        metrics_router,
    ):
        app.include_router(router, prefix=API_PREFIX)
    register_error_handlers(app)
    _register_extra_schemas(app)

    if settings.ENV != "production":
        # En producción Caddy sirve /media directamente desde el volumen.
        settings.MEDIA_DIR.mkdir(parents=True, exist_ok=True)
        app.mount(
            settings.MEDIA_URL_PREFIX,
            StaticFiles(directory=settings.MEDIA_DIR),
            name="media",
        )
    return app


app = create_app()
