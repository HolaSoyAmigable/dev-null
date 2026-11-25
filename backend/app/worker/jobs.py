"""Scheduled jobs: scheduled publishing, nightly aggregation and retention."""

import logging
from datetime import UTC, date, datetime, timedelta

from app.core.cache import invalidate_public_cache
from app.core.db import async_session_factory
from app.core.redis import redis_client
from app.modules.metrics import service as metrics_service
from app.modules.posts import service as posts_service
from app.modules.revalidation.service import Revalidator

logger = logging.getLogger(__name__)


async def publish_scheduled_posts(now: datetime | None = None) -> int:
    """Publish posts whose `scheduled_for` has passed and revalidate their pages."""
    revalidator = Revalidator()
    async with async_session_factory() as session:
        published = await posts_service.publish_due(session, revalidator, now or datetime.now(UTC))
    if published:
        await invalidate_public_cache(redis_client)
        await revalidator.flush()
        logger.info("Published %s scheduled post(s)", published)
    return published


async def aggregate_metrics(day: date | None = None) -> date:
    """Aggregate the previous UTC day (or the given day) into daily_stats."""
    target = day or (datetime.now(UTC).date() - timedelta(days=1))
    async with async_session_factory() as session:
        await metrics_service.aggregate_day(session, target)
    logger.info("Aggregated metrics for %s", target.isoformat())
    return target


async def purge_old_metrics() -> int:
    """Delete raw metrics older than the retention window (13 months)."""
    async with async_session_factory() as session:
        deleted = await metrics_service.purge_old(session)
    logger.info("Purged %s old page view(s)", deleted)
    return deleted


async def nightly() -> None:
    await aggregate_metrics()
    await purge_old_metrics()
