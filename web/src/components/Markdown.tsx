import "server-only";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { createHighlighter, type Highlighter } from "shiki";

import { headingSlug, uniqueId } from "@/lib/format";

const LANGS = [
  "bash",
  "css",
  "diff",
  "dockerfile",
  "go",
  "html",
  "java",
  "javascript",
  "json",
  "jsx",
  "markdown",
  "python",
  "rust",
  "sql",
  "toml",
  "tsx",
  "typescript",
  "yaml",
] as const;
const ALIASES: Record<string, string> = { js: "javascript", ts: "typescript", sh: "bash", shell: "bash", py: "python", yml: "yaml", md: "markdown" };

let highlighter: Promise<Highlighter> | null = null;
function getHighlighter(): Promise<Highlighter> {
  highlighter ??= createHighlighter({ themes: ["github-light", "github-dark"], langs: [...LANGS] });
  return highlighter;
}

async function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const shiki = await getHighlighter();
  const resolved = ALIASES[lang] ?? lang;
  const language = shiki.getLoadedLanguages().includes(resolved) ? resolved : "text";
  // Shiki escapa el código fuente: el HTML generado solo contiene spans con estilos.
  const html = shiki.codeToHtml(code, {
    lang: language,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  });
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

function buildComponents(): Components {
  // Mismo algoritmo de ids que extractToc() para que la TOC enlace correctamente.
  const seen = new Map<string, number>();
  const heading = (Tag: "h2" | "h3") => {
    function Heading({ children }: ComponentPropsWithoutRef<"h2">) {
      const id = uniqueId(headingSlug(textOf(children)), seen);
      return (
        <Tag id={id}>
          <a href={`#${id}`} className="text-fg! no-underline hover:underline">
            {children}
          </a>
        </Tag>
      );
    }
    return Heading;
  };

  return {
    h1: ({ children }) => <h2>{children}</h2>,
    h2: heading("h2"),
    h3: heading("h3"),
    pre: ({ children }) => <>{children}</>,
    code: ({ className, children }) => {
      const match = /language-([\w-]+)/.exec(className ?? "");
      const code = textOf(children).replace(/\n$/, "");
      if (!match && !code.includes("\n")) return <code>{children}</code>;
      return <CodeBlock code={code} lang={match?.[1] ?? "text"} />;
    },
    a: ({ href, children }) => {
      const external = href?.startsWith("http");
      return (
        <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {children}
        </a>
      );
    },
    img: ({ src, alt }) => (
      <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" decoding="async" />
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto">
        <table>{children}</table>
      </div>
    ),
  };
}

/** Markdown → HTML saneado (rehype-sanitize) con resaltado de sintaxis (Shiki). */
export function Markdown({ source }: { source: string }) {
  return (
    <div className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-mono prose-headings:tracking-tight prose-a:text-accent prose-code:before:content-none prose-code:after:content-none prose-pre:bg-transparent prose-pre:p-0 prose-img:rounded-lg">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={buildComponents()}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
