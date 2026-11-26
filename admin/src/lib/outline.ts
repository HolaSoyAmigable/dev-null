/** Títulos de un documento Markdown (para el índice del editor). Ignora los bloques de código. */

export type OutlineItem = {
  level: 1 | 2 | 3 | 4;
  text: string;
  /** Posición del inicio de la línea del título en el texto. */
  offset: number;
};

const HEADING = /^(#{1,4})\s+(.+?)\s*#*\s*$/;
const FENCE = /^\s{0,3}(```|~~~)/;

/** Deja el texto legible: sin enlaces, énfasis ni código en línea. */
function plain(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();
}

export function extractOutline(markdown: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  let fence: string | null = null;
  let offset = 0;
  for (const line of markdown.split("\n")) {
    const opening = FENCE.exec(line)?.[1];
    if (opening) {
      if (fence === null) fence = opening;
      else if (fence === opening) fence = null;
    } else if (fence === null) {
      const match = HEADING.exec(line);
      const text = match ? plain(match[2] ?? "") : "";
      if (match && text) {
        items.push({ level: (match[1] ?? "#").length as OutlineItem["level"], text, offset });
      }
    }
    offset += line.length + 1;
  }
  return items;
}
