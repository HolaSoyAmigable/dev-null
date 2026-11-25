import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageTitle, PostList } from "@/components/PostList";
import { getCategories, getPosts, getSlugs } from "@/lib/data";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getSlugs()).categories.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getCategories()).find((c) => c.slug === slug);
  return category
    ? {
        title: category.name,
        description: category.description ?? undefined,
        alternates: { canonical: `/blog/category/${slug}` },
      }
    : {};
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const [categories, posts] = await Promise.all([getCategories(), getPosts({ category: slug, pageSize: 100 })]);
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();
  return (
    <>
      <PageTitle
        prompt={`cd /blog/${category.slug}`}
        title={category.name}
        description={category.description ?? `${category.post_count} publicaciones en esta categoría.`}
      />
      <PostList posts={posts.items} />
    </>
  );
}
