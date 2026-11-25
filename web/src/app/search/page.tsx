import type { Metadata } from "next";
import Link from "next/link";

import { PageTitle, PostMeta } from "@/components/PostList";
import { search } from "@/lib/data";
import { splitHighlights } from "@/lib/format";

export const metadata: Metadata = {
  title: "Buscar",
  robots: { index: false, follow: true },
  alternates: { canonical: "/search" },
};

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 200);
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const results = q ? await search(q, page) : null;
  const pages = results ? Math.ceil(results.total / results.page_size) : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle prompt={`grep -ri "${q || "…"}" /blog`} title="Buscar" />
      <form role="search" action="/search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Términos de búsqueda
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="docker, fastapi, despliegue…"
          className="h-11 flex-1 rounded-md border border-border bg-surface px-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-accent"
        />
        <button type="submit" className="h-11 cursor-pointer rounded-md bg-accent px-4 font-mono text-sm font-semibold text-bg hover:opacity-90">
          buscar
        </button>
      </form>

      {results ? (
        <section aria-live="polite" className="mt-8">
          {results.total === 0 ? (
            <p className="font-mono text-sm text-muted">Sin resultados. Lo que buscas se fue a /dev/null.</p>
          ) : (
            <>
              <p className="font-mono text-xs text-muted">
                {results.total} resultado{results.total === 1 ? "" : "s"}
              </p>
              <ol className="divide-y divide-border">
                {results.items.map((item) => (
                  <li key={item.slug} className="py-6">
                    <PostMeta post={item} />
                    <h2 className="mt-1 font-mono text-lg font-semibold">
                      <Link href={`/blog/${item.slug}`} className="hover:text-accent">
                        {item.title}
                      </Link>
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                      {splitHighlights(item.snippet).map((part, i) =>
                        part.mark ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>,
                      )}
                    </p>
                  </li>
                ))}
              </ol>
              {pages > 1 ? (
                <nav aria-label="Paginación" className="mt-6 flex justify-between font-mono text-sm">
                  {page > 1 ? (
                    <Link href={`/search?q=${encodeURIComponent(q)}&page=${page - 1}`} className="text-accent">
                      ← anteriores
                    </Link>
                  ) : (
                    <span />
                  )}
                  {page < pages ? (
                    <Link href={`/search?q=${encodeURIComponent(q)}&page=${page + 1}`} className="text-accent">
                      siguientes →
                    </Link>
                  ) : null}
                </nav>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
