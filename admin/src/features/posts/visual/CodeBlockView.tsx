import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { lazy, Suspense } from "react";

// Mermaid es grande: solo se descarga cuando hay un bloque ```mermaid en el documento.
const MermaidDiagram = lazy(() => import("@/components/MermaidDiagram"));

/** Lenguajes ofrecidos en el selector de cada bloque (los alias coinciden con los del blog). */
export const CODE_LANGUAGES: readonly { value: string; label: string }[] = [
  { value: "", label: "Texto" },
  { value: "ts", label: "TypeScript" },
  { value: "js", label: "JavaScript" },
  { value: "kt", label: "Kotlin" },
  { value: "py", label: "Python" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "mermaid", label: "Mermaid (diagrama)" },
];

/**
 * Bloque de código editable con selector de lenguaje. Si el lenguaje es `mermaid`, debajo se
 * dibuja el diagrama en vivo a partir del código.
 */
export function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const language = String(node.attrs.language ?? "");
  const known = CODE_LANGUAGES.some((item) => item.value === language);
  return (
    <NodeViewWrapper className="code-block group relative my-3">
      <div contentEditable={false} className="absolute right-2 top-1.5 z-10 opacity-60 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <select
          aria-label="Lenguaje del bloque de código"
          value={language}
          onChange={(event) => updateAttributes({ language: event.target.value || null })}
          className="cursor-pointer rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-xs text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {known ? null : <option value={language}>{language}</option>}
          {CODE_LANGUAGES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <pre spellCheck={false}>
        <NodeViewContent<"code"> as="code" />
      </pre>
      {language === "mermaid" && node.textContent.trim() ? (
        <div contentEditable={false}>
          <Suspense fallback={<p className="my-2 text-xs text-muted">Cargando diagrama…</p>}>
            <MermaidDiagram chart={node.textContent} />
          </Suspense>
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}
