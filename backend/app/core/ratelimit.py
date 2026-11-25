"""Sliding-window rate limiting on Redis, keyed by client IP."""

import logging
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, Request
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings
from app.core.errors import RateLimitedError
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

WINDOW_SECONDS = 60


def client_ip(request: Request) -> str:
    """Resolve the client IP, honoring X-Forwarded-For behind trusted proxies.

    Cada proxy de confianza añade la IP que ve al final de la cabecera; el primer
    valor lo controla el cliente y se puede falsear. Se toma la entrada situada
    `TRUSTED_PROXY_HOPS` posiciones desde el final.
    """
    settings = get_settings()
    if settings.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            hops = [part.strip() for part in forwarded.split(",") if part.strip()]
            if len(hops) >= settings.TRUSTED_PROXY_HOPS:
                return hops[-settings.TRUSTED_PROXY_HOPS]
    return request.client.host if request.client else "unknown"


async def hit(redis: Redis, bucket: str, identity: str, limit: int) -> bool:
    """Register a hit; return False when the limit for the window is exceeded."""
    key = f"ratelimit:{bucket}:{identity}"
    now = time.time()
    try:
        async with redis.pipeline(transaction=True) as pipe:
            pipe.zremrangebyscore(key, 0, now - WINDOW_SECONDS)
            pipe.zadd(key, {f"{now}:{uuid.uuid4().hex}": now})
            pipe.zcard(key)
            pipe.expire(key, WINDOW_SECONDS)
            results = await pipe.execute()
    except RedisError:
        # Si Redis falla, no bloqueamos el tráfico legítimo.
        logger.warning("Rate limiter unavailable")
        return True
    return int(results[2]) <= limit


def rate_limit(
    bucket: str, limit_getter: Callable[[], int]
) -> Callable[[Request, Redis], Awaitable[None]]:
    """Build a dependency that enforces `limit_getter()` requests per minute."""

    async def dependency(request: Request, redis: Annotated[Redis, Depends(get_redis)]) -> None:
        if not await hit(redis, bucket, client_ip(request), limit_getter()):
            raise RateLimitedError()

    return dependency


login_rate_limit = rate_limit("login", lambda: get_settings().RATE_LIMIT_LOGIN_PER_MINUTE)
events_rate_limit = rate_limit("events", lambda: get_settings().RATE_LIMIT_EVENTS_PER_MINUTE)
public_rate_limit = rate_limit("public", lambda: get_settings().RATE_LIMIT_PUBLIC_PER_MINUTE)
