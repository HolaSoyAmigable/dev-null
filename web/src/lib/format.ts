const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const monthFormatter = new Intl.DateTimeFormat("es-MX", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const GITHUB_REPO = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;

/** URL del repositorio a partir de `usuario/repositorio`; `null` si el formato no es el esperado. */
export function githubRepoUrl(repo: string | null | undefined): string | null {
  return repo && GITHUB_REPO.test(repo) ? `https://github.com/${repo}` : null;
}

/** "Parte 2 · Mi proyecto" para posts dentro de la bitácora de un proyecto. */
export function seriesLabel(post: {
  series_order?: number | null;
  project?: { name: string } | null;
}): string | null {
  return post.project && post.series_order ? `Parte ${post.series_order} · ${post.project.name}` : null;
}

export function formatDate(value: string | null | undefined): string {
  return value ? dateFormatter.format(new Date(value)) : "";
}

/** Fechas tipo `date` (YYYY-MM-DD) como "ene 2024". */
export function formatMonth(value: string | null | undefined): string {
  return value ? monthFormatter.format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : "";
}

export function siteUrl(path = ""): string {
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

/** Slug para anclas de encabezados (mismo algoritmo para la TOC y los <h2>/<h3>). */
export function headingSlug(text: string): string {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "seccion"
  );
}

export type TocItem = { id: string; text: string; level: 2 | 3 };

/** Extrae los encabezados ## y ### del Markdown (ignorando bloques de código). */
export function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const seen = new Map<string, number>();
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const text = match[2]!.replace(/[*_`~]|\[(.*?)\]\(.*?\)/g, "$1").trim();
    items.push({ id: uniqueId(headingSlug(text), seen), text, level: match[1]!.length as 2 | 3 });
  }
  return items;
}

export function uniqueId(base: string, seen: Map<string, number>): string {
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

/** Divide un fragmento con <mark> en partes seguras para renderizar como texto. */
export function splitHighlights(snippet: string): { text: string; mark: boolean }[] {
  const parts: { text: string; mark: boolean }[] = [];
  const regex = /<mark>(.*?)<\/mark>/gs;
  let last = 0;
  for (const match of snippet.matchAll(regex)) {
    if (match.index > last) parts.push({ text: snippet.slice(last, match.index), mark: false });
    parts.push({ text: match[1] ?? "", mark: true });
    last = match.index + match[0].length;
  }
  if (last < snippet.length) parts.push({ text: snippet.slice(last), mark: false });
  // Quita cualquier resto de HTML/Markdown del contenido original.
  return parts.map((p) => ({ ...p, text: p.text.replace(/<[^>]*>/g, "").replace(/[#*`>_]/g, "") }));
}
