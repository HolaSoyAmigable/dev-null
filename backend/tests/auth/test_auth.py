"""Auth: login, refresh rotation, logout, me, change-password, rate limit, CLI."""

from typing import Any

import pytest
from httpx import AsyncClient

from tests.helpers import ADMIN_EMAIL, ADMIN_PASSWORD, API

COOKIE = "devnull_refresh"


async def _login(client: AsyncClient, password: str = ADMIN_PASSWORD) -> Any:
    return await client.post(
        f"{API}/auth/login", json={"email": ADMIN_EMAIL.upper(), "password": password}
    )


async def test_login_returns_access_token_and_httponly_cookie(
    client: AsyncClient, admin_user: Any
) -> None:
    response = await _login(client)

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 900
    set_cookie = response.headers["set-cookie"]
    assert COOKIE in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Path=/api/v1/auth" in set_cookie
    assert "samesite=lax" in set_cookie.lower()


async def test_login_with_wrong_password_returns_error_envelope(
    client: AsyncClient, admin_user: Any
) -> None:
    response = await _login(client, "incorrecta")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


async def test_login_unknown_user_is_rejected(client: AsyncClient) -> None:
    response = await _login(client)
    assert response.status_code == 401


async def test_me_requires_valid_token(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    assert (await client.get(f"{API}/auth/me")).status_code == 401
    bad = await client.get(f"{API}/auth/me", headers={"Authorization": "Bearer nope"})
    assert bad.status_code == 401

    response = await client.get(f"{API}/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["email"] == ADMIN_EMAIL
    assert "password_hash" not in response.json()


async def test_refresh_rotates_token_and_rejects_reuse(
    client: AsyncClient, admin_user: Any
) -> None:
    await _login(client)
    old_refresh = client.cookies.get(COOKIE)
    assert old_refresh

    rotated = await client.post(f"{API}/auth/refresh")
    assert rotated.status_code == 200
    assert client.cookies.get(COOKIE) != old_refresh

    client.cookies.set(COOKIE, old_refresh, path="/api/v1/auth")
    reused = await client.post(f"{API}/auth/refresh")
    assert reused.status_code == 401
    assert reused.json()["error"]["code"] == "INVALID_REFRESH"


async def test_refresh_without_cookie_fails(client: AsyncClient) -> None:
    response = await client.post(f"{API}/auth/refresh")
    assert response.status_code == 401


async def test_logout_invalidates_refresh_token(client: AsyncClient, admin_user: Any) -> None:
    await _login(client)
    token = client.cookies.get(COOKIE)

    response = await client.post(f"{API}/auth/logout")
    assert response.status_code == 204

    client.cookies.set(COOKIE, str(token), path="/api/v1/auth")
    assert (await client.post(f"{API}/auth/refresh")).status_code == 401


async def test_change_password_requires_current_and_revokes_sessions(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    refresh_before = client.cookies.get(COOKIE)
    wrong = await client.post(
        f"{API}/auth/change-password",
        json={"current_password": "otra", "new_password": "nueva-contraseña-segura"},
        headers=auth_headers,
    )
    assert wrong.status_code == 422

    short = await client.post(
        f"{API}/auth/change-password",
        json={"current_password": ADMIN_PASSWORD, "new_password": "corta"},
        headers=auth_headers,
    )
    assert short.status_code == 422

    ok = await client.post(
        f"{API}/auth/change-password",
        json={"current_password": ADMIN_PASSWORD, "new_password": "nueva-contraseña-segura"},
        headers=auth_headers,
    )
    assert ok.status_code == 204

    client.cookies.set(COOKIE, str(refresh_before), path="/api/v1/auth")
    assert (await client.post(f"{API}/auth/refresh")).status_code == 401
    assert (await _login(client)).status_code == 401
    assert (await _login(client, "nueva-contraseña-segura")).status_code == 200


async def test_login_is_rate_limited_per_ip(client: AsyncClient, admin_user: Any) -> None:
    for _ in range(5):
        await _login(client, "incorrecta")
    response = await _login(client)

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "RATE_LIMITED"
    assert response.headers["retry-after"] == "60"


async def test_cli_create_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    from app import cli

    monkeypatch.setenv("ADMIN_PASSWORD", "contraseña-de-la-cli-segura")
    assert await cli._create_admin("cli@example.com", "contraseña-de-la-cli-segura") == 0
    assert await cli._create_admin("cli@example.com", "contraseña-de-la-cli-segura") == 1
    assert await cli._create_admin("otro@example.com", "corta") == 1
