import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarkdownPreview } from "@/components/MarkdownPreview";

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  parse: vi.fn(),
  render: vi.fn(),
}));
vi.mock("mermaid", () => ({ default: mermaid }));

describe("MarkdownPreview", () => {
  it("renderiza GFM y elimina HTML peligroso", () => {
    const { container } = render(
      <MarkdownPreview
        source={"# Título\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))"}
      />,
    );
    expect(screen.getByRole("heading", { name: "Título" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).not.toContain("javascript:");
  });

  it("muestra un aviso cuando no hay contenido", () => {
    render(<MarkdownPreview source="   " />);
    expect(screen.getByText("Nada que previsualizar todavía.")).toBeInTheDocument();
  });

  it("renderiza fórmulas en línea y en bloque con KaTeX", () => {
    const { container } = render(
      <MarkdownPreview source={"Energía $E = mc^2$ en línea.\n\n$$\n\\int_0^1 x\\,dx = \\frac{1}{2}\n$$"} />,
    );
    expect(container.querySelectorAll(".katex").length).toBe(2);
    expect(container.querySelector(".katex-display")).not.toBeNull();
  });

  it("no ejecuta enlaces peligrosos dentro de fórmulas", () => {
    const { container } = render(<MarkdownPreview source={"$\\href{javascript:alert(1)}{clic}$"} />);
    expect(container.innerHTML).not.toContain('href="javascript');
  });

  it("los bloques de código normales se mantienen como código", () => {
    const { container } = render(<MarkdownPreview source={"```ts\nconst a = 1;\n```"} />);
    expect(container.querySelector("pre code")?.textContent).toContain("const a = 1;");
    expect(mermaid.render).not.toHaveBeenCalled();
  });

  it("renderiza un bloque mermaid como diagrama", async () => {
    mermaid.parse.mockResolvedValue(true);
    mermaid.render.mockResolvedValue({ svg: '<svg data-testid="diagrama"><g/></svg>' });
    render(<MarkdownPreview source={"```mermaid\nflowchart TD\n  A --> B\n```"} />);

    const diagram = await screen.findByRole("img", { name: "Diagrama Mermaid" }, { timeout: 3000 });
    expect(diagram.querySelector("svg")).not.toBeNull();
    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: "strict" }));
    expect(mermaid.render).toHaveBeenCalledWith(expect.stringMatching(/^devnull-mermaid-/), "flowchart TD\n  A --> B");
  });

  it("muestra el error de un diagrama inválido sin romper la vista previa", async () => {
    mermaid.parse.mockRejectedValue(new Error("Parse error en línea 1"));
    render(<MarkdownPreview source={"# Hola\n\n```mermaid\nesto no es un diagrama\n```"} />);

    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent("Parse error en línea 1");
    expect(screen.getByRole("heading", { name: "Hola" })).toBeInTheDocument();
  });
});
