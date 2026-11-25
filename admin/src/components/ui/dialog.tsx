import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
};

/** Diálogo modal nativo (<dialog>): foco atrapado y cierre con Escape. */
export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className={cn(
        "m-auto w-full max-w-lg rounded-lg border border-border bg-surface p-0 text-fg backdrop:bg-black/60",
        className,
      )}
    >
      {open ? (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-mono text-sm font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded p-1 text-muted hover:bg-surface-2 hover:text-fg"
              aria-label="Cerrar"
            >
              <X className="size-4" aria-hidden />
            </button>
          </header>
          <div className="overflow-y-auto p-4">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
