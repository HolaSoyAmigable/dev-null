"""Database access for metrics: raw events, aggregates and retention."""

from collections.abc import Collection, Sequence
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import ColumnElement, and_, case, delete, func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.modules.metrics.models import DailyStat, EngagementEvent, PageView
from app.modules.posts.models import Post

# Umbral de "lectura completa" (tarea 5.2): ≥ 75 % de scroll y ≥ 30 s activos.
READ_SCROLL_PCT = 75
READ_SECONDS = 30


@dataclass(frozen=True)
class Totals:
    views: int
    unique_visitors: int
    avg_seconds: float
    avg_scroll_pct: float
    read_rate: float


async def add_page_view(session: AsyncSession, view: PageView) -> PageView:
    session.add(view)
    await session.commit()
    return view


async def upsert_engagement(
    session: AsyncSession, page_view_id: int, scroll: int, seconds: int
) -> None:
    stmt = insert(EngagementEvent).values(
        page_view_id=page_view_id, max_scroll_pct=scroll, seconds_active=seconds
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[EngagementEvent.page_view_id],
        set_={
            "max_scroll_pct": func.greatest(EngagementEvent.max_scroll_pct, scroll),
            "seconds_active": func.greatest(EngagementEvent.seconds_active, seconds),
        },
    )
    await session.execute(stmt)
    await session.commit()


async def page_view_exists(session: AsyncSession, page_view_id: int) -> bool:
    return (await session.get(PageView, page_view_id)) is not None


async def post_id_by_slug(session: AsyncSession, slug: str) -> int | None:
    return await session.scalar(select(Post.id).where(Post.slug == slug))


def _raw_filter(start: datetime, end: datetime, post_id: int | None) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = [
        PageView.is_bot.is_(False),
        PageView.occurred_at >= start,
        PageView.occurred_at < end,
    ]
    if post_id is not None:
        conditions.append(PageView.post_id == post_id)
    return conditions


async def raw_totals(
    session: AsyncSession, start: datetime, end: datetime, post_id: int | None = None
) -> Totals:
    read = case(
        (
            and_(
                EngagementEvent.max_scroll_pct >= READ_SCROLL_PCT,
                EngagementEvent.seconds_active >= READ_SECONDS,
            ),
            1,
        ),
        else_=0,
    )
    stmt = (
        select(
            func.count(PageView.id),
            func.count(func.distinct(PageView.visitor_hash)),
            func.coalesce(func.avg(EngagementEvent.seconds_active), 0),
            func.coalesce(func.avg(EngagementEvent.max_scroll_pct), 0),
            func.coalesce(func.avg(read), 0),
        )
        .select_from(PageView)
        .outerjoin(EngagementEvent, EngagementEvent.page_view_id == PageView.id)
        .where(*_raw_filter(start, end, post_id))
    )
    views, uniques, avg_s, avg_scroll, read_rate = (await session.execute(stmt)).one()
    return Totals(
        views=int(views),
        unique_visitors=int(uniques),
        avg_seconds=float(avg_s),
        avg_scroll_pct=float(avg_scroll),
        read_rate=round(float(read_rate) * 100, 2),
    )


async def raw_daily(
    session: AsyncSession, start: datetime, end: datetime, post_id: int | None = None
) -> dict[date, tuple[int, int]]:
    day = func.date(func.timezone("UTC", PageView.occurred_at))
    stmt = (
        select(day, func.count(PageView.id), func.count(func.distinct(PageView.visitor_hash)))
        .where(*_raw_filter(start, end, post_id))
        .group_by(day)
    )
    return {d: (int(v), int(u)) for d, v, u in (await session.execute(stmt)).all()}


async def stats_daily(
    session: AsyncSession, start: date, end: date, post_id: int | None
) -> dict[date, tuple[int, int, float, float]]:
    """Aggregated rows (post_id None = site total) for [start, end]."""
    condition = DailyStat.post_id.is_(None) if post_id is None else DailyStat.post_id == post_id
    stmt = select(
        DailyStat.date,
        DailyStat.views,
        DailyStat.unique_visitors,
        DailyStat.avg_seconds,
        DailyStat.avg_scroll_pct,
    ).where(condition, DailyStat.date >= start, DailyStat.date <= end)
    return {
        d: (int(v), int(u), float(s), float(sc))
        for d, v, u, s, sc in (await session.execute(stmt)).all()
    }


async def top_posts_stats(
    session: AsyncSession, start: date, end: date
) -> dict[int, tuple[int, int]]:
    stmt = (
        select(DailyStat.post_id, func.sum(DailyStat.views), func.sum(DailyStat.unique_visitors))
        .where(DailyStat.post_id.is_not(None), DailyStat.date >= start, DailyStat.date <= end)
        .group_by(DailyStat.post_id)
    )
    return {int(p): (int(v), int(u)) for p, v, u in (await session.execute(stmt)).all() if p}


