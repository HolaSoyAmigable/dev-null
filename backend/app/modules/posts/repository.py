"""Database access for posts and revisions."""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import Select, func, literal_column, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.posts.models import Post, PostRevision, post_tags
from app.modules.projects.models import Project
from app.modules.taxonomy.models import Category, Tag

PUBLISHED = "published"


async def get(session: AsyncSession, post_id: int) -> Post | None:
    """Load a post with fresh state (and eager relationships)."""
    stmt = select(Post).where(Post.id == post_id).execution_options(populate_existing=True)
    return (await session.scalars(stmt)).one_or_none()


async def slug_exists(session: AsyncSession, slug: str, exclude_id: int | None = None) -> bool:
    stmt = select(Post.id).where(Post.slug == slug)
    if exclude_id is not None:
        stmt = stmt.where(Post.id != exclude_id)
    return (await session.scalar(stmt)) is not None


async def _count(session: AsyncSession, stmt: Select[Post]) -> int:
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    return int(await session.scalar(count_stmt) or 0)


async def admin_list(
    session: AsyncSession, status: str | None, q: str | None, offset: int, limit: int
) -> tuple[Sequence[Post], int]:
    stmt = select(Post)
    if status:
        stmt = stmt.where(Post.status == status)
    if q:
        stmt = stmt.where(Post.title.ilike(f"%{q}%"))
    total = await _count(session, stmt)
    rows = await session.scalars(
        stmt.order_by(Post.updated_at.desc(), Post.id.desc()).offset(offset).limit(limit)
    )
    return rows.all(), total


def _published() -> Select[Post]:
    return select(Post).where(Post.status == PUBLISHED)


async def public_list(
    session: AsyncSession,
    *,
    tag: str | None,
    category: str | None,
    project: str | None,
    featured: bool | None,
    offset: int,
    limit: int,
) -> tuple[Sequence[Post], int]:
    stmt = _published()
    if tag:
        stmt = stmt.where(Post.tags.any(Tag.slug == tag))
    if category:
        stmt = stmt.where(Post.category.has(Category.slug == category))
    if project:
        stmt = stmt.where(Post.project.has(Project.slug == project))
    if featured is not None:
        stmt = stmt.where(Post.featured.is_(featured))
    total = await _count(session, stmt)
    rows = await session.scalars(
        stmt.order_by(Post.published_at.desc(), Post.id.desc()).offset(offset).limit(limit)
    )
    return rows.all(), total


async def public_by_slug(session: AsyncSession, slug: str) -> Post | None:
    return (await session.scalars(_published().where(Post.slug == slug))).one_or_none()


async def related(session: AsyncSession, post: Post, limit: int) -> Sequence[Post]:
    """Published posts sharing tags or category, ranked by shared tags."""
    tag_ids = [t.id for t in post.tags]
    shared = (
        select(func.count())
        .select_from(post_tags)
        .where(post_tags.c.post_id == Post.id, post_tags.c.tag_id.in_(tag_ids or [-1]))
        .scalar_subquery()
    )
    conditions = [Post.tags.any(Tag.id.in_(tag_ids))] if tag_ids else []
    if post.category_id is not None:
        conditions.append(Post.category_id == post.category_id)
    if not conditions:
        return []
    stmt = (
        _published()
        .where(Post.id != post.id, or_(*conditions))
        .order_by(shared.desc(), Post.published_at.desc())
        .limit(limit)
    )
    return (await session.scalars(stmt)).all()


async def search(
    session: AsyncSession, q: str, offset: int, limit: int
) -> tuple[list[tuple[Post, str]], int]:
    """Full-text search in Spanish over the GIN-indexed search_vector."""
    query = func.websearch_to_tsquery("spanish", q)
    base = _published().where(Post.search_vector.op("@@")(query))
    total = await _count(session, base)
    snippet = func.ts_headline(
        "spanish",
        func.coalesce(Post.excerpt, "") + literal_column("' '") + Post.content_md,
        query,
        "StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=10, MaxFragments=1",
    )
    stmt = (
        select(Post, snippet)
        .where(Post.status == PUBLISHED, Post.search_vector.op("@@")(query))
        .order_by(func.ts_rank(Post.search_vector, query).desc(), Post.published_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await session.execute(stmt)).all()
    return [(post, str(snip)) for post, snip in rows], total


async def due_scheduled(session: AsyncSession, now: datetime) -> Sequence[Post]:
    stmt = (
        select(Post)
        .where(Post.status == "scheduled", Post.scheduled_for <= now)
        .order_by(Post.scheduled_for)
        .with_for_update(skip_locked=True)
    )
    return (await session.scalars(stmt)).all()


async def published_slugs(session: AsyncSession) -> Sequence[tuple[str, datetime]]:
    stmt = select(Post.slug, Post.updated_at).where(Post.status == PUBLISHED)
    return [(slug, updated) for slug, updated in (await session.execute(stmt)).all()]


async def revisions(session: AsyncSession, post_id: int) -> Sequence[PostRevision]:
    stmt = (
        select(PostRevision)
        .where(PostRevision.post_id == post_id)
        .order_by(PostRevision.created_at.desc(), PostRevision.id.desc())
    )
    return (await session.scalars(stmt)).all()


async def get_revision(
    session: AsyncSession, post_id: int, revision_id: int
) -> PostRevision | None:
    stmt = select(PostRevision).where(
        PostRevision.id == revision_id, PostRevision.post_id == post_id
    )
    return (await session.scalars(stmt)).one_or_none()
