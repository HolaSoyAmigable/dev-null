"""Async SQLAlchemy engine, session factory and dependency."""

from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()

_engine_options: dict[str, Any] = {
    "pool_pre_ping": True,
    # Timeout corto para no colgar la comprobación de readiness si la BD no responde.
    "connect_args": {"timeout": 3.0},
}
if settings.ENV == "test":
    # En tests cada caso puede usar su propio event loop; sin pool evitamos conexiones huérfanas.
    _engine_options = {"poolclass": NullPool, "connect_args": {"timeout": 3.0}}

engine: AsyncEngine = create_async_engine(settings.DATABASE_URL, **_engine_options)

async_session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """Yield a database session scoped to one request."""
    async with async_session_factory() as session:
        yield session
