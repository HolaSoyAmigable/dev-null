/** Palabras y tiempo de lectura del Markdown; mismo criterio que el backend (posts/service.py). */

const WORDS_PER_MINUTE = 200;
const WORD = /[\p{L}\p{N}_]+/gu;
const CODE_FENCE = /```[\s\S]*?```/g;

export type MarkdownStats = { words: number; minutes: number };

function countWords(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

/** El código se lee a la mitad de velocidad que la prosa. Un texto vacío son 0 min. */
export function markdownStats(markdown: string): MarkdownStats {
  const codeWords = (markdown.match(CODE_FENCE) ?? []).reduce((sum, block) => sum + countWords(block), 0);
  const proseWords = countWords(markdown.replace(CODE_FENCE, " "));
  const words = proseWords + codeWords;
  if (words === 0) return { words: 0, minutes: 0 };
  return { words, minutes: Math.max(1, Math.ceil((proseWords + codeWords / 2) / WORDS_PER_MINUTE)) };
}

export function formatStats({ words, minutes }: MarkdownStats): string {
  const count = new Intl.NumberFormat("es-MX").format(words);
  return `${count} ${words === 1 ? "palabra" : "palabras"} • ${minutes} min de lectura`;
}
