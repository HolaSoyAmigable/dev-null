import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BlogIndex } from "@/components/BlogIndex";

export const revalidate = 3600;

type Props = { params: Promise<{ page: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page } = await params;
  return { title: `Blog · página ${page}`, alternates: { canonical: `/blog/page/${page}` } };
}

export default async function BlogPaginatedPage({ params }: Props) {
  const { page: raw } = await params;
  const page = Number(raw);
  if (!Number.isInteger(page) || page < 1) notFound();
  if (page === 1) redirect("/blog");
  return <BlogIndex page={page} />;
}
