"""Taxonomy schemas."""

from pydantic import BaseModel, ConfigDict, Field

from app.core.slug import MAX_SLUG_LENGTH, SLUG_PATTERN


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=MAX_SLUG_LENGTH, pattern=SLUG_PATTERN)


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=MAX_SLUG_LENGTH, pattern=SLUG_PATTERN)


class TagRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str


class TagWithCount(TagRead):
    post_count: int


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=MAX_SLUG_LENGTH, pattern=SLUG_PATTERN)
    description: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=MAX_SLUG_LENGTH, pattern=SLUG_PATTERN)
    description: str | None = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None


class CategoryWithCount(CategoryRead):
    post_count: int
