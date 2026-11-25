import { describe, expect, it } from "vitest";

import { extractToc, githubRepoUrl, headingSlug, seriesLabel, splitHighlights } from "./format";

describe("githubRepoUrl", () => {
  it("construye la URL solo con un formato válido", () => {
    expect(githubRepoUrl("HolaSoyAmigable/dev-null")).toBe("https://github.com/HolaSoyAmigable/dev-null");
    expect(githubRepoUrl("usuario/repo.js")).toBe("https://github.com/usuario/repo.js");
    expect(githubRepoUrl("javascript:alert(1)")).toBeNull();
    expect(githubRepoUrl("a/b/c")).toBeNull();
    expect(githubRepoUrl("")).toBeNull();
    expect(githubRepoUrl(null)).toBeNull();
  });
});

describe("seriesLabel", () => {
  it("solo existe con proyecto y orden", () => {
    expect(seriesLabel({ series_order: 2, project: { name: "devnull" } })).toBe("Parte 2 · devnull");
    expect(seriesLabel({ series_order: null, project: { name: "devnull" } })).toBeNull();
    expect(seriesLabel({ series_order: 2, project: null })).toBeNull();
  });
});

describe("extractToc", () => {
  it("extrae ## y ### con ids únicos e ignora código", () => {
    const md = [
      "# Título",
      "## Introducción",
      "texto",
      "```bash",
      "## no es un encabezado",
      "```",
      "### Paso **uno**",
      "## Introducción",
    ].join("\n");
    expect(extractToc(md)).toEqual([
      { id: "introduccion", text: "Introducción", level: 2 },
      { id: "paso-uno", text: "Paso uno", level: 3 },
      { id: "introduccion-1", text: "Introducción", level: 2 },
    ]);
  });
});

describe("headingSlug", () => {
  it("normaliza acentos y símbolos", () => {
    expect(headingSlug("¿Qué es /dev/null?")).toBe("que-es-dev-null");
  });
});

describe("splitHighlights", () => {
  it("convierte <mark> en partes y elimina cualquier otro HTML", () => {
    expect(splitHighlights("hola <mark>mundo</mark> <script>x</script>")).toEqual([
      { text: "hola ", mark: false },
      { text: "mundo", mark: true },
      { text: " x", mark: false },
    ]);
  });
});
