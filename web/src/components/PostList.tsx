import Link from "next/link";

import type { PostSummary } from "@/lib/api/client";
import { formatDate } from "@/lib/format";

export function TagLinks({ tags }: { tags: PostSummary["tags"] }) {
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-2 font-mono text-xs">
      {tags.map((tag) => (
        <li key={tag.slug}>
          <Link href={`/blog/tag/${tag.slug}`} className="text-muted hover:text-accent">
            #{tag.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PostMeta({ post }: { post: PostSummary }) {
  return (
    <p className="font-mono text-xs text-muted">
      <time dateTime={post.published_at ?? undefined}>{formatDate(post.published_at)}</time>
      {" · "}
      {post.reading_minutes} min de lectura
      {post.category ? (
        <>
          {" · "}
          <Link href={`/blog/category/${post.category.slug}`} className="hover:text-accent">
            {post.category.name}
          </Link>
        </>
      ) : null}
      {post.project ? (
        <>
          {" · "}
          <Link href={`/projects/${post.project.slug}`} className="hover:text-accent">
            {post.project.name}
          </Link>
        </>
      ) : null}
    </p>
  );
}

export function PostCard({ post, headingLevel = "h2" }: { post: PostSummary; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <article className="group py-6">
      <PostMeta post={post} />
      <Heading className="mt-1 font-mono text-lg font-semibold tracking-tight">
        <Link href={`/blog/${post.slug}`} className="transition-colors group-hover:text-accent">
          {post.title}
        </Link>
      </Heading>
      {post.excerpt ? <p className="mt-2 text-muted">{post.excerpt}</p> : null}
      <div className="mt-3">
        <TagLinks tags={post.tags} />
      </div>
    </article>
  );
}

export function PostList({
  posts,
  empty = "Aún no hay publicaciones. Todo lo que llegue aquí, se queda.",
  headingLevel,
}: {
  posts: PostSummary[];
  empty?: string;
  headingLevel?: "h2" | "h3";
}) {
  if (!posts.length) return <p className="py-10 font-mono text-sm text-muted">{empty}</p>;
  return (
    <div className="divide-y divide-border">
      {posts.map((post) => (
        <PostCard key={post.slug} post={post} headingLevel={headingLevel} />
      ))}
    </div>
  );
}

export function Pagination({ page, total, pageSize, basePath }: { page: number; total: number; pageSize: number; basePath: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (n: number) => (n === 1 ? basePath : `${basePath}/page/${n}`);
  return (
    <nav aria-label="Paginación" className="mt-8 flex items-center justify-between font-mono text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className="text-accent hover:underline" rel="prev">
          ← anteriores
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">
        {page}/{pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="text-accent hover:underline" rel="next">
          siguientes →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function PageTitle({ prompt, title, description }: { prompt: string; title: string; description?: string }) {
  return (
    <header className="mb-8">
      <p className="font-mono text-sm text-muted">
        <span className="text-accent">$</span> {prompt}
      </p>
      <h1 className="mt-2 font-mono text-3xl font-bold tracking-tight">{title}</h1>
      {description ? <p className="mt-3 max-w-2xl text-muted">{description}</p> : null}
    </header>
  );
}
