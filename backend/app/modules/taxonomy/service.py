"""Business logic for tags and categories."""

from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.core.slug import slugify
from app.modules.revalidation.service import Revalidator
from app.modules.taxonomy import repository
from app.modules.taxonomy.models import Category, Tag
from app.modules.taxonomy.schemas import (
    CategoryCreate,
    CategoryUpdate,
    CategoryWithCount,
    TagCreate,
    TagUpdate,
    TagWithCount,
)


async def _ensure_slug_free(
    session: AsyncSession, model: type[Tag] | type[Category], slug: str, exclude_id: int | None
) -> None:
    if await repository.slug_taken(session, model, slug, exclude_id):
        raise ConflictError("Ya existe un elemento con ese slug.", code="SLUG_TAKEN")


# ── Tags ─────────────────────────────────────────────────────────────────────


async def list_tags(session: AsyncSession) -> Sequence[Tag]:
    return await repository.list_tags(session)


async def create_tag(session: AsyncSession, data: TagCreate) -> Tag:
    slug = data.slug or slugify(data.name)
    await _ensure_slug_free(session, Tag, slug, None)
    tag = Tag(name=data.name.strip(), slug=slug)
    session.add(tag)
    await session.commit()
    return tag


async def _get_tag(session: AsyncSession, tag_id: int) -> Tag:
    tag = await session.get(Tag, tag_id)
    if tag is None:
        raise NotFoundError("La etiqueta no existe.")
    return tag


async def update_tag(
    session: AsyncSession, revalidator: Revalidator, tag_id: int, data: TagUpdate
) -> Tag:
    tag = await _get_tag(session, tag_id)
    old_slug = tag.slug
    if data.slug is not None and data.slug != tag.slug:
        await _ensure_slug_free(session, Tag, data.slug, tag.id)
        tag.slug = data.slug
    if data.name is not None:
        tag.name = data.name.strip()
    await session.commit()
    revalidator.add(["/blog", f"/blog/tag/{old_slug}", f"/blog/tag/{tag.slug}"])
    return tag


async def delete_tag(session: AsyncSession, revalidator: Revalidator, tag_id: int) -> None:
    tag = await _get_tag(session, tag_id)
    revalidator.add(["/blog", f"/blog/tag/{tag.slug}"])
    await session.delete(tag)
    await session.commit()


async def public_tags(session: AsyncSession) -> list[TagWithCount]:
    rows = await repository.tags_with_published_count(session)
    return [TagWithCount(id=t.id, name=t.name, slug=t.slug, post_count=n) for t, n in rows]


# ── Categories ───────────────────────────────────────────────────────────────


async def list_categories(session: AsyncSession) -> Sequence[Category]:
    return await repository.list_categories(session)


async def create_category(session: AsyncSession, data: CategoryCreate) -> Category:
    slug = data.slug or slugify(data.name)
    await _ensure_slug_free(session, Category, slug, None)
    category = Category(name=data.name.strip(), slug=slug, description=data.description)
    session.add(category)
    await session.commit()
    return category


async def _get_category(session: AsyncSession, category_id: int) -> Category:
    category = await session.get(Category, category_id)
    if category is None:
        raise NotFoundError("La categoría no existe.")
    return category


async def update_category(
    session: AsyncSession, revalidator: Revalidator, category_id: int, data: CategoryUpdate
) -> Category:
    category = await _get_category(session, category_id)
    old_slug = category.slug
    if data.slug is not None and data.slug != category.slug:
        await _ensure_slug_free(session, Category, data.slug, category.id)
        category.slug = data.slug
    if data.name is not None:
        category.name = data.name.strip()
    if "description" in data.model_fields_set:
        category.description = data.description
    await session.commit()
    revalidator.add(["/blog", f"/blog/category/{old_slug}", f"/blog/category/{category.slug}"])
    return category


async def delete_category(
    session: AsyncSession, revalidator: Revalidator, category_id: int
) -> None:
    category = await _get_category(session, category_id)
    revalidator.add(["/blog", f"/blog/category/{category.slug}"])
    await session.delete(category)
    await session.commit()


async def public_categories(session: AsyncSession) -> list[CategoryWithCount]:
    rows = await repository.categories_with_published_count(session)
    return [
        CategoryWithCount(
            id=c.id, name=c.name, slug=c.slug, description=c.description, post_count=n
        )
        for c, n in rows
    ]
