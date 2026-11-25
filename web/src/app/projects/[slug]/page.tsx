import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/Markdown";
import { PostList } from "@/components/PostList";
import { PROJECT_STATUS, StackList } from "@/components/ProjectCard";
import { getProject, getSlugs } from "@/lib/data";
import { formatMonth } from "@/lib/format";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getSlugs()).projects.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return {};
  return {
    title: project.name,
    description: project.summary ?? undefined,
    alternates: { canonical: `/projects/${slug}` },
    openGraph: project.cover ? { images: [{ url: project.cover.url }] } : undefined,
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const period = [formatMonth(project.start_date), project.end_date ? formatMonth(project.end_date) : project.start_date ? "hoy" : ""]
    .filter(Boolean)
    .join(" → ");

  return (
    <article className="mx-auto max-w-3xl">
      <p className="font-mono text-sm text-muted">
        <Link href="/projects" className="hover:text-accent">
          ~/projects
        </Link>
        <span className="text-accent">/</span>
        {project.slug}
      </p>
      <h1 className="mt-4 font-mono text-3xl font-bold tracking-tight sm:text-4xl">{project.name}</h1>
      {project.summary ? <p className="mt-4 text-lg text-muted">{project.summary}</p> : null}
      <dl className="mt-6 grid gap-x-6 gap-y-2 font-mono text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted">estado</dt>
        <dd>{PROJECT_STATUS[project.status]}</dd>
        {period ? (
          <>
            <dt className="text-muted">periodo</dt>
            <dd>{period}</dd>
          </>
        ) : null}
        {project.repo_url ? (
          <>
            <dt className="text-muted">código</dt>
            <dd>
              <a href={project.repo_url} className="break-all text-accent hover:underline" rel="noopener noreferrer" target="_blank">
                {project.repo_url.replace(/^https?:\/\//, "")}
              </a>
            </dd>
          </>
        ) : null}
        {project.demo_url ? (
          <>
            <dt className="text-muted">demo</dt>
            <dd>
              <a href={project.demo_url} className="break-all text-accent hover:underline" rel="noopener noreferrer" target="_blank">
                {project.demo_url.replace(/^https?:\/\//, "")}
              </a>
            </dd>
          </>
        ) : null}
      </dl>
      <div className="mt-4">
        <StackList stack={project.stack} />
      </div>
      {project.cover ? (
        <img
          src={project.cover.url}
          alt={project.cover.alt_text ?? ""}
          width={project.cover.width ?? undefined}
          height={project.cover.height ?? undefined}
          className="mt-8 w-full rounded-lg"
        />
      ) : null}
      {project.description_md ? (
        <div className="mt-10">
          <Markdown source={project.description_md} />
        </div>
      ) : null}
      <section aria-labelledby="log" className="mt-16 border-t border-border pt-8">
        <h2 id="log" className="font-mono text-xl font-semibold">
          Bitácora <span className="text-muted">({project.post_count})</span>
        </h2>
        <PostList posts={project.posts} headingLevel="h3" empty="La bitácora de este proyecto aún está vacía." />
      </section>
    </article>
  );
}
