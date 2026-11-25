"""Administration API: authentication and the CMS endpoints used by the admin panel.

Debe poder alcanzarse desde cualquier red (el administrador entra desde donde esté);
la protección es la autenticación (Argon2id, JWT de vida corta, refresh `httpOnly`,
rate limit de login), no la red (`uvicorn app.apps.admin:app`).
"""

from fastapi import FastAPI

from app.apps.factory import build_app
from app.modules.auth.router import router as auth_router
from app.modules.career.router import router as career_router
from app.modules.health.router import router as health_router
from app.modules.media.router import router as media_router
from app.modules.metrics.router import router as metrics_router
from app.modules.posts.router import router as posts_router
from app.modules.projects.router import router as projects_router
from app.modules.settings.router import router as settings_router
from app.modules.taxonomy.router import router as taxonomy_router


def create_admin_app() -> FastAPI:
    """Build the administration FastAPI application."""
    return build_app(
        name="API de administración",
        description="Autenticación y gestión de contenido, medios, ajustes y métricas.",
        routers=(
            health_router,
            auth_router,
            posts_router,
            taxonomy_router,
            projects_router,
            career_router,
            settings_router,
            media_router,
            metrics_router,
        ),
    )


app = create_admin_app()
