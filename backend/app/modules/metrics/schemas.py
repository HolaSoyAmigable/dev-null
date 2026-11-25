"""Metrics schemas: ingestion events and dashboard responses."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class EventIn(BaseModel):
    """Beacon payload. `pageview` registra una visita; `engagement` la completa."""

    type: Literal["pageview", "engagement"] = "pageview"
    path: str = Field(min_length=1, max_length=500)
    referrer: str | None = Field(default=None, max_length=1000)
    utm_source: str | None = Field(default=None, max_length=100)
    utm_medium: str | None = Field(default=None, max_length=100)
    utm_campaign: str | None = Field(default=None, max_length=100)
    view_token: str | None = Field(default=None, max_length=100)
    max_scroll_pct: int | None = Field(default=None, ge=0, le=100)
    seconds_active: int | None = Field(default=None, ge=0, le=86_400)


class EventAccepted(BaseModel):
    accepted: bool
    view_token: str | None = Field(
        default=None, description="Identificador firmado para enviar el engagement de la visita"
    )


class Overview(BaseModel):
    start: date
    end: date
    views: int
    unique_visitors: int
    avg_seconds: float
    avg_scroll_pct: float
    read_rate: float = Field(description="Porcentaje de visitas con lectura completa")


class TimeseriesPoint(BaseModel):
    date: date
    views: int
    unique_visitors: int


class TopPost(BaseModel):
    post_id: int
    title: str
    slug: str
    views: int
    unique_visitors: int


class CountItem(BaseModel):
    key: str
    views: int


class RealtimePage(BaseModel):
    path: str
    views: int


class Realtime(BaseModel):
    active_visitors: int
    views: int
    pages: list[RealtimePage]


class PostMetrics(BaseModel):
    post_id: int
    title: str
    slug: str
    overview: Overview
    timeseries: list[TimeseriesPoint]
    referrers: list[CountItem]
