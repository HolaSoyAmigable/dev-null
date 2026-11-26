# 09 — Documentación completa del proyecto

Documento de referencia que resume todo el proyecto en un solo lugar. Los documentos `00`–`07` siguen siendo la **fuente de verdad** de cada tema; este archivo los consolida y añade la descripción del código tal como está implementado, la configuración y la revisión de seguridad.

Para ejecutar el proyecto paso a paso, ver [08-vscode-run-guide.md](08-vscode-run-guide.md).

---

## 1. Qué es dev/null

Blog personal con tres pilares: **carrera**, **proyectos** y **publicaciones**. Incluye:

- CMS propio (panel de administración) con flujo de estados y revisiones.
- API REST (FastAPI) con contrato OpenAPI como fuente de verdad.
- Blog público (Next.js, ISR) con búsqueda, RSS, sitemap y SEO.
- Métricas de visitas propias, **sin cookies ni banners**, que respetan *Do Not Track*.

**Regla del nombre.** Nombre visible (texto): `dev/null`. Identificador técnico (rutas, slugs, archivos, imágenes, variables): `devnull`. La barra `/` nunca aparece en identificadores. Único lugar permitido: `SITE_NAME="dev/null"`.

**Estado.** Fases 0–6 completadas; pendientes la fase 7 (extras) y la 8 (despliegue). Ver [07-roadmap.md](07-roadmap.md).

---

## 2. Stack

| Capa | Tecnología |
|---|---|
| Backend | Python 3.12, FastAPI, uv, SQLAlchemy 2.0 (async), Alembic, Pydantic v2 |
| Base de datos | PostgreSQL 16, Redis 7 |
| Panel admin | React + Vite + TypeScript, TanStack Query, React Hook Form + Zod, shadcn/ui, Tailwind, Recharts |
| Blog público | Next.js (App Router) + TypeScript + Tailwind, ISR |
| Contenido | Markdown: react-markdown, remark-gfm, remark-math + rehype-katex (KaTeX), rehype-sanitize, shiki; diagramas con Mermaid |
| Paquetes JS | pnpm con workspaces (`admin`, `web`, `e2e`) |
| Proxy (producción) | Caddy |
| CI | GitHub Actions |
| Tests | pytest (backend), Vitest (admin y web), Playwright (E2E) |

---

## 3. Arquitectura

```
Navegador ──► Caddy (producción, mismo dominio y HTTPS)
               ├─ /admin/*                         → panel React (estático)
               ├─ /api/v1/public/*, /health, /media → API pública        (:8000)
               ├─ /api/v1/auth/*, /api/v1/admin/*   → API de administración (:8001)
               └─ /*                                → Next.js (blog público)

API pública        ──┐
API de administración ┼─► PostgreSQL (datos) · Redis (caché, rate limit, refresh tokens)
Worker (APScheduler) ─┘
API de administración / worker ──► Next.js /api/revalidate (webhook ISR)
```

El backend son **dos APIs independientes con el mismo código** (`app.apps.public:app` y `app.apps.admin:app`):

- **Pública:** lectura del blog, búsqueda y beacon de métricas. Sin login ni escritura. La usan los visitantes.
- **Administración:** login y todo el CMS. **Accesible desde cualquier red** para que puedas administrar el blog desde donde estés; se protege con autenticación (no con restricción de red) y HTTPS.

En desarrollo no hay Caddy: Vite (admin) hace proxy de `/api` hacia la API de administración (`:8001`) y Next.js (web) de `/api/v1/public` hacia la pública (`:8000`), de modo que todo es de mismo origen y las cookies `httpOnly` funcionan sin CORS.

### 3.1 Regla de capas (backend)

```
router (HTTP) → service (lógica de negocio) → models / repository (BD)
```

Los routers **nunca** tocan la base de datos directamente.

### 3.2 Estructura de carpetas

