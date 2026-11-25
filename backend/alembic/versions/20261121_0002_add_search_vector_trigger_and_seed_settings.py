"""add_search_vector_trigger_and_seed_settings

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-21 02:00:00+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DEFAULT_SETTINGS: dict[str, object] = {
    "site_name": "dev/null",
    "author_name": "Oscar Abdel Utrilla Velazquez",
    "short_bio": (
        "Desarrollador de software. Aquí documento mi carrera, mis proyectos y lo que aprendo."
    ),
    "social_links": [],
    "about_md": "## Sobre mí\n\nEdita este texto desde el panel de administración.",
}


def upgrade() -> None:
    # Vector de búsqueda en español: título (A), extracto (B) y contenido (C).
    op.execute(
        """
        CREATE FUNCTION posts_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('spanish', coalesce(NEW.title, '')), 'A') ||
                setweight(to_tsvector('spanish', coalesce(NEW.excerpt, '')), 'B') ||
                setweight(to_tsvector('spanish', coalesce(NEW.content_md, '')), 'C');
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER posts_search_vector_trigger
        BEFORE INSERT OR UPDATE OF title, excerpt, content_md ON posts
        FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update();
        """
    )
    # Rellena filas existentes (no-op en una BD nueva).
    op.execute("UPDATE posts SET title = title")

    settings_table = sa.table(
        "site_settings",
        sa.column("key", sa.String),
        sa.column("value", JSONB),
    )
    op.bulk_insert(
        settings_table,
        [{"key": key, "value": value} for key, value in _DEFAULT_SETTINGS.items()],
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM site_settings WHERE key IN ('site_name', 'author_name', "
        "'short_bio', 'social_links', 'about_md')"
    )
    op.execute("DROP TRIGGER IF EXISTS posts_search_vector_trigger ON posts")
    op.execute("DROP FUNCTION IF EXISTS posts_search_vector_update()")
