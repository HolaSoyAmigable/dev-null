import { ImagePlus, X } from "lucide-react";
import { useState } from "react";

import { useMediaList } from "@/api/hooks";
import type { Media } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorNotice, Spinner } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

import { UploadButton } from "./UploadButton";

type MediaPickerProps = {
  label: string;
  value: Media | null;
  onChange: (media: Media | null) => void;
};

/** Selector de imagen desde la galería, con subida rápida. */
export function MediaPicker({ label, value, onChange }: MediaPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {value ? (
        <div className="relative overflow-hidden rounded-md border border-border">
          <img
            src={value.url}
            alt={value.alt_text ?? ""}
            className="aspect-video w-full bg-surface-2 object-cover"
          />
          <div className="absolute right-2 top-2 flex gap-1">
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
              Cambiar
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="size-8"
              aria-label={`Quitar ${label.toLowerCase()}`}
              onClick={() => onChange(null)}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
          <ImagePlus className="size-4" aria-hidden /> Elegir imagen
        </Button>
      )}
      <MediaDialog
        open={open}
        title={label}
        onClose={() => setOpen(false)}
        onSelect={(media) => {
          onChange(media);
          setOpen(false);
        }}
      />
    </div>
  );
}

type MediaDialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  onSelect: (media: Media) => void;
};

export function MediaDialog({ open, title, onClose, onSelect }: MediaDialogProps) {
  const [page, setPage] = useState(1);
  const media = useMediaList(page, open);
  const images = media.data?.items.filter((m) => m.mime.startsWith("image/")) ?? [];
  const totalPages = media.data ? Math.ceil(media.data.total / media.data.page_size) : 1;

  return (
    <Dialog open={open} onClose={onClose} title={title} className="max-w-3xl">
      <div className="mb-4 flex justify-end">
        <UploadButton onUploaded={onSelect} />
      </div>
      <ErrorNotice error={media.error} />
      {media.isPending ? (
        <Spinner />
      ) : images.length === 0 ? (
        <p className="text-sm text-muted">No hay imágenes. Sube la primera.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  "block w-full cursor-pointer overflow-hidden rounded-md border border-border",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                )}
              >
                <img
                  src={item.url}
                  alt={item.alt_text ?? "Imagen sin texto alternativo"}
                  className="aspect-square w-full bg-surface-2 object-cover"
                  loading="lazy"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {totalPages > 1 ? (
        <div className="mt-4 flex justify-between">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      ) : null}
    </Dialog>
  );
}
