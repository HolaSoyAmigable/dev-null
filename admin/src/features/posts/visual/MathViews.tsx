import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import katex from "katex";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** HTML de KaTeX (generado por la biblioteca, con `trust` desactivado: sin `\href` ni similares). */
function renderLatex(latex: string, displayMode: boolean): string {
  return katex.renderToString(latex, { displayMode, throwOnError: false, trust: false, output: "htmlAndMathml" });
}

type EditorProps = {
  latex: string;
  display: boolean;
  /** Empieza en modo edición (fórmula recién insertada). */
  startEditing: boolean;
  selected: boolean;
  onCommit: (latex: string) => void;
  onExit: () => void;
};

/** Muestra la fórmula dibujada; al hacer clic se edita su LaTeX en el sitio. */
function MathEditor({ latex, display, startEditing, selected, onCommit, onExit }: EditorProps) {
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(latex);
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const html = useMemo(() => (latex.trim() ? renderLatex(latex, display) : ""), [latex, display]);

  useEffect(() => {
    if (editing) field.current?.focus();
  }, [editing]);

  const finish = (save: boolean) => {
    setEditing(false);
    if (save && draft !== latex) onCommit(draft);
    else setDraft(latex);
    onExit();
  };

  if (editing) {
    const shared = {
      ref: field,
      value: draft,
      "aria-label": display ? "Fórmula en bloque (LaTeX)" : "Fórmula en línea (LaTeX)",
      placeholder: "LaTeX, p. ej. E = mc^2",
      onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
      onBlur: () => finish(true),
      className:
        "w-full rounded border border-accent bg-surface px-2 py-1 font-mono text-[13px] text-fg focus-visible:outline-none",
    };
    return display ? (
      <textarea
        {...shared}
        rows={Math.min(8, Math.max(2, draft.split("\n").length))}
        onKeyDown={(event) => {
          if (event.key === "Escape") finish(false);
          else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) finish(true);
        }}
      />
    ) : (
      <input
        {...shared}
        size={Math.max(8, draft.length + 1)}
        onKeyDown={(event) => {
          if (event.key === "Escape") finish(false);
          else if (event.key === "Enter") {
            event.preventDefault();
            finish(true);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(latex);
        setEditing(true);
      }}
      title="Clic para editar la fórmula"
      className={cn(
        "cursor-pointer rounded border border-transparent text-fg hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        display ? "my-2 block w-full overflow-x-auto py-1 text-center" : "inline px-0.5",
        selected && "border-accent",
      )}
    >
      {html ? (
        <span dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <span className="text-xs text-muted">{display ? "Fórmula vacía (clic para escribir)" : "fórmula"}</span>
      )}
    </button>
  );
}

function MathNodeView({ node, updateAttributes, selected, editor }: NodeViewProps, display: boolean) {
  const latex = String(node.attrs.latex ?? "");
  return (
    <NodeViewWrapper as={display ? "div" : "span"} contentEditable={false} className={display ? "math-block" : "math-inline"}>
      <MathEditor
        latex={latex}
        display={display}
        startEditing={latex === ""}
        selected={selected}
        onCommit={(next) => updateAttributes({ latex: next })}
        onExit={() => editor.commands.focus()}
      />
    </NodeViewWrapper>
  );
}

export const MathInlineView = (props: NodeViewProps) => MathNodeView(props, false);
export const MathBlockView = (props: NodeViewProps) => MathNodeView(props, true);
