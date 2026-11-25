"""Admin routes for projects."""

from fastapi import APIRouter, Depends, status

from app.core.deps import RevalidatorDep, SessionDep, invalidate_cache_on_write
from app.modules.auth.deps import require_admin
from app.modules.projects import service
from app.modules.projects.schemas import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter(
    prefix="/admin/projects",
    tags=["admin-projects"],
    dependencies=[Depends(require_admin), Depends(invalidate_cache_on_write)],
)


@router.get("", response_model=list[ProjectRead])
async def list_projects(session: SessionDep) -> list[ProjectRead]:
    return [ProjectRead.model_validate(p) for p in await service.list_all(session)]


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate, session: SessionDep, revalidator: RevalidatorDep
) -> ProjectRead:
    return ProjectRead.model_validate(await service.create(session, revalidator, body))


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(project_id: int, session: SessionDep) -> ProjectRead:
    return ProjectRead.model_validate(await service.get(session, project_id))


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: int, body: ProjectUpdate, session: SessionDep, revalidator: RevalidatorDep
) -> ProjectRead:
    project = await service.update(session, revalidator, project_id, body)
    return ProjectRead.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: int, session: SessionDep, revalidator: RevalidatorDep) -> None:
    await service.delete(session, revalidator, project_id)
