"""Media: real type validation, size limit, listing and deletion."""

import struct
import zlib
from pathlib import Path

import pytest
from httpx import AsyncClient

from app.modules.media.inspect import detect
from tests.helpers import API, create_post


def _png(width: int, height: int) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    raw = b"".join(b"\x00" + b"\x00\x00\x00" * width for _ in range(height))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def _jpeg(width: int, height: int) -> bytes:
    sof = b"\xff\xc0" + struct.pack(">HBHHB", 11, 8, height, width, 1) + b"\x01\x11\x00"
    return (
        b"\xff\xd8\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00" + b"\x00" * 9 + sof + b"\xff\xd9"
    )


def test_detect_types_and_dimensions() -> None:
    png = detect(_png(3, 2))
    assert png is not None and (png.mime, png.width, png.height) == ("image/png", 3, 2)
    jpeg = detect(_jpeg(640, 480))
    assert jpeg is not None and (jpeg.mime, jpeg.width, jpeg.height) == ("image/jpeg", 640, 480)
    gif = detect(b"GIF89a" + struct.pack("<HH", 10, 20) + b"\x00" * 10)
    assert gif is not None and (gif.width, gif.height) == (10, 20)
    assert detect(b"%PDF-1.7 ...") is not None
    assert detect(b"<svg xmlns='http://www.w3.org/2000/svg'></svg>") is None
    assert detect(b"MZ\x90\x00 executable") is None


async def test_upload_list_update_and_delete(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    upload = await client.post(
        f"{API}/admin/media",
        files={"file": ("foto.txt", _png(4, 3), "text/plain")},
        data={"alt_text": "Una foto"},
        headers=auth_headers,
    )
    assert upload.status_code == 201, upload.text
    media = upload.json()
    assert media["mime"] == "image/png"
    assert (media["width"], media["height"]) == (4, 3)
    assert media["url"].startswith("/media/")
    assert media["url"].endswith(".png")
    assert "foto" not in media["url"]

    from app.core.config import get_settings

    stored = Path(get_settings().MEDIA_DIR) / media["url"].removeprefix("/media/")
    assert stored.exists()
    served = await client.get(media["url"])
    assert served.status_code == 200

    listed = (await client.get(f"{API}/admin/media", headers=auth_headers)).json()
    assert listed["total"] == 1

    updated = await client.patch(
        f"{API}/admin/media/{media['id']}", json={"alt_text": "Nuevo"}, headers=auth_headers
    )
    assert updated.json()["alt_text"] == "Nuevo"

    post = await create_post(client, auth_headers, cover_media_id=media["id"])
    assert post["cover"]["id"] == media["id"]

    deleted = await client.delete(f"{API}/admin/media/{media['id']}", headers=auth_headers)
    assert deleted.status_code == 204
    assert not stored.exists()
    detail = await client.get(f"{API}/admin/posts/{post['id']}", headers=auth_headers)
    assert detail.json()["cover"] is None


async def test_upload_rejects_disguised_files(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    response = await client.post(
        f"{API}/admin/media",
        files={"file": ("imagen.png", b"<script>alert(1)</script>", "image/png")},
        headers=auth_headers,
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "UNSUPPORTED_MEDIA_TYPE"


async def test_upload_rejects_large_files(
    client: AsyncClient, auth_headers: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "MEDIA_MAX_BYTES", 100)
    response = await client.post(
        f"{API}/admin/media",
        files={"file": ("big.png", _png(50, 50) + b"\x00" * 200, "image/png")},
        headers=auth_headers,
    )
    assert response.status_code == 413
