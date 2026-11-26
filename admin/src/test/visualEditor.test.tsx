import type { Editor } from "@tiptap/core";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { normalizeHref } from "@/features/posts/visual/LinkBar";
import { insertBlock } from "@/features/posts/visual/VisualToolbar";
import VisualEditor from "@/features/posts/visual/VisualEditor";
import { createExtensions } from "@/features/posts/visual/extensions";
import { readMarkdown } from "@/features/posts/visual/markdownIO";
import { Editor as TipTapEditor } from "@tiptap/core";

const upload = vi.hoisted(() => ({ mutateAsync: vi.fn() }));
vi.mock("@/api/hooks", () => ({ useMediaMutations: () => ({ upload }) }));

beforeAll(() => {
  // ProseMirror consulta geometría al mover la selección; jsdom no la implementa.
  const rect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) } as DOMRect;
  Range.prototype.getBoundingClientRect = () => rect;
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
  document.elementFromPoint = () => null;
});

function setup(value: string) {
  const onChange = vi.fn();
  let editor: Editor | null = null;
  const view = render(<VisualEditor id="v" value={value} onChange={onChange} onEditor={(e) => (editor = e)} />);
  return { ...view, onChange, editor: () => editor as Editor };
}

const textbox = () => screen.findByRole("textbox", { name: "Contenido del post" });

