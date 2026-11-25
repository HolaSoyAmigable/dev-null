"use client";

import { useEffect, useId, useState } from "react";

/**
 * Diagrama Mermaid del blog. Se renderiza en el navegador (la biblioteca se descarga solo en
 * páginas con diagramas) con `securityLevel: "strict"`. Mientras carga, o si falla, se muestra
 * el código fuente: sin JavaScript el lector sigue viendo el contenido.
 */
export function MermaidDiagram({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  // `useId` devuelve ":r1:"; Mermaid necesita un id utilizable como selector.
  const id = `devnull-mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: document.documentElement.classList.contains("dark") ? "dark" : "default",
        });
        await mermaid.parse(chart);
        const result = await mermaid.render(id, chart);
        if (!cancelled) setSvg(result.svg);
      } catch {
        // Diagrama inválido: se deja visible el código fuente.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (!svg) {
    return (
      <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-4 text-sm">
        <code className="language-mermaid">{chart}</code>
      </pre>
    );
  }
  return (
    <div
      className="not-prose my-6 flex justify-center overflow-x-auto"
      role="img"
      aria-label="Diagrama"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
