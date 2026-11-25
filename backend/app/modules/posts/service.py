"""Business logic for posts: CRUD, workflow states and revisions.

Revisiones: se guarda una al publicar, al restaurar (snapshot previo) y cada
REVISION_EVERY_N_SAVES guardados que modifiquen título o contenido.
"""

import math
import re
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.pagination import Page, PageParams
from app.core.slug import slugify
from app.modules.auth.models import User
from app.modules.media.models import Media
from app.modules.posts import repository
from app.modules.posts.models import Post, PostRevision
from app.modules.posts.schemas import (
    PostCreate,
    PostListItem,
    PostUpdate,
    PublicPostDetail,
    PublicPostSummary,
    PublicSlugs,
    SearchResult,
    SlugEntry,
)
from app.modules.projects.models import Project
from app.modules.revalidation.service import Revalidator
from app.modules.taxonomy import repository as taxonomy_repository
from app.modules.taxonomy.models import Category

REVISION_EVERY_N_SAVES = 5
WORDS_PER_MINUTE = 200
RELATED_LIMIT = 3

_WORD = re.compile(r"\w+", re.UNICODE)
_CODE_FENCE = re.compile(r"```.*?```", re.DOTALL)


def reading_minutes(markdown: str) -> int:
    """Estimate reading time at 200 words per minute (code counts at half speed)."""
    code_words = sum(len(_WORD.findall(block)) for block in _CODE_FENCE.findall(markdown))
    prose_words = len(_WORD.findall(_CODE_FENCE.sub(" ", markdown)))
    return max(1, math.ceil((prose_words + code_words / 2) / WORDS_PER_MINUTE))


def public_paths(post: Post) -> list[str]:
    """Pages of the public site that display this post."""
    paths = ["/", "/blog", f"/blog/{post.slug}", "/rss.xml", "/sitemap.xml"]
    paths += [f"/blog/tag/{tag.slug}" for tag in post.tags]
    if post.category is not None:
        paths.append(f"/blog/category/{post.category.slug}")
    if post.project is not None:
        paths += ["/projects", f"/projects/{post.project.slug}"]
    return paths


async def _unique_slug(session: AsyncSession, base: str, exclude_id: int | None = None) -> str:
    candidate, n = base, 2
    while await repository.slug_exists(session, candidate, exclude_id):
        suffix = f"-{n}"
        candidate = base[: 120 - len(suffix)] + suffix
        n += 1
    return candidate


async def _check_reference(
    session: AsyncSession, model: type[Category] | type[Project] | type[Media], ref_id: int | None
) -> None:
    if ref_id is not None and await session.get(model, ref_id) is None:
        raise ValidationError(
            "Una referencia no existe.", code="INVALID_REFERENCE", details={"id": ref_id}
        )


async def _apply_references(
    session: AsyncSession, post: Post, data: PostCreate | PostUpdate
) -> None:
    fields = data.model_fields_set
    checks: list[tuple[str, type[Category] | type[Project] | type[Media]]] = [
        ("category_id", Category),
        ("project_id", Project),
        ("cover_media_id", Media),
        ("og_media_id", Media),
    ]
    for field, model in checks:
        if field in fields:
            value = getattr(data, field)
            await _check_reference(session, model, value)
            setattr(post, field, value)

    _apply_series(post, data)

    if data.tag_ids is not None and ("tag_ids" in fields or isinstance(data, PostCreate)):
        unique_ids = list(dict.fromkeys(data.tag_ids))
        tags = await taxonomy_repository.get_tags_by_ids(session, unique_ids)
        if len(tags) != len(unique_ids):
            raise ValidationError("Alguna etiqueta no existe.", code="INVALID_REFERENCE")
        post.tags = list(tags)


def _apply_series(post: Post, data: PostCreate | PostUpdate) -> None:
    """Apply `series_order`, which only makes sense inside a project's log.

    Quitar el proyecto sin tocar el orden también limpia el orden; enviar un orden en un
    post sin proyecto es un error de validación.
    """
    fields = data.model_fields_set
    if "series_order" in fields:
        post.series_order = data.series_order
    elif "project_id" in fields and data.project_id is None:
        post.series_order = None
    if post.series_order is not None and post.project_id is None:
        raise ValidationError(
            "El orden en la serie requiere un proyecto asociado.", code="SERIES_REQUIRES_PROJECT"
        )


async def _reload(session: AsyncSession, post_id: int) -> Post:
    post = await repository.get(session, post_id)
    if post is None:
        raise NotFoundError("El post no existe.")
    return post


def _snapshot(post: Post, user: User | None) -> PostRevision:
    return PostRevision(
        post_id=post.id,
        title=post.title,
        content_md=post.content_md,
        created_by=user.id if user else None,
    )


# ── Admin: CRUD ──────────────────────────────────────────────────────────────


