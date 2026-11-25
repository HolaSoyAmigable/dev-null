import "katex/dist/katex.min.css";

import { isValidElement, lazy, Suspense, type ComponentProps, type ReactNode } from "react";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

// Mermaid es grande: solo se descarga cuando la vista previa contiene un diagrama.
const MermaidDiagram = lazy(() => import("./MermaidDiagram"));

/**
 * Mismo saneado que el blog público (docs/05-security.md) más las clases que `remark-math`
 * emite para las fórmulas. KaTeX se aplica DESPUÉS de sanear: su salida es generada por la
 * biblioteca (no por el autor) y `trust` está desactivado, así que `\href` y similares no se ejecutan.
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [["className", /^language-./, "math-inline", "math-display"]],
  },
};

const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS: ComponentProps<typeof Markdown>["rehypePlugins"] = [
  [rehypeSanitize, sanitizeSchema],
  [rehypeKatex, { throwOnError: false, trust: false }],
];

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** `<pre><code class="language-mermaid">` → diagrama; el resto de bloques se deja igual. */
function Pre({ children, ...props }: ComponentProps<"pre">) {
  if (isValidElement<{ className?: string; children?: ReactNode }>(children)) {
    const className = children.props.className ?? "";
    if (/\blanguage-mermaid\b/.test(className)) {
      return (
        <Suspense fallback={<p className="my-4 text-xs text-muted">Cargando diagrama…</p>}>
          <MermaidDiagram chart={textOf(children.props.children).replace(/\n$/, "")} />
        </Suspense>
      );
    }
  }
  return <pre {...props}>{children}</pre>;
}

/** Vista previa del Markdown: GFM, fórmulas KaTeX y diagramas Mermaid, saneada como el blog. */
export function MarkdownPreview({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className="text-sm text-muted">Nada que previsualizar todavía.</p>;
  }
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-pre:bg-surface-2 prose-code:before:content-none prose-code:after:content-none">
      <Markdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={{ pre: Pre }}>
        {source}
      </Markdown>
    </div>
  );
}
