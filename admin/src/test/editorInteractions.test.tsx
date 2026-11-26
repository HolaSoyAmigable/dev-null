import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorToolbar } from "@/features/posts/editor/EditorToolbar";
import { MarkdownEditor } from "@/features/posts/editor/MarkdownEditor";
import { OutlineCard } from "@/features/posts/editor/OutlineCard";
import { applyEditNative, diffRange } from "@/features/posts/editor/textEdit";
import { useEditorView } from "@/features/posts/editor/useEditorView";
import { extractOutline } from "@/lib/outline";

vi.mock("@/api/hooks", () => ({ useMediaMutations: () => ({ upload: { mutateAsync: vi.fn() } }) }));

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <MarkdownEditor id="md" value={value} onChange={setValue} />;
}

const editor = () => screen.getByRole("textbox", { name: "Contenido en Markdown" }) as HTMLTextAreaElement;

function select(start: number, end = start) {
  editor().focus();
  editor().setSelectionRange(start, end);
}

describe("atajos y formato en el editor", () => {
  it("Ctrl+B pone en negrita la selección y repetirlo la quita", async () => {
    const user = userEvent.setup();
    render(<Harness initial="hola mundo" />);
    select(5, 10);

    await user.keyboard("{Control>}b{/Control}");
    expect(editor().value).toBe("hola **mundo**");

    await user.keyboard("{Control>}b{/Control}");
    expect(editor().value).toBe("hola mundo");
  });

  it("Ctrl+K crea un enlace y Ctrl+I una cursiva", async () => {
    const user = userEvent.setup();
    render(<Harness initial="ver docs" />);
    select(4, 8);
    await user.keyboard("{Control>}k{/Control}");
    expect(editor().value).toBe("ver [docs](https://)");

    select(0, 3);
    await user.keyboard("{Control>}i{/Control}");
    expect(editor().value).toBe("_ver_ [docs](https://)");
  });

  it("los botones de la barra aplican el formato y muestran su atajo", async () => {
    const user = userEvent.setup();
    render(<Harness initial={"uno\ndos"} />);
    select(0, 7);

    expect(screen.getByRole("button", { name: /^Negrita \(/ })).toHaveAttribute("title", expect.stringContaining("+B"));
    await user.click(screen.getByRole("button", { name: "Lista con viñetas" }));
    expect(editor().value).toBe("- uno\n- dos");

    await user.click(screen.getByRole("button", { name: "Lista con viñetas" }));
    expect(editor().value).toBe("uno\ndos");
  });

  it("Tab sangra y Esc seguido de Tab permite salir del editor", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness initial="a" />
        <button type="button">siguiente</button>
      </>,
    );
    select(1);

    await user.keyboard("{Tab}");
    expect(editor().value).toBe("a  ");
    expect(editor()).toHaveFocus();

    await user.keyboard("{Escape}{Tab}");
    expect(editor().value).toBe("a  ");
    expect(screen.getByRole("button", { name: "siguiente" })).toHaveFocus();
  });

  it("Shift+Tab quita la sangría", async () => {
    const user = userEvent.setup();
    render(<Harness initial="  a" />);
    select(3);
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(editor().value).toBe("a");
  });

  it("Enter continúa una lista y un elemento vacío la termina", async () => {
    const user = userEvent.setup();
    render(<Harness initial="- uno" />);
    select(5);

    await user.keyboard("{Enter}");
    expect(editor().value).toBe("- uno\n- ");

    await user.keyboard("{Enter}");
    expect(editor().value).toBe("- uno\n");
  });

  it("Enter fuera de una lista inserta un salto normal", async () => {
    const user = userEvent.setup();
    render(<Harness initial="texto" />);
    select(5);
    await user.keyboard("{Enter}");
    expect(editor().value).toBe("texto\n");
  });

  it("pegar una URL sobre una selección crea el enlace", () => {
    render(<Harness initial="ver docs" />);
    select(4, 8);
    fireEvent.paste(editor(), {
      clipboardData: { files: [], types: ["text/plain"], getData: () => "https://ejemplo.com" },
    });
    expect(editor().value).toBe("ver [docs](https://ejemplo.com)");
  });
});

