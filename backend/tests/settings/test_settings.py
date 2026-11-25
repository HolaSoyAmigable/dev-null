"""Site settings: admin update and public read."""

from httpx import AsyncClient

from tests.helpers import API


async def test_settings_update_and_public_read(
    client: AsyncClient,
    auth_headers: dict[str, str],
    revalidations: list[tuple[str, list[str]]],
) -> None:
    defaults = (await client.get(f"{API}/public/settings")).json()
    assert defaults["site_name"] == "dev/null"

    response = await client.patch(
        f"{API}/admin/settings",
        json={
            "author_name": "Oscar",
            "social_links": [{"label": "GitHub", "url": "https://github.com/example"}],
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["author_name"] == "Oscar"
    assert revalidations[-1][1] == ["*"]

    public = (await client.get(f"{API}/public/settings")).json()
    assert public["author_name"] == "Oscar"
    assert public["social_links"][0]["url"] == "https://github.com/example"

    invalid = await client.patch(
        f"{API}/admin/settings",
        json={"social_links": [{"label": "x", "url": "javascript:alert(1)"}]},
        headers=auth_headers,
    )
    assert invalid.status_code == 422
