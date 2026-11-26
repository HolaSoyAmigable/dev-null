import { describe, expect, it } from "vitest";

import {
  actionForShortcut,
  continueList,
  FORMAT_ACTIONS,
  indent,
  insertHorizontalRule,
  insertLink,
  insertTable,
  outdent,
  pasteAsLink,
  setHeading,
  toggleBold,
  toggleInline,
  toggleItalic,
  toggleLinePrefix,
} from "@/features/posts/editor/formatting";

const at = (start: number, end = start) => ({ start, end });
const picked = (edit: { value: string; selectionStart: number; selectionEnd: number }) =>
  edit.value.slice(edit.selectionStart, edit.selectionEnd);

describe("formato en línea", () => {
  it("envuelve la selección y la deja seleccionada", () => {
    const edit = toggleBold("hola mundo", at(5, 10));
    expect(edit.value).toBe("hola **mundo**");
    expect(picked(edit)).toBe("mundo");
  });

  it("sin selección inserta un marcador de posición seleccionado", () => {
    const edit = toggleItalic("a ", at(2));
    expect(edit.value).toBe("a _cursiva_");
    expect(picked(edit)).toBe("cursiva");
  });

  it("repetir el formato lo quita (marcadores fuera o dentro de la selección)", () => {
    const outside = toggleBold("hola **mundo**", at(7, 12));
    expect(outside.value).toBe("hola mundo");
    expect(picked(outside)).toBe("mundo");

    const inside = toggleBold("hola **mundo**", at(5, 14));
    expect(inside.value).toBe("hola mundo");
    expect(picked(inside)).toBe("mundo");
  });

  it("la cursiva no confunde la negrita", () => {
    const edit = toggleItalic("**x**", at(2, 3));
    expect(edit.value).toBe("**_x_**");
  });

  it("código en línea y tachado", () => {
    expect(toggleInline("a b", at(2, 3), "`", "código").value).toBe("a `b`");
    expect(toggleInline("a b", at(2, 3), "~~", "tachado").value).toBe("a ~~b~~");
  });
});

describe("enlaces", () => {
  it("con selección usa el texto y selecciona la URL por escribir", () => {
    const edit = insertLink("ver docs aquí", at(4, 8));
    expect(edit.value).toBe("ver [docs](https://) aquí");
    expect(picked(edit)).toBe("https://");
  });

  it("sin selección crea un enlace de ejemplo", () => {
    expect(insertLink("", at(0)).value).toBe("[texto](https://)");
  });

  it("pegar una URL sobre una selección crea el enlace", () => {
    const edit = pasteAsLink("ver docs", at(4, 8), " https://ejemplo.com/a?b=1 ");
    expect(edit?.value).toBe("ver [docs](https://ejemplo.com/a?b=1)");
    expect(edit?.selectionStart).toBe(edit?.value.length);
  });

  it("no intercepta el pegado normal", () => {
    expect(pasteAsLink("hola", at(0), "https://x.com")).toBeNull(); // sin selección
    expect(pasteAsLink("hola", at(0, 4), "no es una url")).toBeNull();
    expect(pasteAsLink("hola", at(0, 4), "https://x.com con texto")).toBeNull();
  });
});

describe("títulos", () => {
  it("añade, cambia y quita el título de la línea", () => {
    expect(setHeading("Intro", at(2), 2).value).toBe("## Intro");
    expect(setHeading("# Intro", at(2), 2).value).toBe("## Intro");
    expect(setHeading("## Intro", at(2), 2).value).toBe("Intro");
  });

  it("solo afecta a las líneas seleccionadas", () => {
    const value = "uno\ndos\ntres";
    expect(setHeading(value, at(4, 7), 3).value).toBe("uno\n### dos\ntres");
  });
});

describe("listas y citas", () => {
  it("convierte líneas en viñetas, numeradas y tareas, y revierte", () => {
    const value = "a\nb\nc";
    const bullets = toggleLinePrefix(value, at(0, value.length), "bullet");
    expect(bullets.value).toBe("- a\n- b\n- c");
    expect(toggleLinePrefix(bullets.value, at(0, bullets.value.length), "bullet").value).toBe(value);

    expect(toggleLinePrefix(value, at(0, value.length), "number").value).toBe("1. a\n2. b\n3. c");
    expect(toggleLinePrefix(value, at(0, value.length), "task").value).toBe("- [ ] a\n- [ ] b\n- [ ] c");
  });

  it("pasar de un tipo de lista a otro no duplica marcadores", () => {
    const edit = toggleLinePrefix("- a\n- b", at(0, 7), "number");
    expect(edit.value).toBe("1. a\n2. b");
    expect(toggleLinePrefix("- [ ] a", at(0, 7), "bullet").value).toBe("- a");
  });

  it("las líneas vacías no reciben marcador", () => {
    expect(toggleLinePrefix("a\n\nb", at(0, 4), "bullet").value).toBe("- a\n\n- b");
  });

  it("citas", () => {
    expect(toggleLinePrefix("a\nb", at(0, 3), "quote").value).toBe("> a\n> b");
    expect(toggleLinePrefix("> a\n> b", at(0, 7), "quote").value).toBe("a\nb");
  });
});

