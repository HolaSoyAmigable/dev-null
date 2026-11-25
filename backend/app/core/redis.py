"""Async Redis client and dependency."""

from collections.abc import AsyncIterator

from redis.asyncio import Redis

from app.core.config import get_settings

settings = get_settings()

redis_client: Redis = Redis.from_url(
    settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
    # Timeout corto para no colgar la comprobación de readiness si Redis no responde.
    socket_connect_timeout=3.0,
    socket_timeout=3.0,
)


async def get_redis() -> AsyncIterator[Redis]:
    """Yield the shared Redis client."""
    yield redis_client


async def close_redis() -> None:
    """Close the Redis connection pool."""
    await redis_client.aclose()
