"""Metrics: ingestion, privacy, bots, engagement, aggregation and queries."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import func, select, update

from app.core.db import async_session_factory
from app.modules.metrics.models import DailyStat, PageView
from app.modules.metrics.service import (
    external_referrer,
    normalize_path,
    session_hash,
    visitor_hash,
)
from app.modules.metrics.useragent import classify
from tests.helpers import API, BROWSER_HEADERS, create_post, publish

EVENTS = f"{API}/public/events"


def test_classify_user_agents() -> None:
    chrome = classify(BROWSER_HEADERS["User-Agent"], "es")
    assert (chrome.device_type, chrome.browser, chrome.os, chrome.is_bot) == (
        "desktop",
        "Chrome",
        "Windows",
        False,
    )
    iphone = classify(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
        "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "es",
    )
    assert (iphone.device_type, iphone.browser, iphone.os) == ("mobile", "Safari", "iOS")
    assert classify("Mozilla/5.0 (compatible; Googlebot/2.1)", "en").is_bot
    assert classify(BROWSER_HEADERS["User-Agent"], None).is_bot
    assert classify("curl/8.0", "es").is_bot


def test_hashes_rotate_daily_and_hide_ip() -> None:
    today = datetime(2026, 1, 1, tzinfo=UTC).date()
    first = visitor_hash(today, "203.0.113.10", "UA")
    assert first == visitor_hash(today, "203.0.113.10", "UA")
    assert first != visitor_hash(today + timedelta(days=1), "203.0.113.10", "UA")
    assert "203.0.113.10" not in first and len(first) == 64

    at = datetime(2026, 1, 1, 10, 5, tzinfo=UTC)
    assert session_hash(first, at) == session_hash(first, at + timedelta(minutes=20))
    assert session_hash(first, at) != session_hash(first, at + timedelta(minutes=30))


def test_path_and_referrer_normalization() -> None:
    assert normalize_path("/blog/post/?utm_source=x") == "/blog/post"
    assert normalize_path("/admin/posts") is None
    assert external_referrer("https://www.google.com/search?q=secreto", "test") == (
        "google.com",
        "https://www.google.com/search",
    )
    assert external_referrer("http://localhost:3000/blog", None) == (None, None)
    assert external_referrer("javascript:alert(1)", None) == (None, None)


async def test_pageview_and_engagement_are_stored_without_ip(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    post = await create_post(client, auth_headers)
    await publish(client, auth_headers, post["id"])

    # sendBeacon puede mandar text/plain: el endpoint lo acepta igualmente.
    response = await client.post(
        EVENTS,
        content=(
            '{"path": "/blog/' + post["slug"] + '", "referrer": "https://news.ycombinator.com/x",'
            ' "utm_source": "hn"}'
        ),
        headers={**BROWSER_HEADERS, "Content-Type": "text/plain"},
    )
    assert response.status_code == 202
    token = response.json()["view_token"]
    assert token

    engagement = await client.post(
        EVENTS,
        json={
            "type": "engagement",
            "path": "/x",
            "view_token": token,
            "max_scroll_pct": 90,
            "seconds_active": 45,
        },
        headers=BROWSER_HEADERS,
    )
    assert engagement.json()["accepted"] is True

    forged = await client.post(
        EVENTS,
        json={"type": "engagement", "path": "/x", "view_token": "1.fake", "max_scroll_pct": 1},
        headers=BROWSER_HEADERS,
    )
    assert forged.json()["accepted"] is False

    async with async_session_factory() as session:
        view = (await session.scalars(select(PageView))).one()
    assert view.post_id is not None
    assert view.referrer_host == "news.ycombinator.com"
    assert view.utm_source == "hn"
    assert view.device_type == "desktop"
    stored = " ".join(str(v) for v in vars(view).values())
    assert "203.0.113.10" not in stored

    overview = (await client.get(f"{API}/admin/metrics/overview", headers=auth_headers)).json()
    assert overview["views"] == 1
    assert overview["unique_visitors"] == 1
    assert overview["avg_seconds"] == 45
    assert overview["read_rate"] == 100


async def test_bots_dnt_and_invalid_events(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    bot = await client.post(
        EVENTS, json={"path": "/"}, headers={"User-Agent": "Googlebot/2.1", "Accept-Language": "en"}
    )
    assert bot.json() == {"accepted": False, "view_token": None}

    dnt = await client.post(EVENTS, json={"path": "/"}, headers={**BROWSER_HEADERS, "DNT": "1"})
    assert dnt.json()["accepted"] is False

    invalid = await client.post(EVENTS, content="no json", headers=BROWSER_HEADERS)
    assert invalid.status_code == 422

    async with async_session_factory() as session:
        rows = (await session.scalars(select(PageView))).all()
    assert [r.is_bot for r in rows] == [True]

    overview = (await client.get(f"{API}/admin/metrics/overview", headers=auth_headers)).json()
    assert overview["views"] == 0


async def test_events_are_rate_limited(client: AsyncClient) -> None:
    from app.core.config import get_settings

    limit = get_settings().RATE_LIMIT_EVENTS_PER_MINUTE
    for _ in range(limit):
        await client.post(EVENTS, json={"path": "/"}, headers=BROWSER_HEADERS)
    response = await client.post(EVENTS, json={"path": "/"}, headers=BROWSER_HEADERS)
    assert response.status_code == 429


async def test_aggregation_queries_and_retention(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    post = await create_post(client, auth_headers, title="Popular")
    await publish(client, auth_headers, post["id"])
    for i, ua_suffix in enumerate(["a", "b", "b"]):
        headers = {**BROWSER_HEADERS, "User-Agent": BROWSER_HEADERS["User-Agent"] + ua_suffix}
        path = f"/blog/{post['slug']}" if i < 2 else "/"
        await client.post(
            EVENTS, json={"path": path, "referrer": "https://github.com/"}, headers=headers
        )

    # Movemos las visitas a ayer para simular el día ya cerrado.
    yesterday = datetime.now(UTC) - timedelta(days=1)
    async with async_session_factory() as session:
        await session.execute(update(PageView).values(occurred_at=yesterday))
        await session.commit()

    from app.worker.jobs import aggregate_metrics, purge_old_metrics

    day = await aggregate_metrics()
    await aggregate_metrics()  # idempotente
    async with async_session_factory() as session:
        stats = {
            row.post_id: (row.views, row.unique_visitors)
            for row in (await session.scalars(select(DailyStat).where(DailyStat.date == day)))
        }
    assert stats == {None: (3, 2), post["id"]: (2, 2)}

    # Los datos agregados se usan aunque los registros crudos ya no existan.
    async with async_session_factory() as session:
        await session.execute(update(PageView).values(occurred_at=yesterday - timedelta(days=400)))
        await session.commit()
    assert await purge_old_metrics() == 3

    series = (await client.get(f"{API}/admin/metrics/timeseries", headers=auth_headers)).json()
    assert len(series) == 30
    assert series[-2] == {"date": day.isoformat(), "views": 3, "unique_visitors": 2}

    top = (await client.get(f"{API}/admin/metrics/top-posts", headers=auth_headers)).json()
    assert top == [
        {
            "post_id": post["id"],
            "title": "Popular",
            "slug": post["slug"],
            "views": 2,
            "unique_visitors": 2,
        }
    ]

    detail = (
        await client.get(f"{API}/admin/metrics/posts/{post['id']}", headers=auth_headers)
    ).json()
    assert detail["overview"]["views"] == 2

    async with async_session_factory() as session:
        assert await session.scalar(select(func.count(PageView.id))) == 0


async def test_breakdowns_and_realtime(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    await client.post(
        EVENTS, json={"path": "/", "referrer": "https://github.com/x"}, headers=BROWSER_HEADERS
    )
    await client.post(EVENTS, json={"path": "/blog"}, headers=BROWSER_HEADERS)

    referrers = (await client.get(f"{API}/admin/metrics/referrers", headers=auth_headers)).json()
    assert referrers == [{"key": "github.com", "views": 1}]
    devices = (await client.get(f"{API}/admin/metrics/devices", headers=auth_headers)).json()
    assert devices == [{"key": "desktop", "views": 2}]
    countries = (await client.get(f"{API}/admin/metrics/countries", headers=auth_headers)).json()
    assert countries == []

    realtime = (await client.get(f"{API}/admin/metrics/realtime", headers=auth_headers)).json()
    assert realtime["active_visitors"] == 1
    assert realtime["views"] == 2
    assert {p["path"] for p in realtime["pages"]} == {"/", "/blog"}

    assert (await client.get(f"{API}/admin/metrics/overview")).status_code == 401


async def test_top_posts_include_days_not_aggregated(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    """Si el worker no agregó un día cerrado, el ranking debe usar los datos crudos."""
    post = await create_post(client, auth_headers, title="Sin agregar")
    await publish(client, auth_headers, post["id"])
    for suffix in ("a", "b"):
        headers = {**BROWSER_HEADERS, "User-Agent": BROWSER_HEADERS["User-Agent"] + suffix}
        await client.post(EVENTS, json={"path": f"/blog/{post['slug']}"}, headers=headers)

    three_days_ago = datetime.now(UTC) - timedelta(days=3)
    async with async_session_factory() as session:
        await session.execute(update(PageView).values(occurred_at=three_days_ago))
        await session.commit()

    top = (await client.get(f"{API}/admin/metrics/top-posts", headers=auth_headers)).json()
    series = (await client.get(f"{API}/admin/metrics/timeseries", headers=auth_headers)).json()
    assert sum(point["views"] for point in series) == 2
    assert [(p["post_id"], p["views"], p["unique_visitors"]) for p in top] == [(post["id"], 2, 2)]
