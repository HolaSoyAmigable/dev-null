"""add_post_dev_metadata

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-25 20:00:00+00:00

Metadatos de desarrollo de los posts: repositorio de GitHub, orden dentro de la serie
(bitácora de un proyecto) y marca de post destacado en la portada.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("github_repo", sa.String(length=200), nullable=True))
    op.add_column("posts", sa.Column("series_order", sa.Integer(), nullable=True))
    op.add_column(
        "posts",
        sa.Column("featured", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.create_check_constraint(
        "ck_posts_series_order_positive",
        "posts",
        "series_order IS NULL OR series_order >= 1",
    )
    op.create_index("ix_posts_featured", "posts", ["featured"])


def downgrade() -> None:
    op.drop_index("ix_posts_featured", table_name="posts")
    op.drop_constraint("ck_posts_series_order_positive", "posts", type_="check")
    op.drop_column("posts", "featured")
    op.drop_column("posts", "series_order")
    op.drop_column("posts", "github_repo")
