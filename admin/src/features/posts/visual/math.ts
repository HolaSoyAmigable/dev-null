import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { installMath, type MarkdownItLike } from "./markdownMath";
import { MathBlockView, MathInlineView } from "./MathViews";

/** Atributo `latex` leído de `data-latex` y escrito de vuelta al renderizar. */
const latexAttribute = {
  latex: {
    default: "",
    parseHTML: (element: HTMLElement) => element.getAttribute("data-latex") ?? "",
    renderHTML: (attributes: { latex?: string }) => ({ "data-latex": attributes.latex ?? "" }),
  },
};

const setup = function (markdownit: unknown) {
  installMath(markdownit as MarkdownItLike);
};

/** Fórmula en línea: `$E = mc^2$`. Con `withView` se edita en el sitio (React); sin él, solo el modelo. */
export function createMathInline(withView = true) {
  return Node.create({
    name: "mathInline",
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,
    addAttributes: () => latexAttribute,
    parseHTML: () => [{ tag: 'span[data-type="math-inline"]' }],
    renderHTML: ({ HTMLAttributes }) => ["span", mergeAttributes({ "data-type": "math-inline" }, HTMLAttributes)],
    ...(withView ? { addNodeView: () => ReactNodeViewRenderer(MathInlineView, { as: "span" }) } : {}),
    addStorage() {
      return {
        markdown: {
          serialize(state: { write: (text: string) => void }, node: { attrs: { latex?: string } }) {
            const latex = node.attrs.latex ?? "";
            if (latex.trim()) state.write(`$${latex}$`);
          },
          parse: { setup },
        },
      };
    },
  });
}

/** Fórmula en bloque: `$$ … $$` en líneas propias. */
export function createMathBlock(withView = true) {
  return Node.create({
    name: "mathBlock",
    group: "block",
    atom: true,
    selectable: true,
    addAttributes: () => latexAttribute,
    parseHTML: () => [{ tag: 'div[data-type="math-block"]' }],
    renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes({ "data-type": "math-block" }, HTMLAttributes)],
    ...(withView ? { addNodeView: () => ReactNodeViewRenderer(MathBlockView) } : {}),
    addStorage() {
      return {
        markdown: {
          serialize(
            state: {
              write: (text: string) => void;
              text: (text: string, escape: boolean) => void;
              ensureNewLine: () => void;
              closeBlock: (node: unknown) => void;
            },
            node: { attrs: { latex?: string } },
          ) {
            const latex = (node.attrs.latex ?? "").trim();
            if (latex) {
              // `text()` aplica la sangría del contenedor (lista, cita) a cada línea, `write()` no.
              state.write("$$\n");
              state.text(latex, false);
              state.ensureNewLine();
              state.write("$$");
            }
            state.closeBlock(node);
          },
          parse: { setup },
        },
      };
    },
  });
}
