"""Business logic for health checks."""

import asyncio
import logging

from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.health.schemas import ComponentState, ReadinessChecks, ReadinessResponse

logger = logging.getLogger(__name__)


async def _database_is_ready(session: AsyncSession) -> bool:
    try:
        await session.execute(text("SELECT 1"))
    except Exception as exc:
        logger.warning("Database readiness check failed: %s", type(exc).__name__)
        return False
    return True


async def _redis_is_ready(client: Redis) -> bool:
    try:
        await client.ping()
    except Exception as exc:
        logger.warning("Redis readiness check failed: %s", type(exc).__name__)
        return False
    return True


def _component_state(ready: bool) -> ComponentState:
    return "ok" if ready else "error"


async def check_readiness(session: AsyncSession, redis: Redis) -> ReadinessResponse:
    """Check database and Redis concurrently and build the response."""
    database_ready, redis_ready = await asyncio.gather(
        _database_is_ready(session),
        _redis_is_ready(redis),
    )

    checks = ReadinessChecks(
        database=_component_state(database_ready),
        redis=_component_state(redis_ready),
    )
    if database_ready and redis_ready:
        return ReadinessResponse(status="ready", checks=checks)
    return ReadinessResponse(status="not_ready", checks=checks)
