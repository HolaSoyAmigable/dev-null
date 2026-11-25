"""Metrics models: raw page views, engagement and daily aggregates."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CHAR,
    BigInteger,
    Boolean,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import Base


class PageView(Base):
    __tablename__ = "page_views"
    __table_args__ = (
        Index("ix_page_views_post_id_occurred_at", "post_id", "occurred_at"),
        Index("ix_page_views_visitor_hash_occurred_at", "visitor_hash", "occurred_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    occurred_at: Mapped[datetime] = mapped_column(index=True)
    path: Mapped[str] = mapped_column(String(500))
    post_id: Mapped[int | None] = mapped_column(ForeignKey("posts.id", ondelete="SET NULL"))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    visitor_hash: Mapped[str] = mapped_column(String(64))
    session_hash: Mapped[str] = mapped_column(String(64))
    referrer_host: Mapped[str | None] = mapped_column(String(255))
    referrer_url: Mapped[str | None] = mapped_column(String(1000))
    utm_source: Mapped[str | None] = mapped_column(String(100))
    utm_medium: Mapped[str | None] = mapped_column(String(100))
    utm_campaign: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(CHAR(2))
    device_type: Mapped[str] = mapped_column(String(16))
    browser: Mapped[str | None] = mapped_column(String(50))
    os: Mapped[str | None] = mapped_column(String(50))
    is_bot: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class EngagementEvent(Base):
    __tablename__ = "engagement_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    # Una fila por page view: los eventos sucesivos actualizan los máximos.
    page_view_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("page_views.id", ondelete="CASCADE"), unique=True
    )
    max_scroll_pct: Mapped[int] = mapped_column(SmallInteger, default=0)
    seconds_active: Mapped[int] = mapped_column(default=0)


class DailyStat(Base):
    __tablename__ = "daily_stats"
    __table_args__ = (
        # post_id NULL = total del sitio; NULLS NOT DISTINCT permite el upsert (PostgreSQL 15+).
        UniqueConstraint(
            "date",
            "post_id",
            name="uq_daily_stats_date_post_id",
            postgresql_nulls_not_distinct=True,
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date]
    post_id: Mapped[int | None] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"))
    views: Mapped[int] = mapped_column(default=0)
    unique_visitors: Mapped[int] = mapped_column(default=0)
    avg_seconds: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal(0))
    avg_scroll_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal(0))