```
backend/app/
  apps/        factory.py, public.py y admin.py: las dos APIs ASGI
  core/        config, db, redis, seguridad, errores, caché, paginación, rate limit, slugs
  modules/     auth, career, health, media, metrics, posts, projects, public,
               revalidation, settings, taxonomy
  storage/     StorageBackend (disco; interfaz lista para S3)
  worker/      APScheduler: publicaciones programadas y agregación de métricas
  cli.py       create-admin
backend/alembic/   migraciones
backend/tests/     pytest por módulo
admin/             panel React + Vite (base /admin/)
web/               blog Next.js
e2e/               Playwright (flujos críticos)
infra/             docker-compose.yml y scripts de backup/restauración
scripts/           dev-up/dev-down, generate-types
docs/              fuente de verdad
```

### 3.3 Flujo de publicación

1. El admin pulsa **Publicar** → `POST /api/v1/admin/posts/{id}/publish`.
2. El servicio cambia el estado, guarda una revisión y hace commit.
3. Un `Revalidator` recoge las rutas afectadas (`/`, `/blog`, `/blog/{slug}`, tags, categoría, proyecto, RSS, sitemap) y llama **en segundo plano** al webhook `POST {WEB_URL}/api/revalidate` con la cabecera `x-revalidate-secret`.
4. Hay hasta 3 reintentos con backoff exponencial; cada intento queda en `webhook_log`. Si todo falla, las páginas se regeneran solas por `revalidate = 3600`.
5. Toda escritura admin invalida además la caché pública de Redis.

Las publicaciones programadas las ejecuta el worker (`publish_scheduled_posts`) y siguen el mismo camino.

### 3.4 Flujo de métricas

1. El blog envía un *beacon* (`POST /api/v1/public/events`) al cargar la página y un evento `engagement` (scroll máximo y segundos activos) al salir.
2. La API calcula `visitor_hash = HMAC-SHA256(secreto, fecha + IP + User-Agent)` y `session_hash` por ventana de 30 min. **La IP nunca se guarda ni se loguea.**
3. Los bots se marcan por User-Agent y se excluyen de las cifras. Con `DNT: 1` o `Sec-GPC: 1` el evento se descarta.
4. Cada noche (00:15 UTC por defecto) el worker agrega `daily_stats` y purga `page_views` con más de 13 meses.

---

## 4. Modelo de datos

Tablas (detalle completo en [02-data-model.md](02-data-model.md)):

| Tabla | Contenido |
|---|---|
| `users` | Administrador (email único, hash Argon2id, rol, activo) |
| `posts` | Título, slug único, extracto, `content_md`, estado (`draft`, `scheduled`, `published`, `archived`), SEO, `github_repo`, `series_order`, `featured`, `search_vector` (FTS en español, GIN) |
| `post_revisions` | Historial de título y contenido |
| `projects` | Proyectos con stack, estado, URLs `http(s)`, fechas |
| `categories`, `tags`, `post_tags` | Taxonomía |
| `career_entries` | Trabajo, educación, logros y certificaciones, con orden |
| `site_settings` | Nombre, autor, bio, enlaces sociales, "sobre mí" |
| `media` | Archivos subidos: clave de almacenamiento, MIME real, tamaño, dimensiones, alt |
| `page_views`, `engagement_events` | Eventos crudos de métricas |
| `daily_stats` | Agregados diarios (global y por post); índice único `NULLS NOT DISTINCT` |
| `webhook_log` | Registro de llamadas de revalidación |

Migraciones: `backend/alembic/versions/` (`0001` esquema inicial, `0002` trigger del vector de búsqueda y *seed* de settings, `0003` metadatos de desarrollo de los posts).

---

## 5. API REST

Prefijo `/api/v1`. Cada API tiene su documentación interactiva en `/api/v1/docs` (pública `:8000`, administración `:8001`; desactivada en producción). Todos los errores usan el sobre:

```json
{ "error": { "code": "NOT_FOUND", "message": "…", "details": {} } }
```

### 5.1 API pública (sin autenticación, con caché Redis y rate limit por IP)

