"""ISR revalidation webhook towards Next.js with retries and logging.

Política de reintentos: hasta REVALIDATE_MAX_ATTEMPTS intentos con backoff
exponencial (REVALIDATE_BACKOFF_SECONDS * 2^n). Cada llamada queda registrada
en `webhook_log`. Si todo falla, las páginas se regeneran solas con
`revalidate = 3600` (red de seguridad).
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable, Iterable

import httpx
from fastapi import BackgroundTasks

from app.core.config import get_settings
from app.core.db import async_session_factory
from app.modules.revalidation.models import WebhookLog

logger = logging.getLogger(__name__)

Sender = Callable[[str, list[str]], Awaitable[int]]


async def _http_send(target: str, paths: list[str]) -> int:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(
            target,
            json={"paths": paths},
            headers={"x-revalidate-secret": settings.REVALIDATE_SECRET.get_secret_value()},
        )
    return response.status_code


# Reemplazable en tests.
sender: Sender = _http_send


async def revalidate(paths: list[str]) -> WebhookLog:
    """Call the Next.js webhook, retrying on failure, and log the outcome."""
    settings = get_settings()
    target = settings.WEB_URL.rstrip("/") + "/api/revalidate"
    status_code: int | None = None
    attempts = 0
    for attempt in range(settings.REVALIDATE_MAX_ATTEMPTS):
        attempts = attempt + 1
        try:
            status_code = await sender(target, paths)
        except httpx.HTTPError as exc:
            logger.warning("Revalidation attempt %s failed: %s", attempts, type(exc).__name__)
            status_code = None
        if status_code is not None and 200 <= status_code < 300:
            break
        if attempts < settings.REVALIDATE_MAX_ATTEMPTS:
            await asyncio.sleep(settings.REVALIDATE_BACKOFF_SECONDS * (2**attempt))

    log = WebhookLog(target=target, paths=paths, status_code=status_code, attempts=attempts)
    async with async_session_factory() as session:
        session.add(log)
        await session.commit()
    return log


class Revalidator:
    """Collects paths during a request and revalidates them once, in background."""

    def __init__(self, background: BackgroundTasks | None = None) -> None:
        self._background = background
        self.paths: set[str] = set()
        self._scheduled = False

    def add(self, paths: Iterable[str]) -> None:
        self.paths.update(p for p in paths if p)
        if self._background is not None and not self._scheduled and self.paths:
            self._scheduled = True
            self._background.add_task(self._run)

    async def _run(self) -> None:
        if self.paths:
            await revalidate(sorted(self.paths))

    async def flush(self) -> None:
        """Run synchronously (used by the worker, which has no BackgroundTasks)."""
        await self._run()
        self.paths.clear()


def get_revalidator(background: BackgroundTasks) -> Revalidator:
    """FastAPI dependency."""
    return Revalidator(background)
