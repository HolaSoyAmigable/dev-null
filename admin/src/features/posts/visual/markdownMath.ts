/**
 * Reglas de markdown-it para fórmulas: `$…$` en línea y `$$ … $$` en bloque.
 *
 * `tiptap-markdown` convierte el Markdown a HTML con markdown-it antes de cargarlo en el editor.
 * Estas reglas emiten un `<span>`/`<div>` con el LaTeX en `data-latex`, que los nodos
 * `mathInline` y `mathBlock` reconocen. Sin ellas el LaTeX se leería como texto y los `_` o `\`
 * se escaparían al volver a Markdown, rompiendo las fórmulas.
 *
 * Los tipos son mínimos a propósito: markdown-it llega como dependencia de `tiptap-markdown`.
 */

type InlineState = {
  src: string;
  pos: number;
  push: (type: string, tag: string, nesting: number) => { content: string };
};

type BlockState = {
  src: string;
  bMarks: number[];
  eMarks: number[];
  tShift: number[];
  sCount: number[];
  blkIndent: number;
  line: number;
  push: (type: string, tag: string, nesting: number) => {
    content: string;
    map: [number, number] | null;
    block: boolean;
  };
};

export type MarkdownItLike = {
  inline: {
    ruler: { before: (before: string, name: string, rule: (state: InlineState, silent: boolean) => boolean) => void };
  };
  block: {
    ruler: {
      before: (
        before: string,
        name: string,
        rule: (state: BlockState, start: number, end: number, silent: boolean) => boolean,
        options?: { alt: string[] },
      ) => void;
    };
  };
  renderer: { rules: Record<string, (tokens: { content: string }[], index: number) => string> };
  utils: { escapeHtml: (text: string) => string };
};

const DOLLAR = 0x24;
const BACKSLASH = 0x5c;
const isSpace = (code: number) => code === 0x20 || code === 0x09 || code === 0x0a;
const isDigit = (code: number) => code >= 0x30 && code <= 0x39;

/** `$E = mc^2$`. Sigue la regla de Pandoc: sin espacios pegados a los `$` y sin cifra tras el cierre (`$5 y $10` no es fórmula). */
function inlineMath(state: InlineState, silent: boolean): boolean {
  const { src, pos } = state;
  if (src.charCodeAt(pos) !== DOLLAR || src.charCodeAt(pos + 1) === DOLLAR) return false;
  const first = src.charCodeAt(pos + 1);
  if (Number.isNaN(first) || isSpace(first)) return false;

  let end = pos + 1;
  for (;;) {
    end = src.indexOf("$", end);
    if (end === -1) return false;
    if (src.charCodeAt(end - 1) === BACKSLASH) end += 1; // `\$` no cierra
    else break;
  }
  if (end === pos + 1 || isSpace(src.charCodeAt(end - 1)) || isDigit(src.charCodeAt(end + 1))) return false;

  if (!silent) state.push("math_inline", "", 0).content = src.slice(pos + 1, end);
  state.pos = end + 1;
  return true;
}

/** Bloque `$$ … $$` en una o varias líneas. */
function blockMath(state: BlockState, startLine: number, endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false; // sangría de código
  const start = state.bMarks[startLine]! + state.tShift[startLine]!;
  if (state.src.slice(start, start + 2) !== "$$") return false;

  const firstLine = state.src.slice(start + 2, state.eMarks[startLine]);
  let content: string;
  let last = startLine;
  let found = false;

  if (firstLine.trim().endsWith("$$")) {
    content = firstLine.trim().slice(0, -2);
    found = true;
  } else {
    content = firstLine ? `${firstLine}\n` : "";
    for (last = startLine + 1; last < endLine; last += 1) {
      const line = state.src.slice(state.bMarks[last]! + state.tShift[last]!, state.eMarks[last]);
      if (line.trim().endsWith("$$")) {
        content += line.slice(0, line.lastIndexOf("$$"));
        found = true;
        break;
      }
      content += `${line}\n`;
    }
  }
  if (!found) return false;
  if (silent) return true;

  state.line = last + 1;
  const token = state.push("math_block", "", 0);
  token.content = content.trim();
  token.map = [startLine, state.line];
  token.block = true;
  return true;
}

/** Registra las reglas en una instancia de markdown-it (`parse.setup` de los nodos de fórmula). */
export function installMath(md: MarkdownItLike): void {
  const flag = "__devnullMath";
  const marked = md as MarkdownItLike & Record<string, boolean>;
  if (marked[flag]) return; // dos nodos comparten la instancia: se instala una sola vez
  marked[flag] = true;

  md.inline.ruler.before("escape", "math_inline", inlineMath);
  md.block.ruler.before("fence", "math_block", blockMath, { alt: ["paragraph", "reference", "blockquote", "list"] });
  md.renderer.rules.math_inline = (tokens, index) =>
    `<span data-type="math-inline" data-latex="${md.utils.escapeHtml(tokens[index]!.content)}"></span>`;
  md.renderer.rules.math_block = (tokens, index) =>
    `<div data-type="math-block" data-latex="${md.utils.escapeHtml(tokens[index]!.content)}"></div>\n`;
}
