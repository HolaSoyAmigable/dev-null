import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type Ref,
} from "react";

import { useMediaMutations } from "@/api/hooks";
import { errorMessage } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { MAX_UPLOAD_MB } from "@/features/media/UploadButton";
import { cn } from "@/lib/utils";

import { EditorToolbar } from "./EditorToolbar";
import type { EditorHandle } from "./handle";
import {
  actionForShortcut,
  continueList,
  indent,
  outdent,
  pasteAsLink,
  type FormatAction,
} from "./formatting";
import {
  altFromFilename,
  imageMarkdown,
  insertAtSelection,
  insertSnippet,
  replacePlaceholder,
  type Edit,
  type Selection,
  type Snippet,
} from "./snippets";
import { applyEditNative, offsetTop } from "./textEdit";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];

const isImage = (file: File) => IMAGE_TYPES.includes(file.type);
const hasFiles = (transfer: DataTransfer | null) => Array.from(transfer?.types ?? []).includes("Files");

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Alto mínimo en filas; el área crece con el contenido. */
  minRows?: number;
  /** Barra de herramientas fija al hacer scroll; `top` en px respecto a la ventana. */
  stickyTop?: number;
  ref?: Ref<EditorHandle>;
};

/**
 * Editor de Markdown sobre un textarea: barra de formato y bloques, atajos (Ctrl/⌘ + B, I, E, K),
 * Tab para sangrar, Enter que continúa listas, pegar enlaces sobre una selección, subida de imágenes
 * arrastrando o pegando y altura automática. Las ediciones pasan por el navegador para que
 * Ctrl+Z las deshaga. Es controlado: el valor vive en el formulario del post.
 */
export function MarkdownEditor({ id, value, onChange, onBlur, minRows = 24, stickyTop, ref }: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  // Valor más reciente, también entre un cambio y el siguiente render (subidas asíncronas).
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const counter = useRef(0);
  // Esc y después Tab permiten salir del editor con el teclado (Tab normal sangra).
  const tabEscape = useRef(false);
  const { upload } = useMediaMutations();
  const [pending, setPending] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Un textarea recién cargado reporta el cursor en 0 aunque nadie lo haya colocado: hasta que el
  // usuario entra al editor, lo insertado va al final del texto y no al principio.
  const caretPlaced = useRef(false);

  const selection = (): Selection => {
    const el = textarea.current;
    if (!el || !caretPlaced.current) {
      const end = latest.current.length;
      return { start: end, end };
    }
    return { start: el.selectionStart, end: el.selectionEnd };
  };

  // Altura automática: el área se ajusta al contenido (la página es la que hace scroll).
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value, minRows]);

  /** Aplica una edición: por el navegador (conserva Ctrl+Z) o, si no se puede, cambiando el valor. */
  const commit = useCallback(
    (edit: Edit) => {
      caretPlaced.current = true;
      latest.current = edit.value;
      const el = textarea.current;
      if (el && applyEditNative(el, edit)) return; // el evento `input` ya avisó al formulario
      onChange(edit.value);
      // El cursor se restaura tras el render con el valor nuevo.
      requestAnimationFrame(() => {
        const target = textarea.current;
        if (!target) return;
        target.focus();
        target.setSelectionRange(edit.selectionStart, edit.selectionEnd);
      });
    },
    [onChange],
  );

  useImperativeHandle(
    ref,
    () => ({
      insertMedia: (media) =>
        commit(insertAtSelection(latest.current, selection(), imageMarkdown(media.alt_text ?? "", media.url))),
      jumpTo: ({ offset }) => {
        const el = textarea.current;
        if (!el) return;
        caretPlaced.current = true;
        el.focus({ preventScroll: true });
        el.setSelectionRange(offset, offset);
        const top = el.getBoundingClientRect().top + window.scrollY + offsetTop(el, offset);
        // Desplazamiento inmediato: como un enlace de ancla, y sin depender de animaciones.
        window.scrollTo({ top: Math.max(0, top - (stickyTop ?? 0) - 120), behavior: "auto" });
      },
    }),
    [commit, stickyTop],
  );

  const runFormat = (action: FormatAction) => commit(action.run(latest.current, selection()));
  const runSnippet = (snippet: Snippet) => commit(insertSnippet(latest.current, selection(), snippet));

  const uploadImages = async (files: File[]) => {
    setError(null);
    for (const file of files) {
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        setError(`"${file.name}" supera ${MAX_UPLOAD_MB} MB.`);
        continue;
      }
      counter.current += 1;
      const placeholder = `![Subiendo imagen ${counter.current}…]()`;
      commit(insertAtSelection(latest.current, selection(), `${placeholder}\n`));
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

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return; // IME en curso
    const escaped = tabEscape.current;
    tabEscape.current = event.key === "Escape";

    const shortcut = actionForShortcut(event);
    if (shortcut) {
      event.preventDefault();
      runFormat(shortcut);
      return;
    }
    if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey && !escaped) {
      event.preventDefault();
      commit((event.shiftKey ? outdent : indent)(latest.current, selection()));
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const edit = continueList(latest.current, selection());
      if (edit) {
        event.preventDefault();
        commit(edit);
      }
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files).filter(isImage);
    if (files.length) {
      event.preventDefault();
      void uploadImages(files);
      return;
    }
    // Una URL pegada sobre texto seleccionado crea el enlace; el resto se pega con normalidad.
    const link = pasteAsLink(latest.current, selection(), event.clipboardData.getData?.("text/plain") ?? "");
    if (link) {
      event.preventDefault();
      commit(link);
    }
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
      <EditorToolbar
        onFormat={runFormat}
        onSnippet={runSnippet}
        className={cn(
          "mb-1.5 py-1",
          stickyTop !== undefined && "sticky z-10 -mx-1 bg-bg/95 px-1 backdrop-blur",
        )}
        // La posición fija depende de la altura de la cabecera sticky de la página.
        style={stickyTop !== undefined ? { top: stickyTop } : undefined}
      />
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
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        rows={minRows}
        spellCheck
        className={cn(
          "resize-none overflow-hidden font-mono text-[13px] leading-relaxed",
          dragging && "border-accent ring-2 ring-accent",
        )}
        placeholder="# Escribe en Markdown… (arrastra o pega imágenes aquí)"
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
        <span className="text-muted">Tab sangra · Esc y Tab salen del editor</span>
      </div>
    </div>
  );
}
