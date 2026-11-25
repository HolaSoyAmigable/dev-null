"""Declarative base shared by every SQLAlchemy model."""

from datetime import UTC, datetime

from sqlalchemy import DateTime, MetaData
from sqlalchemy.orm import DeclarativeBase

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Base class with a deterministic constraint naming convention."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    type_annotation_map = {datetime: DateTime(timezone=True)}
    # Recupera con RETURNING los valores por defecto del servidor (evita lazy loads en async).
    __mapper_args__ = {"eager_defaults": True}


def utcnow() -> datetime:
    """Current time in UTC (timezone-aware)."""
    return datetime.now(UTC)
