import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/Markdown";
import { PostDevLinks, PostList, PostMeta, TagLinks } from "@/components/PostList";
import { getPost, getRelated, getSettings, getSlugs } from "@/lib/data";
import { extractToc, siteUrl } from "@/lib/format";

export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await getSlugs();
  return slugs.posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  const image = post.og_media ?? post.cover;
  const description = post.seo_description ?? post.excerpt ?? undefined;
  return {
    title: post.seo_title ?? post.title,
    description,
    alternates: { canonical: post.canonical_url ?? `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.seo_title ?? post.title,
      description,
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      tags: post.tags.map((t) => t.name),
      images: image ? [{ url: image.url, width: image.width ?? undefined, height: image.height ?? undefined, alt: image.alt_text ?? "" }] : undefined,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const [related, settings] = await Promise.all([getRelated(slug), getSettings()]);
  const toc = extractToc(post.content_md);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seo_description ?? post.excerpt ?? undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: { "@type": "Person", name: settings.author_name },
    mainEntityOfPage: siteUrl(`/blog/${post.slug}`),
    image: post.cover ? siteUrl(post.cover.url) : undefined,
    keywords: post.tags.map((t) => t.name).join(", ") || undefined,
  };

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <header className="mx-auto max-w-3xl border-b border-border pb-8">
        <p className="font-mono text-sm text-muted">
          <Link href="/blog" className="hover:text-accent">
            ~/blog
          </Link>
          <span className="text-accent">/</span>
          {post.slug}
        </p>
        <h1 className="mt-4 font-mono text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{post.title}</h1>
        {post.excerpt ? <p className="mt-4 text-lg text-muted">{post.excerpt}</p> : null}
        <div className="mt-5 space-y-3">
          <PostMeta post={post} />
          <PostDevLinks post={post} />
          <TagLinks tags={post.tags} />
        </div>
      </header>

      {post.cover ? (
        <img
          src={post.cover.url}
          alt={post.cover.alt_text ?? ""}
          width={post.cover.width ?? undefined}
          height={post.cover.height ?? undefined}
          className="mx-auto mt-8 w-full max-w-3xl rounded-lg"
          fetchPriority="high"
        />
      ) : null}

      <div className="mx-auto mt-10 grid max-w-5xl gap-10 lg:grid-cols-[1fr_14rem]">
        <div className="mx-auto w-full min-w-0 max-w-3xl lg:mx-0">
          <Markdown source={post.content_md} />
        </div>
        {toc.length > 1 ? (
          <nav aria-labelledby="toc-title" className="order-first lg:order-none">
            <div className="rounded-lg border border-border p-4 font-mono text-sm lg:sticky lg:top-20">
              <h2 id="toc-title" className="mb-2 text-muted">
                contenido
              </h2>
              <ol className="space-y-1.5">
                {toc.map((item) => (
                  <li key={item.id} className={item.level === 3 ? "pl-3" : ""}>
                    <a href={`#${item.id}`} className="text-muted hover:text-accent">
                      {item.text}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
        ) : null}
      </div>

      {related.length ? (
        <section aria-labelledby="related" className="mx-auto mt-16 max-w-3xl border-t border-border pt-8">
          <h2 id="related" className="font-mono text-xl font-semibold">
            También te puede interesar
          </h2>
          <PostList posts={related} headingLevel="h3" />
        </section>
      ) : null}
    </article>
  );
}
