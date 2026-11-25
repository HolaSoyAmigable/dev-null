"""create_initial_schema

Revision ID: 0001
Revises:
Create Date: 2026-11-21 01:44:49.361564+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Revisado manualmente: esquema completo del modelo de datos (docs/02-data-model.md).
    op.create_table(
        "career_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("organization", sa.String(length=200), nullable=True),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("description_md", sa.Text(), nullable=True),
        sa.Column(
            "skills", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False
        ),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("visible", sa.Boolean(), server_default="true", nullable=False),
        sa.CheckConstraint(
            "type IN ('work', 'education', 'achievement', 'certification')",
            name=op.f("ck_career_entries_type_valid"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_career_entries")),
    )
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_categories")),
        sa.UniqueConstraint("slug", name=op.f("uq_categories_slug")),
    )
    op.create_table(
        "media",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(length=255), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("alt_text", sa.String(length=300), nullable=True),
        sa.Column("mime", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_media")),
        sa.UniqueConstraint("storage_key", name=op.f("uq_media_storage_key")),
    )
    op.create_table(
        "site_settings",
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint("key", name=op.f("pk_site_settings")),
    )
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tags")),
        sa.UniqueConstraint("slug", name=op.f("uq_tags_slug")),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=32), server_default="admin", nullable=False),
        sa.Column("totp_secret", sa.String(length=64), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_table(
        "webhook_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("target", sa.String(length=500), nullable=False),
        sa.Column("paths", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_webhook_log")),
    )
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("description_md", sa.Text(), nullable=True),
        sa.Column("repo_url", sa.String(length=500), nullable=True),
        sa.Column("demo_url", sa.String(length=500), nullable=True),
        sa.Column(
            "stack", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False
        ),
        sa.Column("status", sa.String(length=16), server_default="active", nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("cover_media_id", sa.Integer(), nullable=True),
        sa.Column("featured", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.CheckConstraint(
            "status IN ('active', 'finished', 'paused')", name=op.f("ck_projects_status_valid")
        ),
        sa.ForeignKeyConstraint(
            ["cover_media_id"],
            ["media.id"],
            name=op.f("fk_projects_cover_media_id_media"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_projects")),
        sa.UniqueConstraint("slug", name=op.f("uq_projects_slug")),
    )
    op.create_table(
        "posts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("excerpt", sa.Text(), nullable=True),
        sa.Column("content_md", sa.Text(), server_default="", nullable=False),
        sa.Column("status", sa.String(length=16), server_default="draft", nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("cover_media_id", sa.Integer(), nullable=True),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("reading_minutes", sa.Integer(), server_default="1", nullable=False),
        sa.Column("seo_title", sa.String(length=300), nullable=True),
        sa.Column("seo_description", sa.Text(), nullable=True),
        sa.Column("canonical_url", sa.String(length=500), nullable=True),
        sa.Column("og_media_id", sa.Integer(), nullable=True),
        sa.Column("saves_since_revision", sa.Integer(), server_default="0", nullable=False),
        sa.Column("search_vector", postgresql.TSVECTOR(), nullable=True),
        sa.CheckConstraint(
            "status IN ('draft', 'scheduled', 'published', 'archived')",
            name=op.f("ck_posts_status_valid"),
        ),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], name=op.f("fk_posts_author_id_users")),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name=op.f("fk_posts_category_id_categories"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["cover_media_id"],
            ["media.id"],
            name=op.f("fk_posts_cover_media_id_media"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["og_media_id"],
            ["media.id"],
            name=op.f("fk_posts_og_media_id_media"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_posts_project_id_projects"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_posts")),
        sa.UniqueConstraint("slug", name=op.f("uq_posts_slug")),
    )
    op.create_index(op.f("ix_posts_category_id"), "posts", ["category_id"], unique=False)
    op.create_index(op.f("ix_posts_project_id"), "posts", ["project_id"], unique=False)
    op.create_index(op.f("ix_posts_published_at"), "posts", ["published_at"], unique=False)
    op.create_index(
        "ix_posts_search_vector", "posts", ["search_vector"], unique=False, postgresql_using="gin"
    )
    op.create_index(op.f("ix_posts_status"), "posts", ["status"], unique=False)
    op.create_table(
        "daily_stats",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=True),
        sa.Column("views", sa.Integer(), nullable=False),
        sa.Column("unique_visitors", sa.Integer(), nullable=False),
        sa.Column("avg_seconds", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("avg_scroll_pct", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.ForeignKeyConstraint(
            ["post_id"], ["posts.id"], name=op.f("fk_daily_stats_post_id_posts"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_daily_stats")),
        sa.UniqueConstraint(
            "date",
            "post_id",
            name="uq_daily_stats_date_post_id",
            postgresql_nulls_not_distinct=True,
        ),
    )
    op.create_table(
        "page_views",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("path", sa.String(length=500), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=True),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("visitor_hash", sa.String(length=64), nullable=False),
        sa.Column("session_hash", sa.String(length=64), nullable=False),
        sa.Column("referrer_host", sa.String(length=255), nullable=True),
        sa.Column("referrer_url", sa.String(length=1000), nullable=True),
        sa.Column("utm_source", sa.String(length=100), nullable=True),
        sa.Column("utm_medium", sa.String(length=100), nullable=True),
        sa.Column("utm_campaign", sa.String(length=100), nullable=True),
        sa.Column("country", sa.CHAR(length=2), nullable=True),
        sa.Column("device_type", sa.String(length=16), nullable=False),
        sa.Column("browser", sa.String(length=50), nullable=True),
        sa.Column("os", sa.String(length=50), nullable=True),
        sa.Column("is_bot", sa.Boolean(), server_default="false", nullable=False),
        sa.ForeignKeyConstraint(
            ["post_id"], ["posts.id"], name=op.f("fk_page_views_post_id_posts"), ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_page_views_project_id_projects"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_page_views")),
    )
    op.create_index(op.f("ix_page_views_occurred_at"), "page_views", ["occurred_at"], unique=False)
    op.create_index(
        "ix_page_views_post_id_occurred_at", "page_views", ["post_id", "occurred_at"], unique=False
    )
    op.create_index(
        "ix_page_views_visitor_hash_occurred_at",
        "page_views",
        ["visitor_hash", "occurred_at"],
        unique=False,
    )
    op.create_table(
        "post_revisions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("content_md", sa.Text(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_post_revisions_created_by_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["post_id"],
            ["posts.id"],
            name=op.f("fk_post_revisions_post_id_posts"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_post_revisions")),
    )
    op.create_index(op.f("ix_post_revisions_post_id"), "post_revisions", ["post_id"], unique=False)
    op.create_table(
        "post_tags",
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["post_id"], ["posts.id"], name=op.f("fk_post_tags_post_id_posts"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["tag_id"], ["tags.id"], name=op.f("fk_post_tags_tag_id_tags"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("post_id", "tag_id", name=op.f("pk_post_tags")),
    )
    op.create_table(
        "engagement_events",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("page_view_id", sa.BigInteger(), nullable=False),
        sa.Column("max_scroll_pct", sa.SmallInteger(), nullable=False),
        sa.Column("seconds_active", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["page_view_id"],
            ["page_views.id"],
            name=op.f("fk_engagement_events_page_view_id_page_views"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_engagement_events")),
        sa.UniqueConstraint("page_view_id", name=op.f("uq_engagement_events_page_view_id")),
    )


def downgrade() -> None:
    # Revisado manualmente: esquema completo del modelo de datos (docs/02-data-model.md).
    op.drop_table("engagement_events")
    op.drop_table("post_tags")
    op.drop_index(op.f("ix_post_revisions_post_id"), table_name="post_revisions")
    op.drop_table("post_revisions")
    op.drop_index("ix_page_views_visitor_hash_occurred_at", table_name="page_views")
    op.drop_index("ix_page_views_post_id_occurred_at", table_name="page_views")
    op.drop_index(op.f("ix_page_views_occurred_at"), table_name="page_views")
    op.drop_table("page_views")
    op.drop_table("daily_stats")
    op.drop_index(op.f("ix_posts_status"), table_name="posts")
    op.drop_index("ix_posts_search_vector", table_name="posts", postgresql_using="gin")
    op.drop_index(op.f("ix_posts_published_at"), table_name="posts")
    op.drop_index(op.f("ix_posts_project_id"), table_name="posts")
    op.drop_index(op.f("ix_posts_category_id"), table_name="posts")
    op.drop_table("posts")
    op.drop_table("projects")
    op.drop_table("webhook_log")
    op.drop_table("users")
    op.drop_table("tags")
    op.drop_table("site_settings")
    op.drop_table("media")
    op.drop_table("categories")
    op.drop_table("career_entries")
