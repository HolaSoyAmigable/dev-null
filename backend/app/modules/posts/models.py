"""Post, post-tag association and revision models."""

from datetime import datetime

from sqlalchemy import CheckConstraint, Column, ForeignKey, Index, String, Table, Text, func
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models import Base, utcnow
from app.modules.media.models import Media
from app.modules.projects.models import Project
from app.modules.taxonomy.models import Category, Tag

POST_STATUSES = ("draft", "scheduled", "published", "archived")

post_tags = Table(
    "post_tags",
    Base.metadata,
    Column("post_id", ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (
        CheckConstraint(f"status IN {POST_STATUSES}", name="status_valid"),
        Index("ix_posts_search_vector", "search_vector", postgresql_using="gin"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    excerpt: Mapped[str | None] = mapped_column(Text)
    content_md: Mapped[str] = mapped_column(Text, default="", server_default="")
    status: Mapped[str] = mapped_column(
        String(16), default="draft", server_default="draft", index=True
    )
    published_at: Mapped[datetime | None] = mapped_column(index=True)
    scheduled_for: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), default=utcnow, onupdate=utcnow
    )
    cover_media_id: Mapped[int | None] = mapped_column(ForeignKey("media.id", ondelete="SET NULL"))
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), index=True
    )
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    reading_minutes: Mapped[int] = mapped_column(default=1, server_default="1")
    seo_title: Mapped[str | None] = mapped_column(String(300))
    seo_description: Mapped[str | None] = mapped_column(Text)
    canonical_url: Mapped[str | None] = mapped_column(String(500))
    og_media_id: Mapped[int | None] = mapped_column(ForeignKey("media.id", ondelete="SET NULL"))
    # Contador de guardados desde la última revisión (para revisiones cada N guardados).
    saves_since_revision: Mapped[int] = mapped_column(default=0, server_default="0")
    # Mantenido por trigger en PostgreSQL; nunca se escribe desde la aplicación.
    search_vector: Mapped[str | None] = mapped_column(TSVECTOR, deferred=True)

    tags: Mapped[list[Tag]] = relationship(secondary=post_tags, lazy="selectin", order_by=Tag.name)
    category: Mapped[Category | None] = relationship(lazy="selectin")
    project: Mapped[Project | None] = relationship(lazy="selectin")
    cover: Mapped[Media | None] = relationship(foreign_keys=[cover_media_id], lazy="selectin")
    og_media: Mapped[Media | None] = relationship(foreign_keys=[og_media_id], lazy="selectin")


class PostRevision(Base):
    __tablename__ = "post_revisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    content_md: Mapped[str] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
