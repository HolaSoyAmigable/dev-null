"""Project model."""

from datetime import date

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models import Base
from app.modules.media.models import Media

PROJECT_STATUSES = ("active", "finished", "paused")


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (CheckConstraint(f"status IN {PROJECT_STATUSES}", name="status_valid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    summary: Mapped[str | None] = mapped_column(Text)
    description_md: Mapped[str | None] = mapped_column(Text)
    repo_url: Mapped[str | None] = mapped_column(String(500))
    demo_url: Mapped[str | None] = mapped_column(String(500))
    stack: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")
    status: Mapped[str] = mapped_column(String(16), default="active", server_default="active")
    start_date: Mapped[date | None]
    end_date: Mapped[date | None]
    cover_media_id: Mapped[int | None] = mapped_column(ForeignKey("media.id", ondelete="SET NULL"))
    featured: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")

    cover: Mapped[Media | None] = relationship(lazy="selectin")
