import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authedApi as api, unwrap } from "./client";
import type {
  CareerCreate,
  PostCreate,
  PostStatus,
  PostUpdate,
  ProjectCreate,
  SiteSettingsUpdate,
} from "./types";

/** Claves de TanStack Query centralizadas. */
export const keys = {
  posts: (filters: object) => ["posts", filters] as const,
  post: (id: number) => ["post", id] as const,
  revisions: (id: number) => ["post", id, "revisions"] as const,
  tags: ["tags"] as const,
  categories: ["categories"] as const,
  projects: ["projects"] as const,
  project: (id: number) => ["project", id] as const,
  career: ["career"] as const,
  media: (page: number) => ["media", page] as const,
  settings: ["settings"] as const,
  metrics: (name: string, range: object) => ["metrics", name, range] as const,
};

// ── Posts ────────────────────────────────────────────────────────────────────

export function usePosts(filters: { status?: PostStatus; q?: string; page: number }) {
  return useQuery({
    queryKey: keys.posts(filters),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/admin/posts", {
          params: {
            query: {
              status: filters.status,
              q: filters.q || undefined,
              page: filters.page,
              page_size: 20,
            },
          },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function usePost(id: number | undefined) {
  return useQuery({
    queryKey: keys.post(id ?? 0),
    queryFn: () =>
      unwrap(api.GET("/api/v1/admin/posts/{post_id}", { params: { path: { post_id: id! } } })),
    enabled: id !== undefined,
  });
}

export function useRevisions(id: number) {
  return useQuery({
    queryKey: keys.revisions(id),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/admin/posts/{post_id}/revisions", { params: { path: { post_id: id } } }),
      ),
  });
}

export function useCreatePost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: PostCreate) => unwrap(api.POST("/api/v1/admin/posts", { body })),
    onSuccess: () => client.invalidateQueries({ queryKey: ["posts"] }),
  });
}

export function useUpdatePost(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: PostUpdate) =>
      unwrap(
        api.PATCH("/api/v1/admin/posts/{post_id}", { params: { path: { post_id: id } }, body }),
      ),
    onSuccess: (post) => {
      client.setQueryData(keys.post(id), post);
      void client.invalidateQueries({ queryKey: ["posts"] });
      void client.invalidateQueries({ queryKey: keys.revisions(id) });
    },
  });
}

type PostAction = "publish" | "unpublish" | "archive" | "duplicate";

export function usePostAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: PostAction }) => {
      const options = { params: { path: { post_id: id } } };
      switch (action) {
        case "publish":
          return unwrap(api.POST("/api/v1/admin/posts/{post_id}/publish", options));
        case "unpublish":
          return unwrap(api.POST("/api/v1/admin/posts/{post_id}/unpublish", options));
        case "archive":
          return unwrap(api.POST("/api/v1/admin/posts/{post_id}/archive", options));
        case "duplicate":
          return unwrap(api.POST("/api/v1/admin/posts/{post_id}/duplicate", options));
      }
    },
    onSuccess: (post, { id }) => {
      if (post.id === id) client.setQueryData(keys.post(id), post);
      void client.invalidateQueries({ queryKey: ["posts"] });
      void client.invalidateQueries({ queryKey: keys.revisions(id) });
    },
  });
}

export function useSchedulePost(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (scheduledFor: string) =>
      unwrap(
        api.POST("/api/v1/admin/posts/{post_id}/schedule", {
          params: { path: { post_id: id } },
          body: { scheduled_for: scheduledFor },
        }),
      ),
    onSuccess: (post) => {
      client.setQueryData(keys.post(id), post);
      void client.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

export function useDeletePost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrap(api.DELETE("/api/v1/admin/posts/{post_id}", { params: { path: { post_id: id } } })),
    onSuccess: () => client.invalidateQueries({ queryKey: ["posts"] }),
  });
}

export function useRestoreRevision(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (revisionId: number) =>
      unwrap(
        api.POST("/api/v1/admin/posts/{post_id}/restore-revision/{revision_id}", {
          params: { path: { post_id: id, revision_id: revisionId } },
        }),
      ),
    onSuccess: (post) => {
      client.setQueryData(keys.post(id), post);
      void client.invalidateQueries({ queryKey: keys.revisions(id) });
    },
  });
}

