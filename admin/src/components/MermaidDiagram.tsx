import { useEffect, useState } from "react";

type State =
  | { status: "loading" }
  | { status: "ready"; svg: string }
  | { status: "error"; message: string };

const DEBOUNCE_MS = 350;
let nextId = 0;

/**
 * Renderiza un diagrama Mermaid en la vista previa. La biblioteca (pesada) se carga solo cuando
 * aparece un bloque ```mermaid, con `securityLevel: "strict"` (sin HTML ni eventos en el diagrama).
 * Se espera un instante tras cada cambio para no re-renderizar en cada pulsación.
 */
export default function MermaidDiagram({ chart }: { chart: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { default: mermaid } = await import("mermaid");
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: document.documentElement.classList.contains("dark") ? "dark" : "default",
          });
          // `parse` valida sin tocar el DOM; así un error de sintaxis no deja restos en la página.
          await mermaid.parse(chart);
          nextId += 1;
          const { svg } = await mermaid.render(`devnull-mermaid-${nextId}`, chart);
          if (!cancelled) setState({ status: "ready", svg });
        } catch (failure) {
          if (!cancelled) {
            setState({ status: "error", message: failure instanceof Error ? failure.message : String(failure) });
          }
        }
      })();
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [chart]);

  if (state.status === "error") {
    return (
      <div role="alert" className="not-prose my-4 rounded-md border border-danger p-3 text-xs">
        <p className="mb-1 font-medium text-danger">Diagrama Mermaid no válido</p>
        <pre className="overflow-x-auto whitespace-pre-wrap text-muted">{state.message}</pre>
      </div>
    );
  }
  if (state.status === "loading") {
    return <p className="my-4 text-xs text-muted">Renderizando diagrama…</p>;
  }
  return (
    <div
      className="not-prose my-4 flex justify-center overflow-x-auto"
      role="img"
      aria-label="Diagrama Mermaid"
      dangerouslySetInnerHTML={{ __html: state.svg }}
    />
  );
}
