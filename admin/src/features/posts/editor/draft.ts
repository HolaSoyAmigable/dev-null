import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Autoguardado local de borradores en `localStorage` (nunca sale del navegador).
 * Se borra al guardar en el servidor. Si el almacenamiento no está disponible,
 * el editor sigue funcionando sin autoguardado.
 */
export const DRAFT_INTERVAL_MS = 30_000;
const PREFIX = "devnull:draft:post:";

export type Draft<T> = {
  values: T;
  /** Cuándo se guardó el borrador local (ISO). */
  savedAt: string;
  /** `updated_at` del post cuando se empezó a editar; `null` en un post nuevo. */
  baseUpdatedAt: string | null;
};

export function draftKey(postId?: number): string {
  return `${PREFIX}${postId ?? "new"}`;
}

export function readDraft<T>(key: string): Draft<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft<T>>;
    if (!parsed || typeof parsed.savedAt !== "string" || typeof parsed.values !== "object" || !parsed.values) {
      return null;
    }
    return { values: parsed.values, savedAt: parsed.savedAt, baseUpdatedAt: parsed.baseUpdatedAt ?? null };
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string, draft: Draft<T>): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Sin almacenamiento: no hay nada que borrar.
  }
}

/**
 * Borrador que vale la pena ofrecer al abrir el editor: existe, difiere de lo cargado y no
 * es anterior a la última versión guardada en el servidor.
 */
export function findRestorableDraft<T>(
  key: string,
  current: T,
  serverUpdatedAt: string | null,
): Draft<T> | null {
  const draft = readDraft<T>(key);
  if (!draft) return null;
  if (JSON.stringify(draft.values) === JSON.stringify(current)) return null;
  if (serverUpdatedAt && new Date(draft.savedAt).getTime() < new Date(serverUpdatedAt).getTime()) {
    return null;
  }
  return draft;
}

export type DraftStatus = "idle" | "saved" | "unavailable";

type Options<T> = {
  storageKey: string;
  values: T;
  /** Solo se guarda si hay cambios sin guardar en el servidor. */
  dirty: boolean;
  baseUpdatedAt: string | null;
  intervalMs?: number;
};

export function useDraftAutosave<T>({
  storageKey,
  values,
  dirty,
  baseUpdatedAt,
  intervalMs = DRAFT_INTERVAL_MS,
}: Options<T>): { status: DraftStatus; savedAt: Date | null; discard: () => void } {
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const latest = useRef({ values, dirty, baseUpdatedAt });
  const lastWritten = useRef<string | null>(null);

  useEffect(() => {
    latest.current = { values, dirty, baseUpdatedAt };
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      const { values: current, dirty: isDirty, baseUpdatedAt: base } = latest.current;
      if (!isDirty) return;
      const snapshot = JSON.stringify(current);
      if (snapshot === lastWritten.current) return;
      const now = new Date();
      const ok = writeDraft<T>(storageKey, { values: current, savedAt: now.toISOString(), baseUpdatedAt: base });
      if (ok) {
        lastWritten.current = snapshot;
        setSavedAt(now);
        setStatus("saved");
      } else {
        setStatus("unavailable");
      }
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [storageKey, intervalMs]);

  const discard = useCallback(() => {
    clearDraft(storageKey);
    lastWritten.current = null;
    setSavedAt(null);
    setStatus("idle");
  }, [storageKey]);

  return { status, savedAt, discard };
}
