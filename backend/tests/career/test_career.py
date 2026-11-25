"""Career: CRUD, reorder and public visibility."""

from httpx import AsyncClient

from tests.helpers import API


async def _create(client: AsyncClient, headers: dict[str, str], title: str, **extra: object) -> int:
    body = {"type": "work", "title": title, "start_date": "2024-01-01", **extra}
    response = await client.post(f"{API}/admin/career", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return int(response.json()["id"])


async def test_career_crud_reorder_and_public(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    first = await _create(client, auth_headers, "Backend Developer", skills=["Python", "Python"])
    second = await _create(client, auth_headers, "Ingeniería", type="education")
    hidden = await _create(client, auth_headers, "Oculta", visible=False)

    entries = (await client.get(f"{API}/admin/career", headers=auth_headers)).json()
    assert [e["id"] for e in entries] == [first, second, hidden]
    assert entries[0]["skills"] == ["Python"]

    reordered = await client.patch(
        f"{API}/admin/career/reorder",
        json={"items": [{"id": second, "sort_order": 1}, {"id": first, "sort_order": 2}]},
        headers=auth_headers,
    )
    assert reordered.status_code == 200
    assert [e["id"] for e in reordered.json()][:2] == [second, first]

    missing = await client.patch(
        f"{API}/admin/career/reorder",
        json={"items": [{"id": 999, "sort_order": 1}]},
        headers=auth_headers,
    )
    assert missing.status_code == 404

    bad = await client.patch(
        f"{API}/admin/career/{first}", json={"end_date": "2020-01-01"}, headers=auth_headers
    )
    assert bad.status_code == 422

    public = (await client.get(f"{API}/public/career")).json()
    assert [e["title"] for e in public] == ["Ingeniería", "Backend Developer"]
    assert "id" not in public[0]

    assert (
        await client.delete(f"{API}/admin/career/{hidden}", headers=auth_headers)
    ).status_code == 204
    assert (
        await client.get(f"{API}/admin/career/{hidden}", headers=auth_headers)
    ).status_code == 404
