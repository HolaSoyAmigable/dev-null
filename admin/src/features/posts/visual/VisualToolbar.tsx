import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
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
  Redo2,
  Sigma,
  Strikethrough,
  Table,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { BUTTON, describeAction, keepFocus } from "../editor/EditorToolbar";

type State = {
  active: Record<string, boolean>;
  codeLanguage: string | null;
  canUndo: boolean;
  canRedo: boolean;
  inTable: boolean;
};

type Item = {
  id: string;
  label: string;
  shortcut?: string;
  icon: LucideIcon;
  /** Nombre y atributos para `editor.isActive`; sin él el botón no se marca. */
  active?: [string, Record<string, unknown>?];
  run: (editor: Editor) => void;
};

const MERMAID_TEMPLATE = "flowchart TD\n  A[Inicio] --> B[Fin]";

/**
 * Inserta un bloque (diagrama, fórmula) al nivel del documento. Si el cursor está dentro de una
 * lista, cita o tabla, el bloque va justo después de ese elemento y no dentro de él.
 */
export function insertBlock(editor: Editor, content: Parameters<Editor["commands"]["insertContent"]>[0]): void {
  const { $from } = editor.state.selection;
  const chain = editor.chain().focus();
  if ($from.depth > 1) chain.insertContentAt($from.after(1), content).run();
  else chain.insertContent(content).run();
}

/** Activa o cambia el lenguaje del bloque de código; repetirlo con el mismo lenguaje vuelve a texto. */
export function setCodeBlock(editor: Editor, language: string): void {
  const chain = editor.chain().focus();
  if (editor.isActive("codeBlock")) {
    if (editor.getAttributes("codeBlock").language === language) chain.toggleCodeBlock().run();
    else chain.updateAttributes("codeBlock", { language }).run();
    return;
  }
  if (language === "mermaid") {
    insertBlock(editor, {
      type: "codeBlock",
      attrs: { language },
      content: [{ type: "text", text: MERMAID_TEMPLATE }],
    });
    return;
  }
  chain.setCodeBlock({ language }).run();
}

