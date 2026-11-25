/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

import { defineConfig, loadEnv, type Connect, type Plugin } from "vite";

// react-router genera /admin (sin barra) para la ruta raíz: al recargar, Vite exige /admin/.
function redirectBase(): Plugin {
  const redirect: Connect.NextHandleFunction = (req, res, next) => {
    if (req.url === "/admin" || req.url?.startsWith("/admin?")) {
      res.writeHead(301, { Location: req.url.replace("/admin", "/admin/") });
      res.end();
      return;
    }
    next();
  };
  return {
    name: "devnull-redirect-base",
    configureServer: (server) => void server.middlewares.use(redirect),
    configurePreviewServer: (server) => void server.middlewares.use(redirect),
  };
}

// El panel se sirve bajo /admin/ (Caddy en producción). En desarrollo, Vite hace de proxy
// para trabajar en el mismo origen (cookies httpOnly sin CORS), como Caddy en producción:
//   /api   → API de administración (ADMIN_API_URL)
//   /media → API pública, que sirve los archivos (API_URL)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const adminApi = env.ADMIN_API_URL ?? "http://127.0.0.1:8001";
  const publicApi = env.API_URL ?? "http://127.0.0.1:8000";
  const proxy = {
    "/api": { target: adminApi, changeOrigin: false },
    "/media": { target: publicApi, changeOrigin: false },
  };

  return {
    base: "/admin/",
    plugins: [redirectBase(), react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    // Mermaid se importa de forma diferida: sin esto, Vite lo optimiza al primer uso y recarga la
    // página entera en desarrollo (se perdería el contenido del editor sin guardar).
    optimizeDeps: { include: ["mermaid"] },
    server: {
      port: 5173,
      proxy,
    },
    preview: {
      port: 4173,
      proxy,
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});
