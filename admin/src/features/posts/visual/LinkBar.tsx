import type { Editor } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Añade `https://` a lo que parece un dominio; deja intactos `/ruta`, `#ancla`, `mailto:` y URLs completas. */
export function normalizeHref(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(text)) return text;
  return `https://${text}`;
}

type Props = {
  editor: Editor;
  onClose: () => void;
};

/** Fila para escribir la dirección del enlace de la selección (Ctrl+K). */
export function LinkBar({ editor, onClose }: Props) {
  const [href, setHref] = useState(() => String(editor.getAttributes("link").href ?? ""));
  const input = useRef<HTMLInputElement>(null);
  const hadLink = editor.isActive("link");

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const finish = () => {
    onClose();
    editor.commands.focus();
  };

  const apply = () => {
    const target = normalizeHref(href);
    if (!target) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else if (editor.state.selection.empty && !hadLink) {
      // Sin texto seleccionado: se inserta la propia dirección como enlace.
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: target, marks: [{ type: "link", attrs: { href: target } }] })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: target }).run();
    }
    finish();
  };

  return (
    <form
      className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-2"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <label htmlFor="visual-link-url" className="text-xs font-medium text-muted">
        Enlace
      </label>
      <Input
        id="visual-link-url"
        ref={input}
        value={href}
        onChange={(event) => setHref(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            finish();
          }
        }}
        placeholder="https://ejemplo.com"
        className="h-8 min-w-48 flex-1"
        inputMode="url"
      />
      <Button type="submit" size="sm" variant="secondary">
        Aplicar
      </Button>
      {hadLink ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            finish();
          }}
        >
          Quitar enlace
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="ghost" onClick={finish}>
        Cancelar
      </Button>
    </form>
  );
}
