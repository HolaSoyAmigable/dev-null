import { Copy, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { usePostAction, usePosts, useDeletePost } from "@/api/hooks";
import type { PostStatus } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorNotice, PageHeader, Spinner } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";

import { STATUS_LABELS, STATUS_TONES } from "./status";

const STATUSES: PostStatus[] = ["draft", "scheduled", "published", "archived"];

export function PostsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const status = (params.get("status") as PostStatus | null) ?? undefined;
  const q = params.get("q") ?? "";
  const page = Number(params.get("page") ?? "1");
  const [search, setSearch] = useState(q);

  const posts = usePosts({ status, q, page });
  const action = usePostAction();
  const remove = useDeletePost();

  const update = (next: Record<string, string | undefined>) => {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([key, value]) =>
      value ? merged.set(key, value) : merged.delete(key),
    );
    setParams(merged);
  };

  const totalPages = posts.data ? Math.max(1, Math.ceil(posts.data.total / posts.data.page_size)) : 1;

  return (
    <>
      <PageHeader
        title="Posts"
        description="Borradores, programados y publicados."
        actions={
          <Link to="/posts/new" className={buttonVariants()}>
            <Plus className="size-4" aria-hidden /> Nuevo post
          </Link>
        }
      />

      <form
        className="mb-4 flex flex-wrap gap-2"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: search.trim() || undefined, page: undefined });
        }}
      >
        <label className="sr-only" htmlFor="post-search">
          Buscar por título
        </label>
        <Input
          id="post-search"
          placeholder="Buscar por título…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-xs"
        />
        <label className="sr-only" htmlFor="post-status">
          Filtrar por estado
        </label>
        <Select
          id="post-status"
          value={status ?? ""}
          onChange={(event) => update({ status: event.target.value || undefined, page: undefined })}
          className="w-44"
        >
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      <ErrorNotice error={posts.error ?? action.error ?? remove.error} />

      {posts.isPending ? (
        <Spinner />
      ) : posts.data && posts.data.items.length === 0 ? (
        <EmptyState title="No hay posts con estos filtros.">
          Crea el primero con «Nuevo post».
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Título</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Categoría</th>
                <th className="hidden px-4 py-2 font-medium lg:table-cell">Actualizado</th>
                <th className="px-4 py-2 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {posts.data?.items.map((post) => (
                <tr key={post.id} className="bg-surface hover:bg-surface-2/50">
                  <td className="px-4 py-3">
                    <Link to={`/posts/${post.id}`} className="font-medium hover:text-accent">
                      {post.title}
                    </Link>
                    <p className="font-mono text-xs text-muted">/blog/{post.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONES[post.status]}>{STATUS_LABELS[post.status]}</Badge>
                    {post.status === "scheduled" ? (
                      <p className="mt-1 text-xs text-muted">{formatDateTime(post.scheduled_for)}</p>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 text-muted md:table-cell">
                    {post.category?.name ?? "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-muted lg:table-cell">
                    {formatDateTime(post.updated_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {post.status === "published" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => action.mutate({ id: post.id, action: "unpublish" })}
                        >
                          Despublicar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => action.mutate({ id: post.id, action: "publish" })}
                        >
                          Publicar
                        </Button>
                      )}
                      {post.status === "published" ? (
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonVariants({ variant: "ghost", size: "icon" })}
                          aria-label={`Ver «${post.title}» en el blog`}
                        >
                          <ExternalLink className="size-4" aria-hidden />
                        </a>
                      ) : null}
                      <Link
                        to={`/posts/${post.id}`}
                        className={buttonVariants({ variant: "ghost", size: "icon" })}
                        aria-label={`Editar «${post.title}»`}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Link>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Duplicar «${post.title}»`}
                        onClick={() =>
                          action.mutate(
                            { id: post.id, action: "duplicate" },
                            { onSuccess: (copy) => navigate(`/posts/${copy.id}`) },
                          )
                        }
                      >
                        <Copy className="size-4" aria-hidden />
                      </Button>
                      {post.status === "draft" || post.status === "archived" ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Eliminar «${post.title}»`}
                          onClick={() => {
                            if (window.confirm(`¿Eliminar «${post.title}»? No se puede deshacer.`)) {
                              remove.mutate(post.id);
                            }
                          }}
                        >
                          <Trash2 className="size-4 text-danger" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {posts.data && totalPages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Paginación">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => update({ page: String(page - 1) })}
          >
            Anterior
          </Button>
          <span className="text-muted">
            Página {page} de {totalPages} · {posts.data.total} posts
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => update({ page: String(page + 1) })}
          >
            Siguiente
          </Button>
        </nav>
      ) : null}
    </>
  );
}
