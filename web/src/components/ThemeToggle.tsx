"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "devnull_theme";

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const isDark = () => document.documentElement.classList.contains("dark");

/** Alterna claro/oscuro. El tema inicial lo aplica ThemeScript antes de pintar. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => true);

  return (
    <button
      type="button"
      onClick={() => {
        const next = !isDark();
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
        } catch {
          // Sin almacenamiento: el cambio dura esta visita.
        }
      }}
      className="cursor-pointer rounded-md px-2 py-1 font-mono text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {dark ? "☾" : "☀"}
    </button>
  );
}

/** Script inline: aplica la preferencia guardada sin parpadeo (oscuro por defecto). */
export const themeScript = `try{if(localStorage.getItem("${STORAGE_KEY}")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;