async def admin_list(
    session: AsyncSession, params: PageParams, status: str | None, q: str | None
) -> Page[PostListItem]:
    rows, total = await repository.admin_list(session, status, q, params.offset, params.page_size)
    return Page(
        items=[PostListItem.model_validate(p) for p in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def get(session: AsyncSession, post_id: int) -> Post:
    return await _reload(session, post_id)


async def create(session: AsyncSession, user: User, data: PostCreate) -> Post:
    if data.slug:
        if await repository.slug_exists(session, data.slug):
            raise ConflictError("Ya existe un post con ese slug.", code="SLUG_TAKEN")
        slug = data.slug
    else:
        slug = await _unique_slug(session, slugify(data.title))

    post = Post(
        title=data.title.strip(),
        slug=slug,
        excerpt=data.excerpt,
        content_md=data.content_md,
        status="draft",
        author_id=user.id,
        reading_minutes=reading_minutes(data.content_md),
        seo_title=data.seo_title,
        seo_description=data.seo_description,
        canonical_url=data.canonical_url,
        github_repo=data.github_repo,
        featured=data.featured,
        tags=[],
    )
    await _apply_references(session, post, data)
    session.add(post)
    await session.commit()
    return await _reload(session, post.id)


async def update(
    session: AsyncSession, revalidator: Revalidator, user: User, post_id: int, data: PostUpdate
) -> Post:
    post = await _reload(session, post_id)
    old_paths = public_paths(post) if post.status == "published" else []
    fields = data.model_fields_set

    if data.slug is not None and data.slug != post.slug:
        if await repository.slug_exists(session, data.slug, post.id):
            raise ConflictError("Ya existe un post con ese slug.", code="SLUG_TAKEN")
        post.slug = data.slug

    content_changed = False
    if data.title is not None and data.title.strip() != post.title:
        post.title = data.title.strip()
        content_changed = True
    if data.content_md is not None and data.content_md != post.content_md:
        post.content_md = data.content_md
        post.reading_minutes = reading_minutes(data.content_md)
        content_changed = True
    for field in ("excerpt", "seo_title", "seo_description", "canonical_url", "github_repo"):
        if field in fields:
            setattr(post, field, getattr(data, field))
    if data.featured is not None:
        post.featured = data.featured
    await _apply_references(session, post, data)

    if content_changed:
        post.saves_since_revision += 1
        if post.saves_since_revision >= REVISION_EVERY_N_SAVES:
            session.add(_snapshot(post, user))
            post.saves_since_revision = 0
    post.updated_at = datetime.now(UTC)
    await session.commit()

    post = await _reload(session, post.id)
    if post.status == "published":
        revalidator.add(old_paths + public_paths(post))
    return post


async def delete(session: AsyncSession, post_id: int) -> None:
    post = await _reload(session, post_id)
    if post.status not in ("draft", "archived"):
        raise ConflictError(
            "Solo se pueden eliminar borradores o posts archivados.", code="INVALID_STATE"
        )
    await session.delete(post)
    await session.commit()


async def duplicate(session: AsyncSession, user: User, post_id: int) -> Post:
    source = await _reload(session, post_id)
    copy = Post(
        title=f"{source.title} (copia)"[:300],
        slug=await _unique_slug(session, f"{source.slug}-copia"[:120].rstrip("-")),
        excerpt=source.excerpt,
        content_md=source.content_md,
        status="draft",
        author_id=user.id,
        reading_minutes=source.reading_minutes,
        category_id=source.category_id,
        project_id=source.project_id,
        cover_media_id=source.cover_media_id,
        og_media_id=source.og_media_id,
        seo_title=source.seo_title,
        seo_description=source.seo_description,
        github_repo=source.github_repo,
        series_order=None,  # la copia no hereda posición: evita dos posts con el mismo orden.
        tags=list(source.tags),
    )
    session.add(copy)
    await session.commit()
    return await _reload(session, copy.id)


# ── Admin: flujo de estados ──────────────────────────────────────────────────


async def _publish(session: AsyncSession, post: Post, user: User | None) -> None:
    now = datetime.now(UTC)
    post.status = "published"
    post.published_at = post.published_at or now
    post.scheduled_for = None
    post.updated_at = now
    post.saves_since_revision = 0
    session.add(_snapshot(post, user))


async def publish(
    session: AsyncSession, revalidator: Revalidator, user: User, post_id: int
) -> Post:
    post = await _reload(session, post_id)
    if not post.content_md.strip():
        raise ValidationError("No se puede publicar un post sin contenido.", code="EMPTY_CONTENT")
    await _publish(session, post, user)
    await session.commit()
    post = await _reload(session, post.id)
    revalidator.add(public_paths(post))
    return post


async def unpublish(session: AsyncSession, revalidator: Revalidator, post_id: int) -> Post:
    post = await _reload(session, post_id)
    was_public = post.status == "published"
    paths = public_paths(post)
    post.status = "draft"
    post.scheduled_for = None
    post.updated_at = datetime.now(UTC)
    await session.commit()
    if was_public:
        revalidator.add(paths)
    return await _reload(session, post.id)


async def archive(session: AsyncSession, revalidator: Revalidator, post_id: int) -> Post:
    post = await _reload(session, post_id)
    was_public = post.status == "published"
    paths = public_paths(post)
    post.status = "archived"
    post.scheduled_for = None
    post.updated_at = datetime.now(UTC)
    await session.commit()
    if was_public:
        revalidator.add(paths)
    return await _reload(session, post.id)


async def schedule(session: AsyncSession, post_id: int, when: datetime) -> Post:
    post = await _reload(session, post_id)
    if post.status == "published":
        raise ConflictError(
            "El post ya está publicado. Despublícalo antes de programarlo.", code="INVALID_STATE"
        )
    if when <= datetime.now(UTC):
        raise ValidationError("La fecha programada debe ser futura.", code="SCHEDULE_IN_PAST")
    if not post.content_md.strip():
        raise ValidationError("No se puede programar un post sin contenido.", code="EMPTY_CONTENT")
    post.status = "scheduled"
    post.scheduled_for = when
    post.updated_at = datetime.now(UTC)
    await session.commit()
    return await _reload(session, post.id)


async def publish_due(session: AsyncSession, revalidator: Revalidator, now: datetime) -> int:
    """Publish every scheduled post whose time has come (used by the worker)."""
    due = await repository.due_scheduled(session, now)
    for post in due:
        await _publish(session, post, None)
    await session.commit()
    for post in due:
        revalidator.add(public_paths(await _reload(session, post.id)))
    return len(due)


# ── Admin: revisiones ────────────────────────────────────────────────────────


async def list_revisions(session: AsyncSession, post_id: int) -> Sequence[PostRevision]:
    await _reload(session, post_id)
    return await repository.revisions(session, post_id)


async def restore_revision(
    session: AsyncSession, revalidator: Revalidator, user: User, post_id: int, revision_id: int
) -> Post:
    post = await _reload(session, post_id)
    revision = await repository.get_revision(session, post_id, revision_id)
    if revision is None:
        raise NotFoundError("La revisión no existe.")
    # Guardamos el estado actual para que restaurar sea reversible.
    session.add(_snapshot(post, user))
    post.title = revision.title
    post.content_md = revision.content_md
    post.reading_minutes = reading_minutes(revision.content_md)
    post.saves_since_revision = 0
    post.updated_at = datetime.now(UTC)
    await session.commit()
    post = await _reload(session, post.id)
    if post.status == "published":
        revalidator.add(public_paths(post))
    return post


# ── Público ──────────────────────────────────────────────────────────────────


async def public_list(
    session: AsyncSession,
    params: PageParams,
    *,
    tag: str | None = None,
    category: str | None = None,
    project: str | None = None,
    featured: bool | None = None,
    q: str | None = None,
) -> Page[PublicPostSummary]:
    if q:
        results = await search(session, params, q)
        return Page(
            items=[PublicPostSummary.model_validate(r) for r in results.items],
            total=results.total,
            page=results.page,
            page_size=results.page_size,
        )
    rows, total = await repository.public_list(
        session,
        tag=tag,
        category=category,
        project=project,
        featured=featured,
        offset=params.offset,
        limit=params.page_size,
    )
    return Page(
        items=[PublicPostSummary.model_validate(p) for p in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def public_detail(session: AsyncSession, slug: str) -> PublicPostDetail:
    post = await repository.public_by_slug(session, slug)
    if post is None:
        raise NotFoundError("El post no existe.")
    return PublicPostDetail.model_validate(post)


async def public_related(session: AsyncSession, slug: str) -> list[PublicPostSummary]:
    post = await repository.public_by_slug(session, slug)
    if post is None:
        raise NotFoundError("El post no existe.")
    rows = await repository.related(session, post, RELATED_LIMIT)
    return [PublicPostSummary.model_validate(p) for p in rows]


async def search(session: AsyncSession, params: PageParams, q: str) -> Page[SearchResult]:
    q = q.strip()
    if not q:
        return Page(items=[], total=0, page=params.page, page_size=params.page_size)
    rows, total = await repository.search(session, q, params.offset, params.page_size)
    items = [
        SearchResult.model_validate(
            {**PublicPostSummary.model_validate(post).model_dump(), "snippet": snippet}
        )
        for post, snippet in rows
    ]
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


async def public_post_slugs(session: AsyncSession) -> list[SlugEntry]:
    rows = await repository.published_slugs(session)
    return [SlugEntry(slug=slug, updated_at=updated) for slug, updated in rows]


async def public_slugs(session: AsyncSession, project_slugs: list[str]) -> PublicSlugs:
    tags = await taxonomy_repository.tags_with_published_count(session)
    categories = await taxonomy_repository.categories_with_published_count(session)
    return PublicSlugs(
        posts=await public_post_slugs(session),
        projects=project_slugs,
        tags=[t.slug for t, _ in tags],
        categories=[c.slug for c, n in categories if n > 0],
    )
