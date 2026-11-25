"""Business logic for site settings (key/value store)."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.revalidation.service import Revalidator
from app.modules.settings.models import SiteSetting
from app.modules.settings.schemas import SiteSettings, SiteSettingsUpdate

# Todas las páginas muestran nombre/autor en cabecera y pie: "*" revalida el sitio entero.
_PATHS = ["*"]


async def get_all(session: AsyncSession) -> SiteSettings:
    rows = (await session.scalars(select(SiteSetting))).all()
    stored: dict[str, Any] = {row.key: row.value for row in rows}
    known = {k: v for k, v in stored.items() if k in SiteSettings.model_fields}
    return SiteSettings.model_validate(known)


async def update(
    session: AsyncSession, revalidator: Revalidator, data: SiteSettingsUpdate
) -> SiteSettings:
    values = data.model_dump(mode="json", exclude_unset=True, exclude_none=True)
    for key, value in values.items():
        stmt = insert(SiteSetting).values(key=key, value=value)
        await session.execute(
            stmt.on_conflict_do_update(index_elements=[SiteSetting.key], set_={"value": value})
        )
    await session.commit()
    if values:
        revalidator.add(_PATHS)
    return await get_all(session)
