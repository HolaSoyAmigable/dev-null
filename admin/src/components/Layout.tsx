import {
  BarChart3,
  Briefcase,
  FileText,
  FolderGit2,
  Image,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  Tags,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Métricas", icon: BarChart3, end: true },
  { to: "/posts", label: "Posts", icon: FileText },
  { to: "/projects", label: "Proyectos", icon: FolderGit2 },
  { to: "/career", label: "Carrera", icon: Briefcase },
  { to: "/taxonomy", label: "Etiquetas", icon: Tags },
  { to: "/media", label: "Media", icon: Image },
  { to: "/settings", label: "Ajustes", icon: Settings },
];

export function Layout() {
  const { user, logout } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
      >
        Saltar al contenido
      </a>
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <Logo />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Abrir menú"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Menu className="size-5" aria-hidden />
        </Button>
      </header>

      <aside
        className={cn(
          "flex-col border-r border-border bg-surface md:sticky md:top-0 md:flex md:h-screen",
          open ? "flex" : "hidden",
        )}
      >
        <div className="hidden px-5 py-5 md:block">
          <Logo className="text-lg" />
          <p className="mt-1 font-mono text-xs text-muted">panel de control</p>
        </div>
        <nav aria-label="Principal" className="flex-1 space-y-1 px-3 py-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-accent/15 font-medium text-accent"
                    : "text-muted hover:bg-surface-2 hover:text-fg",
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t border-border p-3">
          <p className="truncate px-2 font-mono text-xs text-muted" title={user?.email}>
            {user?.email}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {theme === "dark" ? (
                <Sun className="size-4" aria-hidden />
              ) : (
                <Moon className="size-4" aria-hidden />
              )}
            </Button>
            <Button variant="ghost" className="flex-1 justify-start" onClick={() => void logout()}>
              <LogOut className="size-4" aria-hidden />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </aside>

      <main id="main" className="min-w-0 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
