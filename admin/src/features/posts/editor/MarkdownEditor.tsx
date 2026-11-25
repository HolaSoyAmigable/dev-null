import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type Ref,
} from "react";

import { useMediaMutations } from "@/api/hooks";
import type { Media } from "@/api/types";
import { errorMessage } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { MAX_UPLOAD_MB } from "@/features/media/UploadButton";
import { cn } from "@/lib/utils";

import { SnippetToolbar } from "./SnippetToolbar";
import {
  altFromFilename,
  imageMarkdown,
  insertAtSelection,
  insertSnippet,
  replacePlaceholder,
  type Edit,
  type Snippet,
} from "./snippets";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];

const isImage = (file: File) => IMAGE_TYPES.includes(file.type);
const hasFiles = (transfer: DataTransfer | null) => Array.from(transfer?.types ?? []).includes("Files");

export type MarkdownEditorHandle = {
  /** Inserta una imagen ya subida en la posición del cursor. */
  insertMedia: (media: Media) => void;
};

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  rows?: number;
  ref?: Ref<MarkdownEditorHandle>;
};

/**
 * Textarea de Markdown con accesos rápidos a bloques de código/diagramas/fórmulas y subida de
 * imágenes arrastrando o pegando. Es controlado: el valor vive en el formulario del post.
 */
export function MarkdownEditor({ id, value, onChange, onBlur, rows = 24, ref }: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  // Valor más reciente, también entre un cambio y el siguiente render (subidas asíncronas).
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const counter = useRef(0);
  const { upload } = useMediaMutations();
  const [pending, setPending] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Un textarea recién cargado reporta el cursor en 0 aunque nadie lo haya colocado: hasta que el
  // usuario entra al editor, lo insertado va al final del texto y no al principio.
  const caretPlaced = useRef(false);

  const selection = () => {
    const el = textarea.current;
    if (!el || !caretPlaced.current) {
      const end = latest.current.length;
      return { start: end, end };
    }
    return { start: el.selectionStart, end: el.selectionEnd };
  };

  const apply = useCallback(
    (edit: Edit) => {
      latest.current = edit.value;
      onChange(edit.value);
      // El cursor se restaura tras el render con el valor nuevo.
      requestAnimationFrame(() => {
        const el = textarea.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
      });
    },
    [onChange],
  );

  useImperativeHandle(
    ref,
    () => ({
      insertMedia: (media) =>
        apply(insertAtSelection(latest.current, selection(), imageMarkdown(media.alt_text ?? "", media.url))),
    }),
    [apply],
  );

  const uploadImages = async (files: File[]) => {
    setError(null);
    for (const file of files) {
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        setError(`"${file.name}" supera ${MAX_UPLOAD_MB} MB.`);
        continue;
      }
      counter.current += 1;
      const placeholder = `![Subiendo imagen ${counter.current}…]()`;
      apply(insertAtSelection(latest.current, selection(), `${placeholder}\n`));
      setPending((n) => n + 1);
      try {
        const alt = altFromFilename(file.name);
        const media = await upload.mutateAsync({ file, altText: alt });
        const next = replacePlaceholder(latest.current, placeholder, imageMarkdown(media.alt_text ?? alt, media.url));
        latest.current = next;
        onChange(next);
      } catch (failure) {
        const next = replacePlaceholder(latest.current, `${placeholder}\n`, "");
        latest.current = next;
        onChange(next);
        setError(errorMessage(failure));
      } finally {
        setPending((n) => n - 1);
      }
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files).filter(isImage);
    if (!files.length) return; // el texto se pega con normalidad
    event.preventDefault();
    void uploadImages(files);
  };

  const onDragOver = (event: DragEvent<HTMLTextAreaElement>) => {
    if (!hasFiles(event.dataTransfer)) return;
    event.preventDefault();
    setDragging(true);
  };

  const onDrop = (event: DragEvent<HTMLTextAreaElement>) => {
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (!files.length) return;
    event.preventDefault();
    const images = files.filter(isImage);
    if (images.length) void uploadImages(images);
    else setError("Solo se pueden arrastrar imágenes (PNG, JPEG, GIF, WebP o AVIF).");
  };

  return (
    <div>
      <SnippetToolbar onInsert={(snippet: Snippet) => apply(insertSnippet(latest.current, selection(), snippet))} />
      <label htmlFor={id} className="sr-only">
        Contenido en Markdown
      </label>
      <Textarea
        id={id}
        ref={textarea}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          caretPlaced.current = true;
        }}
        onBlur={onBlur}
        onPaste={onPaste}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        rows={rows}
        spellCheck
        className={cn("font-mono text-[13px] leading-relaxed", dragging && "border-accent ring-2 ring-accent")}
        placeholder="# Escribe en Markdown… (arrastra o pega imágenes aquí)"
      />
      <div className="mt-1 min-h-4 text-xs" aria-live="polite">
        {pending > 0 ? (
          <span className="text-muted">Subiendo {pending === 1 ? "1 imagen" : `${pending} imágenes`}…</span>
        ) : null}
        {error ? (
          <span role="alert" className="text-danger">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
