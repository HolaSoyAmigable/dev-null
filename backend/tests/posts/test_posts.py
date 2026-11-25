"""Posts: CRUD, workflow, revisions and public endpoints."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient

from app.modules.posts.service import REVISION_EVERY_N_SAVES, reading_minutes
from tests.helpers import (
    API,
    create_category,
    create_post,
    create_project,
    create_tag,
    publish,
)


def test_reading_minutes() -> None:
    assert reading_minutes("") == 1
    assert reading_minutes("palabra " * 400) == 2
    assert reading_minutes("palabra " * 200 + "```\n" + "code " * 400 + "\n```") == 2


async def test_create_draft_generates_unique_slug(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    first = await create_post(client, auth_headers, title="¿Qué es FastAPI?")
    second = await create_post(client, auth_headers, title="¿Qué es FastAPI?")

    assert first["slug"] == "que-es-fastapi"
    assert second["slug"] == "que-es-fastapi-2"
    assert first["status"] == "draft"
    assert first["reading_minutes"] == 1

    explicit = await client.post(
        f"{API}/admin/posts",
        json={"title": "Otro", "slug": "que-es-fastapi"},
        headers=auth_headers,
    )
    assert explicit.status_code == 409


async def test_create_with_unknown_references_fails(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    response = await client.post(
        f"{API}/admin/posts", json={"title": "X", "category_id": 999}, headers=auth_headers
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_REFERENCE"

    response = await client.post(
        f"{API}/admin/posts", json={"title": "X", "tag_ids": [999]}, headers=auth_headers
    )
    assert response.status_code == 422


async def test_publish_flow_revalidates_and_exposes_post(
    client: AsyncClient,
    auth_headers: dict[str, str],
    revalidations: list[tuple[str, list[str]]],
) -> None:
    tag = await create_tag(client, auth_headers, "python")
    category = await create_category(client, auth_headers, "Backend")
    project = await create_project(client, auth_headers, "devnull")
    post = await create_post(
        client,
        auth_headers,
        tag_ids=[tag["id"]],
        category_id=category["id"],
        project_id=project["id"],
    )
    assert (await client.get(f"{API}/public/posts/{post['slug']}")).status_code == 404

    published = await publish(client, auth_headers, post["id"])
    assert published["status"] == "published"
    assert published["published_at"] is not None

    target, paths = revalidations[-1]
    assert target == "http://web.test/api/revalidate"
    for expected in (
        "/",
        "/blog",
        f"/blog/{post['slug']}",
        "/blog/tag/python",
        "/blog/category/backend",
        "/projects/devnull",
    ):
        assert expected in paths

    public = await client.get(f"{API}/public/posts/{post['slug']}")
    assert public.status_code == 200
    body = public.json()
    assert body["tags"] == [{"name": "python", "slug": "python"}]
    assert body["project"] == {"name": "devnull", "slug": "devnull"}
    assert "id" not in body


async def test_publish_requires_content(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    post = await create_post(client, auth_headers, content_md="   ")
    response = await client.post(f"{API}/admin/posts/{post['id']}/publish", headers=auth_headers)
    assert response.status_code == 422


async def test_unpublish_archive_and_delete_rules(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    post = await create_post(client, auth_headers)
    await publish(client, auth_headers, post["id"])

    blocked = await client.delete(f"{API}/admin/posts/{post['id']}", headers=auth_headers)
    assert blocked.status_code == 409

    unpublished = await client.post(
        f"{API}/admin/posts/{post['id']}/unpublish", headers=auth_headers
    )
    assert unpublished.json()["status"] == "draft"
    assert (await client.get(f"{API}/public/posts/{post['slug']}")).status_code == 404

    archived = await client.post(f"{API}/admin/posts/{post['id']}/archive", headers=auth_headers)
    assert archived.json()["status"] == "archived"
    deleted = await client.delete(f"{API}/admin/posts/{post['id']}", headers=auth_headers)
    assert deleted.status_code == 204
    assert (
        await client.get(f"{API}/admin/posts/{post['id']}", headers=auth_headers)
    ).status_code == 404


async def test_schedule_and_worker_publishes_due_posts(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    post = await create_post(client, auth_headers)
    past = await client.post(
        f"{API}/admin/posts/{post['id']}/schedule",
        json={"scheduled_for": (datetime.now(UTC) - timedelta(hours=1)).isoformat()},
        headers=auth_headers,
    )
    assert past.status_code == 422

    naive = await client.post(
        f"{API}/admin/posts/{post['id']}/schedule",
        json={"scheduled_for": "2099-01-01T10:00:00"},
        headers=auth_headers,
    )
    assert naive.status_code == 422

    when = datetime.now(UTC) + timedelta(minutes=5)
    scheduled = await client.post(
        f"{API}/admin/posts/{post['id']}/schedule",
        json={"scheduled_for": when.isoformat()},
        headers=auth_headers,
    )
    assert scheduled.json()["status"] == "scheduled"

    from app.worker.jobs import publish_scheduled_posts

    assert await publish_scheduled_posts(datetime.now(UTC)) == 0
    assert await publish_scheduled_posts(when + timedelta(seconds=1)) == 1
    detail = await client.get(f"{API}/admin/posts/{post['id']}", headers=auth_headers)
    assert detail.json()["status"] == "published"
    assert detail.json()["scheduled_for"] is None


async def test_duplicate_creates_draft_copy(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    tag = await create_tag(client, auth_headers, "rust")
    post = await create_post(client, auth_headers, tag_ids=[tag["id"]])
    await publish(client, auth_headers, post["id"])

    response = await client.post(f"{API}/admin/posts/{post['id']}/duplicate", headers=auth_headers)
    assert response.status_code == 201
    copy = response.json()
    assert copy["status"] == "draft"
    assert copy["slug"] == f"{post['slug']}-copia"
    assert copy["tags"][0]["slug"] == "rust"


async def test_revisions_every_n_saves_and_restore(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    post = await create_post(client, auth_headers, content_md="versión 0")
    for i in range(1, REVISION_EVERY_N_SAVES + 1):
        await client.patch(
            f"{API}/admin/posts/{post['id']}",
            json={"content_md": f"versión {i}"},
            headers=auth_headers,
        )
    # Un guardado sin cambios en el contenido no cuenta.
    await client.patch(
        f"{API}/admin/posts/{post['id']}", json={"excerpt": "Resumen"}, headers=auth_headers
    )
    revisions = (
        await client.get(f"{API}/admin/posts/{post['id']}/revisions", headers=auth_headers)
    ).json()
    assert len(revisions) == 1
    assert revisions[0]["content_md"] == f"versión {REVISION_EVERY_N_SAVES}"

    await publish(client, auth_headers, post["id"])
    await client.patch(
        f"{API}/admin/posts/{post['id']}", json={"content_md": "cambio"}, headers=auth_headers
    )
    revisions = (
        await client.get(f"{API}/admin/posts/{post['id']}/revisions", headers=auth_headers)
    ).json()
    assert len(revisions) == 2

    restored = await client.post(
        f"{API}/admin/posts/{post['id']}/restore-revision/{revisions[-1]['id']}",
        headers=auth_headers,
    )
    assert restored.status_code == 200
    assert restored.json()["content_md"] == f"versión {REVISION_EVERY_N_SAVES}"
    revisions = (
        await client.get(f"{API}/admin/posts/{post['id']}/revisions", headers=auth_headers)
    ).json()
    assert revisions[0]["content_md"] == "cambio"

    missing = await client.post(
        f"{API}/admin/posts/{post['id']}/restore-revision/9999", headers=auth_headers
    )
    assert missing.status_code == 404


async def test_admin_list_filters(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    await create_post(client, auth_headers, title="Docker en producción")
    published = await create_post(client, auth_headers, title="Kubernetes básico")
    await publish(client, auth_headers, published["id"])

    by_status = await client.get(
        f"{API}/admin/posts", params={"status": "published"}, headers=auth_headers
    )
    assert [p["title"] for p in by_status.json()["items"]] == ["Kubernetes básico"]

    by_q = await client.get(f"{API}/admin/posts", params={"q": "docker"}, headers=auth_headers)
    body = by_q.json()
    assert body["total"] == 1
    assert body["page"] == 1
    assert body["page_size"] == 20

    too_big = await client.get(
        f"{API}/admin/posts", params={"page_size": 101}, headers=auth_headers
    )
    assert too_big.status_code == 422
    assert too_big.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_public_list_filters_and_pagination(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    tag = await create_tag(client, auth_headers, "go")
    category = await create_category(client, auth_headers, "Tutoriales")
    project = await create_project(client, auth_headers, "Mi CLI")
    for i in range(3):
        post = await create_post(
            client,
            auth_headers,
            title=f"Post {i}",
            tag_ids=[tag["id"]] if i == 0 else [],
            category_id=category["id"] if i == 1 else None,
            project_id=project["id"] if i == 2 else None,
        )
        await publish(client, auth_headers, post["id"])
    await create_post(client, auth_headers, title="Borrador")

    everything = (await client.get(f"{API}/public/posts", params={"page_size": 2})).json()
    assert everything["total"] == 3
    assert len(everything["items"]) == 2
    assert everything["items"][0]["title"] == "Post 2"

    for params, title in (
        ({"tag": "go"}, "Post 0"),
        ({"category": "tutoriales"}, "Post 1"),
        ({"project": "mi-cli"}, "Post 2"),
    ):
        items = (await client.get(f"{API}/public/posts", params=params)).json()["items"]
        assert [p["title"] for p in items] == [title]


async def test_related_posts(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    a = await create_tag(client, auth_headers, "a")
    b = await create_tag(client, auth_headers, "b")
    main = await create_post(client, auth_headers, title="Principal", tag_ids=[a["id"], b["id"]])
    both = await create_post(client, auth_headers, title="Ambas", tag_ids=[a["id"], b["id"]])
    one = await create_post(client, auth_headers, title="Una", tag_ids=[b["id"]])
    await create_post(client, auth_headers, title="Ninguna")
    for post in (main, both, one):
        await publish(client, auth_headers, post["id"])

    related = (await client.get(f"{API}/public/posts/{main['slug']}/related")).json()
    assert [p["title"] for p in related] == ["Ambas", "Una"]


async def test_full_text_search_in_spanish(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    post = await create_post(
        client,
        auth_headers,
        title="Desplegando aplicaciones",
        content_md="Hoy desplegamos contenedores con Docker y Caddy.",
    )
    await publish(client, auth_headers, post["id"])
    await create_post(client, auth_headers, title="Docker borrador", content_md="docker docker")

    # "desplegar" coincide con "desplegando"/"desplegamos" gracias al stemming en español.
    response = await client.get(f"{API}/public/search", params={"q": "desplegar"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["slug"] == post["slug"]
    assert "<mark>" in body["items"][0]["snippet"]

    via_list = await client.get(f"{API}/public/posts", params={"q": "docker"})
    assert via_list.json()["total"] == 1

    empty = await client.get(f"{API}/public/search", params={"q": "inexistente"})
    assert empty.json()["total"] == 0


async def test_public_slugs(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    tag = await create_tag(client, auth_headers, "web")
    post = await create_post(client, auth_headers, tag_ids=[tag["id"]])
    await publish(client, auth_headers, post["id"])
    await create_project(client, auth_headers, "Portafolio")

    slugs = (await client.get(f"{API}/public/slugs")).json()
    assert [p["slug"] for p in slugs["posts"]] == [post["slug"]]
    assert slugs["projects"] == ["portafolio"]
    assert slugs["tags"] == ["web"]
    assert slugs["categories"] == []


async def test_update_published_post_revalidates_old_and_new_slug(
    client: AsyncClient,
    auth_headers: dict[str, str],
    revalidations: list[tuple[str, list[str]]],
) -> None:
    post = await create_post(client, auth_headers)
    await publish(client, auth_headers, post["id"])
    response = await client.patch(
        f"{API}/admin/posts/{post['id']}", json={"slug": "nuevo-slug"}, headers=auth_headers
    )
    assert response.json()["slug"] == "nuevo-slug"
    paths = revalidations[-1][1]
    assert f"/blog/{post['slug']}" in paths
    assert "/blog/nuevo-slug" in paths
