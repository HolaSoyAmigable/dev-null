"""Admin routes for posts."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.deps import PageDep, RevalidatorDep, SessionDep, invalidate_cache_on_write
from app.core.pagination import Page
from app.modules.auth.deps import AdminUser, require_admin
from app.modules.posts import service
from app.modules.posts.schemas import (
    PostCreate,
    PostListItem,
    PostRead,
    PostStatus,
    PostUpdate,
    RevisionRead,
    ScheduleRequest,
)

router = APIRouter(
    prefix="/admin/posts",
    tags=["admin-posts"],
    dependencies=[Depends(require_admin), Depends(invalidate_cache_on_write)],
)


@router.get("", response_model=Page[PostListItem])
async def list_posts(
    session: SessionDep,
    params: PageDep,
    status_filter: Annotated[PostStatus | None, Query(alias="status")] = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
) -> Page[PostListItem]:
    return await service.admin_list(session, params, status_filter, q)


@router.post("", response_model=PostRead, status_code=status.HTTP_201_CREATED)
async def create_post(body: PostCreate, session: SessionDep, user: AdminUser) -> PostRead:
    return PostRead.model_validate(await service.create(session, user, body))


@router.get("/{post_id}", response_model=PostRead)
async def get_post(post_id: int, session: SessionDep) -> PostRead:
    return PostRead.model_validate(await service.get(session, post_id))


@router.patch("/{post_id}", response_model=PostRead)
async def update_post(
    post_id: int,
    body: PostUpdate,
    session: SessionDep,
    user: AdminUser,
    revalidator: RevalidatorDep,
) -> PostRead:
    post = await service.update(session, revalidator, user, post_id, body)
    return PostRead.model_validate(post)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(post_id: int, session: SessionDep) -> None:
    await service.delete(session, post_id)


@router.post("/{post_id}/publish", response_model=PostRead)
async def publish_post(
    post_id: int, session: SessionDep, user: AdminUser, revalidator: RevalidatorDep
) -> PostRead:
    return PostRead.model_validate(await service.publish(session, revalidator, user, post_id))


@router.post("/{post_id}/unpublish", response_model=PostRead)
async def unpublish_post(
    post_id: int, session: SessionDep, revalidator: RevalidatorDep
) -> PostRead:
    return PostRead.model_validate(await service.unpublish(session, revalidator, post_id))


@router.post("/{post_id}/archive", response_model=PostRead)
async def archive_post(post_id: int, session: SessionDep, revalidator: RevalidatorDep) -> PostRead:
    return PostRead.model_validate(await service.archive(session, revalidator, post_id))


@router.post("/{post_id}/schedule", response_model=PostRead)
async def schedule_post(post_id: int, body: ScheduleRequest, session: SessionDep) -> PostRead:
    return PostRead.model_validate(await service.schedule(session, post_id, body.scheduled_for))


@router.post("/{post_id}/duplicate", response_model=PostRead, status_code=status.HTTP_201_CREATED)
async def duplicate_post(post_id: int, session: SessionDep, user: AdminUser) -> PostRead:
    return PostRead.model_validate(await service.duplicate(session, user, post_id))


@router.get("/{post_id}/revisions", response_model=list[RevisionRead])
async def list_revisions(post_id: int, session: SessionDep) -> list[RevisionRead]:
    return [RevisionRead.model_validate(r) for r in await service.list_revisions(session, post_id)]


@router.post("/{post_id}/restore-revision/{revision_id}", response_model=PostRead)
async def restore_revision(
    post_id: int,
    revision_id: int,
    session: SessionDep,
    user: AdminUser,
    revalidator: RevalidatorDep,
) -> PostRead:
    post = await service.restore_revision(session, revalidator, user, post_id, revision_id)
    return PostRead.model_validate(post)
