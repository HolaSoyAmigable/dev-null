"""Tests for liveness and readiness endpoints."""

from collections.abc import AsyncIterator

from fastapi import FastAPI
from httpx import AsyncClient

READY_HEALTHY = {
    "status": "ready",
    "checks": {"database": "ok", "redis": "ok"},
}


class _HealthySession:
    async def execute(self, statement: object) -> None:
        return None


class _FailingSession:
    async def execute(self, statement: object) -> None:
        raise RuntimeError("database unavailable")


class _HealthyRedis:
    async def ping(self) -> bool:
        return True


class _FailingRedis:
    async def ping(self) -> bool:
        raise ConnectionError("redis unavailable")


async def _provide_healthy_session() -> AsyncIterator[_HealthySession]:
    yield _HealthySession()


async def _provide_failing_session() -> AsyncIterator[_FailingSession]:
    yield _FailingSession()


async def _provide_healthy_redis() -> AsyncIterator[_HealthyRedis]:
    yield _HealthyRedis()


async def _provide_failing_redis() -> AsyncIterator[_FailingRedis]:
    yield _FailingRedis()


async def test_health_returns_ok(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_ready_returns_ready_with_real_dependencies(client: AsyncClient) -> None:
    response = await client.get("/api/v1/ready")

    assert response.status_code == 200, (
        "db/redis no disponibles; ejecuta ./scripts/dev-up.sh. Respuesta: " + response.text
    )
    assert response.json() == READY_HEALTHY


async def test_ready_returns_503_when_redis_fails(client: AsyncClient, admin_app: FastAPI) -> None:
    from app.core.db import get_session
    from app.core.redis import get_redis

    admin_app.dependency_overrides[get_session] = _provide_healthy_session
    admin_app.dependency_overrides[get_redis] = _provide_failing_redis
    try:
        response = await client.get("/api/v1/ready")
    finally:
        admin_app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "checks": {"database": "ok", "redis": "error"},
    }


async def test_ready_returns_503_when_database_fails(
    client: AsyncClient, admin_app: FastAPI
) -> None:
    from app.core.db import get_session
    from app.core.redis import get_redis

    admin_app.dependency_overrides[get_session] = _provide_failing_session
    admin_app.dependency_overrides[get_redis] = _provide_healthy_redis
    try:
        response = await client.get("/api/v1/ready")
    finally:
        admin_app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "checks": {"database": "error", "redis": "ok"},
    }
