"""Reusable helpers for API tests."""

from typing import Any

from httpx import AsyncClient

API = "/api/v1"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "una-contraseña-larga-y-segura"


async def create_post(
    client: AsyncClient, headers: dict[str, str], **fields: Any
) -> dict[str, Any]:
    body = {"title": "Mi primer post", "content_md": "Hola mundo " * 50, **fields}
    response = await client.post(f"{API}/admin/posts", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return dict(response.json())


async def publish(client: AsyncClient, headers: dict[str, str], post_id: int) -> dict[str, Any]:
    response = await client.post(f"{API}/admin/posts/{post_id}/publish", headers=headers)
    assert response.status_code == 200, response.text
    return dict(response.json())


async def create_tag(client: AsyncClient, headers: dict[str, str], name: str) -> dict[str, Any]:
    response = await client.post(f"{API}/admin/tags", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return dict(response.json())


async def create_category(
    client: AsyncClient, headers: dict[str, str], name: str
) -> dict[str, Any]:
    response = await client.post(f"{API}/admin/categories", json={"name": name}, headers=headers)
    assert response.status_code == 201, response.text
    return dict(response.json())


async def create_project(
    client: AsyncClient, headers: dict[str, str], name: str, **fields: Any
) -> dict[str, Any]:
    response = await client.post(
        f"{API}/admin/projects", json={"name": name, **fields}, headers=headers
    )
    assert response.status_code == 201, response.text
    return dict(response.json())


BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
    ),
    "Accept-Language": "es-MX,es;q=0.9",
}
