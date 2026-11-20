# AGENTS.md — Reglas permanentes del agente

## Proyecto
**dev/null** es un blog personal con tres pilares: carrera, proyectos y publicaciones.
Incluye CMS propio, API REST y métricas de visitas sin cookies.
Identificador técnico: `devnull`. Nombre visible: `dev/null` (solo en texto, nunca en rutas).

---

## Stack con versiones
| Capa | Tecnología |
|---|---|
| Backend | Python 3.12, FastAPI, uv, SQLAlchemy 2.0, Alembic, Pydantic v2 |
| Base de datos | PostgreSQL 16, Redis |
| Panel admin | React + Vite + TypeScript, TanStack Query, React Hook Form + Zod, shadcn/ui, Tailwind, Recharts |
| Blog público | Next.js (App Router) + TypeScript + Tailwind, ISR |
| JS package manager | pnpm con workspaces (admin, web) |
| Contenido | Markdown; react-markdown + remark-gfm + rehype-sanitize + shiki |
| Proxy | Caddy |

---

## Estructura de carpetas
```
backend/app/
  core/          # config, db, redis, seguridad transversal
  modules/       # auth posts projects taxonomy career media public metrics revalidation
  storage/       # StorageBackend (disco; interfaz para S3 futuro)
  worker/        # APScheduler (publicaciones programadas, agregación de métricas)
alembic/         # migraciones
tests/
admin/           # panel React + Vite
web/             # blog Next.js
infra/backup/    # scripts de backup
scripts/         # generate-types.sh y utilidades
.github/workflows/
docs/            # fuente de verdad del proyecto
```

## Regla de capas (backend)
```
router (HTTP) → service (lógica de negocio) → models / repository (BD)
```
Los routers **nunca** tocan la BD directamente.

---

## Regla del nombre
- Nombre visible (texto): `dev/null`
- Identificador técnico (rutas, slugs, archivos, imágenes Docker, variables): `devnull`
- La barra `/` **nunca** aparece en rutas, slugs, nombres de archivo, claves ni variables de entorno.
- Único lugar permitido: `SITE_NAME="dev/null"` y texto visible en UI/docs.

---

## Convenciones de idioma
- **Documentación y textos visibles**: español.
- **Código, nombres de archivos, variables, commits**: inglés.

---

## Flujo obligatorio por tarea
1. **Plan**: presenta lista de archivos/cambios. Espera aprobación.
2. **Implementa**: ejecuta los cambios aprobados.
3. **Verifica**: comprueba criterios de aceptación y muestra resultado.

---

## Prohibiciones
- No añadir dependencias sin avisar explícitamente al usuario.
- No tocar módulos fuera del alcance de la tarea activa.
- No hardcodear secretos, URLs ni credenciales.
- No usar la barra `/` de `dev/null` en ningún identificador técnico.
- No inventar decisiones de arquitectura; lo ambiguo va en "Preguntas abiertas" del doc correspondiente.
- No generar nada de despliegue (Docker, CI, AWS) hasta la fase indicada en el roadmap.

---

## Documentos a leer antes de cada tarea
Antes de implementar cualquier tarea, leer los docs de `/docs` relevantes:
- Siempre: `06-conventions.md` (convenciones) y `07-roadmap.md` (alcance).
- Backend: `01-architecture.md`, `02-data-model.md`, `03-api-contract.md`.
- Métricas: `04-metrics.md`.
- Seguridad: `05-security.md`.
- Diseño/UX: `00-vision.md`.

---

## Comandos canónicos

```bash
# Entorno de desarrollo (disponibles desde tarea 0.2)
dev-up:         ./scripts/dev-up.sh           # levanta db y redis
dev-down:       ./scripts/dev-down.sh         # detiene los servicios

# Backend
lint:          pendiente (ruff check .)
types:         pendiente (mypy .)
tests:         pendiente (pytest)

# Frontend
lint-fe:       pendiente (eslint)
types-fe:      pendiente (tsc --noEmit)
tests-fe:      pendiente (vitest)
e2e:           pendiente (playwright test)

# Generación de tipos
generate-types: pendiente (scripts/generate-types.sh)
```

---

## Contrato de tipos
El OpenAPI de FastAPI es la fuente de verdad.
Los tipos TypeScript de `admin/` y `web/` se generan con `scripts/generate-types.sh`.
Nunca escribir tipos TS a mano para los schemas de la API.
