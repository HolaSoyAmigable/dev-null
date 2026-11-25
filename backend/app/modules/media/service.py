"""Business logic for media uploads."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import NotFoundError, PayloadTooLargeError, ValidationError
from app.core.pagination import Page, PageParams
from app.modules.media.inspect import detect
from app.modules.media.models import Media
from app.modules.media.schemas import MediaRead
from app.storage import StorageBackend


def _storage_key(extension: str) -> str:
    now = datetime.now(UTC)
    return f"{now:%Y/%m}/{uuid.uuid4().hex}.{extension}"


async def upload(
    session: AsyncSession, storage: StorageBackend, data: bytes, alt_text: str | None
) -> Media:
    """Validate the real file type and size, store it and register it."""
    if len(data) > get_settings().MEDIA_MAX_BYTES:
        raise PayloadTooLargeError()
    if not data:
        raise ValidationError("El archivo está vacío.", code="EMPTY_FILE")
    info = detect(data)
    if info is None:
        raise ValidationError(
            "Tipo de archivo no permitido. Usa PNG, JPEG, GIF, WebP, AVIF o PDF.",
            code="UNSUPPORTED_MEDIA_TYPE",
        )
    key = _storage_key(info.extension)
    await storage.save(key, data)
    media = Media(
        storage_key=key,
        url=storage.public_url(key),
        alt_text=(alt_text or "").strip() or None,
        mime=info.mime,
        size_bytes=len(data),
        width=info.width,
        height=info.height,
    )
    session.add(media)
    try:
        await session.commit()
    except Exception:
        await storage.delete(key)
        raise
    return media


async def list_media(session: AsyncSession, params: PageParams) -> Page[MediaRead]:
    total = int(await session.scalar(select(func.count(Media.id))) or 0)
    rows = await session.scalars(
        select(Media)
        .order_by(Media.created_at.desc(), Media.id.desc())
        .offset(params.offset)
        .limit(params.page_size)
    )
    return Page(
        items=[MediaRead.model_validate(m) for m in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def _get(session: AsyncSession, media_id: int) -> Media:
    media = await session.get(Media, media_id)
    if media is None:
        raise NotFoundError("El archivo no existe.")
    return media


async def update_alt(session: AsyncSession, media_id: int, alt_text: str | None) -> Media:
    media = await _get(session, media_id)
    media.alt_text = (alt_text or "").strip() or None
    await session.commit()
    return media


async def delete(session: AsyncSession, storage: StorageBackend, media_id: int) -> None:
    """Delete the record (FKs fall back to NULL) and then the stored file."""
    media = await _get(session, media_id)
    key = media.storage_key
    await session.delete(media)
    await session.commit()
    await storage.delete(key)
