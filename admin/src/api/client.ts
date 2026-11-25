import createClient, { type Middleware } from "openapi-fetch";

import type { paths } from "./schema";
import type { ApiErrorBody } from "./types";

/**
 * Cliente tipado generado desde el OpenAPI de FastAPI.
 * El access token vive solo en memoria (nunca en localStorage).
 * El refresh token es una cookie httpOnly que el navegador envía a /api/v1/auth.
 */

let accessToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  listeners.forEach((listener) => listener(token));
}

export function onAccessTokenChange(listener: (token: string | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, body: Partial<ApiErrorBody> | undefined) {
    super(body?.error?.message ?? "Error inesperado de la API.");
    this.status = status;
    this.code = body?.error?.code ?? "UNKNOWN";
    this.details = (body?.error?.details as Record<string, unknown> | undefined) ?? {};
  }
}

let refreshing: Promise<string | null> | null = null;

/** Rota el refresh token; deduplica peticiones concurrentes. */
export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= fetch("/api/v1/auth/refresh", { method: "POST", credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) return null;
      const body = (await response.json()) as { access_token: string };
      return body.access_token;
    })
    .catch(() => null)
    .then((token) => {
      setAccessToken(token);
      return token;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

const authMiddleware: Middleware = {
  onRequest({ request }) {
    if (accessToken) request.headers.set("Authorization", `Bearer ${accessToken}`);
    return request;
  },
};

export const api = createClient<paths>({ baseUrl: "", credentials: "same-origin" });
api.use(authMiddleware);

/** fetch con reintento tras refrescar el token si la API responde 401. */
async function fetchWithRefresh(input: Request): Promise<Response> {
  const retry = input.clone();
  const response = await fetch(input);
  if (response.status !== 401 || input.url.includes("/auth/")) return response;
  const token = await refreshAccessToken();
  if (!token) return response;
  retry.headers.set("Authorization", `Bearer ${token}`);
  return fetch(retry);
}

export const authedApi = createClient<paths>({
  baseUrl: "",
  credentials: "same-origin",
  fetch: fetchWithRefresh,
});
authedApi.use(authMiddleware);

/** Convierte la respuesta de openapi-fetch en datos o lanza ApiError. */
export async function unwrap<T>(
  promise: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await promise;
  if (!response.ok) throw new ApiError(response.status, error as ApiErrorBody | undefined);
  return data as T;
}