// ── Taxonomía ────────────────────────────────────────────────────────────────

export function useTags() {
  return useQuery({
    queryKey: keys.tags,
    queryFn: () => unwrap(api.GET("/api/v1/admin/tags")),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => unwrap(api.GET("/api/v1/admin/categories")),
  });
}

export function useTaxonomyMutations() {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: keys.tags });
    void client.invalidateQueries({ queryKey: keys.categories });
  };
  return {
    createTag: useMutation({
      mutationFn: (name: string) => unwrap(api.POST("/api/v1/admin/tags", { body: { name } })),
      onSuccess: refresh,
    }),
    updateTag: useMutation({
      mutationFn: ({ id, name, slug }: { id: number; name: string; slug: string }) =>
        unwrap(
          api.PATCH("/api/v1/admin/tags/{tag_id}", {
            params: { path: { tag_id: id } },
            body: { name, slug },
          }),
        ),
      onSuccess: refresh,
    }),
    deleteTag: useMutation({
      mutationFn: (id: number) =>
        unwrap(api.DELETE("/api/v1/admin/tags/{tag_id}", { params: { path: { tag_id: id } } })),
      onSuccess: refresh,
    }),
    createCategory: useMutation({
      mutationFn: (body: { name: string; description?: string | null }) =>
        unwrap(api.POST("/api/v1/admin/categories", { body })),
      onSuccess: refresh,
    }),
    updateCategory: useMutation({
      mutationFn: ({
        id,
        ...body
      }: {
        id: number;
        name: string;
        slug: string;
        description: string | null;
      }) =>
        unwrap(
          api.PATCH("/api/v1/admin/categories/{category_id}", {
            params: { path: { category_id: id } },
            body,
          }),
        ),
      onSuccess: refresh,
    }),
    deleteCategory: useMutation({
      mutationFn: (id: number) =>
        unwrap(
          api.DELETE("/api/v1/admin/categories/{category_id}", {
            params: { path: { category_id: id } },
          }),
        ),
      onSuccess: refresh,
    }),
  };
}

// ── Media ────────────────────────────────────────────────────────────────────

export function useMediaList(page: number, enabled = true) {
  return useQuery({
    enabled,
    queryKey: keys.media(page),
    queryFn: () =>
      unwrap(api.GET("/api/v1/admin/media", { params: { query: { page, page_size: 24 } } })),
    placeholderData: (previous) => previous,
  });
}

export function useMediaMutations() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ["media"] });
  return {
    upload: useMutation({
      mutationFn: ({ file, altText }: { file: File; altText?: string }) =>
        unwrap(
          api.POST("/api/v1/admin/media", {
            body: { file: file as unknown as string, alt_text: altText || null },
            bodySerializer: (body) => {
              const form = new FormData();
              form.append("file", body.file as unknown as Blob);
              if (body.alt_text) form.append("alt_text", body.alt_text);
              return form;
            },
          }),
        ),
      onSuccess: refresh,
    }),
    updateAlt: useMutation({
      mutationFn: ({ id, altText }: { id: number; altText: string }) =>
        unwrap(
          api.PATCH("/api/v1/admin/media/{media_id}", {
            params: { path: { media_id: id } },
            body: { alt_text: altText || null },
          }),
        ),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: number) =>
        unwrap(
          api.DELETE("/api/v1/admin/media/{media_id}", { params: { path: { media_id: id } } }),
        ),
      onSuccess: refresh,
    }),
  };
}

// ── Proyectos ────────────────────────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: keys.projects,
    queryFn: () => unwrap(api.GET("/api/v1/admin/projects")),
  });
}

export function useProject(id: number | undefined) {
  return useQuery({
    queryKey: keys.project(id ?? 0),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/admin/projects/{project_id}", {
          params: { path: { project_id: id! } },
        }),
      ),
    enabled: id !== undefined,
  });
}

