import type { Media } from "@/api/types";

/** Destino de un salto del índice: posición en el Markdown y número de orden del título. */
export type JumpTarget = { offset: number; index: number };

/** Lo que la página necesita de cualquier editor (visual o Markdown). */
export type EditorHandle = {
  /** Inserta una imagen ya subida en la posición del cursor. */
  insertMedia: (media: Media) => void;
  /** Lleva el cursor y la vista a un título del índice. */
  jumpTo: (target: JumpTarget) => void;
};
