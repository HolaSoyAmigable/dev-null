import { describe, expect, it } from "vitest";

import { toPayload, postFormSchema } from "@/features/posts/postForm";
import { formatBytes, slugify } from "@/lib/utils";

describe("slugify", () => {
  it("genera slugs ASCII como el backend", () => {
    expect(slugify("¡Hola, Mundo! Ñandú & café")).toBe("hola-mundo-nandu-cafe");
    expect(slugify("dev/null")).toBe("dev-null");
    expect(slugify("!!!")).toBe("sin-titulo");
  });
});

describe("formatBytes", () => {
  it("usa unidades legibles", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("postForm", () => {
  it("convierte campos vacíos en null y los ids en números", () => {
    const values = postFormSchema.parse({
      title: " Hola ",
      slug: "",
      excerpt: "",
      content_md: "texto",
      category_id: "3",
      project_id: "",
      tag_ids: [1, 2],
      seo_title: "",
      seo_description: "",
      canonical_url: "",
    });
    const payload = toPayload(values, null, null);
    expect(payload).toMatchObject({
      title: "Hola",
      slug: null,
      excerpt: null,
      category_id: 3,
      project_id: null,
      tag_ids: [1, 2],
      canonical_url: null,
    });
  });

  it("rechaza slugs y URLs inválidos", () => {
    const result = postFormSchema.safeParse({
      title: "x",
      slug: "No Válido",
      excerpt: "",
      content_md: "",
      category_id: "",
      project_id: "",
      tag_ids: [],
      seo_title: "",
      seo_description: "",
      canonical_url: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });
});
