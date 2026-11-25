"""Projects: admin CRUD and public pages with their log posts."""

from httpx import AsyncClient

from tests.helpers import API, create_post, create_project, publish


async def test_project_crud(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    project = await create_project(
        client,
        auth_headers,
        "Mi Blog",
        stack=["FastAPI", " Next.js ", "FastAPI", ""],
        repo_url="https://github.com/example/devnull",
        start_date="2026-01-01",
    )
    assert project["slug"] == "mi-blog"
    assert project["stack"] == ["FastAPI", "Next.js"]
    assert project["status"] == "active"

    bad_dates = await client.patch(
        f"{API}/admin/projects/{project['id']}",
        json={"end_date": "2025-01-01"},
        headers=auth_headers,
    )
    assert bad_dates.status_code == 422

    bad_url = await client.patch(
        f"{API}/admin/projects/{project['id']}",
        json={"demo_url": "no-es-url"},
        headers=auth_headers,
    )
    assert bad_url.status_code == 422

    updated = await client.patch(
        f"{API}/admin/projects/{project['id']}",
        json={"status": "finished", "featured": True, "end_date": "2026-06-01"},
        headers=auth_headers,
    )
    assert updated.json()["status"] == "finished"
    assert updated.json()["featured"] is True

    dup = await client.post(f"{API}/admin/projects", json={"name": "Mi blog"}, headers=auth_headers)
    assert dup.status_code == 409

    deleted = await client.delete(f"{API}/admin/projects/{project['id']}", headers=auth_headers)
    assert deleted.status_code == 204


async def test_public_projects_include_log_posts(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    project = await create_project(client, auth_headers, "Compilador", featured=True)
    await create_project(client, auth_headers, "Otro", sort_order=5)
    log = await create_post(client, auth_headers, title="Bitácora 1", project_id=project["id"])
    await publish(client, auth_headers, log["id"])
    await create_post(client, auth_headers, title="Bitácora borrador", project_id=project["id"])

    listing = (await client.get(f"{API}/public/projects")).json()
    assert [p["slug"] for p in listing] == ["compilador", "otro"]
    assert listing[0]["post_count"] == 1

    detail = (await client.get(f"{API}/public/projects/compilador")).json()
    assert [p["title"] for p in detail["posts"]] == ["Bitácora 1"]
    assert (await client.get(f"{API}/public/projects/nada")).status_code == 404


async def test_project_log_orders_posts_by_series(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    from tests.helpers import create_post, create_project, publish

    project = await create_project(client, auth_headers, "Serie")
    ids = {}
    for title, order in (("Tercero", 3), ("Primero", 1), ("Suelto", None), ("Segundo", 2)):
        fields = {"project_id": project["id"]}
        if order is not None:
            fields["series_order"] = order
        post = await create_post(client, auth_headers, title=title, **fields)
        await publish(client, auth_headers, post["id"])
        ids[title] = post["id"]

    detail = (await client.get("/api/v1/public/projects/serie")).json()
    titles = [post["title"] for post in detail["posts"]]
    assert titles == ["Primero", "Segundo", "Tercero", "Suelto"]
    assert [post["series_order"] for post in detail["posts"]] == [1, 2, 3, None]
