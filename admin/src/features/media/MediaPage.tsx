import { Copy, FileText, Trash2 } from "lucide-react";
import { useState } from "react";

import { useMediaList, useMediaMutations } from "@/api/hooks";
import type { Media } from "@/api/types";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorNotice, PageHeader, Spinner } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { formatBytes, formatDate } from "@/lib/utils";

import { MAX_UPLOAD_MB, UploadButton } from "./UploadButton";

export function MediaPage() {
  const [page, setPage] = useState(1);
  const media = useMediaList(page);
  const { remove } = useMediaMutations();
  const totalPages = media.data ? Math.max(1, Math.ceil(media.data.total / media.data.page_size)) : 1;

  return (
    <>
      <PageHeader
        title="Media"
        description={`PNG, JPEG, GIF, WebP, AVIF o PDF · máximo ${MAX_UPLOAD_MB} MB. El tipo se valida por contenido.`}
        actions={<UploadButton />}
      />
      <ErrorNotice error={media.error ?? remove.error} />
      {media.isPending ? (
        <Spinner />
      ) : !media.data?.items.length ? (
        <EmptyState title="La galería está vacía.">Sube imágenes para usarlas en posts y proyectos.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {media.data.items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onDelete={() => {
                if (window.confirm("¿Eliminar este archivo? Se quitará de los posts que lo usen.")) {
                  remove.mutate(item.id);
                }
              }}
            />
          ))}
        </ul>
      )}
      {totalPages > 1 ? (
        <div className="mt-6 flex justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted">
            Página {page} de {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Siguiente
          </Button>
        </div>
      ) : null}
    </>
  );
}

function MediaCard({ item, onDelete }: { item: Media; onDelete: () => void }) {
  const { updateAlt } = useMediaMutations();
  const [alt, setAlt] = useState(item.alt_text ?? "");
  const isImage = item.mime.startsWith("image/");

  return (
    <li className="overflow-hidden rounded-lg border border-border bg-surface">
      {isImage ? (
        <img src={item.url} alt={item.alt_text ?? ""} loading="lazy" className="aspect-video w-full bg-surface-2 object-cover" />
      ) : (
        <div className="grid aspect-video place-items-center bg-surface-2">
          <FileText className="size-10 text-muted" aria-hidden />
        </div>
      )}
      <div className="space-y-2 p-3">
        <p className="font-mono text-xs text-muted">
          {item.mime} · {formatBytes(item.size_bytes)}
          {item.width ? ` · ${item.width}×${item.height}` : ""} · {formatDate(item.created_at)}
        </p>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            updateAlt.mutate({ id: item.id, altText: alt });
          }}
        >
          <label className="sr-only" htmlFor={`alt-${item.id}`}>
            Texto alternativo
          </label>
          <Input
            id={`alt-${item.id}`}
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            placeholder="Texto alternativo"
            className="h-8 text-xs"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={alt === (item.alt_text ?? "")}>
            Guardar
          </Button>
        </form>
        <div className="flex justify-between">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void navigator.clipboard?.writeText(`![${alt}](${item.url})`)}
          >
            <Copy className="size-3.5" aria-hidden /> Markdown
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Eliminar archivo">
            <Trash2 className="size-3.5 text-danger" aria-hidden />
          </Button>
        </div>
      </div>
    </li>
  );
}
