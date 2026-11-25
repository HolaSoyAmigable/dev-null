import { timingSafeEqual } from "node:crypto";

import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Webhook de revalidación ISR (docs/01-architecture.md). Lo llama la API tras publicar.
 * Cabecera `x-revalidate-secret`; body `{ "paths": ["/blog/mi-post", ...] }`.
 * "*" revalida el sitio entero (cambios de settings que afectan a cabecera y pie).
 */
const MAX_PATHS = 100;

function validSecret(received: string | null): boolean {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!validSecret(request.headers.get("x-revalidate-secret"))) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Secreto inválido.", details: {} } }, { status: 401 });
  }
  let paths: unknown;
  try {
    paths = ((await request.json()) as { paths?: unknown }).paths;
  } catch {
    paths = undefined;
  }
  if (!Array.isArray(paths) || paths.length > MAX_PATHS || !paths.every((p) => typeof p === "string" && (p === "*" || p.startsWith("/")))) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Body inválido.", details: {} } }, { status: 400 });
  }

  const revalidated: string[] = [];
  if (paths.includes("*")) {
    revalidatePath("/", "layout");
    revalidated.push("*");
  } else {
    for (const path of paths as string[]) {
      revalidatePath(path);
      revalidated.push(path);
    }
    // El listado paginado depende de /blog: se regeneran todas sus páginas.
    if (paths.includes("/blog")) revalidatePath("/blog/page/[page]", "page");
  }
  return NextResponse.json({ revalidated, now: Date.now() });
}
