# dev/null

> Aquí nada se descarta.

Blog personal de un desarrollador con tres pilares: carrera, proyectos y publicaciones.
Incluye CMS propio, API REST con FastAPI, panel de administración en React y blog público
con Next.js, todo con métricas de visitas propias sin cookies ni banners.

> Estado: **fases 0–6 completadas** (núcleo, CMS, panel, blog, proyectos/carrera, métricas y pulido).
> Pendiente: fase 7 (extras) y fase 8 (despliegue). Ver [roadmap](docs/07-roadmap.md).

---

## Estructura

| Carpeta | Contenido |
|---|---|
| `backend/` | Dos APIs FastAPI —pública y de administración— (Python 3.12, SQLAlchemy async, Alembic) + worker APScheduler |
| `admin/` | Panel React + Vite (`/admin`) |
| `web/` | Blog público Next.js (App Router, ISR) |
| `e2e/` | Tests end-to-end con Playwright |
| `infra/` | Docker Compose de desarrollo y scripts de backup |
| `scripts/` | Arranque de servicios y generación de tipos |
| `docs/` | Fuente de verdad del proyecto |

## Requisitos

- Docker (PostgreSQL 16 y Redis 7)
- [uv](https://docs.astral.sh/uv/) (Python 3.12)
- Node.js 24 con corepack (`corepack pnpm …`)

## Puesta en marcha (desarrollo)

```bash
cp .env.example .env                    # y cambia los secretos
cp web/.env.example web/.env.local      # mismo REVALIDATE_SECRET que en .env
./scripts/dev-up.sh                     # PostgreSQL + Redis

cd backend
uv sync
uv run alembic upgrade head
uv run python -m app.cli create-admin --email tu@correo.com   # pide la contraseña
uv run uvicorn app.apps.public:app --port 8000                # API pública → http://localhost:8000/api/v1/docs
uv run uvicorn app.apps.admin:app --port 8001                 # API admin   → http://localhost:8001/api/v1/docs (otra terminal)
uv run python -m app.worker                                   # worker (otra terminal)

cd ..
corepack pnpm install
corepack pnpm --filter admin dev        # panel → http://localhost:5173/admin/
corepack pnpm --filter web dev          # blog  → http://localhost:3000
```

En Windows, los scripts `.sh` se ejecutan desde Git Bash o WSL.

## Comandos

| Tarea | Comando |
|---|---|
| Lint / formato / tipos / tests (backend) | `cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run pytest` |
| Lint / tipos / tests (frontend) | `corepack pnpm lint && corepack pnpm typecheck && corepack pnpm test` |
| E2E (3 flujos críticos) | `corepack pnpm e2e` |
| Regenerar tipos desde OpenAPI | `bash scripts/generate-types.sh` |
| Backup / restauración | `./infra/backup/backup.sh` · `./infra/backup/restore.sh backups/<STAMP>` |

Los tipos TypeScript de `admin/` y `web/` se generan desde el OpenAPI de FastAPI: nunca se escriben a mano.

## Documentación

| Documento | Contenido |
|---|---|
| [00-vision.md](docs/00-vision.md) | Propósito, identidad y metas del proyecto |
| [01-architecture.md](docs/01-architecture.md) | Componentes, flujos y estructura de carpetas |
| [02-data-model.md](docs/02-data-model.md) | Modelo de datos PostgreSQL |
| [03-api-contract.md](docs/03-api-contract.md) | Contrato de la API REST |
| [04-metrics.md](docs/04-metrics.md) | Sistema de métricas sin cookies |
| [05-security.md](docs/05-security.md) | Seguridad y buenas prácticas |
| [06-conventions.md](docs/06-conventions.md) | Convenciones de código y git |
| [07-roadmap.md](docs/07-roadmap.md) | Roadmap por fases y tareas |

## Nombre

- **Nombre visible:** `dev/null`
- **Tagline:** "Aquí nada se descarta."
- **Identificador técnico:** `devnull`
