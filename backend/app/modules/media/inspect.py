"""Detect file type from magic bytes and read image dimensions.

No se confía en la extensión ni en el Content-Type del cliente. SVG queda
excluido a propósito porque puede contener scripts.
"""

import struct
from dataclasses import dataclass


@dataclass(frozen=True)
class FileInfo:
    mime: str
    extension: str
    width: int | None
    height: int | None


def _png_size(data: bytes) -> tuple[int, int] | None:
    if len(data) < 24:
        return None
    width, height = struct.unpack(">II", data[16:24])
    return int(width), int(height)


def _gif_size(data: bytes) -> tuple[int, int] | None:
    if len(data) < 10:
        return None
    width, height = struct.unpack("<HH", data[6:10])
    return int(width), int(height)


def _jpeg_size(data: bytes) -> tuple[int, int] | None:
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        length = struct.unpack(">H", data[i + 2 : i + 4])[0]
        # Marcadores SOF (Start Of Frame) contienen las dimensiones.
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE):
            height, width = struct.unpack(">HH", data[i + 5 : i + 9])
            return int(width), int(height)
        i += 2 + length
    return None


def _webp_size(data: bytes) -> tuple[int, int] | None:
    chunk = data[12:16]
    if chunk == b"VP8 " and len(data) >= 30:
        width, height = struct.unpack("<HH", data[26:30])
        return int(width & 0x3FFF), int(height & 0x3FFF)
    if chunk == b"VP8L" and len(data) >= 25:
        bits = int.from_bytes(data[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if chunk == b"VP8X" and len(data) >= 30:
        width = int.from_bytes(data[24:27], "little") + 1
        height = int.from_bytes(data[27:30], "little") + 1
        return width, height
    return None


def detect(data: bytes) -> FileInfo | None:
    """Return the detected type of an allowed file, or None if not allowed."""
    size: tuple[int, int] | None
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        mime, ext, size = "image/png", "png", _png_size(data)
    elif data.startswith(b"\xff\xd8\xff"):
        mime, ext, size = "image/jpeg", "jpg", _jpeg_size(data)
    elif data[:6] in (b"GIF87a", b"GIF89a"):
        mime, ext, size = "image/gif", "gif", _gif_size(data)
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        mime, ext, size = "image/webp", "webp", _webp_size(data)
    elif data[4:12] in (b"ftypavif", b"ftypavis"):
        mime, ext, size = "image/avif", "avif", None
    elif data.startswith(b"%PDF-"):
        mime, ext, size = "application/pdf", "pdf", None
    else:
        return None
    width, height = size if size else (None, None)
    return FileInfo(mime=mime, extension=ext, width=width, height=height)
