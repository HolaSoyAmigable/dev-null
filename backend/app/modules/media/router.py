"""Admin routes for media."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from app.core.config import get_settings
from app.core.deps import PageDep, SessionDep, invalidate_cache_on_write
from app.core.errors import PayloadTooLargeError
from app.core.pagination import Page
from app.modules.auth.deps import require_admin
from app.modules.media import service
from app.modules.media.schemas import MediaRead, MediaUpdate
from app.storage import StorageBackend, get_storage

router = APIRouter(
    prefix="/admin/media",
    tags=["admin-media"],
    dependencies=[Depends(require_admin), Depends(invalidate_cache_on_write)],
)

StorageDep = Annotated[StorageBackend, Depends(get_storage)]


@router.get("", response_model=Page[MediaRead])
async def list_media(session: SessionDep, params: PageDep) -> Page[MediaRead]:
    return await service.list_media(session, params)


@router.post("", response_model=MediaRead, status_code=status.HTTP_201_CREATED)
async def upload_media(
    session: SessionDep,
    storage: StorageDep,
    file: Annotated[UploadFile, File(description="Imagen o PDF")],
    alt_text: Annotated[str | None, Form(max_length=300)] = None,
) -> MediaRead:
    limit = get_settings().MEDIA_MAX_BYTES
    # Lee como máximo limit + 1 bytes para rechazar archivos grandes sin cargarlos enteros.
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise PayloadTooLargeError()
    media = await service.upload(session, storage, data, alt_text)
    return MediaRead.model_validate(media)


@router.patch("/{media_id}", response_model=MediaRead)
async def update_media(media_id: int, body: MediaUpdate, session: SessionDep) -> MediaRead:
    return MediaRead.model_validate(await service.update_alt(session, media_id, body.alt_text))


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media(media_id: int, session: SessionDep, storage: StorageDep) -> None:
    await service.delete(session, storage, media_id)
