import "server-only";

import createClient from "openapi-fetch";

import type { components, paths } from "./schema";

export type Schemas = components["schemas"];
export type PostSummary = Schemas["PublicPostSummary"];
export type PostDetail = Schemas["PublicPostDetail"];
export type SearchResult = Schemas["SearchResult"];
export type ProjectSummary = Schemas["PublicProjectSummary"];
export type ProjectDetail = Schemas["PublicProjectDetail"];
export type CareerEntry = Schemas["PublicCareerEntry"];
export type TagWithCount = Schemas["TagWithCount"];
export type CategoryWithCount = Schemas["CategoryWithCount"];
export type SiteSettings = Schemas["SiteSettings"];
export type PublicSlugs = Schemas["PublicSlugs"];
export type PostPage = Schemas["Page_PublicPostSummary_"];
export type SearchPage = Schemas["Page_SearchResult_"];

/** Red de seguridad del ISR: si falla el webhook, las páginas se regeneran cada hora. */
export const REVALIDATE_SECONDS = 3600;

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:8000";

/** Cliente server-side: las respuestas se cachean y se revalidan vía webhook. */
export const api = createClient<paths>({
  baseUrl: apiUrl,
  fetch: (request: Request) => fetch(request, { next: { revalidate: REVALIDATE_SECONDS } }),
});

/** Cliente sin caché (búsqueda en tiempo real). */
export const liveApi = createClient<paths>({
  baseUrl: apiUrl,
  fetch: (request: Request) => fetch(request, { cache: "no-store" }),
});

export class ApiUnavailableError extends Error {}

type Result<T> = { data?: T; error?: unknown; response: Response };

/** Devuelve los datos, `null` si es 404, o lanza si la API falla. */
export async function fetchOrNull<T>(promise: Promise<Result<T>>): Promise<T | null> {
  let result: Result<T>;
  try {
    result = await promise;
  } catch (error) {
    throw new ApiUnavailableError(`API no disponible: ${(error as Error).message}`);
  }
  if (result.response.status === 404) return null;
  if (!result.response.ok || result.data === undefined) {
    throw new ApiUnavailableError(`La API respondió ${result.response.status}`);
  }
  return result.data;
}

/** Igual que fetchOrNull, pero usa `fallback` si la API no responde (p. ej. durante el build). */
export async function fetchWithFallback<T>(promise: Promise<Result<T>>, fallback: T): Promise<T> {
  try {
    return (await fetchOrNull(promise)) ?? fallback;
  } catch (error) {
    console.warn(`[devnull] ${(error as Error).message}; usando valores por defecto.`);
    return fallback;
  }
}
