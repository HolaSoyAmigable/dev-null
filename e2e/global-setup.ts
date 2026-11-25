import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Crea el administrador de prueba si no existe (la CLI responde 1 si ya existe). */
export default function globalSetup(): void {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Faltan E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD");

  const backend = fileURLToPath(new URL("../backend", import.meta.url));
  const result = spawnSync("uv", ["run", "python", "-m", "app.cli", "create-admin", "--email", email], {
    cwd: backend,
    env: { ...process.env, ADMIN_PASSWORD: password },
    encoding: "utf-8",
  });
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== 0 && !output.includes("Ya existe")) {
    throw new Error(`No se pudo crear el administrador de prueba:\n${output}`);
  }
}
