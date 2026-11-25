"""Public, unauthenticated endpoints (cached in Redis and rate limited by IP)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import RootModel
from pydantic import ValidationError as PydanticValidationError

from app.core.cache import cache_key, cached_json
from app.core.deps import PageDep, RedisDep, SessionDep
from app.core.errors import ErrorResponse, ValidationError
from app.core.pagination import Page
from app.core.ratelimit import client_ip, events_rate_limit, public_rate_limit
from app.core.slug import SLUG_PATTERN
from app.modules.career import service as career_service
from app.modules.career.schemas import PublicCareerEntry
from app.modules.metrics import service as metrics_service
from app.modules.metrics.schemas import EventAccepted, EventIn
from app.modules.posts import service as posts_service
from app.modules.posts.schemas import (
    PublicPostDetail,
    PublicPostSummary,
    PublicSlugs,
    SearchResult,
)
from app.modules.projects import service as projects_service
from app.modules.projects.schemas import PublicProjectDetail, PublicProjectSummary
from app.modules.settings import service as settings_service
from app.modules.settings.schemas import SiteSettings
from app.modules.taxonomy import service as taxonomy_service
from app.modules.taxonomy.schemas import CategoryWithCount, TagWithCount

router = APIRouter(prefix="/public", tags=["public"])
content = APIRouter(dependencies=[Depends(public_rate_limit)])

SlugQ = Annotated[str | None, Query(max_length=120, pattern=SLUG_PATTERN)]


class _PostList(RootModel[list[PublicPostSummary]]):
    pass


class _ProjectList(RootModel[list[PublicProjectSummary]]):
    pass


class _CareerList(RootModel[list[PublicCareerEntry]]):
    pass


class _TagList(RootModel[list[TagWithCount]]):
    pass


class _CategoryList(RootModel[list[CategoryWithCount]]):
    pass


_PostPage = Page[PublicPostSummary]
_SearchPage = Page[SearchResult]


@content.get("/posts", response_model=Page[PublicPostSummary])
async def list_posts(
    session: SessionDep,
    redis: RedisDep,
    params: PageDep,
    tag: SlugQ = None,
    category: SlugQ = None,
    project: SlugQ = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
) -> Page[PublicPostSummary]:
    async def load() -> Page[PublicPostSummary]:
        return await posts_service.public_list(
            session, params, tag=tag, category=category, project=project, q=q
        )

    key = cache_key("posts", params.page, params.page_size, tag, category, project, q)
    return await cached_json(redis, key, _PostPage, load)


@content.get("/posts/{slug}", response_model=PublicPostDetail)
async def get_post(slug: str, session: SessionDep, redis: RedisDep) -> PublicPostDetail:
    async def load() -> PublicPostDetail:
        return await posts_service.public_detail(session, slug)

    return await cached_json(redis, cache_key("post", slug), PublicPostDetail, load)


@content.get("/posts/{slug}/related", response_model=list[PublicPostSummary])
async def related_posts(slug: str, session: SessionDep, redis: RedisDep) -> list[PublicPostSummary]:
    async def load() -> _PostList:
        return _PostList(await posts_service.public_related(session, slug))

    return (await cached_json(redis, cache_key("related", slug), _PostList, load)).root


@content.get("/projects", response_model=list[PublicProjectSummary])
async def list_projects(session: SessionDep, redis: RedisDep) -> list[PublicProjectSummary]:
    async def load() -> _ProjectList:
        return _ProjectList(await projects_service.public_list(session))

    return (await cached_json(redis, cache_key("projects"), _ProjectList, load)).root


@content.get("/projects/{slug}", response_model=PublicProjectDetail)
async def get_project(slug: str, session: SessionDep, redis: RedisDep) -> PublicProjectDetail:
    async def load() -> PublicProjectDetail:
        return await projects_service.public_detail(session, slug)

    return await cached_json(redis, cache_key("project", slug), PublicProjectDetail, load)


@content.get("/career", response_model=list[PublicCareerEntry])
async def career(session: SessionDep, redis: RedisDep) -> list[PublicCareerEntry]:
    async def load() -> _CareerList:
        return _CareerList(await career_service.public_list(session))

    return (await cached_json(redis, cache_key("career"), _CareerList, load)).root


@content.get("/tags", response_model=list[TagWithCount])
async def tags(session: SessionDep, redis: RedisDep) -> list[TagWithCount]:
    async def load() -> _TagList:
        return _TagList(await taxonomy_service.public_tags(session))

    return (await cached_json(redis, cache_key("tags"), _TagList, load)).root


@content.get("/categories", response_model=list[CategoryWithCount])
async def categories(session: SessionDep, redis: RedisDep) -> list[CategoryWithCount]:
    async def load() -> _CategoryList:
        return _CategoryList(await taxonomy_service.public_categories(session))

    return (await cached_json(redis, cache_key("categories"), _CategoryList, load)).root


@content.get("/search", response_model=Page[SearchResult])
async def search(
    session: SessionDep,
    redis: RedisDep,
    params: PageDep,
    q: Annotated[str, Query(min_length=1, max_length=200)],
) -> Page[SearchResult]:
    async def load() -> Page[SearchResult]:
        return await posts_service.search(session, params, q)

    key = cache_key("search", q.strip().lower(), params.page, params.page_size)
    return await cached_json(redis, key, _SearchPage, load)


@content.get("/settings", response_model=SiteSettings)
async def site_settings(session: SessionDep, redis: RedisDep) -> SiteSettings:
    async def load() -> SiteSettings:
        return await settings_service.get_all(session)

    return await cached_json(redis, cache_key("settings"), SiteSettings, load)


@content.get("/slugs", response_model=PublicSlugs)
async def slugs(session: SessionDep, redis: RedisDep) -> PublicSlugs:
    async def load() -> PublicSlugs:
        project_slugs = await projects_service.public_slugs(session)
        return await posts_service.public_slugs(session, project_slugs)

    return await cached_json(redis, cache_key("slugs"), PublicSlugs, load)


@router.post(
    "/events",
    response_model=EventAccepted,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(events_rate_limit)],
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/EventIn"}}},
        }
    },
)
async def ingest_event(request: Request, session: SessionDep) -> EventAccepted:
    """Receive a beacon. Accepts any Content-Type because sendBeacon may send text/plain."""
    body = await request.body()
    if len(body) > 8192:
        raise ValidationError("Evento demasiado grande.")
    try:
        event = EventIn.model_validate_json(body)
    except PydanticValidationError as exc:
        raise ValidationError(
            details={"errors": exc.errors(include_url=False, include_input=False)}
        ) from exc
    headers = request.headers
    return await metrics_service.ingest(
        session,
        event,
        ip=client_ip(request),
        user_agent=headers.get("user-agent", ""),
        accept_language=headers.get("accept-language"),
        own_host=headers.get("x-forwarded-host") or headers.get("host"),
        dnt=headers.get("dnt") == "1" or headers.get("sec-gpc") == "1",
    )


router.include_router(content)

# Modelos que no se declaran como parámetros pero deben aparecer en el OpenAPI.
OPENAPI_EXTRA_MODELS = (EventIn, ErrorResponse)
