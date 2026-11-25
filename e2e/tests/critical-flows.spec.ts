import { expect, test, type Page } from "@playwright/test";

const ADMIN_URL = process.env.ADMIN_URL ?? "http://localhost:5173/admin/";

async function login(page: Page): Promise<void> {
  await page.goto(`${ADMIN_URL}login`);
  await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Contraseña").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Métricas" })).toBeVisible();
}

test.describe.serial("flujos críticos", () => {
  const unique = Date.now().toString(36);
  const title = `Post E2E ${unique}`;
  let slug = "";

  test("1. el administrador inicia sesión", async ({ page }) => {
    await page.goto(`${ADMIN_URL}login`);
    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel("Contraseña").fill("contraseña-incorrecta");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert")).toContainText("Credenciales inválidas");

    await login(page);
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();

    // La sesión sobrevive a una recarga gracias a la cookie httpOnly de refresh.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Métricas" })).toBeVisible();
  });

  test("2. crea y publica un post", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Posts" }).click();
    await page.getByRole("link", { name: "Nuevo post" }).click();

    await page.getByLabel("Título", { exact: true }).fill(title);
    await page.getByLabel("Extracto").fill("Publicado automáticamente por Playwright.");
    await page
      .getByLabel("Contenido en Markdown")
      .fill("## Sección E2E\n\nContenido de prueba con `código`.\n\n```python\nprint('hola')\n```");
    await page.getByRole("button", { name: /^Guardar/ }).first().click();

    await expect(page).toHaveURL(/\/admin\/posts\/\d+$/);
    await expect(page.getByText("Borrador", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Publicar ahora" }).click();
    await expect(page.getByText("Publicado", { exact: true })).toBeVisible();

    const slugInput = page.getByLabel("Slug");
    slug = await slugInput.inputValue();
    expect(slug).toMatch(/^post-e2e-/);
  });

  test("3. el post aparece en el blog público", async ({ page }) => {
    expect(slug, "el test 2 debe publicar el post").not.toBe("");

    await page.goto(`/blog/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sección E2E" })).toBeVisible();
    await expect(page.locator("pre.shiki")).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`${title}.*dev/null`));

    await page.goto("/blog");
    await expect(page.getByRole("link", { name: title })).toBeVisible();

    await page.goto(`/search?q=${encodeURIComponent("E2E")}`);
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  });
});
