import { z } from "zod";

import type { Media, Post, PostCreate } from "@/api/types";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((value) => value || null);

/** Validación del formulario (los tipos de la API vienen del OpenAPI). */
export const postFormSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio.").max(300),
  slug: z
    .string()
    .trim()
    .max(120)
    .regex(/^([a-z0-9]+(?:-[a-z0-9]+)*)?$/, "Solo minúsculas, números y guiones."),
  excerpt: optionalText(1000),
  content_md: z.string(),
  category_id: z.string(),
  project_id: z.string(),
  tag_ids: z.array(z.number()),
  seo_title: optionalText(300),
  seo_description: optionalText(500),
  canonical_url: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), "Debe ser una URL http(s).")
    .transform((value) => value || null),
});

export type PostFormInput = z.input<typeof postFormSchema>;
export type PostFormOutput = z.output<typeof postFormSchema>;

export function toFormValues(post: Post | undefined): PostFormInput {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    content_md: post?.content_md ?? "",
    category_id: post?.category_id ? String(post.category_id) : "",
    project_id: post?.project_id ? String(post.project_id) : "",
    tag_ids: post?.tags.map((t) => t.id) ?? [],
    seo_title: post?.seo_title ?? "",
    seo_description: post?.seo_description ?? "",
    canonical_url: post?.canonical_url ?? "",
  };
}

export function toPayload(
  values: PostFormOutput,
  cover: Media | null,
  og: Media | null,
): PostCreate {
  return {
    title: values.title,
    slug: values.slug || null,
    excerpt: values.excerpt,
    content_md: values.content_md,
    category_id: values.category_id ? Number(values.category_id) : null,
    project_id: values.project_id ? Number(values.project_id) : null,
    tag_ids: values.tag_ids,
    cover_media_id: cover?.id ?? null,
    og_media_id: og?.id ?? null,
    seo_title: values.seo_title,
    seo_description: values.seo_description,
    canonical_url: values.canonical_url,
  };
}
