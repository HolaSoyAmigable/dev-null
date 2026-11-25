"""Shared builder for the ASGI applications (lifespan, errors, docs, OpenAPI extras)."""

import logging
from collections.abc import AsyncIterator, Iterable, Sequence
from contextlib import asynccontextmanager
from typing import Any, Literal

from fastapi import APIRouter, FastAPI
from pydantic import BaseModel
from pydantic.json_schema import models_json_schema

from app.core.config import get_settings
from app.core.db import engine
from app.core.errors import ErrorResponse, register_error_handlers
from app.core.logging import configure_logging
from app.core.redis import close_redis

API_PREFIX = "/api/v1"

logger = logging.getLogger(__name__)


def _register_extra_schemas(app: FastAPI, models: Iterable[type[BaseModel]]) -> None:
    """Add schemas that no route declares (error envelope, beacon body) to the OpenAPI document."""
    original = app.openapi
    extra: list[tuple[type[BaseModel], Literal["validation"]]] = [
        (model, "validation") for model in models
    ]

    def openapi() -> dict[str, Any]:
        if app.openapi_schema is None:
            schema = original()
            components = schema.setdefault("components", {}).setdefault("schemas", {})
            _, definitions = models_json_schema(extra, ref_template="#/components/schemas/{model}")
            components.update(definitions.get("$defs", {}))
            app.openapi_schema = schema
        return app.openapi_schema

    app.openapi = openapi  # type: ignore[method-assign]


def build_app(
    *,
    name: str,
    description: str,
    routers: Sequence[APIRouter],
    extra_models: Sequence[type[BaseModel]] = (),
) -> FastAPI:
    """Build a FastAPI application with the settings every devnull API shares."""
    configure_logging()
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        logger.info("%s starting (env=%s)", name, settings.ENV)
        yield
        await close_redis()
        await engine.dispose()
        logger.info("%s stopped", name)

    app = FastAPI(
        title=f"{settings.SITE_NAME} — {name}",
        description=description,
        version="1.0.0",
        lifespan=lifespan,
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=f"{API_PREFIX}/docs" if settings.ENV != "production" else None,
        redoc_url=None,
    )
    for router in routers:
        app.include_router(router, prefix=API_PREFIX)
    register_error_handlers(app)
    _register_extra_schemas(app, (ErrorResponse, *extra_models))
    return app
