"""Post schemas (admin and public)."""

from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.core.slug import MAX_SLUG_LENGTH, SLUG_PATTERN
from app.modules.media.schemas import MediaRead
from app.modules.taxonomy.schemas import CategoryRead, TagRead

PostStatus = Literal["draft", "scheduled", "published", "archived"]


class ProjectRef(BaseModel):
    """Minimal project reference embedded in posts."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str


class _PostFields(BaseModel):
    excerpt: str | None = Field(default=None, max_length=1000)
    category_id: int | None = None
    project_id: int | None = None
    cover_media_id: int | None = None
    seo_title: str | None = Field(default=None, max_length=300)
    seo_description: str | None = Field(default=None, max_length=500)
    canonical_url: str | None = Field(default=None, max_length=500)
    og_media_id: int | None = None


class PostCreate(_PostFields):
    title: str = Field(min_length=1, max_length=300)
    slug: str | None = Field(default=None, max_length=MAX_SLUG_LENGTH, pattern=SLUG_PATTERN)
    content_md: str = ""
    tag_ids: list[int] = Field(default_factory=list)


class PostUpdate(_PostFields):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    slug: str | None = Field(default=None, max_length=MAX_SLUG_LENGTH, pattern=SLUG_PATTERN)
    content_md: str | None = None
    tag_ids: list[int] | None = None


class ScheduleRequest(BaseModel):
    scheduled_for: AwareDatetime


class PostListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    status: PostStatus
    published_at: datetime | None
    scheduled_for: datetime | None
    updated_at: datetime
    reading_minutes: int
    category: CategoryRead | None
    project: ProjectRef | None
    tags: list[TagRead]


class PostRead(PostListItem):
    excerpt: str | None
    content_md: str
    created_at: datetime
    category_id: int | None
    project_id: int | None
    cover_media_id: int | None
    og_media_id: int | None
    cover: MediaRead | None
    og_media: MediaRead | None
    seo_title: str | None
    seo_description: str | None
    canonical_url: str | None


class RevisionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    post_id: int
    title: str
    content_md: str
    created_by: int | None
    created_at: datetime


# ── Público ──────────────────────────────────────────────────────────────────


class PublicMedia(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    url: str
    alt_text: str | None
    width: int | None
    height: int | None


class PublicTaxonomyRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    slug: str


class PublicProjectRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    slug: str


class PublicPostSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str
    slug: str
    excerpt: str | None
    published_at: datetime | None
    updated_at: datetime
    reading_minutes: int
    cover: PublicMedia | None
    category: PublicTaxonomyRef | None
    project: PublicProjectRef | None
    tags: list[PublicTaxonomyRef]


class PublicPostDetail(PublicPostSummary):
    content_md: str
    seo_title: str | None
    seo_description: str | None
    canonical_url: str | None
    og_media: PublicMedia | None


class SearchResult(PublicPostSummary):
    snippet: str = Field(description="Fragmento con coincidencias resaltadas con <mark>")


class SlugEntry(BaseModel):
    slug: str
    updated_at: datetime


class PublicSlugs(BaseModel):
    posts: list[SlugEntry]
    projects: list[str]
    tags: list[str]
    categories: list[str]
