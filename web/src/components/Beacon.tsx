"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Métricas sin cookies (docs/04-metrics.md):
 * - pageview con fetch(keepalive) para recibir un view_token firmado;
 * - engagement (scroll máximo y segundos activos) con navigator.sendBeacon al salir.
 * Se omite con Do Not Track / GPC y en el navegador del administrador.
 */
const ENDPOINT = "/api/v1/public/events";
const ADMIN_FLAG = "devnull_admin";
const IDLE_MS = 30_000;
// Reutiliza el pageview en curso si el efecto se monta dos veces (StrictMode en desarrollo).
let lastView: { path: string; at: number; token: Promise<string | null> } | null = null;

function sendPageview(path: string): Promise<string | null> {
  const now = Date.now();
  if (lastView?.path === path && now - lastView.at < 1000) return lastView.token;
  const body = JSON.stringify({ path, referrer: document.referrer || null, ...utm() });
  const token = fetch(ENDPOINT, {
    method: "POST",
    body,
    keepalive: true,
    headers: { "Content-Type": "text/plain" },
  })
    .then((r) => (r.ok ? (r.json() as Promise<{ view_token?: string | null }>) : null))
    .then((data) => data?.view_token ?? null)
    .catch(() => null);
  lastView = { path, at: now, token };
  return token;
}

function trackingDisabled(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.doNotTrack === "1" || nav.globalPrivacyControl) return true;
  try {
    return localStorage.getItem(ADMIN_FLAG) === "1";
  } catch {
    return false;
  }
}

function utm(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    const value = params.get(key);
    if (value) out[key] = value.slice(0, 100);
  }
  return out;
}

function scrollPct(): number {
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  if (max <= 0) return 100;
  return Math.min(100, Math.round((window.scrollY / max) * 100));
}

export function Beacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (trackingDisabled()) return;
    let token: string | null = null;
    let maxScroll = scrollPct();
    let activeMs = 0;
    let lastTick = Date.now();
    let lastInteraction = Date.now();
    let sent = false;

    void sendPageview(pathname).then((value) => {
      token = value;
    });

    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === "visible" && now - lastInteraction < IDLE_MS) {
        activeMs += now - lastTick;
      }
      lastTick = now;
    };
    const interact = () => {
      tick();
      lastInteraction = Date.now();
      maxScroll = Math.max(maxScroll, scrollPct());
    };
    const flush = () => {
      tick();
      if (!token || sent) return;
      sent = true;
      const payload = JSON.stringify({
        type: "engagement",
        path: pathname,
        view_token: token,
        max_scroll_pct: maxScroll,
        seconds_active: Math.round(activeMs / 1000),
      });
      navigator.sendBeacon?.(ENDPOINT, new Blob([payload], { type: "text/plain" }));
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
      else lastTick = Date.now();
    };

    const interval = window.setInterval(tick, 5000);
    window.addEventListener("scroll", interact, { passive: true });
    window.addEventListener("keydown", interact);
    window.addEventListener("pointerdown", interact);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flush();
      window.clearInterval(interval);
      window.removeEventListener("scroll", interact);
      window.removeEventListener("keydown", interact);
      window.removeEventListener("pointerdown", interact);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname]);

  return null;
}
