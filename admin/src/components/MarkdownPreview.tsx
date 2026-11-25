import Markdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

/** Vista previa del Markdown, saneada igual que en el blog público (docs/05-security.md). */
export function MarkdownPreview({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className="text-sm text-muted">Nada que previsualizar todavía.</p>;
  }
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-pre:bg-surface-2 prose-code:before:content-none prose-code:after:content-none">
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {source}
      </Markdown>
    </div>
  );
}
