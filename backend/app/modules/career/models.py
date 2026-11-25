"""Career entry model."""

from datetime import date

from sqlalchemy import Boolean, CheckConstraint, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import Base

CAREER_TYPES = ("work", "education", "achievement", "certification")


class CareerEntry(Base):
    __tablename__ = "career_entries"
    __table_args__ = (CheckConstraint(f"type IN {CAREER_TYPES}", name="type_valid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(200))
    organization: Mapped[str | None] = mapped_column(String(200))
    location: Mapped[str | None] = mapped_column(String(200))
    start_date: Mapped[date]
    end_date: Mapped[date | None]
    description_md: Mapped[str | None] = mapped_column(Text)
    skills: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
    visible: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
