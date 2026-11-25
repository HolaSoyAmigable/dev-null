"""Shared dependency aliases for routers."""

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import invalidate_public_cache
from app.core.db import get_session
from app.core.pagination import PageParams, page_params
from app.core.redis import get_redis
from app.modules.revalidation.service import Revalidator, get_revalidator

SessionDep = Annotated[AsyncSession, Depends(get_session)]
RedisDep = Annotated[Redis, Depends(get_redis)]
PageDep = Annotated[PageParams, Depends(page_params)]
RevalidatorDep = Annotated[Revalidator, Depends(get_revalidator)]

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


async def invalidate_cache_on_write(request: Request, redis: RedisDep) -> AsyncIterator[None]:
    """Router dependency: drop the public cache after any successful admin write."""
    yield
    if request.method not in _SAFE_METHODS:
        await invalidate_public_cache(redis)
