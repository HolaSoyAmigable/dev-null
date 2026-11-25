import Link from "next/link";

import type { ProjectSummary } from "@/lib/api/client";
import { formatMonth } from "@/lib/format";

export const PROJECT_STATUS: Record<ProjectSummary["status"], string> = {
  active: "activo",
  finished: "terminado",
  paused: "en pausa",
};

export function StackList({ stack }: { stack: string[] }) {
  if (!stack.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Tecnologías">
      {stack.map((tech) => (
        <li key={tech} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">
          {tech}
        </li>
      ))}
    </ul>
  );
}

export function ProjectCard({ project, headingLevel = "h2" }: { project: ProjectSummary; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <article className="group relative flex flex-col rounded-lg border border-border bg-surface p-5 transition-colors hover:border-accent">
      {project.cover ? (
        <img
          src={project.cover.url}
          alt=""
          width={project.cover.width ?? undefined}
          height={project.cover.height ?? undefined}
          loading="lazy"
          className="mb-4 aspect-video w-full rounded-md object-cover"
        />
      ) : null}
      <div className="flex items-baseline justify-between gap-2">
        <Heading className="font-mono text-lg font-semibold">
          <Link href={`/projects/${project.slug}`} className="after:absolute after:inset-0 group-hover:text-accent">
            {project.name}
          </Link>
        </Heading>
        <span className="font-mono text-xs text-muted">[{PROJECT_STATUS[project.status]}]</span>
      </div>
      {project.summary ? <p className="mt-2 flex-1 text-sm text-muted">{project.summary}</p> : <div className="flex-1" />}
      <div className="mt-4 space-y-2">
        <StackList stack={project.stack} />
        <p className="font-mono text-xs text-muted">
          {project.start_date ? formatMonth(project.start_date) : ""}
          {project.post_count ? ` · ${project.post_count} entradas de bitácora` : ""}
        </p>
      </div>
    </article>
  );
}
