import type { PostStatus } from "@/api/types";

export const STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Borrador",
  scheduled: "Programado",
  published: "Publicado",
  archived: "Archivado",
};

export const STATUS_TONES: Record<PostStatus, "neutral" | "success" | "warning" | "info"> = {
  draft: "neutral",
  scheduled: "info",
  published: "success",
  archived: "warning",
};