async def aggregated_days(session: AsyncSession, start: date, end: date) -> set[date]:
    """Days in [start, end] that already have a site-total row in daily_stats."""
    stmt = select(DailyStat.date).where(
        DailyStat.post_id.is_(None), DailyStat.date >= start, DailyStat.date <= end
    )
    return set((await session.scalars(stmt)).all())


async def top_posts_raw(
    session: AsyncSession, start: datetime, end: datetime, days: Collection[date] | None = None
) -> dict[int, tuple[int, int]]:
    """Per-post totals from raw page views, optionally limited to the given UTC days."""
    conditions = [PageView.post_id.is_not(None), *_raw_filter(start, end, None)]
    if days is not None:
        conditions.append(func.date(func.timezone("UTC", PageView.occurred_at)).in_(list(days)))
    stmt = (
        select(
            PageView.post_id,
            func.count(PageView.id),
            func.count(func.distinct(PageView.visitor_hash)),
        )
        .where(*conditions)
        .group_by(PageView.post_id)
    )
    return {int(p): (int(v), int(u)) for p, v, u in (await session.execute(stmt)).all() if p}


async def posts_by_ids(session: AsyncSession, ids: Sequence[int]) -> dict[int, tuple[str, str]]:
    if not ids:
        return {}
    rows = await session.execute(select(Post.id, Post.title, Post.slug).where(Post.id.in_(ids)))
    return {pid: (title, slug) for pid, title, slug in rows.all()}


async def group_count(
    session: AsyncSession,
    column: InstrumentedAttribute[str] | InstrumentedAttribute[str | None],
    start: datetime,
    end: datetime,
    post_id: int | None = None,
    limit: int = 20,
) -> list[tuple[str, int]]:
    count = func.count(PageView.id)
    stmt = (
        select(column, count)
        .where(column.is_not(None), *_raw_filter(start, end, post_id))
        .group_by(column)
        .order_by(count.desc())
        .limit(limit)
    )
    return [(str(key), int(n)) for key, n in (await session.execute(stmt)).all()]


async def realtime(
    session: AsyncSession, since: datetime
) -> tuple[int, int, list[tuple[str, int]]]:
    base = [PageView.is_bot.is_(False), PageView.occurred_at >= since]
    visitors, views = (
        await session.execute(
            select(func.count(func.distinct(PageView.visitor_hash)), func.count(PageView.id)).where(
                *base
            )
        )
    ).one()
    count = func.count(PageView.id)
    pages = await session.execute(
        select(PageView.path, count)
        .where(*base)
        .group_by(PageView.path)
        .order_by(count.desc())
        .limit(10)
    )
    return int(visitors), int(views), [(p, int(n)) for p, n in pages.all()]


_AGGREGATE_SQL = """
WITH pv AS (
    SELECT p.post_id, p.visitor_hash, e.seconds_active, e.max_scroll_pct
    FROM page_views p
    LEFT JOIN engagement_events e ON e.page_view_id = p.id
    WHERE NOT p.is_bot AND p.occurred_at >= :start AND p.occurred_at < :end
    {post_filter}
)
INSERT INTO daily_stats (date, post_id, views, unique_visitors, avg_seconds, avg_scroll_pct)
SELECT :day, {post_column}, count(*), count(DISTINCT visitor_hash),
       coalesce(avg(seconds_active), 0), coalesce(avg(max_scroll_pct), 0)
FROM pv
{group_by}
HAVING count(*) > 0
ON CONFLICT (date, post_id) DO UPDATE SET
    views = EXCLUDED.views,
    unique_visitors = EXCLUDED.unique_visitors,
    avg_seconds = EXCLUDED.avg_seconds,
    avg_scroll_pct = EXCLUDED.avg_scroll_pct
"""


async def aggregate_day(session: AsyncSession, day: date, start: datetime, end: datetime) -> None:
    """Upsert daily_stats for one UTC day: site total and one row per post."""
    params = {"day": day, "start": start, "end": end}
    total_sql = _AGGREGATE_SQL.format(post_filter="", post_column="NULL::integer", group_by="")
    per_post_sql = _AGGREGATE_SQL.format(
        post_filter="AND p.post_id IS NOT NULL", post_column="post_id", group_by="GROUP BY post_id"
    )
    await session.execute(text(total_sql), params)
    await session.execute(text(per_post_sql), params)
    await session.commit()


async def delete_older_than(session: AsyncSession, cutoff: datetime) -> int:
    result = await session.execute(delete(PageView).where(PageView.occurred_at < cutoff))
    await session.commit()
    return int(getattr(result, "rowcount", 0) or 0)
