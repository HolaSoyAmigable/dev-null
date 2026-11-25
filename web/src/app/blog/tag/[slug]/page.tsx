import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageTitle, PostList } from "@/components/PostList";
import { getPosts, getSlugs, getTags } from "@/lib/data";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getSlugs()).tags.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tag = (await getTags()).find((t) => t.slug === slug);
  return tag ? { title: `#${tag.name}`, alternates: { canonical: `/blog/tag/${slug}` } } : {};
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  const [tags, posts] = await Promise.all([getTags(), getPosts({ tag: slug, pageSize: 100 })]);
  const tag = tags.find((t) => t.slug === slug);
  if (!tag) notFound();
  return (
    <>
      <PageTitle prompt={`grep -l "#${tag.slug}" /blog/*`} title={`#${tag.name}`} description={`${tag.post_count} publicaciones con esta etiqueta.`} />
      <PostList posts={posts.items} />
    </>
  );
}
