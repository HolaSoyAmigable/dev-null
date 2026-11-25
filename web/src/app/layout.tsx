import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { Beacon } from "@/components/Beacon";
import { Footer, Header } from "@/components/SiteChrome";
import { themeScript } from "@/components/ThemeToggle";
import { getSettings } from "@/lib/data";
import { siteUrl } from "@/lib/format";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const revalidate = 3600;

/** El <title> siempre incluye el nombre del blog y el del autor (docs/00-vision.md). */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const brand = `${settings.site_name} — ${settings.author_name}`;
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: brand, template: `%s · ${brand}` },
    description: settings.short_bio || "Aquí nada se descarta.",
    applicationName: settings.site_name,
    authors: [{ name: settings.author_name }],
    alternates: {
      canonical: "/",
      types: { "application/rss+xml": [{ url: "/rss.xml", title: brand }] },
    },
    openGraph: { type: "website", siteName: brand, locale: "es_MX" },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  return (
    <html lang="es" className={`dark ${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-bg"
        >
          Saltar al contenido
        </a>
        <Header settings={settings} />
        <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-10">
          {children}
        </main>
        <Footer settings={settings} />
        <Beacon />
      </body>
    </html>
  );
}
