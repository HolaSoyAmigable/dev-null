import type { Metadata } from "next";
import { BlogIndex } from "@/components/BlogIndex";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Blog",
  description: "Artículos técnicos, bitácoras de proyectos y notas.",
  alternates: { canonical: "/blog" },
};

export default function BlogPage() {
  return <BlogIndex page={1} />;
}
