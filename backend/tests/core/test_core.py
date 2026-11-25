"""Core utilities: slugs, tokens and storage."""

import asyncio
from pathlib import Path

import pytest

from app.core.security import create_token, decode_token, hash_password, verify_password
from app.core.slug import slugify
from app.storage import LocalDiskStorage


def test_slugify() -> None:
    assert slugify("¡Hola, Mundo! Ñandú & café") == "hola-mundo-nandu-cafe"
    assert slugify("dev/null") == "dev-null"
    assert slugify("!!!") == "sin-titulo"
    assert len(slugify("a" * 300)) == 120


def test_password_hashing_uses_argon2id() -> None:
    hashed = hash_password("secreto")
    assert hashed.startswith("$argon2id$")
    assert verify_password(hashed, "secreto")
    assert not verify_password(hashed, "otro")
    assert not verify_password("no-es-un-hash", "secreto")


def test_tokens_are_typed() -> None:
    access, payload = create_token(7, "access")
    assert decode_token(access, "access") == payload
    assert decode_token(access, "refresh") is None
    assert decode_token("basura", "access") is None


def test_local_storage_blocks_path_traversal(tmp_path: Path) -> None:
    storage = LocalDiskStorage(tmp_path, "/media/")
    asyncio.run(storage.save("2026/01/a.png", b"x"))
    assert (tmp_path / "2026/01/a.png").read_bytes() == b"x"
    assert storage.public_url("2026/01/a.png") == "/media/2026/01/a.png"
    with pytest.raises(ValueError):
        asyncio.run(storage.save("../fuera.txt", b"x"))


def _request(headers: dict[str, str], host: str = "10.0.0.9") -> object:
    from starlette.requests import Request

    scope = {
        "type": "http",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
        "client": (host, 1234),
    }
    return Request(scope)


def test_client_ip_ignores_spoofed_forwarded_prefix() -> None:
    from app.core.ratelimit import client_ip

    # El cliente envía "1.1.1.1"; el proxy de confianza añade la IP real al final.
    request = _request({"x-forwarded-for": "1.1.1.1, 203.0.113.7"})
    assert client_ip(request) == "203.0.113.7"  # type: ignore[arg-type]


def test_client_ip_falls_back_to_peer_without_header() -> None:
    from app.core.ratelimit import client_ip

    assert client_ip(_request({})) == "10.0.0.9"  # type: ignore[arg-type]


def test_production_rejects_insecure_settings() -> None:
    from pydantic import ValidationError as PydanticValidationError

    from app.core.config import Settings

    base = {
        "ENV": "production",
        "DATABASE_URL": "postgresql+asyncpg://u:p@127.0.0.1/db",
        "REDIS_URL": "redis://127.0.0.1:6379/0",
        "WEB_URL": "http://web:3000",
        "JWT_SECRET": "a" * 40,
        "REFRESH_SECRET": "b" * 40,
        "METRICS_SALT_SECRET": "c" * 40,
        "REVALIDATE_SECRET": "d" * 40,
        "COOKIE_SECURE": True,
    }
    Settings(_env_file=None, **base)  # type: ignore[arg-type]
    for override in (
        {"JWT_SECRET": "corto"},
        {"JWT_SECRET": "cambia_esto_por_un_secreto_seguro" + "x" * 10},
        {"REFRESH_SECRET": "a" * 40},
        {"COOKIE_SECURE": False},
    ):
        with pytest.raises(PydanticValidationError):
            Settings(_env_file=None, **{**base, **override})  # type: ignore[arg-type]
