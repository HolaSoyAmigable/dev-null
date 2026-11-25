import Link from "next/link";

import { ProjectCard } from "@/components/ProjectCard";
import { PostList } from "@/components/PostList";
import { getPosts, getProjects, getSettings } from "@/lib/data";

export const revalidate = 3600;

export default async function HomePage() {
  const [settings, posts, projects] = await Promise.all([getSettings(), getPosts({ pageSize: 5 }), getProjects()]);
  const featured = projects.filter((p) => p.featured).slice(0, 4);
  const shown = featured.length ? featured : projects.slice(0, 4);

  return (
    <>
      <section className="border-b border-border pb-12">
        <p className="font-mono text-sm text-muted">
          <span className="text-accent">$</span> cat README.md
        </p>
        <h1 className="mt-3 font-mono text-4xl font-bold tracking-tight sm:text-5xl">{settings.author_name}</h1>
        <p className="mt-2 font-mono text-lg text-accent">Aquí nada se descarta.</p>
        {settings.short_bio ? <p className="mt-4 max-w-2xl text-lg text-muted">{settings.short_bio}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3 font-mono text-sm">
          <Link href="/blog" className="rounded-md bg-accent px-4 py-2 font-semibold text-bg hover:opacity-90">
            leer el blog
          </Link>
          <Link href="/career" className="rounded-md border border-border px-4 py-2 hover:bg-surface-2">
            ver mi carrera
          </Link>
        </div>
      </section>

      <section className="py-12" aria-labelledby="latest">
        <div className="flex items-baseline justify-between">
          <h2 id="latest" className="font-mono text-xl font-semibold">
            Últimas publicaciones
          </h2>
          <Link href="/blog" className="font-mono text-sm text-accent hover:underline">
            ls /blog →
          </Link>
        </div>
        <PostList posts={posts.items} headingLevel="h3" />
      </section>

      {shown.length ? (
        <section className="border-t border-border pt-12" aria-labelledby="projects">
          <div className="flex items-baseline justify-between">
            <h2 id="projects" className="font-mono text-xl font-semibold">
              Proyectos
            </h2>
            <Link href="/projects" className="font-mono text-sm text-accent hover:underline">
              ls /projects →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {shown.map((project) => (
              <ProjectCard key={project.slug} project={project} headingLevel="h3" />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
