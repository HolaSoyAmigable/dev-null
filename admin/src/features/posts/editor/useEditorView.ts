import { useCallback, useState } from "react";

/** `visual`: editor WYSIWYG · `markdown`: texto fuente · `preview`: solo lectura · `split`: Markdown + vista previa. */
export type EditorView = "visual" | "markdown" | "preview" | "split";

const KEY = "devnull:editor:view";
const VIEWS: readonly EditorView[] = ["visual", "markdown", "preview", "split"];

function read(): EditorView {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "write") return "markdown"; // valor de la versión anterior (editor de texto)
    return VIEWS.find((view) => view === stored) ?? "visual";
  } catch {
    return "visual";
  }
}

/** Vista del editor; se recuerda en este navegador. Por defecto, el editor visual. */
export function useEditorView(): [EditorView, (view: EditorView) => void] {
  const [view, setView] = useState<EditorView>(read);
  const update = useCallback((next: EditorView) => {
    setView(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Sin almacenamiento: la vista solo dura esta sesión.
    }
  }, []);
  return [view, update];
}
