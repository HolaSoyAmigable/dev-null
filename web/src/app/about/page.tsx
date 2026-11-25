import type { Metadata } from "next";

import { Markdown } from "@/components/Markdown";
import { PageTitle } from "@/components/PostList";
import { getSettings } from "@/lib/data";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: "Sobre mí",
    description: settings.short_bio || undefined,
    alternates: { canonical: "/about" },
  };
}

export default async function AboutPage() {
  const settings = await getSettings();
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle prompt="whoami" title={settings.author_name} description={settings.short_bio || undefined} />
      {settings.about_md ? <Markdown source={settings.about_md} /> : null}
      {settings.social_links?.length ? (
        <section aria-labelledby="contact" className="mt-12 border-t border-border pt-8">
          <h2 id="contact" className="font-mono text-xl font-semibold">
            Dónde encontrarme
          </h2>
          <ul className="mt-4 space-y-2 font-mono text-sm">
            {settings.social_links.map((link) => (
              <li key={link.url}>
                <span className="text-muted">{link.label}:</span>{" "}
                <a href={link.url} rel="me noopener noreferrer" target="_blank" className="text-accent hover:underline">
                  {link.url.replace(/^https?:\/\//, "")}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