describe("VisualEditor", () => {
  beforeEach(() => upload.mutateAsync.mockReset());

  it("muestra el formato en vivo y no reescribe el Markdown al abrir", async () => {
    const { onChange, container } = setup("# Título\n\nTexto con **negrita** y *cursiva*.");
    await textbox();

    expect(container.querySelector("h1")?.textContent).toBe("Título");
    expect(container.querySelector("strong")?.textContent).toBe("negrita");
    expect(container.querySelector("em")?.textContent).toBe("cursiva");
    expect(container.textContent).not.toContain("**");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("los botones aplican el formato y devuelven Markdown", async () => {
    const user = userEvent.setup();
    const { onChange, editor, container } = setup("hola mundo");
    await textbox();

    act(() => void editor().commands.selectAll());
    await user.click(screen.getByRole("button", { name: /^Negrita/ }));

    await waitFor(() => expect(container.querySelector("strong")?.textContent).toBe("hola mundo"));
    expect(onChange).toHaveBeenLastCalledWith("**hola mundo**");
    expect(screen.getByRole("button", { name: /^Negrita/ })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Título 2" }));
    expect(onChange).toHaveBeenLastCalledWith("## **hola mundo**");
  });

  it("carga los cambios externos sin devolverlos al formulario", async () => {
    const { onChange, rerender, container } = setup("primero");
    await textbox();

    rerender(<VisualEditor id="v" value={"## Restaurado\n\ncon **fuerza**"} onChange={onChange} />);
    await waitFor(() => expect(container.querySelector("h2")?.textContent).toBe("Restaurado"));
    expect(container.querySelector("strong")?.textContent).toBe("fuerza");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("el Markdown devuelto no se vuelve a cargar al llegar como valor", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    let editor: Editor | null = null;
    const view = render(<VisualEditor id="v" value="uno" onChange={onChange} onEditor={(e) => (editor = e)} />);
    await textbox();

    act(() => void (editor as unknown as Editor).commands.selectAll());
    await user.click(screen.getByRole("button", { name: /^Cursiva/ }));
    const emitted = onChange.mock.calls.at(-1)?.[0] as string;
    expect(emitted).toBe("*uno*");

    // El formulario devuelve lo mismo que el editor emitió: no debe recargarse (se perdería el cursor).
    const before = (editor as unknown as Editor).state.doc;
    view.rerender(<VisualEditor id="v" value={emitted} onChange={onChange} onEditor={(e) => (editor = e)} />);
    expect((editor as unknown as Editor).state.doc).toBe(before);
  });

  it("muestra las fórmulas dibujadas y los bloques de código con su lenguaje", async () => {
    const { container } = setup("Energía $E = mc^2$.\n\n```ts\nconst a = 1;\n```");
    await textbox();

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
    expect(container.querySelector(".ProseMirror")?.textContent).not.toContain("$"); // sin símbolos de LaTeX
    expect(screen.getByRole("combobox", { name: "Lenguaje del bloque de código" })).toHaveValue("ts");
  });

  it("sube una imagen pegada y la inserta", async () => {
    upload.mutateAsync.mockResolvedValue({ url: "/media/a.png", alt_text: "diagrama flujo" });
    const { onChange, container } = setup("texto");
    const box = await textbox();

    const file = new File([new Uint8Array(5)], "diagrama-flujo.png", { type: "image/png" });
    const paste = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData?: unknown };
    paste.clipboardData = { files: [file], types: ["Files"], getData: () => "" };
    act(() => void box.dispatchEvent(paste));

    // ProseMirror añade un <img> separador sin `src`: se busca la imagen real.
    await waitFor(() => expect(container.querySelector("img[src]")?.getAttribute("src")).toBe("/media/a.png"));
    expect(upload.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ altText: "diagrama flujo" }));
    expect(onChange.mock.calls.at(-1)?.[0]).toContain("![diagrama flujo](/media/a.png)");
  });

  it("rechaza imágenes demasiado grandes", async () => {
    const { container } = setup("texto");
    const box = await textbox();
    const file = new File([new Uint8Array(1)], "enorme.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 11 * 1024 * 1024 });
    const paste = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData?: unknown };
    paste.clipboardData = { files: [file], types: ["Files"], getData: () => "" };
    act(() => void box.dispatchEvent(paste));

    expect(await screen.findByRole("alert")).toHaveTextContent("supera 10 MB");
    expect(upload.mutateAsync).not.toHaveBeenCalled();
    expect(container.querySelector("img[src]")).toBeNull();
  });

  it("Ctrl+K abre la barra de enlace y aplica la dirección", async () => {
    const user = userEvent.setup();
    const { onChange, editor } = setup("ver docs");
    const box = await textbox();

    act(() => void editor().chain().focus().selectAll().run());
    box.focus();
    await user.keyboard("{Control>}k{/Control}");
    const field = await screen.findByLabelText("Enlace");
    await user.clear(field);
    await user.type(field, "ejemplo.com{Enter}");

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith("[ver docs](https://ejemplo.com)"));
    expect(screen.queryByLabelText("Enlace")).toBeNull();
  });

  it("el selector de lenguaje del bloque cambia el lenguaje", async () => {
    const user = userEvent.setup();
    const { onChange } = setup("```ts\nx\n```");
    await textbox();

    await user.selectOptions(screen.getByRole("combobox", { name: "Lenguaje del bloque de código" }), "py");
    expect(onChange).toHaveBeenLastCalledWith("```py\nx\n```");
  });

  it("los botones de tabla aparecen solo dentro de una tabla", async () => {
    const user = userEvent.setup();
    const { editor } = setup("texto");
    await textbox();

    expect(screen.queryByRole("button", { name: "Añadir fila" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Tabla" }));
    expect(await screen.findByRole("button", { name: "Añadir fila" })).toBeInTheDocument();
    expect(readMarkdown(editor())).toContain("| --- | --- | --- |");
  });
});

describe("insertBlock", () => {
  it("dentro de una lista inserta el bloque tras la lista y no dentro", () => {
    const editor = new TipTapEditor({
      element: document.createElement("div"),
      extensions: createExtensions("", false),
      content: "- uno\n- dos",
    });
    editor.commands.setTextSelection(4); // dentro del primer elemento
    insertBlock(editor, { type: "mathBlock", attrs: { latex: "a+b" } });

    expect(editor.state.doc.child(0).type.name).toBe("bulletList");
    expect(editor.state.doc.child(1).type.name).toBe("mathBlock");
    expect(readMarkdown(editor)).toBe("- uno\n- dos\n\n$$\na+b\n$$");
    editor.destroy();
  });

  it("en un párrafo del nivel superior inserta el bloque ahí", () => {
    const editor = new TipTapEditor({ element: document.createElement("div"), extensions: createExtensions("", false), content: "texto" });
    editor.commands.setTextSelection(2);
    insertBlock(editor, { type: "mathBlock", attrs: { latex: "x" } });
    expect(editor.state.doc.firstChild?.type.name).toBe("paragraph");
    expect(editor.state.doc.childCount).toBeGreaterThanOrEqual(2);
    editor.destroy();
  });
});

describe("normalizeHref", () => {
  it("completa dominios y respeta rutas, anclas y esquemas", () => {
    expect(normalizeHref(" ejemplo.com/ruta ")).toBe("https://ejemplo.com/ruta");
    expect(normalizeHref("http://x.com")).toBe("http://x.com");
    expect(normalizeHref("/blog/post")).toBe("/blog/post");
    expect(normalizeHref("#seccion")).toBe("#seccion");
    expect(normalizeHref("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(normalizeHref("   ")).toBe("");
  });
});