export function useSaveProject(id: number | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ProjectCreate) =>
      id === undefined
        ? unwrap(api.POST("/api/v1/admin/projects", { body }))
        : unwrap(
            api.PATCH("/api/v1/admin/projects/{project_id}", {
              params: { path: { project_id: id } },
              body,
            }),
          ),
    onSuccess: (project) => {
      client.setQueryData(keys.project(project.id), project);
      void client.invalidateQueries({ queryKey: keys.projects });
    },
  });
}

export function useDeleteProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrap(
        api.DELETE("/api/v1/admin/projects/{project_id}", {
          params: { path: { project_id: id } },
        }),
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.projects }),
  });
}

// ── Carrera ──────────────────────────────────────────────────────────────────

export function useCareer() {
  return useQuery({
    queryKey: keys.career,
    queryFn: () => unwrap(api.GET("/api/v1/admin/career")),
  });
}

export function useCareerMutations() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: keys.career });
  return {
    save: useMutation({
      mutationFn: ({ id, body }: { id?: number; body: CareerCreate }) =>
        id === undefined
          ? unwrap(api.POST("/api/v1/admin/career", { body }))
          : unwrap(
              api.PATCH("/api/v1/admin/career/{entry_id}", {
                params: { path: { entry_id: id } },
                body,
              }),
            ),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: number) =>
        unwrap(
          api.DELETE("/api/v1/admin/career/{entry_id}", { params: { path: { entry_id: id } } }),
        ),
      onSuccess: refresh,
    }),
    reorder: useMutation({
      mutationFn: (items: { id: number; sort_order: number }[]) =>
        unwrap(api.PATCH("/api/v1/admin/career/reorder", { body: { items } })),
      onSuccess: (entries) => client.setQueryData(keys.career, entries),
    }),
  };
}

// ── Settings ─────────────────────────────────────────────────────────────────

export function useSiteSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: () => unwrap(api.GET("/api/v1/admin/settings")),
  });
}

export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: SiteSettingsUpdate) =>
      unwrap(api.PATCH("/api/v1/admin/settings", { body })),
    onSuccess: (settings) => client.setQueryData(keys.settings, settings),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      unwrap(api.POST("/api/v1/auth/change-password", { body })),
  });
}

// ── Métricas ─────────────────────────────────────────────────────────────────

export type DateRange = { start: string; end: string };

export function useMetrics(range: DateRange) {
  const query = { start: range.start, end: range.end };
  const overview = useQuery({
    queryKey: keys.metrics("overview", range),
    queryFn: () => unwrap(api.GET("/api/v1/admin/metrics/overview", { params: { query } })),
  });
  const timeseries = useQuery({
    queryKey: keys.metrics("timeseries", range),
    queryFn: () => unwrap(api.GET("/api/v1/admin/metrics/timeseries", { params: { query } })),
  });
  const topPosts = useQuery({
    queryKey: keys.metrics("top-posts", range),
    queryFn: () => unwrap(api.GET("/api/v1/admin/metrics/top-posts", { params: { query } })),
  });
  const referrers = useQuery({
    queryKey: keys.metrics("referrers", range),
    queryFn: () => unwrap(api.GET("/api/v1/admin/metrics/referrers", { params: { query } })),
  });
  const devices = useQuery({
    queryKey: keys.metrics("devices", range),
    queryFn: () => unwrap(api.GET("/api/v1/admin/metrics/devices", { params: { query } })),
  });
  const browsers = useQuery({
    queryKey: keys.metrics("browsers", range),
    queryFn: () => unwrap(api.GET("/api/v1/admin/metrics/browsers", { params: { query } })),
  });
  const countries = useQuery({
    queryKey: keys.metrics("countries", range),
    queryFn: () => unwrap(api.GET("/api/v1/admin/metrics/countries", { params: { query } })),
  });
  return { overview, timeseries, topPosts, referrers, devices, browsers, countries };
}

export function useRealtime() {
  return useQuery({
    queryKey: ["metrics", "realtime"],
    queryFn: () => unwrap(api.GET("/api/v1/admin/metrics/realtime")),
    refetchInterval: 15_000,
  });
}

export function usePostMetrics(id: number, range: DateRange) {
  return useQuery({
    queryKey: keys.metrics(`post-${id}`, range),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/admin/metrics/posts/{post_id}", {
          params: { path: { post_id: id }, query: range },
        }),
      ),
  });
}
