"""Shared fixtures for the test suite.

Los tests usan PostgreSQL y Redis reales (./scripts/dev-up.sh):
- Base de datos `<DB>_test`, creada y migrada automáticamente.
- Redis en la base lógica 15.
"""

import asyncio
import os
import tempfile
from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.engine import make_url

_TEST_DEFAULTS = {
    "JWT_SECRET": "test-jwt-secret-with-enough-length-0123456789",
    "REFRESH_SECRET": "test-refresh-secret-with-enough-length-0123",
    "METRICS_SALT_SECRET": "test-metrics-salt",
    "REVALIDATE_SECRET": "test-revalidate-secret",
    "WEB_URL": "http://web.test",
}
for _name, _value in _TEST_DEFAULTS.items():
    os.environ.setdefault(_name, _value)


def _configure_environment() -> tuple[str, str]:
    """Point the app at test resources before any app module is imported."""
    from app.core.config import Settings

    if os.environ.get("DEVNULL_TEST_ADMIN_DB_URL"):
        # Ya configurado (conftest importado de nuevo como módulo `tests.conftest`).
        return os.environ["DEVNULL_TEST_ADMIN_DB_URL"], os.environ["DEVNULL_TEST_DB_NAME"]

    base = Settings()  # type: ignore[call-arg]
    db_url = make_url(base.DATABASE_URL)
    if db_url.host == "localhost":
        # En Windows "localhost" prueba IPv6 primero y cada conexión espera al timeout.
        db_url = db_url.set(host="127.0.0.1")
    test_db = db_url.set(database=f"{db_url.database}_test")
    redis_base = (
        base.REDIS_URL.rsplit("/", 1)[0] if base.REDIS_URL.count("/") > 2 else base.REDIS_URL
    )
    os.environ.update(
        {
            "ENV": "test",
            "DATABASE_URL": test_db.render_as_string(hide_password=False),
            "REDIS_URL": f"{redis_base.replace('//localhost', '//127.0.0.1')}/15",
            "MEDIA_DIR": tempfile.mkdtemp(prefix="devnull-media-"),
            "REVALIDATE_BACKOFF_SECONDS": "0",
            "TRUST_PROXY_HEADERS": "true",
            "DEVNULL_TEST_ADMIN_DB_URL": db_url.render_as_string(hide_password=False),
            "DEVNULL_TEST_DB_NAME": str(test_db.database),
        }
    )
    return db_url.render_as_string(hide_password=False), str(test_db.database)


_ADMIN_DB_URL, _TEST_DB_NAME = _configure_environment()

from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()


async def _ensure_database() -> None:
    import asyncpg

    url = make_url(_ADMIN_DB_URL).set(drivername="postgresql")
    conn = await asyncpg.connect(url.render_as_string(hide_password=False))
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", _TEST_DB_NAME)
        if not exists:
            await conn.execute(f'CREATE DATABASE "{_TEST_DB_NAME}"')
    finally:
        await conn.close()


@pytest.fixture(scope="session", autouse=True)
def database() -> Iterator[None]:
    """Create the test database and apply every migration (tests migrations too)."""
    from alembic.config import Config

    from alembic import command

    asyncio.run(_ensure_database())
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.downgrade(config, "base")
    command.upgrade(config, "head")
    yield


_TABLES = (
    "engagement_events, page_views, daily_stats, webhook_log, post_revisions, post_tags, "
    "posts, projects, tags, categories, career_entries, media, site_settings, users"
)


@pytest.fixture(autouse=True)
async def clean_state() -> AsyncIterator[None]:
    """Empty every table and the Redis test database before each test."""
    from sqlalchemy import text

    from app.core.db import engine
    from app.core.redis import redis_client

    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {_TABLES} RESTART IDENTITY CASCADE"))
    await redis_client.flushdb()
    yield


@pytest.fixture
def revalidations(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, list[str]]]:
    """Capture revalidation webhook calls instead of sending HTTP requests."""
    from app.modules.revalidation import service

    calls: list[tuple[str, list[str]]] = []

    async def fake_sender(target: str, paths: list[str]) -> int:
        calls.append((target, paths))
        return 200

    monkeypatch.setattr(service, "sender", fake_sender)
    return calls


@pytest.fixture(scope="session")
def app_instance() -> FastAPI:
    from app.main import app

    return app


@pytest.fixture
async def client(
    app_instance: FastAPI, revalidations: list[tuple[str, list[str]]]
) -> AsyncIterator[AsyncClient]:
    """HTTP client bound to the ASGI app."""
    transport = ASGITransport(app=app_instance, client=("203.0.113.10", 50000))
    async with AsyncClient(
        transport=transport, base_url="http://test", timeout=10.0
    ) as http_client:
        yield http_client


from tests.helpers import ADMIN_EMAIL, ADMIN_PASSWORD  # noqa: E402


@pytest.fixture
async def admin_user() -> Any:
    from app.core.db import async_session_factory
    from app.modules.auth import service

    async with async_session_factory() as session:
        return await service.create_admin(session, ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture
async def auth_headers(client: AsyncClient, admin_user: Any) -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
