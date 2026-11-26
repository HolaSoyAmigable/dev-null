import type { Editor } from "@tiptap/core";

type MarkdownStorage = { markdown: { getMarkdown: () => string } };

/** Markdown del documento, sin saltos de línea al final (las tablas y el nodo final los añaden). */
export function readMarkdown(editor: Editor): string {
  return (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown().replace(/\s+$/, "");
}
