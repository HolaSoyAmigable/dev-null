"""Project schemas (admin and public)."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

from app.core.slug import MAX_SLUG_LENGTH, SLUG_PATTERN
from app.modules.media.schemas import MediaRead
from app.modules.posts.schemas import PublicMedia, PublicPostSummary

ProjectStatus = Literal["active", "finished", "paused"]


def _clean_stack(value: list[str] | None) -> list[str] | None:
    if value is None:
        return None
    return list(dict.fromkeys(item.strip() for item in value if item.strip()))


class _ProjectFields(BaseModel):
    summary: str | None = Field(default=None, max_length=1000)
    description_md: str | None = None
    repo_url: HttpUrl | None = None
    demo_url: HttpUrl | None = None
    start_date: date | None = None
    end_date: date | None = None
    cover_media_id: int | None = None


class ProjectCreate(_ProjectFields):
    name: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(default=None, max_length=MAX_SLUG_LENGTH, pattern=SLUG_PATTERN)
    stack: list[str] = Field(default_factory=list, description="Lista de tecnologías")
    status: ProjectStatus = "active"
    featured: bool = False
    sort_order: int = 0

    _stack = field_validator("stack")(_clean_stack)


class ProjectUpdate(_ProjectFields):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(default=None, max_length=MAX_SLUG_LENGTH, pattern=SLUG_PATTERN)
    stack: list[str] | None = None
    status: ProjectStatus | None = None
    featured: bool | None = None
    sort_order: int | None = None

    _stack = field_validator("stack")(_clean_stack)


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    summary: str | None
    description_md: str | None
    repo_url: str | None
    demo_url: str | None
    stack: list[str]
    status: ProjectStatus
    start_date: date | None
    end_date: date | None
    cover_media_id: int | None
    cover: MediaRead | None
    featured: bool
    sort_order: int


class PublicProjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    slug: str
    summary: str | None
    repo_url: str | None
    demo_url: str | None
    stack: list[str]
    status: ProjectStatus
    start_date: date | None
    end_date: date | None
    cover: PublicMedia | None
    featured: bool
    post_count: int = 0


class PublicProjectDetail(PublicProjectSummary):
    description_md: str | None
    posts: list[PublicPostSummary]
