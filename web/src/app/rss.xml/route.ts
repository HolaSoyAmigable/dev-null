import { getPosts, getSettings } from "@/lib/data";
import { siteUrl } from "@/lib/format";

export const revalidate = 3600;

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Feed RSS 2.0 con las últimas 20 publicaciones. */
export async function GET() {
  const [settings, posts] = await Promise.all([getSettings(), getPosts({ pageSize: 20 })]);
  const title = `${settings.site_name} — ${settings.author_name}`;
  const items = posts.items
    .map((post) => {
      const url = siteUrl(`/blog/${post.slug}`);
      return [
        "<item>",
        `<title>${escape(post.title)}</title>`,
        `<link>${url}</link>`,
        `<guid isPermaLink="true">${url}</guid>`,
        post.published_at ? `<pubDate>${new Date(post.published_at).toUTCString()}</pubDate>` : "",
        post.excerpt ? `<description>${escape(post.excerpt)}</description>` : "",
        ...post.tags.map((t) => `<category>${escape(t.name)}</category>`),
        "</item>",
      ].join("");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escape(title)}</title>
<link>${siteUrl("/")}</link>
<description>${escape(settings.short_bio || "Aquí nada se descarta.")}</description>
<language>es</language>
<atom:link href="${siteUrl("/rss.xml")}" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
