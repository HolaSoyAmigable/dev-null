"""Webhook log model for ISR revalidation calls."""

from datetime import datetime

from sqlalchemy import String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import Base


class WebhookLog(Base):
    __tablename__ = "webhook_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    target: Mapped[str] = mapped_column(String(500))
    paths: Mapped[list[str]] = mapped_column(JSONB)
    status_code: Mapped[int | None]
    attempts: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
