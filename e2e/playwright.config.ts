import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

// Variables: e2e/.env (local, no versionado) o, si no existe, los valores de prueba de .env.example.
const here = fileURLToPath(new URL(".", import.meta.url));
for (const file of [".env", ".env.example"]) {
  if (existsSync(here + file)) {
    process.loadEnvFile(here + file);
    break;
  }
}

const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
const reuse = !process.env.CI;

/**
 * Tres flujos críticos (docs/06-conventions.md): login, crear y publicar un post,
 * y verificarlo en el blog público. Requiere PostgreSQL y Redis (./scripts/dev-up.sh).
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: webUrl,
    trace: "retain-on-failure",
    locale: "es-MX",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // API pública (blog y beacon de métricas).
      command: "uv run --directory ../backend uvicorn app.apps.public:app --host 127.0.0.1 --port 8000",
      url: "http://127.0.0.1:8000/api/v1/health",
      reuseExistingServer: reuse,
      timeout: 120_000,
    },
    {
      // API de administración (login y CMS del panel).
      command: "uv run --directory ../backend uvicorn app.apps.admin:app --host 127.0.0.1 --port 8001",
      url: "http://127.0.0.1:8001/api/v1/health",
      reuseExistingServer: reuse,
      timeout: 120_000,
    },
    {
      command: "corepack pnpm --filter admin dev",
      url: "http://localhost:5173/admin/",
      reuseExistingServer: reuse,
      timeout: 120_000,
    },
    {
      command: "corepack pnpm --filter web dev",
      url: webUrl,
      reuseExistingServer: reuse,
      timeout: 180_000,
    },
  ],
});
