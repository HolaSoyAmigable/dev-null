"""Database access for tags and categories."""

from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.posts.models import Post, post_tags
from app.modules.taxonomy.models import Category, Tag


async def list_tags(session: AsyncSession) -> Sequence[Tag]:
    return (await session.scalars(select(Tag).order_by(Tag.name))).all()


async def list_categories(session: AsyncSession) -> Sequence[Category]:
    return (await session.scalars(select(Category).order_by(Category.name))).all()


async def get_tags_by_ids(session: AsyncSession, ids: Sequence[int]) -> Sequence[Tag]:
    if not ids:
        return []
    return (await session.scalars(select(Tag).where(Tag.id.in_(ids)))).all()


async def slug_taken(
    session: AsyncSession, model: type[Tag] | type[Category], slug: str, exclude_id: int | None
) -> bool:
    stmt = select(model.id).where(model.slug == slug)
    if exclude_id is not None:
        stmt = stmt.where(model.id != exclude_id)
    return (await session.scalar(stmt)) is not None


async def tags_with_published_count(session: AsyncSession) -> list[tuple[Tag, int]]:
    count = func.count(Post.id)
    stmt = (
        select(Tag, count)
        .join(post_tags, post_tags.c.tag_id == Tag.id)
        .join(Post, (Post.id == post_tags.c.post_id) & (Post.status == "published"))
        .group_by(Tag.id)
        .order_by(count.desc(), Tag.name)
    )
    return [(tag, int(n)) for tag, n in (await session.execute(stmt)).all()]


async def categories_with_published_count(session: AsyncSession) -> list[tuple[Category, int]]:
    count = func.count(Post.id)
    stmt = (
        select(Category, count)
        .outerjoin(Post, (Post.category_id == Category.id) & (Post.status == "published"))
        .group_by(Category.id)
        .order_by(Category.name)
    )
    return [(category, int(n)) for category, n in (await session.execute(stmt)).all()]
