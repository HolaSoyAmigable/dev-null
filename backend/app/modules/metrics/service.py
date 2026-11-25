"""Metrics logic: privacy-preserving ingestion, aggregation and queries.

- visitor_hash = HMAC-SHA256(METRICS_SALT_SECRET, fecha + IP + User-Agent)
- session_hash = HMAC-SHA256(METRICS_SALT_SECRET, visitor_hash + ventana de 30 min)
La IP solo se usa en memoria para el hash; nunca se guarda ni se loguea.
"""

import hashlib
import hmac
import re
from datetime import UTC, date, datetime, timedelta
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import NotFoundError
from app.modules.metrics import repository
from app.modules.metrics.models import PageView
from app.modules.metrics.schemas import (
    CountItem,
    EventAccepted,
    EventIn,
    Overview,
    PostMetrics,
    Realtime,
    RealtimePage,
    TimeseriesPoint,
    TopPost,
)
from app.modules.metrics.useragent import classify
from app.modules.posts.models import Post
from app.modules.projects.models import Project

SESSION_WINDOW_SECONDS = 30 * 60
REALTIME_MINUTES = 30
_POST_PATH = re.compile(r"^/blog/([a-z0-9]+(?:-[a-z0-9]+)*)/?$")
_PROJECT_PATH = re.compile(r"^/projects/([a-z0-9]+(?:-[a-z0-9]+)*)/?$")


def _hmac(message: str) -> str:
    secret = get_settings().METRICS_SALT_SECRET.get_secret_value().encode()
    return hmac.new(secret, message.encode(), hashlib.sha256).hexdigest()


def visitor_hash(day: date, ip: str, user_agent: str) -> str:
    return _hmac(f"{day.isoformat()}|{ip}|{user_agent}")


def session_hash(visitor: str, at: datetime) -> str:
    window_start = int(at.timestamp()) // SESSION_WINDOW_SECONDS * SESSION_WINDOW_SECONDS
    return _hmac(f"{visitor}|{window_start}")


def sign_view(page_view_id: int) -> str:
    return f"{page_view_id}.{_hmac(f'view:{page_view_id}')[:24]}"


def verify_view(token: str) -> int | None:
    raw_id, _, signature = token.partition(".")
    if not raw_id.isdigit():
        return None
    expected = sign_view(int(raw_id)).partition(".")[2]
    return int(raw_id) if hmac.compare_digest(signature, expected) else None


def normalize_path(path: str) -> str | None:
    parsed = urlparse(path)
    clean = parsed.path or "/"
    if not clean.startswith("/") or clean.startswith(("/api", "/admin", "/_next")):
        return None
    if len(clean) > 1:
        clean = clean.rstrip("/")
    return clean[:500]


def _site_host() -> str:
    return (urlparse(get_settings().SITE_URL).hostname or "").lower()


def external_referrer(referrer: str | None, own_host: str | None) -> tuple[str | None, str | None]:
    """Return (host, url-without-query) for external referrers only."""
    if not referrer:
        return None, None
    parsed = urlparse(referrer)
    host = (parsed.hostname or "").lower()
    if not host or parsed.scheme not in ("http", "https"):
        return None, None
    if host in {_site_host(), (own_host or "").lower()}:
        return None, None
    host = host.removeprefix("www.")
    return host[:255], f"{parsed.scheme}://{parsed.netloc}{parsed.path}"[:1000]


async def _resolve_content(session: AsyncSession, path: str) -> tuple[int | None, int | None]:
    if match := _POST_PATH.match(path):
        return await repository.post_id_by_slug(session, match.group(1)), None
    if match := _PROJECT_PATH.match(path):
        project_id = await session.scalar(select(Project.id).where(Project.slug == match.group(1)))
        return None, project_id
    return None, None


async def ingest(
    session: AsyncSession,
    event: EventIn,
    *,
    ip: str,
    user_agent: str,
    accept_language: str | None,
    own_host: str | None,
    dnt: bool,
) -> EventAccepted:
    """Store a page view or merge an engagement update."""
    if dnt:
        return EventAccepted(accepted=False)

    if event.type == "engagement":
        page_view_id = verify_view(event.view_token or "")
        if page_view_id is None or not await repository.page_view_exists(session, page_view_id):
            return EventAccepted(accepted=False)
        await repository.upsert_engagement(
            session, page_view_id, event.max_scroll_pct or 0, event.seconds_active or 0
        )
        return EventAccepted(accepted=True)

    path = normalize_path(event.path)
    if path is None:
        return EventAccepted(accepted=False)
    now = datetime.now(UTC)
    client = classify(user_agent, accept_language)
    visitor = visitor_hash(now.date(), ip, user_agent)
    referrer_host, referrer_url = external_referrer(event.referrer, own_host)
    post_id, project_id = await _resolve_content(session, path)
    view = await repository.add_page_view(
        session,
        PageView(
            occurred_at=now,
            path=path,
            post_id=post_id,
            project_id=project_id,
            visitor_hash=visitor,
            session_hash=session_hash(visitor, now),
            referrer_host=referrer_host,
            referrer_url=referrer_url,
            utm_source=event.utm_source,
            utm_medium=event.utm_medium,
            utm_campaign=event.utm_campaign,
            country=None,  # GeoLite2 pendiente (ver docs/04-metrics.md)
            device_type=client.device_type,
            browser=client.browser,
            os=client.os,
            is_bot=client.is_bot,
        ),
    )
    if client.is_bot:
        return EventAccepted(accepted=False)
    return EventAccepted(accepted=True, view_token=sign_view(view.id))


