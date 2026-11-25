import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownPreview } from "@/components/MarkdownPreview";

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
});
