import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MarkdownEditor } from "@/features/posts/editor/MarkdownEditor";

const upload = vi.hoisted(() => ({ mutateAsync: vi.fn() }));
vi.mock("@/api/hooks", () => ({ useMediaMutations: () => ({ upload }) }));

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <MarkdownEditor id="md" value={value} onChange={setValue} />;
}

const editor = () => screen.getByRole("textbox", { name: "Contenido en Markdown" }) as HTMLTextAreaElement;

function imageFile(name = "diagrama-flujo.png", size = 10) {
  return new File([new Uint8Array(size)], name, { type: "image/png" });
}

describe("MarkdownEditor", () => {
  beforeEach(() => {
    upload.mutateAsync.mockReset();
  });

  it("la barra inserta bloques de código en el cursor", async () => {
    const user = userEvent.setup();
    render(<Harness initial="Intro" />);

    // Sin haber colocado el cursor, el bloque va al final (no al principio).
    await user.click(screen.getByRole("button", { name: "Bloque de código Kotlin" }));
    expect(editor().value).toBe("Intro\n\n```kt\n\n```\n");

    await user.click(screen.getByRole("button", { name: "Fórmula en bloque (LaTeX)" }));
    expect(editor().value).toContain("$$\n\n$$");
  });

  it("respeta el cursor cuando el usuario ya lo colocó", async () => {
    const user = userEvent.setup();
    render(<Harness initial="Intro" />);

    await user.click(editor());
    editor().setSelectionRange(0, 0);
    await user.click(screen.getByRole("button", { name: "Bloque de código TypeScript" }));

    expect(editor().value).toBe("```ts\n\n```\n\nIntro");
  });

  it("ofrece los lenguajes pedidos", () => {
    render(<Harness />);
    for (const name of ["TypeScript", "Kotlin", "Python", "SQL", "Bash"]) {
      expect(screen.getByRole("button", { name: `Bloque de código ${name}` })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Diagrama Mermaid" })).toBeInTheDocument();
  });

  it("sube una imagen pegada e inserta el Markdown", async () => {
    upload.mutateAsync.mockResolvedValue({ url: "/media/2026/11/abc.png", alt_text: "diagrama flujo" });
    render(<Harness initial="Texto" />);

    fireEvent.paste(editor(), { clipboardData: { files: [imageFile()], types: ["Files"] } });

    await waitFor(() => expect(editor().value).toContain("![diagrama flujo](/media/2026/11/abc.png)"));
    expect(upload.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ altText: "diagrama flujo" }));
    expect(editor().value).not.toContain("Subiendo");
  });

  it("sube una imagen arrastrada y suelta", async () => {
    upload.mutateAsync.mockResolvedValue({ url: "/media/x.png", alt_text: null });
    render(<Harness />);

    fireEvent.drop(editor(), { dataTransfer: { files: [imageFile("foto.png")], types: ["Files"] } });

    await waitFor(() => expect(editor().value).toContain("![foto](/media/x.png)"));
  });

  it("retira el marcador y avisa si la subida falla", async () => {
    upload.mutateAsync.mockRejectedValue(new Error("Archivo no permitido"));
    render(<Harness initial="Hola" />);

    fireEvent.paste(editor(), { clipboardData: { files: [imageFile()], types: ["Files"] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Archivo no permitido");
    expect(editor().value).toBe("Hola");
  });

  it("rechaza imágenes demasiado grandes sin subirlas", async () => {
    render(<Harness />);
    fireEvent.paste(editor(), { clipboardData: { files: [imageFile("enorme.png", 11 * 1024 * 1024)], types: ["Files"] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("supera 10 MB");
    expect(upload.mutateAsync).not.toHaveBeenCalled();
  });

  it("pegar texto sigue funcionando con normalidad", () => {
    render(<Harness />);
    const notPrevented = fireEvent.paste(editor(), { clipboardData: { files: [], types: ["text/plain"] } });
    expect(notPrevented).toBe(true);
    expect(upload.mutateAsync).not.toHaveBeenCalled();
  });
});
