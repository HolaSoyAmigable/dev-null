import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { createExtensions } from "@/features/posts/visual/extensions";
import { readMarkdown } from "@/features/posts/visual/markdownIO";

let current: Editor | null = null;

function open(markdown: string): Editor {
  current?.destroy();
  current = new Editor({ element: document.createElement("div"), extensions: createExtensions("", false), content: markdown });
  return current;
}

const md = readMarkdown;

/** Carga el Markdown en el editor y lo vuelve a obtener. */
const roundTrip = (markdown: string) => md(open(markdown));

afterEach(() => {
  current?.destroy();
  current = null;
});

describe("ida y vuelta de Markdown (editor visual)", () => {
  it("conserva el texto con formato, títulos y listas", () => {
    const source = [
      "# Título",
      "",
      "Texto con **negrita**, *cursiva*, ~~tachado~~ y `código`.",
      "",
      "## Lista",
      "",
      "- uno",
      "- dos",
      "",
      "1. primero",
      "2. segundo",
      "",
      "> una cita",
    ].join("\n");
    expect(roundTrip(source)).toBe(source);
  });

  it("conserva enlaces, imágenes y listas de tareas", () => {
    const source = [
      "Ver [la documentación](https://ejemplo.com/docs) y ![diagrama](/media/2026/11/a.png).",
      "",
      "- [ ] pendiente",
      "- [x] hecho",
    ].join("\n");
    expect(roundTrip(source)).toBe(source);
  });

  it("conserva tablas GFM", () => {
    const source = ["| Nombre | Valor |", "| --- | --- |", "| a | 1 |", "| b | 2 |"].join("\n");
    expect(roundTrip(source)).toBe(source);
  });

  it("conserva bloques de código con su lenguaje y su contenido literal", () => {
    const source = ["```ts", "const a: number = 1; // **no es negrita** $no_es_formula$", "```", "", "```bash", "echo $$", "```"].join("\n");
    expect(roundTrip(source)).toBe(source);
  });

  it("conserva los bloques mermaid como código", () => {
    const source = ["```mermaid", "flowchart LR", "  A[Inicio] --> B[Fin]", "```"].join("\n");
    expect(roundTrip(source)).toBe(source);
  });
});

describe("fórmulas", () => {
  it("lee y escribe fórmulas en línea sin escapar el LaTeX", () => {
    const source = "La energía $E = mc^2$ y $x_1 + \\alpha$ en línea.";
    const editor = open(source);
    const latex: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === "mathInline") latex.push(node.attrs.latex);
    });
    expect(latex).toEqual(["E = mc^2", "x_1 + \\alpha"]);
    expect(md(editor)).toBe(source);
  });

  it("lee y escribe fórmulas en bloque de varias líneas", () => {
    const source = ["$$", "\\int_0^1 x\\,dx = \\frac{1}{2}", "$$"].join("\n");
    const editor = open(source);
    const blocks = editor.state.doc.content.childCount;
    expect(editor.state.doc.firstChild?.type.name).toBe("mathBlock");
    expect(blocks).toBe(1);
    expect(md(editor)).toBe(source);
  });

  it("acepta la fórmula en bloque en una sola línea", () => {
    const editor = open("$$ a^2 + b^2 = c^2 $$");
    expect(editor.state.doc.firstChild?.attrs.latex).toBe("a^2 + b^2 = c^2");
    expect(md(editor)).toBe("$$\na^2 + b^2 = c^2\n$$");
  });

  it("no confunde importes de dinero con fórmulas", () => {
    const source = "Cuesta $5 y luego $10 en total.";
    const editor = open(source);
    let formulas = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "mathInline") formulas += 1;
    });
    expect(formulas).toBe(0);
  });

  it("las fórmulas dentro de bloques de código siguen siendo texto", () => {
    const editor = open("```py\nprecio = '$x$'\n```");
    let formulas = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name.startsWith("math")) formulas += 1;
    });
    expect(formulas).toBe(0);
  });
});

describe("bloques anidados", () => {
  it("una fórmula en bloque dentro de una lista conserva la sangría en todas sus líneas", () => {
    const source = ["- elemento", "", "  $$", "  \\int_0^1 x\\,dx", "  $$"].join("\n");
    const editor = open(source);
    let latex = "";
    editor.state.doc.descendants((node) => {
      if (node.type.name === "mathBlock") latex = node.attrs.latex;
    });
    expect(latex).toBe("\\int_0^1 x\\,dx");
    expect(md(editor)).toBe(source);
  });

  it("un diagrama dentro de una lista se escribe con sangría", () => {
    const source = ["- paso", "", "  ```mermaid", "  flowchart TD", "    A --> B", "  ```"].join("\n");
    expect(roundTrip(source)).toBe(source);
  });
});

describe("edición desde la barra de herramientas", () => {
  it("negrita, títulos y listas producen el Markdown esperado", () => {
    const editor = open("hola mundo");
    editor.chain().selectAll().toggleBold().run();
    expect(md(editor)).toBe("**hola mundo**");

    editor.chain().selectAll().toggleBold().toggleHeading({ level: 2 }).run();
    expect(md(editor)).toBe("## hola mundo");

    // El cursor dentro del texto basta para cambiar el tipo del bloque.
    editor.chain().setTextSelection(3).toggleHeading({ level: 2 }).toggleBulletList().run();
    expect(md(editor)).toBe("- hola mundo");
  });

  it("inserta una tabla, una fórmula y un diagrama", () => {
    const editor = open("");
    editor.chain().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
    expect(md(editor)).toContain("| --- | --- |");

    const math = open("");
    math.chain().insertContent({ type: "mathBlock", attrs: { latex: "a+b" } }).run();
    expect(md(math)).toBe("$$\na+b\n$$");

    const diagram = open("");
    diagram
      .chain()
      .insertContent({ type: "codeBlock", attrs: { language: "mermaid" }, content: [{ type: "text", text: "flowchart TD\n  A --> B" }] })
      .run();
    expect(md(diagram)).toBe("```mermaid\nflowchart TD\n  A --> B\n```");
  });

  it("no genera marcas que el blog no entiende (subrayado)", () => {
    const editor = open("texto");
    expect(editor.schema.marks.underline).toBeUndefined();
  });
});

describe("normalización", () => {
  it("el texto equivalente se escribe de forma canónica", () => {
    // Documentado: al editar, el Markdown se reescribe (p. ej. `_cursiva_` pasa a `*cursiva*`).
    expect(roundTrip("_cursiva_ y __negrita__")).toBe("*cursiva* y **negrita**");
  });
});
