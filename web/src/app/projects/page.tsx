import type { Metadata } from "next";

import { ProjectCard } from "@/components/ProjectCard";
import { PageTitle } from "@/components/PostList";
import { getProjects } from "@/lib/data";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Proyectos",
  description: "Portafolio de proyectos, cada uno con su bitácora de desarrollo.",
  alternates: { canonical: "/projects" },
};

export default async function ProjectsPage() {
  const projects = await getProjects();
  return (
    <>
      <PageTitle prompt="ls ~/projects" title="Proyectos" description="Lo que he construido. Cada proyecto tiene su propia bitácora." />
      {projects.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.slug} project={project} />
          ))}
        </div>
      ) : (
        <p className="font-mono text-sm text-muted">Directorio vacío. Por ahora.</p>
      )}
    </>
  );
}
