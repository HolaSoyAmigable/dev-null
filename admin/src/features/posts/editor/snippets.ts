/** Inserción de bloques y de imágenes en el textarea (funciones puras, sin DOM). */

export type Snippet = { id: string; label: string; title: string };

export const CODE_SNIPPETS: readonly Snippet[] = [
  { id: "ts", label: "ts", title: "Bloque de código TypeScript" },
  { id: "kt", label: "kt", title: "Bloque de código Kotlin" },
  { id: "py", label: "py", title: "Bloque de código Python" },
  { id: "sql", label: "sql", title: "Bloque de código SQL" },
  { id: "bash", label: "bash", title: "Bloque de código Bash" },
];

export const DIAGRAM_SNIPPET: Snippet = { id: "mermaid", label: "mermaid", title: "Diagrama Mermaid" };
export const MATH_SNIPPET: Snippet = { id: "math", label: "$$", title: "Fórmula en bloque (LaTeX)" };

export type Selection = { start: number; end: number };
export type Edit = { value: string; selectionStart: number; selectionEnd: number };

const FENCE = "```";
const MERMAID_TEMPLATE = "flowchart TD\n  A[Inicio] --> B[Fin]";

/** Separa el bloque del texto vecino con líneas en blanco, como exige Markdown. */
export function gaps(before: string, after: string): { lead: string; trail: string } {
  const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trail = after === "" ? "\n" : after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  return { lead, trail };
}

function block(value: string, sel: Selection, open: string, close: string, placeholder: string): Edit {
  const before = value.slice(0, sel.start);
  const after = value.slice(sel.end);
  const selected = value.slice(sel.start, sel.end);
  const body = selected || placeholder;
  const { lead, trail } = gaps(before, after);
  const head = `${lead}${open}\n`;
  const next = `${before}${head}${body}\n${close}${trail}${after}`;
  const bodyStart = before.length + head.length;
  // Sin selección y sin plantilla, el cursor queda dentro del bloque vacío.
  return { value: next, selectionStart: bodyStart, selectionEnd: bodyStart + body.length };
}

/** Inserta un bloque con valla y lenguaje; si hay texto seleccionado, lo envuelve. */
export function insertCodeBlock(value: string, sel: Selection, language: string): Edit {
  const placeholder = language === "mermaid" ? MERMAID_TEMPLATE : "";
  return block(value, sel, `${FENCE}${language}`, FENCE, placeholder);
}

/** Inserta un bloque de fórmula `$$ … $$`. */
export function insertMathBlock(value: string, sel: Selection): Edit {
  return block(value, sel, "$$", "$$", "");
}

export function insertSnippet(value: string, sel: Selection, snippet: Snippet): Edit {
  return snippet.id === MATH_SNIPPET.id
    ? insertMathBlock(value, sel)
    : insertCodeBlock(value, sel, snippet.id);
}

export function imageMarkdown(alt: string, url: string): string {
  return `![${alt.replace(/[[\]]/g, "")}](${url})`;
}

/** Inserta `text` en el cursor (reemplazando la selección) y deja el cursor después. */
export function insertAtSelection(value: string, sel: Selection, text: string): Edit {
  const next = value.slice(0, sel.start) + text + value.slice(sel.end);
  const caret = sel.start + text.length;
  return { value: next, selectionStart: caret, selectionEnd: caret };
}

/** Sustituye la primera aparición de `placeholder` (p. ej. al terminar una subida). */
export function replacePlaceholder(value: string, placeholder: string, replacement: string): string {
  const index = value.indexOf(placeholder);
  if (index === -1) return value;
  return value.slice(0, index) + replacement + value.slice(index + placeholder.length);
}

/** Alt legible a partir del nombre del archivo (`mi-captura_1.png` → `mi captura 1`). */
export function altFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return /^(image|imagen|captura|screenshot)$/i.test(base) ? "" : base;
}