| Método y ruta | Descripción |
|---|---|
| `GET /health` | Liveness |
| `GET /public/posts` | Listado paginado (filtros `tag`, `category`, `project`, `q`) |
| `GET /public/posts/{slug}` · `/related` | Detalle y relacionados |
| `GET /public/projects` · `/{slug}` | Proyectos |
| `GET /public/career` | Entradas visibles de carrera |
| `GET /public/tags` · `/categories` | Taxonomía con contadores |
| `GET /public/search?q=` | Búsqueda de texto completo con *snippet* |
| `GET /public/settings` · `/slugs` | Ajustes del sitio y slugs para sitemap |
| `POST /public/events` | Beacon de métricas (máx. 8 KB, rate limit propio) |

### 5.2 API de administración — autenticación

| Ruta | Descripción |
|---|---|
| `POST /auth/login` | Credenciales → access token (JSON) + refresh token (cookie `httpOnly`); rate limit 5/min |
| `POST /auth/refresh` | Rota el refresh token |
| `POST /auth/logout` | Invalida el refresh token |
| `GET /auth/me` | Usuario actual |
| `POST /auth/change-password` | Cambia la contraseña y cierra las demás sesiones |

### 5.3 API de administración — CMS (requiere rol `admin`)

- `/admin/posts`: CRUD, `publish`, `unpublish`, `archive`, `schedule`, `duplicate`, `revisions`, `restore-revision/{id}`.
- `/admin/projects`, `/admin/career` (incluye `PATCH /reorder`), `/admin/tags`, `/admin/categories`.
- `/admin/media`: listar, subir (multipart), editar texto alternativo, eliminar.
- `/admin/settings`: leer y actualizar.
- `/admin/metrics`: `overview`, `timeseries`, `top-posts`, `referrers`, `countries`, `devices`, `browsers`, `realtime`, `posts/{id}`.

### 5.4 Contrato de tipos

Cada API publica su OpenAPI, que es la fuente de verdad de su contrato: `backend/openapi.admin.json` y `backend/openapi.public.json`. `scripts/generate-types.sh` genera `admin/src/api/schema.d.ts` (desde la de administración) y `web/src/lib/api/schema.d.ts` (desde la pública). El CI falla si no están al día. **Nunca se escriben tipos de la API a mano.**

---

## 6. Módulos del backend

| Módulo | Responsabilidad |
|---|---|
| `core/config.py` | Ajustes tipados desde el entorno / `.env`; en producción rechaza secretos débiles |
| `core/security.py` | Argon2id y JWT HS256 (access y refresh con secretos distintos) |
| `core/ratelimit.py` | Ventana deslizante en Redis por IP |
| `core/cache.py` | Caché JSON de endpoints públicos (TTL 60 s) |
| `core/errors.py` | Excepciones de dominio y manejadores del sobre de error |
| `modules/auth` | Login, rotación de refresh con lista blanca en Redis, cambio de contraseña |
| `modules/posts` | CRUD, estados, revisiones, búsqueda, relacionados |
| `modules/media` | Subida validada por *magic bytes* (PNG, JPEG, GIF, WebP, AVIF, PDF; sin SVG) |
| `modules/metrics` | Ingesta sin cookies, agregación y consultas del dashboard |
| `modules/revalidation` | Webhook ISR con reintentos y log |
| `storage` | `LocalDiskStorage` (interfaz `StorageBackend` para S3 futuro) |
| `worker` | Trabajos: publicar programados (cada minuto), agregar y purgar métricas (nocturno) |

---

## 7. Frontends

### 7.1 Panel de administración (`admin/`)

- React + Vite, servido bajo `/admin/`. Rutas en `src/router.tsx`.
- Funciones: login, dashboard de métricas, posts (editor Markdown con vista previa, revisiones, programación), proyectos, carrera, taxonomía, ajustes y media.
- El **access token vive solo en memoria**; el refresh es una cookie `httpOnly` que el navegador envía a `/api/v1/auth`. Un 401 dispara un refresh automático con reintento.
- Marca el navegador del admin con `localStorage.devnull_admin` para excluirlo de las métricas.

#### Editor de posts

El formulario (`features/posts/PostEditorPage.tsx`) ofrece cuatro vistas del mismo campo `content_md` (la elegida se recuerda en el navegador): **Editar** (editor visual, por defecto), **Markdown** (texto fuente), **Vista previa** y **Dividida** (Markdown + vista previa).

