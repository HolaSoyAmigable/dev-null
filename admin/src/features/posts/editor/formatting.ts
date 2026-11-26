/**
 * Operaciones de formato Markdown sobre el texto del editor. Son funciones puras
 * (`valor + selección → edición`): no tocan el DOM y se prueban sin navegador.
 */
import { gaps, type Edit, type Selection } from "./snippets";

// ── Utilidades de líneas ─────────────────────────────────────────────────────

function lineStart(value: string, index: number): number {
  return index <= 0 ? 0 : value.lastIndexOf("\n", index - 1) + 1;
}

function lineEnd(value: string, index: number): number {
  const found = value.indexOf("\n", index);
  return found === -1 ? value.length : found;
}

/** Líneas completas tocadas por la selección (una selección que termina justo tras un salto no cuenta la siguiente). */
function lineRange(value: string, sel: Selection): { start: number; end: number } {
  const end = sel.end > sel.start && value[sel.end - 1] === "\n" ? sel.end - 1 : sel.end;
  return { start: lineStart(value, sel.start), end: lineEnd(value, end) };
}

function mapLines(value: string, sel: Selection, transform: (line: string) => string): Edit {
  const { start, end } = lineRange(value, sel);
  const next = value
    .slice(start, end)
    .split("\n")
    .map((line) => transform(line))
    .join("\n");
  const caret = start + next.length;
  return {
    value: value.slice(0, start) + next + value.slice(end),
    selectionStart: sel.start === sel.end ? caret : start,
    selectionEnd: caret,
  };
}

function insertBlock(value: string, sel: Selection, text: string, select: { from: number; to: number }): Edit {
  const before = value.slice(0, sel.start);
  const after = value.slice(sel.end);
  const { lead, trail } = gaps(before, after);
  const offset = before.length + lead.length;
  return {
    value: `${before}${lead}${text}${trail}${after}`,
    selectionStart: offset + select.from,
    selectionEnd: offset + select.to,
  };
}

// ── Formato en línea ─────────────────────────────────────────────────────────

/** Envuelve la selección con `marker`; si ya estaba envuelta, quita el formato. */
export function toggleInline(value: string, sel: Selection, marker: string, placeholder: string): Edit {
  const size = marker.length;
  const selected = value.slice(sel.start, sel.end);
  const outside =
    value.slice(sel.start - size, sel.start) === marker && value.slice(sel.end, sel.end + size) === marker;
  if (sel.start >= size && outside) {
    return {
      value: value.slice(0, sel.start - size) + selected + value.slice(sel.end + size),
      selectionStart: sel.start - size,
      selectionEnd: sel.end - size,
    };
  }
  if (selected.length >= size * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(size, -size);
    return {
      value: value.slice(0, sel.start) + inner + value.slice(sel.end),
      selectionStart: sel.start,
      selectionEnd: sel.start + inner.length,
    };
  }
  const text = selected || placeholder;
  const start = sel.start + size;
  return {
    value: `${value.slice(0, sel.start)}${marker}${text}${marker}${value.slice(sel.end)}`,
    selectionStart: start,
    selectionEnd: start + text.length,
  };
}

export const toggleBold = (value: string, sel: Selection) => toggleInline(value, sel, "**", "negrita");
export const toggleItalic = (value: string, sel: Selection) => toggleInline(value, sel, "_", "cursiva");
export const toggleStrike = (value: string, sel: Selection) => toggleInline(value, sel, "~~", "tachado");
export const toggleInlineCode = (value: string, sel: Selection) => toggleInline(value, sel, "`", "código");

/** `[texto](url)`; sin `url` deja seleccionado el marcador para escribirla. */
export function insertLink(value: string, sel: Selection, url?: string): Edit {
  const text = value.slice(sel.start, sel.end) || "texto";
  const target = url ?? "https://";
  const head = `[${text}](`;
  const start = sel.start + head.length;
  return {
    value: `${value.slice(0, sel.start)}${head}${target})${value.slice(sel.end)}`,
    // Con URL conocida el cursor queda tras el enlace; si no, se selecciona el marcador.
    selectionStart: url ? start + target.length + 1 : start,
    selectionEnd: url ? start + target.length + 1 : start + target.length,
  };
}

