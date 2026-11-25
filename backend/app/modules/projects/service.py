"""Business logic for projects."""

from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.slug import slugify
from app.modules.media.models import Media
from app.modules.posts.models import Post
from app.modules.posts.schemas import PublicPostSummary
from app.modules.projects.models import Project
from app.modules.projects.schemas import (
    ProjectCreate,
    ProjectUpdate,
    PublicProjectDetail,
    PublicProjectSummary,
)
from app.modules.revalidation.service import Revalidator

_ORDER = (Project.featured.desc(), Project.sort_order, Project.name)


def _paths(slug: str) -> list[str]:
    return ["/", "/projects", f"/projects/{slug}", "/sitemap.xml"]


async def _slug_taken(session: AsyncSession, slug: str, exclude_id: int | None) -> bool:
    stmt = select(Project.id).where(Project.slug == slug)
    if exclude_id is not None:
        stmt = stmt.where(Project.id != exclude_id)
    return (await session.scalar(stmt)) is not None


async def _get(session: AsyncSession, project_id: int) -> Project:
    stmt = select(Project).where(Project.id == project_id).execution_options(populate_existing=True)
    project = (await session.scalars(stmt)).one_or_none()
    if project is None:
        raise NotFoundError("El proyecto no existe.")
    return project


def _validate_dates(project: Project) -> None:
    if project.start_date and project.end_date and project.end_date < project.start_date:
        raise ValidationError(
            "La fecha de fin no puede ser anterior a la de inicio.", code="INVALID_DATES"
        )


async def _check_cover(session: AsyncSession, media_id: int | None) -> None:
    if media_id is not None and await session.get(Media, media_id) is None:
        raise ValidationError("La imagen de portada no existe.", code="INVALID_REFERENCE")


async def list_all(session: AsyncSession) -> Sequence[Project]:
    return (await session.scalars(select(Project).order_by(*_ORDER))).all()


async def get(session: AsyncSession, project_id: int) -> Project:
    return await _get(session, project_id)


async def create(session: AsyncSession, revalidator: Revalidator, data: ProjectCreate) -> Project:
    slug = data.slug or slugify(data.name)
    if await _slug_taken(session, slug, None):
        raise ConflictError("Ya existe un proyecto con ese slug.", code="SLUG_TAKEN")
    await _check_cover(session, data.cover_media_id)
    values = data.model_dump(exclude={"slug", "repo_url", "demo_url"})
    project = Project(
        **values,
        slug=slug,
        repo_url=str(data.repo_url) if data.repo_url else None,
        demo_url=str(data.demo_url) if data.demo_url else None,
    )
    _validate_dates(project)
    session.add(project)
    await session.commit()
    revalidator.add(_paths(project.slug))
    return await _get(session, project.id)


async def update(
    session: AsyncSession, revalidator: Revalidator, project_id: int, data: ProjectUpdate
) -> Project:
    project = await _get(session, project_id)
    old_slug = project.slug
    for field in data.model_fields_set:
        value = getattr(data, field)
        if field in ("name", "status", "featured", "sort_order", "stack") and value is None:
            continue
        if field == "slug":
            if value is None or value == project.slug:
                continue
            if await _slug_taken(session, value, project.id):
                raise ConflictError("Ya existe un proyecto con ese slug.", code="SLUG_TAKEN")
        if field in ("repo_url", "demo_url") and value is not None:
            value = str(value)
        if field == "cover_media_id":
            await _check_cover(session, value)
        setattr(project, field, value)
    _validate_dates(project)
    await session.commit()
    revalidator.add(_paths(old_slug) + _paths(project.slug))
    return await _get(session, project.id)


async def delete(session: AsyncSession, revalidator: Revalidator, project_id: int) -> None:
    project = await _get(session, project_id)
    revalidator.add(_paths(project.slug) + ["/blog"])
    await session.delete(project)
    await session.commit()


async def _published_counts(session: AsyncSession) -> dict[int, int]:
    stmt = (
        select(Post.project_id, func.count(Post.id))
        .where(Post.status == "published", Post.project_id.is_not(None))
        .group_by(Post.project_id)
    )
    return {int(pid): int(n) for pid, n in (await session.execute(stmt)).all() if pid}


async def public_list(session: AsyncSession) -> list[PublicProjectSummary]:
    counts = await _published_counts(session)
    return [
        PublicProjectSummary.model_validate(p).model_copy(
            update={"post_count": counts.get(p.id, 0)}
        )
        for p in await list_all(session)
    ]


async def public_detail(session: AsyncSession, slug: str) -> PublicProjectDetail:
    project = (await session.scalars(select(Project).where(Project.slug == slug))).one_or_none()
    if project is None:
        raise NotFoundError("El proyecto no existe.")
    posts = (
        await session.scalars(
            select(Post)
            .where(Post.project_id == project.id, Post.status == "published")
            .order_by(Post.published_at.desc())
        )
    ).all()
    summary = PublicProjectSummary.model_validate(project)
    return PublicProjectDetail(
        **summary.model_dump(exclude={"post_count"}),
        post_count=len(posts),
        description_md=project.description_md,
        posts=[PublicPostSummary.model_validate(p) for p in posts],
    )


async def public_slugs(session: AsyncSession) -> list[str]:
    return list((await session.scalars(select(Project.slug).order_by(Project.slug))).all())
