import Link from "next/link";

import { PageTitle, Pagination, PostList } from "@/components/PostList";
import { getCategories, getPosts, getTags } from "@/lib/data";

/** Listado paginado del blog con categorías y etiquetas (páginas /blog y /blog/page/[n]). */
export async function BlogIndex({ page }: { page: number }) {
  const [posts, tags, categories] = await Promise.all([getPosts({ page }), getTags(), getCategories()]);
  const usedCategories = categories.filter((c) => c.post_count > 0);
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_14rem]">
      <div>
        <PageTitle prompt="ls -lt /blog" title="Blog" description="Artículos técnicos, bitácoras de proyectos y notas." />
        <PostList posts={posts.items} />
        <Pagination page={page} total={posts.total} pageSize={posts.page_size} basePath="/blog" />
      </div>
      <aside className="space-y-8 font-mono text-sm lg:pt-24">
        {usedCategories.length ? (
          <nav aria-labelledby="cats">
            <h2 id="cats" className="mb-2 text-muted">
              categorías/
            </h2>
            <ul className="space-y-1">
              {usedCategories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/blog/category/${c.slug}`} className="hover:text-accent">
                    {c.name} <span className="text-muted">({c.post_count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        {tags.length ? (
          <nav aria-labelledby="tags">
            <h2 id="tags" className="mb-2 text-muted">
              etiquetas/
            </h2>
            <ul className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <li key={t.slug}>
                  <Link href={`/blog/tag/${t.slug}`} className="hover:text-accent">
                    #{t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </aside>
    </div>
  );
}