const PLAIN_URL = /^https?:\/\/\S+$/;

/** Pegar una URL sobre texto seleccionado crea el enlace; en otro caso `null` (pegado normal). */
export function pasteAsLink(value: string, sel: Selection, pasted: string): Edit | null {
  const url = pasted.trim();
  if (sel.start === sel.end || !PLAIN_URL.test(url)) return null;
  return insertLink(value, sel, url);
}

// ── Formato de líneas ────────────────────────────────────────────────────────

/** Título de nivel `level` en las líneas seleccionadas; repetirlo lo quita. */
export function setHeading(value: string, sel: Selection, level: 1 | 2 | 3 | 4): Edit {
  const prefix = `${"#".repeat(level)} `;
  const { start, end } = lineRange(value, sel);
  const filled = value
    .slice(start, end)
    .split("\n")
    .filter((line) => line.trim() !== "");
  const active = filled.length > 0 && filled.every((line) => line.startsWith(prefix));
  return mapLines(value, sel, (line) => {
    if (line.trim() === "") return line;
    return active ? line.slice(prefix.length) : prefix + line.replace(/^#{1,6}\s+/, "");
  });
}

export type LineKind = "bullet" | "number" | "task" | "quote";

const LINE_PATTERNS: Record<LineKind, RegExp> = {
  task: /^(\s*)[-*+] \[[ xX]\] /,
  bullet: /^(\s*)[-*+] (?!\[[ xX]\] )/,
  number: /^(\s*)\d+\. /,
  quote: /^(\s*)> ?/,
};
const LIST_KINDS: LineKind[] = ["task", "bullet", "number"];

/** Lista (viñetas, numerada o de tareas) o cita en las líneas seleccionadas; repetirla la quita. */
export function toggleLinePrefix(value: string, sel: Selection, kind: LineKind): Edit {
  const { start, end } = lineRange(value, sel);
  const lines = value.slice(start, end).split("\n");
  const filled = lines.filter((line) => line.trim() !== "");
  const active = filled.length > 0 && filled.every((line) => LINE_PATTERNS[kind].test(line));
  let counter = 0;
  return mapLines(value, sel, (line) => {
    if (line.trim() === "" && lines.length > 1) return line;
    if (active) return line.replace(LINE_PATTERNS[kind], "$1");
    if (kind === "quote") return `> ${line}`;
    // Pasar de un tipo de lista a otro: se retira el marcador anterior.
    const body = LIST_KINDS.reduce((text, other) => text.replace(LINE_PATTERNS[other], "$1"), line);
    const indent = /^\s*/.exec(body)?.[0] ?? "";
    counter += 1;
    const marker = kind === "bullet" ? "- " : kind === "task" ? "- [ ] " : `${counter}. `;
    return `${indent}${marker}${body.slice(indent.length)}`;
  });
}

// ── Bloques ──────────────────────────────────────────────────────────────────

const TABLE = "| Columna 1 | Columna 2 | Columna 3 |\n| --- | --- | --- |\n|  |  |  |";

export function insertTable(value: string, sel: Selection): Edit {
  return insertBlock(value, sel, TABLE, { from: 2, to: "Columna 1".length + 2 });
}

export function insertHorizontalRule(value: string, sel: Selection): Edit {
  return insertBlock(value, sel, "---", { from: 3, to: 3 });
}

// ── Sangría y listas inteligentes ────────────────────────────────────────────

const INDENT = "  ";

/** Tab: sangra las líneas seleccionadas o inserta espacios en el cursor. */
export function indent(value: string, sel: Selection): Edit {
  if (sel.start === sel.end) {
    return {
      value: value.slice(0, sel.start) + INDENT + value.slice(sel.end),
      selectionStart: sel.start + INDENT.length,
      selectionEnd: sel.start + INDENT.length,
    };
  }
  const edit = mapLines(value, sel, (line) => (line === "" ? line : INDENT + line));
  return { ...edit, selectionStart: sel.start + INDENT.length, selectionEnd: edit.selectionEnd };
}

/** Shift+Tab: quita hasta dos espacios (o un tabulador) al inicio de cada línea. */
export function outdent(value: string, sel: Selection): Edit {
  const { start } = lineRange(value, sel);
  const firstLine = value.slice(start, lineEnd(value, start));
  const removed = /^(?: {1,2}|\t)/.exec(firstLine)?.[0].length ?? 0;
  const edit = mapLines(value, sel, (line) => line.replace(/^(?: {1,2}|\t)/, ""));
  const selectionStart = Math.max(start, sel.start - removed);
  return {
    ...edit,
    selectionStart,
    selectionEnd: sel.start === sel.end ? selectionStart : edit.selectionEnd,
  };
}

const LIST_ITEM = /^(\s*)(?:(\d+)\. |([-*+]) (\[[ xX]\] )?|(>) ?)/;

/**
 * Enter dentro de una lista o cita: continúa el elemento (numeración y casillas incluidas).
 * Sobre un elemento vacío lo quita y termina la lista. `null` = comportamiento normal.
 */
export function continueList(value: string, sel: Selection): Edit | null {
  if (sel.start !== sel.end) return null;
  const start = lineStart(value, sel.start);
  const before = value.slice(start, sel.start);
  const match = LIST_ITEM.exec(before);
  if (!match || match[0].length > before.length) return null;

  const end = lineEnd(value, sel.start);
  const content = before.slice(match[0].length) + value.slice(sel.start, end);
  if (content.trim() === "") {
    // Elemento vacío: la lista termina.
    return { value: value.slice(0, start) + value.slice(end), selectionStart: start, selectionEnd: start };
  }

  const indentation = match[1] ?? "";
  const prefix = match[2]
    ? `${indentation}${Number(match[2]) + 1}. `
    : match[3]
      ? `${indentation}${match[3]} ${match[4] ? "[ ] " : ""}`
      : `${indentation}> `;
  const insert = `\n${prefix}`;
  const caret = sel.start + insert.length;
  return {
    value: value.slice(0, sel.start) + insert + value.slice(sel.start),
    selectionStart: caret,
    selectionEnd: caret,
  };
}

// ── Registro de acciones (barra y atajos) ────────────────────────────────────

export type FormatActionId =
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "link"
  | "h2"
  | "h3"
  | "bullet"
  | "number"
  | "task"
  | "quote"
  | "table"
  | "rule";

export type FormatAction = {
  id: FormatActionId;
  label: string;
  /** Texto del atajo para mostrar (usa "Ctrl"; en macOS se lee como ⌘). */
  shortcut?: string;
  run: (value: string, sel: Selection) => Edit;
};

export const FORMAT_ACTIONS: readonly FormatAction[] = [
  { id: "bold", label: "Negrita", shortcut: "Ctrl+B", run: toggleBold },
  { id: "italic", label: "Cursiva", shortcut: "Ctrl+I", run: toggleItalic },
  { id: "strike", label: "Tachado", run: toggleStrike },
  { id: "code", label: "Código en línea", shortcut: "Ctrl+E", run: toggleInlineCode },
  { id: "link", label: "Enlace", shortcut: "Ctrl+K", run: (value, sel) => insertLink(value, sel) },
  { id: "h2", label: "Título 2", run: (value, sel) => setHeading(value, sel, 2) },
  { id: "h3", label: "Título 3", run: (value, sel) => setHeading(value, sel, 3) },
  { id: "bullet", label: "Lista con viñetas", run: (value, sel) => toggleLinePrefix(value, sel, "bullet") },
  { id: "number", label: "Lista numerada", run: (value, sel) => toggleLinePrefix(value, sel, "number") },
  { id: "task", label: "Lista de tareas", run: (value, sel) => toggleLinePrefix(value, sel, "task") },
  { id: "quote", label: "Cita", run: (value, sel) => toggleLinePrefix(value, sel, "quote") },
  { id: "table", label: "Tabla", run: insertTable },
  { id: "rule", label: "Línea separadora", run: insertHorizontalRule },
];

const SHORTCUTS: Record<string, FormatActionId> = { b: "bold", i: "italic", e: "code", k: "link" };

export type KeyInfo = { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean };

/** Acción asociada a un atajo (Ctrl/⌘ + tecla), o `null`. */
export function actionForShortcut(event: KeyInfo): FormatAction | null {
  if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return null;
  const id = SHORTCUTS[event.key.toLowerCase()];
  return FORMAT_ACTIONS.find((action) => action.id === id) ?? null;
}
