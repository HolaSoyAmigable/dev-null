"""Public API: read-only content for the blog plus the cookieless metrics beacon.

Es la única API expuesta a los visitantes. No contiene autenticación ni escritura
de contenido (`uvicorn app.apps.public:app`).
"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.apps.factory import build_app
from app.core.config import get_settings
from app.modules.health.router import router as health_router
from app.modules.metrics.schemas import EventIn
from app.modules.public.router import router as public_router


def create_public_app() -> FastAPI:
    """Build the public FastAPI application."""
    settings = get_settings()
    app = build_app(
        name="API pública",
        description="Contenido público del blog y recepción de métricas sin cookies.",
        routers=(health_router, public_router),
        extra_models=(EventIn,),
    )
    if settings.ENV != "production":
        # En producción Caddy sirve /media directamente desde el volumen.
        settings.MEDIA_DIR.mkdir(parents=True, exist_ok=True)
        app.mount(
            settings.MEDIA_URL_PREFIX,
            StaticFiles(directory=settings.MEDIA_DIR),
            name="media",
        )
    return app


app = create_public_app()
