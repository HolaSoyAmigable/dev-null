import type { Edit } from "./snippets";

/** Zona que cambia entre dos textos: se sustituye `[start, oldEnd)` por `inserted`. */
export function diffRange(oldValue: string, newValue: string): { start: number; oldEnd: number; inserted: string } {
  const max = Math.min(oldValue.length, newValue.length);
  let start = 0;
  while (start < max && oldValue[start] === newValue[start]) start += 1;
  let oldEnd = oldValue.length;
  let newEnd = newValue.length;
  while (oldEnd > start && newEnd > start && oldValue[oldEnd - 1] === newValue[newEnd - 1]) {
    oldEnd -= 1;
    newEnd -= 1;
  }
  return { start, oldEnd, inserted: newValue.slice(start, newEnd) };
}

/**
 * Aplica una edición **a través del navegador** (`execCommand`), de modo que Ctrl+Z / Ctrl+Y
 * deshagan también lo insertado por la barra y los atajos. Cambiar `value` por código borraría
 * el historial nativo del textarea. Devuelve `false` si el navegador no lo permite; el llamador
 * debe entonces aplicar la edición por la vía normal.
 */
export function applyEditNative(el: HTMLTextAreaElement, edit: Edit): boolean {
  if (typeof document.execCommand !== "function") return false;
  const { start, oldEnd, inserted } = diffRange(el.value, edit.value);
  el.focus();
  if (start !== oldEnd || inserted !== "") {
    el.setSelectionRange(start, oldEnd);
    const done =
      inserted === "" ? document.execCommand("delete") : document.execCommand("insertText", false, inserted);
    if (!done || el.value !== edit.value) return false;
  }
  el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
  return true;
}

/** Altura de `offset` (en px, relativa al borde superior del textarea) midiendo un espejo del texto. */
export function offsetTop(el: HTMLTextAreaElement, offset: number): number {
  const style = window.getComputedStyle(el);
  const mirror = document.createElement("div");
  const properties = [
    "boxSizing",
    "width",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "tabSize",
  ] as const;
  for (const property of properties) mirror.style[property] = style[property];
  Object.assign(mirror.style, {
    position: "absolute",
    visibility: "hidden",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    top: "0",
    left: "-9999px",
  });
  mirror.textContent = el.value.slice(0, offset);
  const marker = document.createElement("span");
  marker.textContent = "​";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const top = marker.offsetTop;
  document.body.removeChild(mirror);
  return top;
}
