import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";

import { useMediaMutations } from "@/api/hooks";
import { errorMessage } from "@/components/ui/feedback";
import { MAX_UPLOAD_MB } from "@/features/media/UploadButton";
import { cn } from "@/lib/utils";

import type { EditorHandle } from "../editor/handle";
import { altFromFilename } from "../editor/snippets";
import { createExtensions } from "./extensions";
import { LinkBar } from "./LinkBar";
import { readMarkdown } from "./markdownIO";
import { VisualToolbar } from "./VisualToolbar";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];
const isImage = (file: File) => IMAGE_TYPES.includes(file.type);

type Props = {
  id: string;
  /** Markdown del post (fuente de verdad: vive en el formulario). */
  value: string;
  onChange: (markdown: string) => void;
  onBlur?: () => void;
  /** Barra fija al hacer scroll; `top` en px respecto a la ventana. */
  stickyTop?: number;
  /** Para pruebas: recibe la instancia del editor. */
  onEditor?: (editor: Editor | null) => void;
  ref?: Ref<EditorHandle>;
};

/**
 * Editor visual (WYSIWYG): se ve el resultado mientras se escribe, sin símbolos de Markdown.
 * El documento sigue siendo Markdown: solo se reescribe cuando el usuario cambia algo, así abrir
 * un post no altera su texto. Los cambios externos (restaurar un borrador o una revisión, editar
 * en la pestaña Markdown) se cargan en el editor sin avisar de vuelta al formulario.
 */
export default function VisualEditor({ id, value, onChange, onBlur, stickyTop, onEditor, ref }: Props) {
  const extensions = useMemo(() => createExtensions("Empieza a escribir… (también puedes usar # , - , 1. , > o ``` como en Markdown)"), []);
  // Último Markdown que el editor entregó o cargó: distingue un cambio externo de nuestro propio eco.
  const lastSynced = useRef(value);
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const uploadRef = useRef<(files: File[], pos?: number) => void>(() => undefined);
  const openLinkRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    onChangeRef.current = onChange;
    onBlurRef.current = onBlur;
  });

  const { upload } = useMediaMutations();
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  const editor = useEditor({
    extensions,
    content: value,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Contenido del post",
        spellcheck: "true",
      },
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "k") {
          event.preventDefault();
          openLinkRef.current();
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter(isImage);
        if (!files.length) return false; // el texto (y los enlaces) se pegan con normalidad
        event.preventDefault();
        uploadRef.current(files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (!files.length) return false;
        event.preventDefault();
        const images = files.filter(isImage);
        if (images.length) uploadRef.current(images, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos);
        else setError("Solo se pueden arrastrar imágenes (PNG, JPEG, GIF, WebP o AVIF).");
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      const markdown = readMarkdown(current);
      lastSynced.current = markdown;
      onChangeRef.current(markdown);
    },
    onBlur: () => onBlurRef.current?.(),
  });

  useEffect(() => {
    onEditor?.(editor);
    return () => onEditor?.(null);
  }, [editor, onEditor]);

  // Cambios externos del Markdown (borrador restaurado, revisión, pestaña Markdown).
  useEffect(() => {
    if (!editor || editor.isDestroyed || value === lastSynced.current) return;
    lastSynced.current = value;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  const uploadImages = async (files: File[], pos?: number) => {
    if (!editor) return;
    setError(null);
    let at = pos;
    for (const file of files) {
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        setError(`"${file.name}" supera ${MAX_UPLOAD_MB} MB.`);
        continue;
      }
      setPending((n) => n + 1);
      try {
        const alt = altFromFilename(file.name);
        const media = await upload.mutateAsync({ file, altText: alt });
        const chain = editor.chain().focus();
        if (at !== undefined) chain.setTextSelection(Math.min(at, editor.state.doc.content.size));
        chain.setImage({ src: media.url, alt: media.alt_text ?? alt }).run();
        at = undefined; // las siguientes imágenes van tras la anterior
      } catch (failure) {
        setError(errorMessage(failure));
      } finally {
        setPending((n) => n - 1);
      }
    }
  };
  useEffect(() => {
    uploadRef.current = (files, pos) => void uploadImages(files, pos);
  });
  useEffect(() => {
    openLinkRef.current = () => setLinkOpen(true);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      insertMedia: (media) => {
        editor?.chain().focus().setImage({ src: media.url, alt: media.alt_text ?? "" }).run();
      },
      jumpTo: ({ index }) => {
        if (!editor) return;
        let seen = 0;
        let target = -1;
        editor.state.doc.descendants((node, pos) => {
          if (target !== -1) return false;
          if (node.type.name === "heading") {
            if (seen === index) target = pos;
            seen += 1;
          }
          return true;
        });
        if (target === -1) return;
        editor.chain().focus().setTextSelection(target + 1).run();
        const dom = editor.view.nodeDOM(target);
        if (dom instanceof HTMLElement) {
          const top = dom.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top: Math.max(0, top - (stickyTop ?? 0) - 120), behavior: "auto" });
        }
      },
    }),
    [editor, stickyTop],
  );

  if (!editor) return <div className="min-h-96 rounded-md border border-border bg-surface" aria-busy="true" />;

  return (
    <div>
      <VisualToolbar
        editor={editor}
        onLink={() => setLinkOpen(true)}
        className={cn("mb-1.5 py-1", stickyTop !== undefined && "sticky z-10 -mx-1 bg-bg/95 px-1 backdrop-blur")}
        style={stickyTop !== undefined ? { top: stickyTop } : undefined}
      />
      {linkOpen ? <LinkBar editor={editor} onClose={() => setLinkOpen(false)} /> : null}
      <EditorContent
        editor={editor}
        className="visual-editor rounded-md border border-border bg-surface px-4 py-3 focus-within:ring-2 focus-within:ring-accent"
      />
      <div className="mt-1 flex min-h-4 flex-wrap items-center justify-between gap-x-4 text-xs" aria-live="polite">
        <span>
          {pending > 0 ? (
            <span className="text-muted">Subiendo {pending === 1 ? "1 imagen" : `${pending} imágenes`}…</span>
          ) : null}
          {error ? (
            <span role="alert" className="text-danger">
              {error}
            </span>
          ) : null}
        </span>
        <span className="text-muted">Arrastra o pega imágenes · Markdown como # o - también funciona</span>
      </div>
    </div>
  );
}
