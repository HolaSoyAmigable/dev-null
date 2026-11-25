"""Taxonomy: admin CRUD and public lists with counts."""

from httpx import AsyncClient

from tests.helpers import API, create_category, create_post, create_tag, publish


async def test_admin_endpoints_require_auth(client: AsyncClient) -> None:
    assert (await client.get(f"{API}/admin/tags")).status_code == 401
    assert (await client.post(f"{API}/admin/categories", json={"name": "x"})).status_code == 401


async def test_tag_crud_and_slug_conflict(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    tag = await create_tag(client, auth_headers, "Programación Funcional")
    assert tag["slug"] == "programacion-funcional"

    dup = await client.post(
        f"{API}/admin/tags", json={"name": "Programación funcional"}, headers=auth_headers
    )
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "SLUG_TAKEN"

    updated = await client.patch(
        f"{API}/admin/tags/{tag['id']}", json={"name": "FP", "slug": "fp"}, headers=auth_headers
    )
    assert updated.status_code == 200
    assert updated.json() == {"id": tag["id"], "name": "FP", "slug": "fp"}

    invalid = await client.patch(
        f"{API}/admin/tags/{tag['id']}", json={"slug": "No Válido"}, headers=auth_headers
    )
    assert invalid.status_code == 422

    assert (
        await client.delete(f"{API}/admin/tags/{tag['id']}", headers=auth_headers)
    ).status_code == 204
    assert (
        await client.delete(f"{API}/admin/tags/{tag['id']}", headers=auth_headers)
    ).status_code == 404


async def test_category_crud(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    category = await create_category(client, auth_headers, "Backend")
    response = await client.patch(
        f"{API}/admin/categories/{category['id']}",
        json={"description": "APIs y bases de datos"},
        headers=auth_headers,
    )
    assert response.json()["description"] == "APIs y bases de datos"

    listed = await client.get(f"{API}/admin/categories", headers=auth_headers)
    assert [c["slug"] for c in listed.json()] == ["backend"]


async def test_public_lists_count_only_published_posts(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    tag = await create_tag(client, auth_headers, "python")
    category = await create_category(client, auth_headers, "Backend")
    published = await create_post(
        client, auth_headers, tag_ids=[tag["id"]], category_id=category["id"]
    )
    await publish(client, auth_headers, published["id"])
    await create_post(
        client, auth_headers, title="Borrador", tag_ids=[tag["id"]], category_id=category["id"]
    )

    tags = (await client.get(f"{API}/public/tags")).json()
    categories = (await client.get(f"{API}/public/categories")).json()
    assert tags == [{"id": tag["id"], "name": "python", "slug": "python", "post_count": 1}]
    assert categories[0]["post_count"] == 1
