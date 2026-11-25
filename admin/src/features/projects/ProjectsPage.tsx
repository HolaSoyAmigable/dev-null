import { Plus, Star } from "lucide-react";
import { Link } from "react-router";

import { useProjects } from "@/api/hooks";
import type { ProjectStatus } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorNotice, PageHeader, Spinner } from "@/components/ui/feedback";

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: "success" | "info" | "warning" }> = {
  active: { label: "Activo", tone: "success" },
  finished: { label: "Terminado", tone: "info" },
  paused: { label: "Pausado", tone: "warning" },
};

export function ProjectsPage() {
  const projects = useProjects();
  return (
    <>
      <PageHeader
        title="Proyectos"
        description="Portafolio. Cada proyecto tiene su bitácora de posts."
        actions={
          <Link to="/projects/new" className={buttonVariants()}>
            <Plus className="size-4" aria-hidden /> Nuevo proyecto
          </Link>
        }
      />
      <ErrorNotice error={projects.error} />
      {projects.isPending ? (
        <Spinner />
      ) : !projects.data?.length ? (
        <EmptyState title="Aún no hay proyectos." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {projects.data.map((project) => (
            <li key={project.id}>
              <Link
                to={`/projects/${project.id}`}
                className="block h-full rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-mono font-semibold">
                    {project.featured ? (
                      <Star className="mr-1 inline size-4 text-warning" aria-label="Destacado" />
                    ) : null}
                    {project.name}
                  </h2>
                  <Badge tone={PROJECT_STATUS[project.status].tone}>
                    {PROJECT_STATUS[project.status].label}
                  </Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted">{project.summary ?? "Sin resumen."}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {project.stack.map((tech) => (
                    <span key={tech} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">
                      {tech}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