describe("bloques", () => {
  it("inserta una tabla con la primera cabecera seleccionada", () => {
    const edit = insertTable("Texto", at(5));
    expect(edit.value.startsWith("Texto\n\n| Columna 1 |")).toBe(true);
    expect(edit.value).toContain("| --- | --- | --- |");
    expect(picked(edit)).toBe("Columna 1");
  });

  it("inserta una línea separadora aislada", () => {
    expect(insertHorizontalRule("a", at(1)).value).toBe("a\n\n---\n");
  });
});

describe("sangría", () => {
  it("Tab en el cursor inserta dos espacios", () => {
    const edit = indent("ab", at(1));
    expect(edit.value).toBe("a  b");
    expect(edit.selectionStart).toBe(3);
  });

  it("Tab con varias líneas seleccionadas las sangra todas", () => {
    const edit = indent("a\nb", at(0, 3));
    expect(edit.value).toBe("  a\n  b");
  });

  it("Shift+Tab quita la sangría", () => {
    expect(outdent("  a\n  b", at(0, 7)).value).toBe("a\nb");
    expect(outdent("    a", at(5)).value).toBe("  a");
    expect(outdent("a", at(1)).value).toBe("a");
  });
});

describe("Enter en listas", () => {
  it("continúa viñetas, numeración, tareas y citas", () => {
    const bullet = continueList("- uno", at(5));
    expect(bullet?.value).toBe("- uno\n- ");
    expect(bullet?.selectionStart).toBe(bullet?.value.length);

    expect(continueList("1. uno", at(6))?.value).toBe("1. uno\n2. ");
    expect(continueList("- [x] hecho", at(11))?.value).toBe("- [x] hecho\n- [ ] ");
    expect(continueList("> cita", at(6))?.value).toBe("> cita\n> ");
    expect(continueList("  - anidado", at(12))?.value).toBe("  - anidado\n  - ");
  });

  it("mantiene el texto posterior al cursor en el nuevo elemento", () => {
    expect(continueList("- uno dos", at(5))?.value).toBe("- uno\n-  dos");
  });

  it("un elemento vacío termina la lista", () => {
    const edit = continueList("- uno\n- ", at(8));
    expect(edit?.value).toBe("- uno\n");
    expect(edit?.selectionStart).toBe(6);
  });

  it("no actúa fuera de listas, con selección ni antes del marcador", () => {
    expect(continueList("texto", at(5))).toBeNull();
    expect(continueList("- uno", at(0, 5))).toBeNull();
    expect(continueList("- uno", at(1))).toBeNull();
  });
});

describe("atajos y registro de acciones", () => {
  const key = (k: string, extra = {}) => ({ key: k, ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, ...extra });

  it("mapea Ctrl/⌘ + B, I, E, K", () => {
    expect(actionForShortcut(key("b"))?.id).toBe("bold");
    expect(actionForShortcut(key("I"))?.id).toBe("italic");
    expect(actionForShortcut(key("e"))?.id).toBe("code");
    expect(actionForShortcut(key("k", { ctrlKey: false, metaKey: true }))?.id).toBe("link");
  });

  it("ignora otras combinaciones", () => {
    expect(actionForShortcut(key("b", { ctrlKey: false }))).toBeNull();
    expect(actionForShortcut(key("b", { shiftKey: true }))).toBeNull();
    expect(actionForShortcut(key("z"))).toBeNull();
  });

  it("todas las acciones del registro producen una edición válida", () => {
    for (const action of FORMAT_ACTIONS) {
      const edit = action.run("texto de prueba", at(0, 5));
      expect(typeof edit.value, action.id).toBe("string");
      expect(edit.selectionStart, action.id).toBeGreaterThanOrEqual(0);
      expect(edit.selectionEnd, action.id).toBeGreaterThanOrEqual(edit.selectionStart);
    }
  });
});
