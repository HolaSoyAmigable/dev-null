import "server-only";

import { cache } from "react";

import {
  api,
  fetchOrNull,
  fetchWithFallback,
  liveApi,
  type CareerEntry,
  type CategoryWithCount,
  type PostPage,
  type ProjectSummary,
  type PublicSlugs,
  type SearchPage,
  type SiteSettings,
  type TagWithCount,
} from "./api/client";

export const PAGE_SIZE = 10;

const DEFAULT_SETTINGS: SiteSettings = {
  site_name: "dev/null",
  author_name: "[TU NOMBRE]",
  short_bio: "",
  social_links: [],
  about_md: "",
};

const emptyPage = (page = 1, pageSize = PAGE_SIZE): PostPage => ({
  items: [],
  total: 0,
  page,
  page_size: pageSize,
});

export const getSettings = cache(
  async (): Promise<SiteSettings> =>
    fetchWithFallback(api.GET("/api/v1/public/settings"), DEFAULT_SETTINGS),
);

type PostFilters = {
  page?: number;
  pageSize?: number;
  tag?: string;
  category?: string;
  project?: string;
  featured?: boolean;
};

export async function getPosts(filters: PostFilters = {}): Promise<PostPage> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  return fetchWithFallback(
    api.GET("/api/v1/public/posts", {
      params: {
        query: {
          page,
          page_size: pageSize,
          tag: filters.tag,
          category: filters.category,
          project: filters.project,
          featured: filters.featured,
        },
      },
    }),
    emptyPage(page, pageSize),
  );
}

export const getPost = cache(async (slug: string) =>
  fetchOrNull(api.GET("/api/v1/public/posts/{slug}", { params: { path: { slug } } })),
);

export async function getRelated(slug: string) {
  return fetchWithFallback(
    api.GET("/api/v1/public/posts/{slug}/related", { params: { path: { slug } } }),
    [],
  );
}

export const getProjects = cache(
  async (): Promise<ProjectSummary[]> => fetchWithFallback(api.GET("/api/v1/public/projects"), []),
);

export const getProject = cache(async (slug: string) =>
  fetchOrNull(api.GET("/api/v1/public/projects/{slug}", { params: { path: { slug } } })),
);

export async function getCareer(): Promise<CareerEntry[]> {
  return fetchWithFallback(api.GET("/api/v1/public/career"), []);
}

export const getTags = cache(
  async (): Promise<TagWithCount[]> => fetchWithFallback(api.GET("/api/v1/public/tags"), []),
);

export const getCategories = cache(
  async (): Promise<CategoryWithCount[]> =>
    fetchWithFallback(api.GET("/api/v1/public/categories"), []),
);

export async function getSlugs(): Promise<PublicSlugs> {
  return fetchWithFallback(api.GET("/api/v1/public/slugs"), {
    posts: [],
    projects: [],
    tags: [],
    categories: [],
  });
}

export async function search(q: string, page: number): Promise<SearchPage> {
  return fetchWithFallback(
    liveApi.GET("/api/v1/public/search", { params: { query: { q, page, page_size: PAGE_SIZE } } }),
    { items: [], total: 0, page, page_size: PAGE_SIZE },
  );
}