# ── Agregación (worker) ──────────────────────────────────────────────────────


def _day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime(day.year, day.month, day.day, tzinfo=UTC)
    return start, start + timedelta(days=1)


async def aggregate_day(session: AsyncSession, day: date) -> None:
    start, end = _day_bounds(day)
    await repository.aggregate_day(session, day, start, end)


def _months_ago(now: datetime, months: int) -> datetime:
    month_index = now.year * 12 + now.month - 1 - months
    year, month = divmod(month_index, 12)
    return now.replace(year=year, month=month + 1, day=min(now.day, 28))


async def purge_old(session: AsyncSession, now: datetime | None = None) -> int:
    """Delete page views (and their engagement) older than the retention window."""
    now = now or datetime.now(UTC)
    cutoff = _months_ago(now, get_settings().METRICS_RETENTION_MONTHS)
    return await repository.delete_older_than(session, cutoff)


# ── Consultas del dashboard ──────────────────────────────────────────────────


def default_range(start: date | None, end: date | None) -> tuple[date, date]:
    today = datetime.now(UTC).date()
    end = min(end or today, today)
    start = start or end - timedelta(days=29)
    return (start, end) if start <= end else (end, start)


def _range_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    return _day_bounds(start)[0], _day_bounds(end)[1]


async def timeseries(
    session: AsyncSession, start: date, end: date, post_id: int | None = None
) -> list[TimeseriesPoint]:
    """Past days from daily_stats; today (or non-aggregated days) from page_views."""
    stats = await repository.stats_daily(session, start, end, post_id)
    raw = await repository.raw_daily(session, *_range_bounds(start, end), post_id)
    today = datetime.now(UTC).date()
    points: list[TimeseriesPoint] = []
    day = start
    while day <= end:
        if day != today and day in stats:
            views, uniques = stats[day][0], stats[day][1]
        else:
            views, uniques = raw.get(day, (0, 0))
        points.append(TimeseriesPoint(date=day, views=views, unique_visitors=uniques))
        day += timedelta(days=1)
    return points


async def overview(
    session: AsyncSession, start: date, end: date, post_id: int | None = None
) -> Overview:
    series = await timeseries(session, start, end, post_id)
    raw = await repository.raw_totals(session, *_range_bounds(start, end), post_id)
    return Overview(
        start=start,
        end=end,
        views=sum(p.views for p in series),
        # Las huellas rotan cada día: los únicos del período son la suma de únicos diarios.
        unique_visitors=sum(p.unique_visitors for p in series),
        avg_seconds=round(raw.avg_seconds, 1),
        avg_scroll_pct=round(raw.avg_scroll_pct, 1),
        read_rate=raw.read_rate,
    )


async def top_posts(session: AsyncSession, start: date, end: date, limit: int) -> list[TopPost]:
    """Aggregated days come from daily_stats; today and non-aggregated days from raw views."""
    today = datetime.now(UTC).date()
    totals: dict[int, list[int]] = {}
    past_end = min(end, today - timedelta(days=1))
    raw_days: list[date] = []
    if start <= past_end:
        for pid, (v, u) in (await repository.top_posts_stats(session, start, past_end)).items():
            totals.setdefault(pid, [0, 0])
            totals[pid][0] += v
            totals[pid][1] += u
        done = await repository.aggregated_days(session, start, past_end)
        raw_days += [
            start + timedelta(days=offset)
            for offset in range((past_end - start).days + 1)
            if start + timedelta(days=offset) not in done
        ]
    if end >= today:
        raw_days.append(today)
    if raw_days:
        bounds = _range_bounds(min(raw_days), max(raw_days))
        for pid, (v, u) in (await repository.top_posts_raw(session, *bounds, raw_days)).items():
            totals.setdefault(pid, [0, 0])
            totals[pid][0] += v
            totals[pid][1] += u
    ranked = sorted(totals.items(), key=lambda item: item[1][0], reverse=True)[:limit]
    info = await repository.posts_by_ids(session, [pid for pid, _ in ranked])
    return [
        TopPost(post_id=pid, title=info[pid][0], slug=info[pid][1], views=v, unique_visitors=u)
        for pid, (v, u) in ranked
        if pid in info
    ]


async def breakdown(
    session: AsyncSession,
    dimension: str,
    start: date,
    end: date,
    post_id: int | None = None,
) -> list[CountItem]:
    columns = {
        "referrers": PageView.referrer_host,
        "countries": PageView.country,
        "devices": PageView.device_type,
        "browsers": PageView.browser,
    }
    rows = await repository.group_count(
        session, columns[dimension], *_range_bounds(start, end), post_id
    )
    return [CountItem(key=key, views=n) for key, n in rows]


async def realtime(session: AsyncSession) -> Realtime:
    since = datetime.now(UTC) - timedelta(minutes=REALTIME_MINUTES)
    visitors, views, pages = await repository.realtime(session, since)
    return Realtime(
        active_visitors=visitors,
        views=views,
        pages=[RealtimePage(path=p, views=n) for p, n in pages],
    )


async def post_metrics(session: AsyncSession, post_id: int, start: date, end: date) -> PostMetrics:
    post = await session.get(Post, post_id)
    if post is None:
        raise NotFoundError("El post no existe.")
    return PostMetrics(
        post_id=post.id,
        title=post.title,
        slug=post.slug,
        overview=await overview(session, start, end, post_id),
        timeseries=await timeseries(session, start, end, post_id),
        referrers=await breakdown(session, "referrers", start, end, post_id),
    )
