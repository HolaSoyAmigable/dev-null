"""Media schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MediaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    alt_text: str | None
    mime: str
    size_bytes: int
    width: int | None
    height: int | None
    created_at: datetime


class MediaUpdate(BaseModel):
    alt_text: str | None = Field(default=None, max_length=300)
