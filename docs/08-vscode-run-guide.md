# 08 — Guía para ejecutar el proyecto en VS Code (Windows)

Guía paso a paso, comando por comando. Todos los comandos son de **PowerShell** (terminal integrada de VS Code, `Ctrl+Ñ` o `` Ctrl+` ``) salvo que se indique lo contrario.

> Resumen: necesitas **4 terminales** abiertas a la vez: API, worker, panel admin y blog público. PostgreSQL y Redis corren en Docker.

---

## 1. Requisitos previos

| Herramienta | Versión | Comprobar con |
|---|---|---|
| Docker Desktop (en ejecución) | reciente | `docker --version` |
| Git (incluye Git Bash) | reciente | `git --version` |
| uv (gestor de Python) | reciente | `uv --version` |
| Node.js | 24 | `node --version` |
| corepack (viene con Node) | — | `corepack --version` |

Instalar lo que falte:

```powershell
winget install --id Docker.DockerDesktop
```

```powershell
winget install --id astral-sh.uv
```

```powershell
winget install --id OpenJS.NodeJS
```

Activa corepack una sola vez (pnpm se usa siempre como `corepack pnpm`):

```powershell
corepack enable
```

Extensiones recomendadas de VS Code: *Python*, *Ruff*, *ESLint*, *Tailwind CSS IntelliSense*, *Docker*.

---

## 2. Abrir el proyecto

```powershell
code C:\Users\oscar\Desktop\devnull
```

Abre una terminal: **Terminal → Nueva terminal**. Verifica que estás en la raíz:

```powershell
Get-Location
```

---

## 3. Variables de entorno

Los dos archivos `.env` **no se versionan**. Créalos a partir de los ejemplos:

```powershell
Copy-Item .env.example .env
```

```powershell
Copy-Item web\.env.example web\.env.local
```

Edita `.env` y cambia **todos** los valores `cambia_esto_…` por secretos propios. Para generar uno aleatorio de 48 caracteres:

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```

Reglas importantes:

- `POSTGRES_PASSWORD` y la contraseña dentro de `DATABASE_URL` deben ser **la misma**.
- `REVALIDATE_SECRET` debe ser **idéntico** en `.env` y en `web\.env.local`.
- En desarrollo deja `ENV=development`, `COOKIE_SECURE=false` y `TRUST_PROXY_HEADERS=false`.
- Si `ENV=production`, la API **no arranca** salvo que los 4 secretos tengan ≥ 32 caracteres, sean distintos entre sí, no empiecen por `cambia_esto` y `COOKIE_SECURE=true`.
- Si ya usas el puerto 5432 o 6379, cambia `DB_PORT` / `REDIS_PORT` **y** el puerto dentro de `DATABASE_URL` / `REDIS_URL`.

---

## 4. Levantar PostgreSQL y Redis

Asegúrate de que Docker Desktop esté abierto (`docker info` no debe dar error). Los scripts `.sh` se ejecutan con Git Bash:

```powershell
& "C:\Program Files\Git\bin\bash.exe" ./scripts/dev-up.sh
```

Alternativa sin script:

```powershell
docker compose -f infra/docker-compose.yml --env-file .env up -d --wait db redis
```

Comprobar que ambos están `healthy`:

```powershell
docker compose -f infra/docker-compose.yml --env-file .env ps
```

---

## 5. Backend (API FastAPI)

### 5.1 Dependencias

```powershell
cd backend
```

```powershell
uv sync
```

### 5.2 Migraciones de base de datos

```powershell
uv run alembic upgrade head
```

### 5.3 Crear el usuario administrador

Pide la contraseña de forma interactiva (mínimo según `MIN_PASSWORD_LENGTH`):

```powershell
uv run python -m app.cli create-admin --email tu@correo.com
```

### 5.4 Arrancar la API (terminal 1)

```powershell
uv run uvicorn app.main:app --port 8000 --reload
```

Comprobar en el navegador o con curl:

- Documentación interactiva: <http://localhost:8000/api/v1/docs> (solo si `ENV` ≠ `production`)
- Salud: <http://localhost:8000/api/v1/health>

```powershell
curl.exe http://localhost:8000/api/v1/health
```

### 5.5 Arrancar el worker (terminal 2)

Publica posts programados y agrega/purga métricas. Desde `backend`:

```powershell
uv run python -m app.worker
```

---

## 6. Frontends

Abre una **terminal nueva** en la raíz del proyecto.

### 6.1 Instalar dependencias (una sola vez)

```powershell
corepack pnpm install
```

### 6.2 Panel de administración (terminal 3)

```powershell
corepack pnpm --filter admin dev
```

Abre <http://localhost:5173/admin/> e inicia sesión con el admin del paso 5.3. Vite hace de proxy hacia la API (`/api` y `/media`), así que no hay CORS.

### 6.3 Blog público (terminal 4)

```powershell
corepack pnpm --filter web dev
```

Abre <http://localhost:3000>. Next.js reescribe `/api/v1` y `/media` hacia la API (`API_URL`).

---

## 7. Primer recorrido de prueba

1. Entra a <http://localhost:5173/admin/> y crea una categoría y una etiqueta.
2. Crea un post, escribe contenido Markdown y pulsa **Publicar**.
3. Abre <http://localhost:3000/blog> y comprueba que aparece (la revalidación ISR la dispara la API).
4. Entra al post y revisa en el panel el dashboard de métricas (<http://localhost:5173/admin/>).

---

## 8. Tests, lint y tipos

Con Docker (db y redis) levantado, desde `backend`:

```powershell
uv run ruff check .
```

```powershell
uv run ruff format --check .
```

```powershell
uv run mypy app
```

```powershell
uv run pytest
```

Los tests crean y usan una base `<nombre>_test` y Redis DB 15; no tocan tus datos de desarrollo.

Frontend, desde la raíz:

```powershell
corepack pnpm lint
```

```powershell
corepack pnpm typecheck
```

```powershell
corepack pnpm test
```

E2E con Playwright (primero instala el navegador una vez):

```powershell
corepack pnpm --filter e2e exec playwright install chromium
```

```powershell
corepack pnpm e2e
```

---

## 9. Regenerar tipos TypeScript desde el OpenAPI

Tras cambiar schemas o rutas del backend (nunca se editan a mano):

```powershell
& "C:\Program Files\Git\bin\bash.exe" scripts/generate-types.sh
```

---

## 10. Backup y restauración (opcional)

```powershell
& "C:\Program Files\Git\bin\bash.exe" ./infra/backup/backup.sh
```

```powershell
& "C:\Program Files\Git\bin\bash.exe" ./infra/backup/restore.sh backups/<SELLO>
```

---

## 11. Detener todo

Pulsa `Ctrl+C` en cada terminal (API, worker, admin, web) y luego:

```powershell
& "C:\Program Files\Git\bin\bash.exe" ./scripts/dev-down.sh
```

Alternativa sin script:

```powershell
docker compose -f infra/docker-compose.yml --env-file .env down
```

Para **borrar también los datos** (irreversible): añade `-v` al comando anterior.

---

## 12. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `docker: error during connect` | Docker Desktop apagado | Abre Docker Desktop y espera a que arranque |
| `ConnectionRefusedError` / `WinError 1225` en tests o API | db/redis no están levantados | Repite el paso 4 |
| `password authentication failed` | Contraseña de `DATABASE_URL` ≠ `POSTGRES_PASSWORD` | Alinea ambas; si el volumen ya existía, `down -v` y vuelve a subir |
| `port is already allocated` | Puerto 5432/6379/8000 ocupado | Cambia `DB_PORT`, `REDIS_PORT` o `API_PORT` en `.env` y en las URLs |
| La API no arranca: "Configuración insegura en producción" | `ENV=production` con secretos débiles | Usa secretos largos y distintos, `COOKIE_SECURE=true` |
| `ValidationError` al iniciar: faltan campos | `.env` incompleto | Compara con `.env.example` |
| Panel muestra "sesión inválida" tras reiniciar Redis | Los refresh tokens viven en Redis | Vuelve a iniciar sesión |
| El blog no refleja un post recién publicado | `REVALIDATE_SECRET` distinto o `WEB_URL` incorrecto | Iguala el secreto en `.env` y `web\.env.local`; revisa la tabla `webhook_log` |
| `ImportError: app.modules.media` | Falta la carpeta `media` del backend (estaba ignorada por git) | Ya corregido en `.gitignore`; verifica con `git status` que `backend/app/modules/media/` aparece |
| `corepack` pide confirmar la descarga de pnpm | Primera ejecución | Acepta con `Y` |
| Los scripts `.sh` no se ejecutan en PowerShell | PowerShell no interpreta bash | Usa Git Bash como en los ejemplos o los comandos `docker compose` equivalentes |
