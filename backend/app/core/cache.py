"""Small Redis-backed JSON cache for public endpoints."""

import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from pydantic import BaseModel
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings

logger = logging.getLogger(__name__)

PUBLIC_PREFIX = "cache:public:"


async def cached_json[T: BaseModel](
    redis: Redis,
    key: str,
    model: type[T],
    loader: Callable[[], Awaitable[T]],
) -> T:
    """Return a cached model or compute, store and return it.

    Redis failures degrade to an uncached call instead of failing the request.
    """
    full_key = PUBLIC_PREFIX + key
    try:
        raw = await redis.get(full_key)
    except RedisError:
        raw = None
        logger.warning("Cache read failed")
    if raw is not None:
        return model.model_validate_json(raw)

    value = await loader()
    try:
        await redis.set(
            full_key, value.model_dump_json(), ex=get_settings().PUBLIC_CACHE_TTL_SECONDS
        )
    except RedisError:
        logger.warning("Cache write failed")
    return value


async def invalidate_public_cache(redis: Redis) -> None:
    """Drop every cached public response (called after content changes)."""
    try:
        keys: list[Any] = [key async for key in redis.scan_iter(match=PUBLIC_PREFIX + "*")]
        if keys:
            await redis.delete(*keys)
    except RedisError:
        logger.warning("Cache invalidation failed")


def cache_key(*parts: object) -> str:
    """Build a stable cache key from arbitrary parts."""
    return json.dumps(parts, default=str, separators=(",", ":"))