describe("edición nativa (deshacer)", () => {
  afterEach(() => {
    // @ts-expect-error restaurar el entorno de jsdom
    delete document.execCommand;
  });

  it("diffRange localiza lo que cambia", () => {
    expect(diffRange("hola mundo", "hola **mundo**")).toEqual({ start: 5, oldEnd: 10, inserted: "**mundo**" });
    expect(diffRange("abc", "abc")).toEqual({ start: 3, oldEnd: 3, inserted: "" });
    expect(diffRange("abcd", "ad")).toEqual({ start: 1, oldEnd: 3, inserted: "" });
  });

  it("aplica la edición con execCommand para conservar el historial", async () => {
    const calls: [string, string | undefined][] = [];
    document.execCommand = ((command: string, _ui?: boolean, text?: string) => {
      calls.push([command, text]);
      const el = document.activeElement as HTMLTextAreaElement;
      const next = el.value.slice(0, el.selectionStart) + (text ?? "") + el.value.slice(el.selectionEnd);
      const caret = el.selectionStart + (text ?? "").length;
      // Imita al navegador: cambia el valor y avisa con un evento `input`.
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(el, next);
      el.setSelectionRange(caret, caret);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }) as typeof document.execCommand;

    const user = userEvent.setup();
    render(<Harness initial="hola mundo" />);
    select(5, 10);
    await user.keyboard("{Control>}b{/Control}");

    expect(calls).toEqual([["insertText", "**mundo**"]]);
    expect(editor().value).toBe("hola **mundo**");
    expect(editor().selectionStart).toBe(7); // "mundo" queda seleccionado
    expect(editor().selectionEnd).toBe(12);
  });

  it("si el navegador no lo permite devuelve false y el editor usa la vía normal", () => {
    const area = document.createElement("textarea");
    area.value = "abc";
    document.body.appendChild(area);
    document.execCommand = (() => false) as typeof document.execCommand;
    expect(applyEditNative(area, { value: "abXc", selectionStart: 3, selectionEnd: 3 })).toBe(false);
    area.remove();
  });
});

describe("EditorToolbar", () => {
  it("expone todos los grupos con nombres accesibles", () => {
    render(<EditorToolbar onFormat={vi.fn()} onSnippet={vi.fn()} />);
    for (const name of [/^Negrita/, /^Cursiva/, "Tachado", /^Código en línea/, /^Enlace/, "Título 2", "Título 3", "Lista con viñetas", "Lista numerada", "Lista de tareas", "Cita", "Tabla", "Línea separadora", "Bloque de código TypeScript", "Diagrama Mermaid"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("los botones no roban el foco del editor", () => {
    render(<EditorToolbar onFormat={vi.fn()} onSnippet={vi.fn()} />);
    const notPrevented = fireEvent.mouseDown(screen.getByRole("button", { name: "Tabla" }));
    expect(notPrevented).toBe(false); // preventDefault evita el cambio de foco
  });
});

describe("índice del documento", () => {
  it("extrae títulos con su posición e ignora el código", () => {
    const md = "# Uno\ntexto\n```md\n## no\n```\n## Dos **fuerte**\n### [Tres](http://x.com)\n##### no entra";
    const items = extractOutline(md);
    expect(items.map((i) => [i.level, i.text])).toEqual([
      [1, "Uno"],
      [2, "Dos fuerte"],
      [3, "Tres"],
    ]);
    expect(md.slice(items[1]?.offset, (items[1]?.offset ?? 0) + 7)).toBe("## Dos ");
  });

  it("OutlineCard lista los títulos y avisa al pulsar uno", async () => {
    const onJump = vi.fn();
    const user = userEvent.setup();
    render(<OutlineCard items={extractOutline("# A\n## B")} onJump={onJump} />);
    await user.click(screen.getByRole("button", { name: "B" }));
    expect(onJump).toHaveBeenCalledWith(4, 1);
  });

  it("no se muestra sin títulos", () => {
    const { container } = render(<OutlineCard items={[]} onJump={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("useEditorView", () => {
  beforeEach(() => window.localStorage.clear());

  it("recuerda la vista elegida y descarta valores inválidos", () => {
    const first = renderHook(() => useEditorView());
    expect(first.result.current[0]).toBe("visual");
    act(() => first.result.current[1]("split"));
    expect(window.localStorage.getItem("devnull:editor:view")).toBe("split");

    const second = renderHook(() => useEditorView());
    expect(second.result.current[0]).toBe("split");

    window.localStorage.setItem("devnull:editor:view", "otra-cosa");
    expect(renderHook(() => useEditorView()).result.current[0]).toBe("visual");

    // El valor de la versión anterior pasa a la pestaña Markdown.
    window.localStorage.setItem("devnull:editor:view", "write");
    expect(renderHook(() => useEditorView()).result.current[0]).toBe("markdown");
  });
});
