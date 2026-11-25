"""Worker process entry point: `uv run python -m app.worker`."""

import asyncio
import contextlib
import logging
import signal

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import get_settings
from app.core.db import engine
from app.core.logging import configure_logging
from app.core.redis import close_redis
from app.worker import jobs

logger = logging.getLogger("app.worker")


def build_scheduler() -> AsyncIOScheduler:
    settings = get_settings()
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        jobs.publish_scheduled_posts,
        "interval",
        minutes=1,
        id="publish_scheduled_posts",
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        jobs.nightly,
        "cron",
        hour=settings.METRICS_AGGREGATION_HOUR_UTC,
        minute=settings.METRICS_AGGREGATION_MINUTE_UTC,
        id="nightly_metrics",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=6 * 3600,
    )
    return scheduler


async def main() -> None:
    configure_logging()
    scheduler = build_scheduler()
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        # En Windows no hay señales en el event loop: se usa KeyboardInterrupt.
        with contextlib.suppress(NotImplementedError):
            loop.add_signal_handler(sig, stop.set)

    # Al arrancar: publica lo atrasado y asegura la agregación de ayer.
    await jobs.publish_scheduled_posts()
    await jobs.aggregate_metrics()
    scheduler.start()
    logger.info("Worker started")
    try:
        await stop.wait()
    finally:
        scheduler.shutdown(wait=False)
        await close_redis()
        await engine.dispose()
        logger.info("Worker stopped")


if __name__ == "__main__":
    with contextlib.suppress(KeyboardInterrupt):
        asyncio.run(main())
