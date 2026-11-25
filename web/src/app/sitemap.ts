import type { MetadataRoute } from "next";

import { getSlugs } from "@/lib/data";
import { siteUrl } from "@/lib/format";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getSlugs();
  const staticPages = ["/", "/blog", "/projects", "/career", "/about"].map((path) => ({
    url: siteUrl(path),
    changeFrequency: "weekly" as const,
    priority: path === "/" ? 1 : 0.8,
  }));
  return [
    ...staticPages,
    ...slugs.posts.map((post) => ({
      url: siteUrl(`/blog/${post.slug}`),
      lastModified: post.updated_at,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...slugs.projects.map((slug) => ({ url: siteUrl(`/projects/${slug}`), priority: 0.6 })),
    ...slugs.tags.map((slug) => ({ url: siteUrl(`/blog/tag/${slug}`), priority: 0.4 })),
    ...slugs.categories.map((slug) => ({ url: siteUrl(`/blog/category/${slug}`), priority: 0.5 })),
  ];
}
