import { describe, expect, it } from "vitest";

import { extractToc, headingSlug, splitHighlights } from "./format";

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
