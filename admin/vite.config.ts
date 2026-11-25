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

// El panel se sirve bajo /admin/ (Caddy en producción). En desarrollo, Vite hace
// de proxy hacia la API para trabajar en el mismo origen (cookies httpOnly sin CORS).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.API_PROXY_TARGET ?? "http://127.0.0.1:8000";

  return {
    base: "/admin/",
    plugins: [redirectBase(), react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    server: {
      port: 5173,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: false },
        "/media": { target: apiTarget, changeOrigin: false },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: false },
        "/media": { target: apiTarget, changeOrigin: false },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});