**Editor visual (WYSIWYG, `features/posts/visual/`).** Se ve el resultado mientras se escribe: la negrita se ve en negrita, los títulos como títulos, sin símbolos de Markdown. Está hecho con **TipTap** (ProseMirror) y `tiptap-markdown`; el post se sigue guardando como Markdown, así que la API, el blog, las revisiones y la búsqueda no cambian.

| Pieza | Función |
|---|---|
| `VisualEditor.tsx` + `extensions.ts` | Carga el Markdown, lo edita y lo devuelve al formulario. Carga diferida (el paquete pesa ~1 MB, 340 KB comprimido). Admite negrita, cursiva, tachado, código, enlaces, H1–H4, listas (viñetas, numeradas, tareas), citas, tablas GFM, imágenes, bloques de código con resaltado y selector de lenguaje, `Ctrl+K` para enlaces y las reglas de Markdown al escribir (`## `, `- `, `1. `, `> `, ` ``` `). |
| `VisualToolbar.tsx` + `LinkBar.tsx` | Barra con botones que reflejan el formato bajo el cursor (`aria-pressed`), deshacer/rehacer, bloques (`ts`, `kt`, `py`, `sql`, `bash`, `mermaid`, `$$`) y botones contextuales de tabla (añadir/eliminar fila, columna o tabla). Los diagramas y las fórmulas en bloque se insertan fuera de la lista o cita donde esté el cursor. |
| `markdownMath.ts` + `math.ts` + `MathViews.tsx` | Fórmulas `$…$` y `$$…$$`: reglas de markdown-it que las leen y nodos que las escriben sin escapar el LaTeX. Se ven dibujadas (KaTeX) y se editan al hacer clic. El importe `$5 y $10` no se confunde con una fórmula. |
| `CodeBlockView.tsx` | Bloque de código con selector de lenguaje; con `mermaid`, el diagrama se dibuja en vivo bajo el código. |

Sobre el texto fuente: abrir un post **no** lo reescribe; solo se reescribe cuando se cambia algo en el editor visual, y entonces se normaliza (por ejemplo `_cursiva_` pasa a `*cursiva*`, `__negrita__` a `**negrita**`). El contenido y el aspecto en el blog no cambian. La pestaña **Markdown** permite ver y retocar el texto fuente.

Resto de piezas de `features/posts/editor/` (compartidas por el editor de texto):

| Pieza | Función |
|---|---|
| `EditorToolbar.tsx` + `formatting.ts` + `snippets.ts` | Barra con **formato** (negrita, cursiva, tachado, código, enlace, H2/H3, listas de viñetas, numeradas y de tareas, cita, tabla, separador) y **bloques** (`ts`, `kt`, `py`, `sql`, `bash`, `mermaid`, `$$`). Las operaciones son funciones puras (`valor + selección → edición`): envuelven o desenvuelven la selección, alternan prefijos de línea y separan los bloques con líneas en blanco. |
| `MarkdownEditor.tsx` + `textEdit.ts` | Atajos `Ctrl/⌘ + B`, `I`, `E`, `K`; `Tab`/`Shift+Tab` sangran (con `Esc` y luego `Tab` se sale del editor); `Enter` continúa listas, tareas y citas (y un elemento vacío las termina); pegar una URL sobre texto seleccionado crea el enlace; altura automática. Las ediciones se aplican con `execCommand`, así que **`Ctrl+Z` y `Ctrl+Y` deshacen y rehacen también lo hecho con la barra**; si el navegador no lo permite se aplica por la vía normal. |
| `OutlineCard.tsx` + `lib/outline.ts` | **Índice** con los títulos (H1–H4, sin contar el código); al pulsar uno el cursor y la vista saltan a esa sección. |
| `useEditorView.ts` + `PostEditorPage.tsx` | Vistas **Escribir**, **Vista previa** y **Dividida** (editor y vista previa lado a lado; la vista previa acompaña al scroll), que se recuerda en el navegador. **Modo enfoque**: oculta el panel lateral, el slug y el extracto. La cabecera con Guardar/Publicar y la barra de formato quedan fijas al hacer scroll. |
| `MarkdownEditor.tsx` | **Arrastrar o pegar imágenes**: se suben a `/admin/media` (máx. 10 MB; PNG, JPEG, GIF, WebP, AVIF) y se inserta `![alt](url)` en el cursor, con un marcador mientras sube. |
| `EditorStats.tsx` + `lib/markdownStats.ts` | "450 palabras • 3 min de lectura" en tiempo real; mismo cálculo que el backend (200 ppm, código a la mitad). |
| `draft.ts` + `DraftNotice.tsx` | **Autoguardado local** cada 30 s en `localStorage` (`devnull:draft:post:<id>` o `…:new`), indicador "Borrador guardado localmente", y aviso para restaurar o descartar al reabrir. Se borra al guardar en el servidor. |
| `DevMetadataFields.tsx` | En "Organización": repositorio de GitHub, orden en la serie (activo solo con proyecto) e interruptor "Fijar en la portada". |
| `components/MarkdownPreview.tsx` + `MermaidDiagram.tsx` | Vista previa con GFM, **KaTeX** (`$…$`, `$$…$$`) y **Mermaid** (carga diferida, `securityLevel: "strict"`). |

Los campos y *bindings* originales del formulario (`title`, `slug`, `excerpt`, `category_id`, `project_id`, `tag_ids`, portada, SEO, `canonical_url`, imagen OG) no cambian. Los tipos del payload salen del OpenAPI (`PostCreate`) y `postForm.ts` valida los campos nuevos.

### 7.2 Blog público (`web/`)

- Next.js App Router con ISR; páginas: inicio, blog (paginado, por tag y categoría), post, proyectos, carrera, acerca de, búsqueda, `rss.xml`, `sitemap.xml`, `robots.txt`.
- Markdown renderizado en servidor con saneado (`rehype-sanitize`), resaltado Shiki y fórmulas KaTeX. Los diagramas Mermaid se dibujan en el navegador (con el código fuente como respaldo).
- La portada muestra primero los posts **destacados** (`featured`); cada post muestra su repositorio de GitHub y su posición en la serie; la bitácora de un proyecto ordena sus posts por `series_order`.
- Cabeceras de seguridad y CSP en `next.config.ts`.
- `/api/revalidate` recibe el webhook de la API (secreto comparado en tiempo constante).

---

## 8. Configuración (variables de entorno)

| Variable | Descripción |
|---|---|
| `ENV` | `development`, `production` o `test` |
| `API_PORT` (8000), `ADMIN_API_PORT` (8001) | Puertos de la API pública y la de administración |
| `API_URL`, `ADMIN_API_URL` | URLs que usan Next.js y Vite para el proxy en desarrollo |
| `SITE_NAME`, `SITE_URL` | Nombre visible y URL pública del blog |
| `DATABASE_URL`, `REDIS_URL` | Conexiones (en contenedor apuntan a `db` y `redis`) |
| `JWT_SECRET`, `REFRESH_SECRET`, `METRICS_SALT_SECRET`, `REVALIDATE_SECRET` | Secretos sin valor por defecto |
| `ACCESS_TOKEN_TTL_MINUTES` (15), `REFRESH_TOKEN_TTL_DAYS` (7) | Vida de los tokens |
| `COOKIE_SECURE` | `true` obligatorio en producción |
| `TRUST_PROXY_HEADERS` (false), `TRUSTED_PROXY_HOPS` (1) | Confianza en `X-Forwarded-For` y número de proxies |
| `WEB_URL` | URL interna de Next.js para el webhook |
| `MEDIA_DIR`, `MEDIA_URL_PREFIX`, `MEDIA_MAX_BYTES` (10 MB) | Almacenamiento de archivos |
| `RATE_LIMIT_LOGIN/EVENTS/PUBLIC_PER_MINUTE` | 5 / 60 / 300 |
| `PUBLIC_CACHE_TTL_SECONDS` | 60 |
| `METRICS_AGGREGATION_HOUR/MINUTE_UTC`, `METRICS_RETENTION_MONTHS` | 00:15 UTC, 13 meses |
| `POSTGRES_*`, `DB_PORT`, `REDIS_PORT`, `API_PORT` | Docker Compose |

`web/.env.local`: `API_URL`, `SITE_URL`, `REVALIDATE_SECRET`.

---

## 9. Seguridad

Resumen de controles (detalle en [05-security.md](05-security.md)):

- Contraseñas con Argon2id; mínimo 12 caracteres; igualación de tiempos en login con usuario inexistente.
- Access token de 15 min en memoria; refresh de 7 días en cookie `httpOnly`, `SameSite=Lax`, con rotación y lista blanca en Redis.
- Rate limiting en login, eventos y endpoints públicos.
- Subidas: tipo real por *magic bytes*, tamaño máximo, nombre aleatorio, SVG excluido.
- Markdown saneado; `snippet` de búsqueda mostrado como texto.
- Webhook ISR protegido con secreto compartido.
- CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- La API corre como usuario no root en el contenedor; PostgreSQL y Redis solo publican en `127.0.0.1`.
- Consultas parametrizadas (SQLAlchemy); sin SQL construido con entrada del usuario.

---

## 10. Revisión de seguridad y bugs (21-11-2026)

Revisión manual del código (backend, web, admin, infra y CI). No se ejecutó análisis dinámico.

### 10.1 Corregidos en esta revisión

| # | Sev. | Hallazgo | Corrección |
|---|---|---|---|
| 1 | Alta | `.gitignore` y `backend/.dockerignore` tenían `media/`, que también ignoraba `backend/app/modules/media/`. Un clon limpio, el CI o la imagen Docker fallaban con `ImportError`. | Cambiado a `/media/` (solo la raíz). El módulo vuelve a ser versionable. |
| 2 | Alta | El rate limit usaba el **primer** valor de `X-Forwarded-For`, controlado por el cliente, con `TRUST_PROXY_HEADERS=True` por defecto: permitía eludir el límite de login y falsear visitantes. | Por defecto `TRUST_PROXY_HEADERS=false`; si se activa, se toma la entrada situada `TRUSTED_PROXY_HOPS` posiciones desde el final (la que añade el proxy de confianza). Nuevas variables en `.env.example` y tests. |
| 3 | Media | Sin validación de secretos en producción. | `Settings` rechaza con `ENV=production`: secretos < 32 caracteres, valores `cambia_esto…`, secretos repetidos y `COOKIE_SECURE=false`. Tests añadidos. |

> Con `TRUST_PROXY_HEADERS=false` y Next.js/Vite haciendo de proxy en desarrollo, todas las peticiones llegan con la IP del proxy: el rate limit y las métricas verán una sola IP. En producción activa `TRUST_PROXY_HEADERS=true` con el número correcto de `TRUSTED_PROXY_HOPS` **solo** si la API no es accesible sin pasar por Caddy.

### 10.1 bis Revisión del dashboard de métricas

Se enviaron eventos de prueba (Chrome, Firefox, iPhone, Googlebot, DNT y curl) y se compararon las respuestas de `/admin/metrics/*` con consultas directas a la base: visitas, únicos, dispositivos, navegadores, referrers, engagement y tasa de lectura coincidieron; bots y DNT quedaron excluidos.

| Hallazgo | Corrección |
|---|---|
| **"Posts más leídos" ignoraba los días cerrados que el worker no agregó** (la gráfica sí usaba datos crudos de respaldo, por lo que ambas cifras podían contradecirse). | `top_posts` completa con datos crudos los días sin fila en `daily_stats`. Test `test_top_posts_include_days_not_aggregated`. |
| La gráfica usaba curva suavizada (`monotone`), que insinuaba valores intermedios inexistentes, y la etiqueta "hoy" mostraba el día UTC. | Línea recta con puntos (≤ 31 días) y etiqueta con la fecha UTC real. El panel indica que los días se cuentan en UTC. |

Notas sin cambio: los días son UTC (en México, desde las 18:00 locales las visitas caen en el día siguiente); en desarrollo el panel (`:5173`) y el blog (`:3000`) son orígenes distintos, así que `localStorage.devnull_admin` no excluye tus propias visitas al blog (en producción, bajo Caddy, sí).

### 10.2 Pendientes (no corregidos)

| # | Sev. | Hallazgo | Recomendación |
|---|---|---|---|
| 4 | Media | Reutilizar un refresh token ya rotado no revoca las demás sesiones; tras `change-password` los access tokens siguen válidos hasta 15 min. | Detectar reutilización y llamar a `revoke_all_sessions`; añadir versión de token por usuario. |
| 5 | Media | Dockerfile usa `uv:latest` y ejecuta `alembic upgrade head` en cada arranque (carrera con varias réplicas). | Fijar versión de `uv`; mover las migraciones a un paso de despliegue (fase 8). |
| 6 | Baja | `canonical_url` de posts es un `str` libre. | Validar con `HttpUrl`. |
| 7 | Baja | Búsqueda admin con `ilike('%q%')` sin escapar `%` y `_`. | Escapar comodines. |
| 8 | Baja | `view_token` de engagement sin caducidad; `own_host` viene de cabeceras del cliente; bots detectados solo por User-Agent. | Añadir TTL al token; usar `SITE_URL` como única referencia. |
| 9 | Baja | El limitador falla abierto si Redis cae (decisión documentada); `/auth/refresh` sin rate limit propio. | Añadir límite a `refresh`. |
| 10 | Info | Acciones de GitHub fijadas por tag, no por SHA. | Fijar por SHA en la fase 8. |

---

## 11. Calidad, tests y CI

- **Backend:** `ruff check`, `ruff format --check`, `mypy app` y `pytest --cov-fail-under=80`. Los tests usan una base `_test` y Redis DB 15.
- **Frontend:** ESLint, `tsc`, Vitest (admin y web), *build* de ambos.
- **Contrato:** regenera los dos OpenAPI y los tipos y falla si `git diff` no está limpio.
- **E2E:** Playwright con los flujos críticos (`e2e/tests/critical-flows.spec.ts`).
- **CI** (`.github/workflows/ci.yml`): jobs `backend`, `frontend`, `contract` y `e2e` en cada PR y en `main`.

---

## 12. Operación

- **Servicios Docker Compose** (`infra/docker-compose.yml`): `db`, `redis` por defecto; `api` (pública), `admin-api` y `worker` con `--profile app`. `admin-api` y `worker` esperan a que `api` esté sana.
- **Backup:** `infra/backup/backup.sh` (`pg_dump` formato custom + tar del volumen de media + `SHA256SUMS`, conserva las últimas 14). Restauración con `restore.sh`.
- **Despliegue:** Docker, Caddy y AWS están **fuera de alcance hasta la fase 8** del roadmap.

---

## 13. Convenciones de trabajo

- Documentación y textos visibles en **español**; código, archivos, variables y commits en **inglés**.
- Flujo por tarea: plan → aprobación → implementación → verificación.
- No añadir dependencias sin avisar; no hardcodear secretos, URLs ni credenciales.
- Lo ambiguo se registra en "Preguntas abiertas" del documento correspondiente.

---

## 14. Índice de documentos

| Archivo | Contenido |
|---|---|
| [00-vision.md](00-vision.md) | Propósito, identidad y metas |
| [01-architecture.md](01-architecture.md) | Componentes y flujos |
| [02-data-model.md](02-data-model.md) | Modelo de datos |
| [03-api-contract.md](03-api-contract.md) | Contrato de la API |
| [04-metrics.md](04-metrics.md) | Métricas sin cookies |
| [05-security.md](05-security.md) | Seguridad |
| [06-conventions.md](06-conventions.md) | Convenciones |
| [07-roadmap.md](07-roadmap.md) | Roadmap |
| [08-vscode-run-guide.md](08-vscode-run-guide.md) | Guía de ejecución en VS Code |
| 09-project-documentation.md | Este documento |
