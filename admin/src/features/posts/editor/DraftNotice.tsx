import { Button } from "@/components/ui/button";

import type { DraftStatus } from "./draft";

const timeFormatter = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });

/** Indicador discreto del autoguardado local. */
export function DraftStatusLabel({ status, savedAt }: { status: DraftStatus; savedAt: Date | null }) {
  if (status === "unavailable") {
    return <span className="text-xs text-warning">Autoguardado local no disponible</span>;
  }
  if (status !== "saved" || !savedAt) return null;
  return (
    <span className="text-xs text-muted" role="status">
      Borrador guardado localmente · {timeFormatter.format(savedAt)}
    </span>
  );
}

type RestoreProps = {
  savedAt: string;
  onRestore: () => void;
  onDiscard: () => void;
};

/** Aviso al abrir el editor cuando hay un borrador local más reciente. */
export function DraftRestoreBanner({ savedAt, onRestore, onDiscard }: RestoreProps) {
  return (
    <div
      role="alert"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3 text-sm"
    >
      <p className="text-fg">
        Hay un borrador guardado localmente el{" "}
        <span className="font-medium">{dateTimeFormatter.format(new Date(savedAt))}</span>.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={onRestore}>
          Restaurar
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          Descartar
        </Button>
      </div>
    </div>
  );
}
