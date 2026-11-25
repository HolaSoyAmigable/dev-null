"""Business logic for career entries."""

from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.modules.career.models import CareerEntry
from app.modules.career.schemas import CareerCreate, CareerUpdate, PublicCareerEntry, ReorderItem
from app.modules.revalidation.service import Revalidator

_PATHS = ["/career", "/about", "/"]
_ORDER = (CareerEntry.sort_order, CareerEntry.start_date.desc(), CareerEntry.id)
_NON_NULLABLE = {"type", "title", "start_date", "skills", "sort_order", "visible"}


def _clean_skills(skills: list[str]) -> list[str]:
    return list(dict.fromkeys(s.strip() for s in skills if s.strip()))


def _validate(entry: CareerEntry) -> None:
    if entry.end_date is not None and entry.end_date < entry.start_date:
        raise ValidationError(
            "La fecha de fin no puede ser anterior a la de inicio.", code="INVALID_DATES"
        )


async def _get(session: AsyncSession, entry_id: int) -> CareerEntry:
    entry = await session.get(CareerEntry, entry_id)
    if entry is None:
        raise NotFoundError("La entrada de carrera no existe.")
    return entry


async def list_all(session: AsyncSession) -> Sequence[CareerEntry]:
    return (await session.scalars(select(CareerEntry).order_by(*_ORDER))).all()


async def get(session: AsyncSession, entry_id: int) -> CareerEntry:
    return await _get(session, entry_id)


async def create(
    session: AsyncSession, revalidator: Revalidator, data: CareerCreate
) -> CareerEntry:
    sort_order = data.sort_order
    if sort_order is None:
        current_max = await session.scalar(select(func.max(CareerEntry.sort_order)))
        sort_order = (current_max or 0) + 1
    entry = CareerEntry(
        **data.model_dump(exclude={"sort_order", "skills"}),
        skills=_clean_skills(data.skills),
        sort_order=sort_order,
    )
    _validate(entry)
    session.add(entry)
    await session.commit()
    revalidator.add(_PATHS)
    return entry


async def update(
    session: AsyncSession, revalidator: Revalidator, entry_id: int, data: CareerUpdate
) -> CareerEntry:
    entry = await _get(session, entry_id)
    for field in data.model_fields_set:
        value = getattr(data, field)
        if field in _NON_NULLABLE and value is None:
            continue
        if field == "skills":
            value = _clean_skills(value)
        setattr(entry, field, value)
    _validate(entry)
    await session.commit()
    revalidator.add(_PATHS)
    return entry


async def delete(session: AsyncSession, revalidator: Revalidator, entry_id: int) -> None:
    entry = await _get(session, entry_id)
    await session.delete(entry)
    await session.commit()
    revalidator.add(_PATHS)


async def reorder(
    session: AsyncSession, revalidator: Revalidator, items: list[ReorderItem]
) -> Sequence[CareerEntry]:
    ids = [item.id for item in items]
    if len(set(ids)) != len(ids):
        raise ValidationError("Hay IDs repetidos en la lista.", code="DUPLICATE_IDS")
    entries = {
        e.id: e
        for e in (await session.scalars(select(CareerEntry).where(CareerEntry.id.in_(ids)))).all()
    }
    missing = [i for i in ids if i not in entries]
    if missing:
        raise NotFoundError("Alguna entrada no existe.", details={"ids": missing})
    for item in items:
        entries[item.id].sort_order = item.sort_order
    await session.commit()
    revalidator.add(_PATHS)
    return await list_all(session)


async def public_list(session: AsyncSession) -> list[PublicCareerEntry]:
    rows = await session.scalars(
        select(CareerEntry).where(CareerEntry.visible.is_(True)).order_by(*_ORDER)
    )
    return [PublicCareerEntry.model_validate(e) for e in rows]
