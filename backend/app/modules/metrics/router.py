"""Admin routes for metrics dashboards."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.deps import SessionDep
from app.modules.auth.deps import require_admin
from app.modules.metrics import service
from app.modules.metrics.schemas import (
    CountItem,
    Overview,
    PostMetrics,
    Realtime,
    TimeseriesPoint,
    TopPost,
)

router = APIRouter(
    prefix="/admin/metrics", tags=["admin-metrics"], dependencies=[Depends(require_admin)]
)

StartQ = Annotated[date | None, Query(description="Inicio (YYYY-MM-DD, UTC)")]
EndQ = Annotated[date | None, Query(description="Fin inclusivo (YYYY-MM-DD, UTC)")]


@router.get("/overview", response_model=Overview)
async def overview(session: SessionDep, start: StartQ = None, end: EndQ = None) -> Overview:
    return await service.overview(session, *service.default_range(start, end))


@router.get("/timeseries", response_model=list[TimeseriesPoint])
async def timeseries(
    session: SessionDep, start: StartQ = None, end: EndQ = None
) -> list[TimeseriesPoint]:
    return await service.timeseries(session, *service.default_range(start, end))


@router.get("/top-posts", response_model=list[TopPost])
async def top_posts(
    session: SessionDep,
    start: StartQ = None,
    end: EndQ = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> list[TopPost]:
    return await service.top_posts(session, *service.default_range(start, end), limit)


@router.get("/referrers", response_model=list[CountItem])
async def referrers(session: SessionDep, start: StartQ = None, end: EndQ = None) -> list[CountItem]:
    return await service.breakdown(session, "referrers", *service.default_range(start, end))


@router.get("/countries", response_model=list[CountItem])
async def countries(session: SessionDep, start: StartQ = None, end: EndQ = None) -> list[CountItem]:
    return await service.breakdown(session, "countries", *service.default_range(start, end))


@router.get("/devices", response_model=list[CountItem])
async def devices(session: SessionDep, start: StartQ = None, end: EndQ = None) -> list[CountItem]:
    return await service.breakdown(session, "devices", *service.default_range(start, end))


@router.get("/browsers", response_model=list[CountItem])
async def browsers(session: SessionDep, start: StartQ = None, end: EndQ = None) -> list[CountItem]:
    return await service.breakdown(session, "browsers", *service.default_range(start, end))


@router.get("/realtime", response_model=Realtime)
async def realtime(session: SessionDep) -> Realtime:
    return await service.realtime(session)


@router.get("/posts/{post_id}", response_model=PostMetrics)
async def post_metrics(
    post_id: int, session: SessionDep, start: StartQ = None, end: EndQ = None
) -> PostMetrics:
    return await service.post_metrics(session, post_id, *service.default_range(start, end))
