"""Revalidation webhook: retries with backoff and webhook_log entries."""

import httpx
import pytest
from sqlalchemy import select

from app.core.db import async_session_factory
from app.modules.revalidation import service
from app.modules.revalidation.models import WebhookLog


async def test_revalidate_retries_and_logs(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[list[str]] = []

    async def flaky(target: str, paths: list[str]) -> int:
        calls.append(paths)
        if len(calls) == 1:
            raise httpx.ConnectError("caído")
        return 500 if len(calls) == 2 else 200

    monkeypatch.setattr(service, "sender", flaky)
    log = await service.revalidate(["/blog", "/"])

    assert len(calls) == 3
    assert (log.status_code, log.attempts) == (200, 3)


async def test_revalidate_gives_up_after_max_attempts(monkeypatch: pytest.MonkeyPatch) -> None:
    async def down(target: str, paths: list[str]) -> int:
        return 503

    monkeypatch.setattr(service, "sender", down)
    await service.revalidate(["/"])

    async with async_session_factory() as session:
        row = (await session.scalars(select(WebhookLog))).one()
    assert row.target == "http://web.test/api/revalidate"
    assert (row.status_code, row.attempts, row.paths) == (503, 3, ["/"])
