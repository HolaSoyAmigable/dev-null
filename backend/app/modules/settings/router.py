"""Admin routes for site settings."""

from fastapi import APIRouter, Depends

from app.core.deps import RevalidatorDep, SessionDep, invalidate_cache_on_write
from app.modules.auth.deps import require_admin
from app.modules.settings import service
from app.modules.settings.schemas import SiteSettings, SiteSettingsUpdate

router = APIRouter(
    prefix="/admin/settings",
    tags=["admin-settings"],
    dependencies=[Depends(require_admin), Depends(invalidate_cache_on_write)],
)


@router.get("", response_model=SiteSettings)
async def get_settings(session: SessionDep) -> SiteSettings:
    return await service.get_all(session)


@router.patch("", response_model=SiteSettings)
async def update_settings(
    body: SiteSettingsUpdate, session: SessionDep, revalidator: RevalidatorDep
) -> SiteSettings:
    return await service.update(session, revalidator, body)
