import { describe, expect, it } from "vitest";

import type { Post } from "@/api/types";
import { isGithubRepo, postFormSchema, toFormValues, toPayload } from "@/features/posts/postForm";

function parse(overrides: Record<string, unknown> = {}) {
  return postFormSchema.safeParse({ ...toFormValues(undefined), title: "Hola", ...overrides });
}

describe("isGithubRepo", () => {
  it("acepta usuario/repositorio y URLs de GitHub", () => {
    for (const ok of ["", "usuario/repo", "Usuario/mi-repo.js", "https://github.com/usuario/repo", "https://github.com/usuario/repo.git", "https://www.github.com/u/r/tree/main"]) {
      expect(isGithubRepo(ok), ok).toBe(true);
    }
  });

  it("rechaza lo demás", () => {
    for (const bad of ["solo-nombre", "https://gitlab.com/u/r", "u/r/extra", "-u/r", "http://github.com/u"]) {
      expect(isGithubRepo(bad), bad).toBe(false);
    }
  });
});

describe("formulario de posts: metadatos de desarrollo", () => {
  it("los campos nuevos son opcionales y por defecto vacíos", () => {
    const result = parse();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.github_repo).toBeNull();
      expect(result.data.series_order).toBeNull();
      expect(result.data.featured).toBe(false);
    }
  });

  it("valida repositorio y orden de serie", () => {
    expect(parse({ github_repo: "no es un repo" }).success).toBe(false);
    expect(parse({ series_order: "0" }).success).toBe(false);
    expect(parse({ series_order: "abc" }).success).toBe(false);
    const ok = parse({ github_repo: " usuario/repo ", series_order: "12", featured: true });
    expect(ok.success && [ok.data.github_repo, ok.data.series_order, ok.data.featured]).toEqual(["usuario/repo", 12, true]);
  });

  it("el payload conserva los campos existentes y añade los nuevos", () => {
    const values = postFormSchema.parse({
      ...toFormValues(undefined),
      title: "Post",
      project_id: "4",
      series_order: "2",
      github_repo: "u/r",
      featured: true,
    });
    const payload = toPayload(values, { id: 9 } as never, { id: 10 } as never);
    expect(payload).toMatchObject({
      title: "Post",
      project_id: 4,
      cover_media_id: 9,
      og_media_id: 10,
      github_repo: "u/r",
      series_order: 2,
      featured: true,
    });
  });

  it("sin proyecto el orden de serie se envía como null", () => {
    const values = postFormSchema.parse({ ...toFormValues(undefined), title: "Post", series_order: "5" });
    expect(toPayload(values, null, null).series_order).toBeNull();
  });

  it("toFormValues carga los valores del post", () => {
    const post = {
      title: "T", slug: "t", excerpt: null, content_md: "", category_id: null, project_id: 3, tags: [],
      seo_title: null, seo_description: null, canonical_url: null,
      github_repo: "u/r", series_order: 7, featured: true,
    } as unknown as Post;
    expect(toFormValues(post)).toMatchObject({ github_repo: "u/r", series_order: "7", featured: true, project_id: "3" });
  });
});
