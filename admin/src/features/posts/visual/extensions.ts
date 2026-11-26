import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import { Markdown } from "tiptap-markdown";

import { CodeBlockView } from "./CodeBlockView";
import { createMathBlock, createMathInline } from "./math";

const lowlight = createLowlight(common);

/** Las listas de tareas se escriben compactas (sin línea en blanco entre elementos), como las de viñetas. */
const CompactTaskList = TaskList.extend({
  addAttributes() {
    return { ...this.parent?.(), tight: { default: true, parseHTML: () => true, renderHTML: () => ({}) } };
  },
});

/** Bloque de código resaltado; con `withView`, selector de lenguaje y diagramas Mermaid en vivo. */
function createCodeBlock(withView: boolean) {
  const base = withView
    ? CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockView);
        },
      })
    : CodeBlockLowlight;
  return base.configure({ lowlight, defaultLanguage: null });
}

/**
 * Extensiones del editor visual. El documento se guarda como Markdown (`content_md`):
 * solo se incluyen elementos que el blog sabe mostrar y que tienen forma en Markdown.
 * `withViews: false` omite las vistas React (pruebas sin navegador); el modelo es el mismo.
 */
export function createExtensions(placeholder: string, withViews = true) {
  return [
    StarterKit.configure({
      codeBlock: false, // se sustituye por `CodeBlock`
      underline: false, // sin equivalente en Markdown
      heading: { levels: [1, 2, 3, 4] },
      link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow" } },
    }),
    createCodeBlock(withViews),
    Image.configure({ inline: true, allowBase64: false }),
    Placeholder.configure({ placeholder }),
    Table,
    TableRow,
    TableHeader,
    TableCell,
    CompactTaskList,
    TaskItem.configure({ nested: true }),
    createMathInline(withViews),
    createMathBlock(withViews),
    Markdown.configure({
      html: false, // el blog no renderiza HTML en bruto
      tightLists: true,
      bulletListMarker: "-",
      linkify: false,
      breaks: false,
      transformPastedText: true, // pegar Markdown crea el formato
      transformCopiedText: false,
    }),
  ];
}
