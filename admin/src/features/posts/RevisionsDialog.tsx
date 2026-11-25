import { useState } from "react";

import { useRestoreRevision, useRevisions } from "@/api/hooks";
import type { Post } from "@/api/types";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorNotice, Spinner } from "@/components/ui/feedback";
import { cn, formatDateTime } from "@/lib/utils";

type RevisionsDialogProps = {
  postId: number;
  open: boolean;
  onClose: () => void;
  onRestored: (post: Post) => void;
};

export function RevisionsDialog({ postId, open, onClose, onRestored }: RevisionsDialogProps) {
  const revisions = useRevisions(postId);
  const restore = useRestoreRevision(postId);
  const [selected, setSelected] = useState<number | null>(null);
  const current = revisions.data?.find((r) => r.id === selected) ?? revisions.data?.[0];

  return (
    <Dialog open={open} onClose={onClose} title="Historial de revisiones" className="max-w-4xl">
      <p className="mb-4 text-xs text-muted">
        Se guarda una revisión al publicar, al restaurar y cada 5 guardados con cambios.
      </p>
      <ErrorNotice error={revisions.error ?? restore.error} />
      {revisions.isPending ? (
        <Spinner />
      ) : !revisions.data?.length ? (
        <p className="text-sm text-muted">Todavía no hay revisiones.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
          <ul className="space-y-1">
            {revisions.data.map((revision) => (
              <li key={revision.id}>
                <button
                  type="button"
                  onClick={() => setSelected(revision.id)}
                  className={cn(
                    "w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm",
                    current?.id === revision.id ? "bg-accent/15 text-accent" : "hover:bg-surface-2",
                  )}
                >
                  <span className="block truncate font-medium">{revision.title}</span>
                  <span className="text-xs text-muted">{formatDateTime(revision.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
          {current ? (
            <div className="min-w-0 space-y-3">
              <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border p-4">
                <MarkdownPreview source={current.content_md} />
              </div>
              <Button
                disabled={restore.isPending}
                onClick={() => {
                  if (!window.confirm("¿Restaurar esta revisión? El estado actual se guardará como revisión.")) {
                    return;
                  }
                  restore.mutate(current.id, {
                    onSuccess: (post) => {
                      onRestored(post);
                      onClose();
                    },
                  });
                }}
              >
                Restaurar esta revisión
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
