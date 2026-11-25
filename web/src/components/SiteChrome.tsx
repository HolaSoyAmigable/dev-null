import Link from "next/link";

import type { SiteSettings } from "@/lib/api/client";

import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/blog", label: "blog" },
  { href: "/projects", label: "proyectos" },
  { href: "/career", label: "carrera" },
  { href: "/about", label: "sobre mí" },
];

export function Header({ settings }: { settings: SiteSettings }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg" aria-label={`${settings.site_name}: inicio`}>
          <Logo name={settings.site_name} />
        </Link>
        <nav aria-label="Principal" className="flex flex-wrap items-center gap-1 font-mono text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-1 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/search"
            className="rounded-md px-2 py-1 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            aria-label="Buscar"
          >
            grep
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

export function Footer({ settings }: { settings: SiteSettings }) {
  const year = new Date().getUTCFullYear();
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-8 font-mono text-sm text-muted">
        <p>
          © {year} {settings.author_name} · <span className="text-accent">exit 0</span>
        </p>
        <ul className="flex flex-wrap gap-4">
          {(settings.social_links ?? []).map((link) => (
            <li key={link.url}>
              <a href={link.url} rel="me noopener noreferrer" target="_blank" className="hover:text-fg">
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a href="/rss.xml" className="hover:text-fg">
              rss
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
