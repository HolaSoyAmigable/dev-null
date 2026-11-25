import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearDraft,
  draftKey,
  findRestorableDraft,
  readDraft,
  useDraftAutosave,
  writeDraft,
} from "@/features/posts/editor/draft";
import {
  altFromFilename,
  imageMarkdown,
  insertAtSelection,
  insertCodeBlock,
  insertMathBlock,
  replacePlaceholder,
} from "@/features/posts/editor/snippets";
import { formatStats, markdownStats } from "@/lib/markdownStats";

describe("markdownStats", () => {
  it("cuenta palabras y tiempo de lectura igual que el backend", () => {
    expect(markdownStats("")).toEqual({ words: 0, minutes: 0 });
    expect(markdownStats("Hola mundo")).toEqual({ words: 2, minutes: 1 });
    const prose = "palabra ".repeat(450);
    expect(markdownStats(prose)).toEqual({ words: 450, minutes: 3 });
  });

  it("el código cuenta a mitad de velocidad", () => {
    const code = "```ts\n" + "const x = 1; ".repeat(100) + "\n```";
    const stats = markdownStats(`${"palabra ".repeat(100)}\n\n${code}`);
    // El lenguaje de la valla (`ts`) cuenta como palabra, igual que en el backend.
    expect(stats.words).toBe(100 + 301);
    // 100 prosa + 301/2 de código ≈ 250 → 2 min
    expect(stats.minutes).toBe(2);
  });

  it("da formato en español", () => {
    expect(formatStats({ words: 450, minutes: 3 })).toBe("450 palabras • 3 min de lectura");
    expect(formatStats({ words: 1, minutes: 1 })).toBe("1 palabra • 1 min de lectura");
  });
});

describe("snippets", () => {
  it("inserta un bloque de código vacío con el cursor dentro", () => {
    const edit = insertCodeBlock("Texto", { start: 5, end: 5 }, "ts");
    expect(edit.value).toBe("Texto\n\n```ts\n\n```\n");
    expect(edit.selectionStart).toBe(edit.selectionEnd);
    expect(edit.value.slice(edit.selectionStart - 6, edit.selectionStart)).toBe("```ts\n");
  });

  it("envuelve la selección", () => {
    const edit = insertCodeBlock("antes código después", { start: 6, end: 12 }, "py");
    expect(edit.value).toBe("antes \n\n```py\ncódigo\n```\n\n después");
    expect(edit.value.slice(edit.selectionStart, edit.selectionEnd)).toBe("código");
  });

  it("no duplica líneas en blanco", () => {
    expect(insertCodeBlock("", { start: 0, end: 0 }, "sql").value).toBe("```sql\n\n```\n");
    expect(insertCodeBlock("a\n\n", { start: 3, end: 3 }, "bash").value).toBe("a\n\n```bash\n\n```\n");
  });

  it("mermaid trae una plantilla seleccionada y las fórmulas usan $$", () => {
    const diagram = insertCodeBlock("", { start: 0, end: 0 }, "mermaid");
    expect(diagram.value).toContain("```mermaid\nflowchart TD");
    expect(diagram.value.slice(diagram.selectionStart, diagram.selectionEnd)).toContain("A[Inicio]");
    expect(insertMathBlock("", { start: 0, end: 0 }).value).toBe("$$\n\n$$\n");
  });

  it("inserta imágenes en el cursor y reemplaza marcadores", () => {
    expect(imageMarkdown("a [b]", "/media/x.png")).toBe("![a b](/media/x.png)");
    const edit = insertAtSelection("ab", { start: 1, end: 1 }, "![x](/u)");
    expect(edit.value).toBe("a![x](/u)b");
    expect(edit.selectionStart).toBe(1 + "![x](/u)".length);
    expect(replacePlaceholder("a ![Subiendo…]() b", "![Subiendo…]()", "![ok](/u)")).toBe("a ![ok](/u) b");
    expect(replacePlaceholder("sin marcador", "![x]()", "y")).toBe("sin marcador");
    expect(altFromFilename("mi-captura_1.png")).toBe("mi captura 1");
    expect(altFromFilename("image.png")).toBe("");
  });
});

describe("borradores locales", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("guarda, lee y borra", () => {
    const key = draftKey(7);
    expect(key).toBe("devnull:draft:post:7");
    expect(draftKey()).toBe("devnull:draft:post:new");
    expect(writeDraft(key, { values: { a: 1 }, savedAt: "2026-01-01T00:00:00.000Z", baseUpdatedAt: null })).toBe(true);
    expect(readDraft<{ a: number }>(key)?.values).toEqual({ a: 1 });
    clearDraft(key);
    expect(readDraft(key)).toBeNull();
  });

  it("ignora datos corruptos", () => {
    window.localStorage.setItem("k", "{no es json");
    expect(readDraft("k")).toBeNull();
    window.localStorage.setItem("k", JSON.stringify({ values: 1 }));
    expect(readDraft("k")).toBeNull();
  });

  it("solo ofrece restaurar un borrador distinto y más reciente que el servidor", () => {
    const key = draftKey(1);
    const draft = { values: { t: "nuevo" }, savedAt: "2026-06-02T00:00:00.000Z", baseUpdatedAt: null };
    writeDraft(key, draft);
    expect(findRestorableDraft(key, { t: "nuevo" }, null)).toBeNull();
    expect(findRestorableDraft(key, { t: "viejo" }, "2026-06-01T00:00:00.000Z")?.values).toEqual({ t: "nuevo" });
    expect(findRestorableDraft(key, { t: "viejo" }, "2026-06-03T00:00:00.000Z")).toBeNull();
  });
});

describe("useDraftAutosave", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("guarda cada intervalo solo si hay cambios sin guardar", () => {
    const key = draftKey(3);
    const { result, rerender } = renderHook((props: { dirty: boolean; text: string }) =>
      useDraftAutosave({ storageKey: key, values: { text: props.text }, dirty: props.dirty, baseUpdatedAt: "u" }),
      { initialProps: { dirty: false, text: "a" } },
    );

    act(() => void vi.advanceTimersByTime(30_000));
    expect(readDraft(key)).toBeNull();
    expect(result.current.status).toBe("idle");

    rerender({ dirty: true, text: "b" });
    act(() => void vi.advanceTimersByTime(30_000));
    expect(readDraft<{ text: string }>(key)?.values).toEqual({ text: "b" });
    expect(readDraft(key)?.baseUpdatedAt).toBe("u");
    expect(result.current.status).toBe("saved");
    expect(result.current.savedAt).toBeInstanceOf(Date);

    act(() => result.current.discard());
    expect(readDraft(key)).toBeNull();
    expect(result.current.status).toBe("idle");
  });
});
