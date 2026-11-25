import { useDeferredValue, useMemo } from "react";

import { formatStats, markdownStats } from "@/lib/markdownStats";

/** Palabras y tiempo de lectura en tiempo real (se difiere para no frenar la escritura). */
export function EditorStats({ markdown }: { markdown: string }) {
  const deferred = useDeferredValue(markdown);
  const text = useMemo(() => formatStats(markdownStats(deferred)), [deferred]);
  return (
    <p className="text-xs text-muted" aria-live="off" data-testid="editor-stats">
      {text}
    </p>
  );
}
