"""Public cache in Redis, invalidation on admin writes, and error envelopes."""

from httpx import AsyncClient

from app.core.cache import PUBLIC_PREFIX
from app.core.redis import redis_client
from tests.helpers import API, create_post, publish


async def test_public_responses_are_cached_and_invalidated(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    assert (await client.get(f"{API}/public/posts")).json()["total"] == 0
    keys = [key async for key in redis_client.scan_iter(match=PUBLIC_PREFIX + "*")]
    assert keys

    post = await create_post(client, auth_headers)
    # Crear un borrador también limpia la caché (cualquier escritura del admin).
    assert [key async for key in redis_client.scan_iter(match=PUBLIC_PREFIX + "*")] == []

    await client.get(f"{API}/public/posts")
    await publish(client, auth_headers, post["id"])
    assert (await client.get(f"{API}/public/posts")).json()["total"] == 1


async def test_unknown_route_uses_error_envelope(client: AsyncClient) -> None:
    response = await client.get(f"{API}/public/no-existe")
    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "NOT_FOUND", "message": "El recurso solicitado no existe.", "details": {}}
    }


async def test_each_api_publishes_only_its_own_contract(
    public_client: AsyncClient, admin_client: AsyncClient
) -> None:
    public = (await public_client.get(f"{API}/openapi.json")).json()
    admin = (await admin_client.get(f"{API}/openapi.json")).json()

    assert "/api/v1/public/posts" in public["paths"]
    assert {"EventIn", "ErrorResponse"} <= set(public["components"]["schemas"])
    assert not [path for path in public["paths"] if "/admin" in path or "/auth" in path]

    assert "/api/v1/auth/login" in admin["paths"]
    assert "/api/v1/admin/posts" in admin["paths"]
    assert "ErrorResponse" in admin["components"]["schemas"]
    assert not [path for path in admin["paths"] if "/public" in path]


async def test_apis_do_not_serve_each_others_routes(
    public_client: AsyncClient, admin_client: AsyncClient
) -> None:
    assert (await public_client.post(f"{API}/auth/login", json={})).status_code == 404
    assert (await public_client.get(f"{API}/admin/posts")).status_code == 404
    assert (await admin_client.get(f"{API}/public/posts")).status_code == 404
    assert (await public_client.get(f"{API}/health")).status_code == 200
    assert (await admin_client.get(f"{API}/health")).status_code == 200
