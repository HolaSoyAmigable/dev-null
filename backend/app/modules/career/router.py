"""Admin routes for career entries."""

from fastapi import APIRouter, Depends, status

from app.core.deps import RevalidatorDep, SessionDep, invalidate_cache_on_write
from app.modules.auth.deps import require_admin
from app.modules.career import service
from app.modules.career.schemas import CareerCreate, CareerRead, CareerUpdate, ReorderRequest

router = APIRouter(
    prefix="/admin/career",
    tags=["admin-career"],
    dependencies=[Depends(require_admin), Depends(invalidate_cache_on_write)],
)


@router.get("", response_model=list[CareerRead])
async def list_entries(session: SessionDep) -> list[CareerRead]:
    return [CareerRead.model_validate(e) for e in await service.list_all(session)]


@router.post("", response_model=CareerRead, status_code=status.HTTP_201_CREATED)
async def create_entry(
    body: CareerCreate, session: SessionDep, revalidator: RevalidatorDep
) -> CareerRead:
    return CareerRead.model_validate(await service.create(session, revalidator, body))


@router.patch("/reorder", response_model=list[CareerRead])
async def reorder_entries(
    body: ReorderRequest, session: SessionDep, revalidator: RevalidatorDep
) -> list[CareerRead]:
    entries = await service.reorder(session, revalidator, body.items)
    return [CareerRead.model_validate(e) for e in entries]


@router.get("/{entry_id}", response_model=CareerRead)
async def get_entry(entry_id: int, session: SessionDep) -> CareerRead:
    return CareerRead.model_validate(await service.get(session, entry_id))


@router.patch("/{entry_id}", response_model=CareerRead)
async def update_entry(
    entry_id: int, body: CareerUpdate, session: SessionDep, revalidator: RevalidatorDep
) -> CareerRead:
    return CareerRead.model_validate(await service.update(session, revalidator, entry_id, body))


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(entry_id: int, session: SessionDep, revalidator: RevalidatorDep) -> None:
    await service.delete(session, revalidator, entry_id)