const GROUPS: readonly (readonly Item[])[] = [
  [
    { id: "undo", label: "Deshacer", shortcut: "Ctrl+Z", icon: Undo2, run: (e) => void e.chain().focus().undo().run() },
    { id: "redo", label: "Rehacer", shortcut: "Ctrl+Y", icon: Redo2, run: (e) => void e.chain().focus().redo().run() },
  ],
  [
    { id: "bold", label: "Negrita", shortcut: "Ctrl+B", icon: Bold, active: ["bold"], run: (e) => void e.chain().focus().toggleBold().run() },
    { id: "italic", label: "Cursiva", shortcut: "Ctrl+I", icon: Italic, active: ["italic"], run: (e) => void e.chain().focus().toggleItalic().run() },
    { id: "strike", label: "Tachado", icon: Strikethrough, active: ["strike"], run: (e) => void e.chain().focus().toggleStrike().run() },
    { id: "code", label: "Código en línea", shortcut: "Ctrl+E", icon: Code, active: ["code"], run: (e) => void e.chain().focus().toggleCode().run() },
  ],
  [
    { id: "h2", label: "Título 2", icon: Heading2, active: ["heading", { level: 2 }], run: (e) => void e.chain().focus().toggleHeading({ level: 2 }).run() },
    { id: "h3", label: "Título 3", icon: Heading3, active: ["heading", { level: 3 }], run: (e) => void e.chain().focus().toggleHeading({ level: 3 }).run() },
  ],
  [
    { id: "bullet", label: "Lista con viñetas", icon: List, active: ["bulletList"], run: (e) => void e.chain().focus().toggleBulletList().run() },
    { id: "number", label: "Lista numerada", icon: ListOrdered, active: ["orderedList"], run: (e) => void e.chain().focus().toggleOrderedList().run() },
    { id: "task", label: "Lista de tareas", icon: ListChecks, active: ["taskList"], run: (e) => void e.chain().focus().toggleTaskList().run() },
    { id: "quote", label: "Cita", icon: Quote, active: ["blockquote"], run: (e) => void e.chain().focus().toggleBlockquote().run() },
  ],
  [
    { id: "table", label: "Tabla", icon: Table, run: (e) => void e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { id: "rule", label: "Línea separadora", icon: Minus, run: (e) => void e.chain().focus().setHorizontalRule().run() },
    { id: "math-inline", label: "Fórmula en línea", icon: Sigma, run: (e) => void e.chain().focus().insertContent({ type: "mathInline", attrs: { latex: "" } }).run() },
  ],
];

const CODE_BUTTONS: readonly { id: string; label: string; title: string }[] = [
  { id: "ts", label: "ts", title: "Bloque de código TypeScript" },
  { id: "kt", label: "kt", title: "Bloque de código Kotlin" },
  { id: "py", label: "py", title: "Bloque de código Python" },
  { id: "sql", label: "sql", title: "Bloque de código SQL" },
  { id: "bash", label: "bash", title: "Bloque de código Bash" },
  { id: "mermaid", label: "mermaid", title: "Diagrama Mermaid" },
];

const TABLE_ACTIONS: readonly { label: string; run: (editor: Editor) => void }[] = [
  { label: "Añadir fila", run: (e) => void e.chain().focus().addRowAfter().run() },
  { label: "Añadir columna", run: (e) => void e.chain().focus().addColumnAfter().run() },
  { label: "Eliminar fila", run: (e) => void e.chain().focus().deleteRow().run() },
  { label: "Eliminar columna", run: (e) => void e.chain().focus().deleteColumn().run() },
  { label: "Eliminar tabla", run: (e) => void e.chain().focus().deleteTable().run() },
];

type Props = {
  editor: Editor;
  onLink: () => void;
  className?: string;
  style?: CSSProperties;
};

/** Barra del editor visual: cada botón refleja el formato del texto bajo el cursor. */
export function VisualToolbar({ editor, onLink, className, style }: Props) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }): State => {
      const names: [string, Record<string, unknown>?][] = [
        ["bold"], ["italic"], ["strike"], ["code"], ["link"], ["heading", { level: 2 }], ["heading", { level: 3 }],
        ["bulletList"], ["orderedList"], ["taskList"], ["blockquote"],
      ];
      return {
        active: Object.fromEntries(names.map(([name, attrs]) => [key(name, attrs), current.isActive(name, attrs)])),
        codeLanguage: current.isActive("codeBlock") ? String(current.getAttributes("codeBlock").language ?? "") : null,
        canUndo: current.can().undo(),
        canRedo: current.can().redo(),
        inTable: current.isActive("table"),
      };
    },
  });

  return (
    <div
      role="toolbar"
      aria-label="Formato"
      style={style}
      className={cn("flex flex-wrap items-center gap-x-1 gap-y-1", className)}
    >
      {GROUPS.map((group, index) => (
        <div key={index} className="flex items-center gap-0.5 border-r border-border pr-1.5 last:border-r-0">
          {group.map((item) => {
            const pressed = item.active ? state.active[key(item.active[0], item.active[1])] : undefined;
            const disabled = (item.id === "undo" && !state.canUndo) || (item.id === "redo" && !state.canRedo);
            const text = describeAction(item.label, item.shortcut);
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                title={text}
                aria-label={text}
                aria-pressed={pressed}
                disabled={disabled}
                onMouseDown={keepFocus}
                onClick={() => item.run(editor)}
                className={cn(
                  BUTTON,
                  "grid size-7 place-items-center disabled:cursor-default disabled:opacity-40",
                  pressed && "border-border bg-surface-2 text-accent",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            );
          })}
          {index === 1 ? (
            <button
              type="button"
              title={describeAction("Enlace", "Ctrl+K")}
              aria-label={describeAction("Enlace", "Ctrl+K")}
              aria-pressed={state.active["link"]}
              onMouseDown={keepFocus}
              onClick={onLink}
              className={cn(BUTTON, "grid size-7 place-items-center", state.active["link"] && "border-border bg-surface-2 text-accent")}
            >
              <LinkIcon className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      ))}
      <div className="flex items-center gap-1 border-r border-border pr-1.5">
        {CODE_BUTTONS.map((button) => (
          <button
            key={button.id}
            type="button"
            title={button.title}
            aria-label={button.title}
            aria-pressed={state.codeLanguage === button.id}
            onMouseDown={keepFocus}
            onClick={() => setCodeBlock(editor, button.id)}
            className={cn(
              BUTTON,
              "border-border px-2 py-0.5 font-mono text-xs",
              state.codeLanguage === button.id && "bg-surface-2 text-accent",
            )}
          >
            {button.label}
          </button>
        ))}
        <button
          type="button"
          title="Fórmula en bloque (LaTeX)"
          aria-label="Fórmula en bloque (LaTeX)"
          onMouseDown={keepFocus}
          onClick={() => insertBlock(editor, { type: "mathBlock", attrs: { latex: "" } })}
          className={cn(BUTTON, "border-border px-2 py-0.5 font-mono text-xs")}
        >
          $$
        </button>
      </div>
      {state.inTable ? (
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Tabla">
          {TABLE_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onMouseDown={keepFocus}
              onClick={() => action.run(editor)}
              className={cn(BUTTON, "border-border px-2 py-0.5 text-xs")}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const key = (name: string, attrs?: Record<string, unknown>) => `${name}${attrs ? JSON.stringify(attrs) : ""}`;
