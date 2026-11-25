import { CODE_SNIPPETS, DIAGRAM_SNIPPET, MATH_SNIPPET, type Snippet } from "./snippets";

const GROUPS: readonly (readonly Snippet[])[] = [CODE_SNIPPETS, [DIAGRAM_SNIPPET, MATH_SNIPPET]];

type Props = { onInsert: (snippet: Snippet) => void };

/** Barra sutil con accesos rápidos a bloques de código, diagramas y fórmulas. */
export function SnippetToolbar({ onInsert }: Props) {
  return (
    <div
      role="toolbar"
      aria-label="Insertar bloques"
      className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      {GROUPS.map((group, index) => (
        <div key={index} className="flex items-center gap-1">
          {group.map((snippet) => (
            <button
              key={snippet.id}
              type="button"
              title={snippet.title}
              aria-label={snippet.title}
              onClick={() => onInsert(snippet)}
              className="cursor-pointer rounded border border-border px-2 py-0.5 font-mono text-xs text-muted transition-colors hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {snippet.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
