"""Schemas for health and readiness responses."""

from typing import Literal

from pydantic import BaseModel

ComponentState = Literal["ok", "error"]


class HealthResponse(BaseModel):
    """Liveness response."""

    status: Literal["ok"] = "ok"


class ReadinessChecks(BaseModel):
    """Status of each dependency required by the API."""

    database: ComponentState
    redis: ComponentState


class ReadinessResponse(BaseModel):
    """Readiness response."""

    status: Literal["ready", "not_ready"]
    checks: ReadinessChecks
