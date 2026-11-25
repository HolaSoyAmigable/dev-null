"""Storage backends for uploaded media.

`StorageBackend` es la interfaz; `LocalDiskStorage` guarda en disco (volumen
Docker). Un backend S3 futuro solo debe implementar los mismos métodos.
"""

import asyncio
from functools import lru_cache
from pathlib import Path
from typing import Protocol

from app.core.config import get_settings


class StorageBackend(Protocol):
    async def save(self, key: str, data: bytes) -> None: ...

    async def delete(self, key: str) -> None: ...

    def public_url(self, key: str) -> str: ...


class LocalDiskStorage:
    """Store files under a base directory and serve them from a URL prefix."""

    def __init__(self, base_dir: Path, url_prefix: str) -> None:
        self.base_dir = base_dir.resolve()
        self.url_prefix = url_prefix.rstrip("/")

    def _path(self, key: str) -> Path:
        path = (self.base_dir / key).resolve()
        if not path.is_relative_to(self.base_dir):
            raise ValueError("Invalid storage key")
        return path

    async def save(self, key: str, data: bytes) -> None:
        path = self._path(key)

        def _write() -> None:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)

        await asyncio.to_thread(_write)

    async def delete(self, key: str) -> None:
        path = self._path(key)
        await asyncio.to_thread(path.unlink, missing_ok=True)

    def public_url(self, key: str) -> str:
        return f"{self.url_prefix}/{key}"


@lru_cache
def get_storage() -> StorageBackend:
    settings = get_settings()
    return LocalDiskStorage(settings.MEDIA_DIR, settings.MEDIA_URL_PREFIX)
