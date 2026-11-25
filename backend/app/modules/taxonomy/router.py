"""Admin routes for tags and categories."""

from fastapi import APIRouter, Depends, status

from app.core.deps import RevalidatorDep, SessionDep, invalidate_cache_on_write
from app.modules.auth.deps import require_admin
from app.modules.taxonomy import service
from app.modules.taxonomy.schemas import (
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
    TagCreate,
    TagRead,
    TagUpdate,
)

router = APIRouter(
    prefix="/admin",
    tags=["admin-taxonomy"],
    dependencies=[Depends(require_admin), Depends(invalidate_cache_on_write)],
)


@router.get("/tags", response_model=list[TagRead])
async def list_tags(session: SessionDep) -> list[TagRead]:
    return [TagRead.model_validate(t) for t in await service.list_tags(session)]


@router.post("/tags", response_model=TagRead, status_code=status.HTTP_201_CREATED)
async def create_tag(body: TagCreate, session: SessionDep) -> TagRead:
    return TagRead.model_validate(await service.create_tag(session, body))


@router.patch("/tags/{tag_id}", response_model=TagRead)
async def update_tag(
    tag_id: int, body: TagUpdate, session: SessionDep, revalidator: RevalidatorDep
) -> TagRead:
    return TagRead.model_validate(await service.update_tag(session, revalidator, tag_id, body))


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(tag_id: int, session: SessionDep, revalidator: RevalidatorDep) -> None:
    await service.delete_tag(session, revalidator, tag_id)


@router.get("/categories", response_model=list[CategoryRead])
async def list_categories(session: SessionDep) -> list[CategoryRead]:
    return [CategoryRead.model_validate(c) for c in await service.list_categories(session)]


@router.post("/categories", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(body: CategoryCreate, session: SessionDep) -> CategoryRead:
    return CategoryRead.model_validate(await service.create_category(session, body))


@router.patch("/categories/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: int, body: CategoryUpdate, session: SessionDep, revalidator: RevalidatorDep
) -> CategoryRead:
    category = await service.update_category(session, revalidator, category_id, body)
    return CategoryRead.model_validate(category)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int, session: SessionDep, revalidator: RevalidatorDep
) -> None:
    await service.delete_category(session, revalidator, category_id)
