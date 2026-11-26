import type { CSSProperties } from "react";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  Table,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { FORMAT_ACTIONS, type FormatAction, type FormatActionId } from "./formatting";
import { CODE_SNIPPETS, DIAGRAM_SNIPPET, MATH_SNIPPET, type Snippet } from "./snippets";

const ICONS: Record<FormatActionId, LucideIcon> = {
  bold: Bold,
  italic: Italic,
  strike: Strikethrough,
  code: Code,
  link: LinkIcon,
  h2: Heading2,
  h3: Heading3,
  bullet: List,
  number: ListOrdered,
  task: ListChecks,
  quote: Quote,
  table: Table,
  rule: Minus,
};

/** Grupos separados por una línea fina. */
const FORMAT_GROUPS: readonly (readonly FormatActionId[])[] = [
  ["bold", "italic", "strike", "code", "link"],
  ["h2", "h3"],
  ["bullet", "number", "task", "quote"],
  ["table", "rule"],
];
const SNIPPET_GROUPS: readonly (readonly Snippet[])[] = [CODE_SNIPPETS, [DIAGRAM_SNIPPET, MATH_SNIPPET]];

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** "Negrita (Ctrl+B)"; en macOS el atajo se muestra con ⌘. */
export function describeAction(label: string, shortcut?: string): string {
  if (!shortcut) return label;
  return `${label} (${isMac() ? shortcut.replace("Ctrl", "⌘") : shortcut})`;
}

const describe = (action: FormatAction) => describeAction(action.label, action.shortcut);

export const BUTTON =
  "cursor-pointer rounded border border-transparent text-muted transition-colors hover:border-border hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

// `onMouseDown` evita que el botón robe el foco: el editor conserva su selección.
export const keepFocus = (event: { preventDefault: () => void }) => event.preventDefault();

type Props = {
  onFormat: (action: FormatAction) => void;
  onSnippet: (snippet: Snippet) => void;
  className?: string;
  style?: CSSProperties;
};

/** Barra de formato (iconos) y de bloques (código, diagrama, fórmula) del editor. */
export function EditorToolbar({ onFormat, onSnippet, className, style }: Props) {
  return (
    <div
      role="toolbar"
      aria-label="Formato y bloques"
      style={style}
      className={cn("flex flex-wrap items-center gap-x-1 gap-y-1", className)}
    >
      {FORMAT_GROUPS.map((group, index) => (
        <div key={index} className="flex items-center gap-0.5 border-r border-border pr-1.5 last:border-r-0">
          {group.map((id) => {
            const action = FORMAT_ACTIONS.find((candidate) => candidate.id === id);
            const Icon = ICONS[id];
            if (!action) return null;
            const text = describe(action);
            return (
              <button
                key={id}
                type="button"
                title={text}
                aria-label={text}
                onMouseDown={keepFocus}
                onClick={() => onFormat(action)}
                className={cn(BUTTON, "grid size-7 place-items-center")}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            );
          })}
        </div>
      ))}
      {SNIPPET_GROUPS.map((group, index) => (
        <div key={`s${index}`} className="flex items-center gap-1 border-r border-border pr-1.5 last:border-r-0">
          {group.map((snippet) => (
            <button
              key={snippet.id}
              type="button"
              title={snippet.title}
              aria-label={snippet.title}
              onMouseDown={keepFocus}
              onClick={() => onSnippet(snippet)}
              className={cn(BUTTON, "border-border px-2 py-0.5 font-mono text-xs")}
            >
              {snippet.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
