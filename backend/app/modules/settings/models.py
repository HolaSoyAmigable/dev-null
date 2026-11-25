"""Site settings key/value model."""

from typing import Any

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import Base


class SiteSetting(Base):
    __tablename__ = "site_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    # JSON arbitrario por diseño (texto, listas de enlaces, etc.).
    value: Mapped[Any] = mapped_column(JSONB)
