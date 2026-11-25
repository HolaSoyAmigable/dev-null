"""Career schemas."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CareerType = Literal["work", "education", "achievement", "certification"]


class CareerCreate(BaseModel):
    type: CareerType
    title: str = Field(min_length=1, max_length=200)
    organization: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    start_date: date
    end_date: date | None = None
    description_md: str | None = None
    skills: list[str] = Field(default_factory=list)
    sort_order: int | None = None
    visible: bool = True


class CareerUpdate(BaseModel):
    type: CareerType | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    organization: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    description_md: str | None = None
    skills: list[str] | None = None
    sort_order: int | None = None
    visible: bool | None = None


class CareerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: CareerType
    title: str
    organization: str | None
    location: str | None
    start_date: date
    end_date: date | None
    description_md: str | None
    skills: list[str]
    sort_order: int
    visible: bool


class PublicCareerEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    type: CareerType
    title: str
    organization: str | None
    location: str | None
    start_date: date
    end_date: date | None
    description_md: str | None
    skills: list[str]


class ReorderItem(BaseModel):
    id: int
    sort_order: int


class ReorderRequest(BaseModel):
    items: list[ReorderItem] = Field(min_length=1)
