"""Shared pagination parameters and response envelope."""

from dataclasses import dataclass
from typing import Annotated

from fastapi import Query
from pydantic import BaseModel

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


class Page[T](BaseModel):
    """Paginated list response defined in the API contract."""

    items: list[T]
    total: int
    page: int
    page_size: int


@dataclass(frozen=True)
class PageParams:
    """Validated pagination input."""

    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def page_params(
    page: Annotated[int, Query(ge=1, description="Página (desde 1)")] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="Elementos por página")
    ] = DEFAULT_PAGE_SIZE,
) -> PageParams:
    """FastAPI dependency for `?page=` and `?page_size=`."""
    return PageParams(page=page, page_size=page_size)
