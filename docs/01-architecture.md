# 01 — Arquitectura

## Diagrama de componentes

```
                        ┌─────────────────────────────────────────┐
                        │                 Caddy                   │
                        │  (proxy inverso, TLS, cabeceras HTTP)   │
                        └──────────┬──────────┬───────────────────┘
                                   │          │
              ┌────────────────────▼──┐  ┌────▼────────────────────┐
              │   web (Next.js :3000) │  │  admin (estático :80/*) │
              │   Server Components   │  │  React + Vite build     │
              │   ISR + revalidación  │  │  base path: /admin/     │
              └────────────────────┬──┘  └─────────────────────────┘
                                   │
                        ┌──────────▼──────────────┐
                        │   api (FastAPI :8000)    │
                        │   prefijo: /api/v1       │
                        └──────┬──────────┬────────┘
                               │          │
                    ┌──────────▼──┐  ┌────▼──────┐
                    │ PostgreSQL  │  │   Redis   │
                    │     16      │  │  caché +  │
                    └──────▲──────┘  │ rate limit│
                           │         └────▲──────┘
                    ┌──────┴──────────────┴──────┐
                    │   worker (APScheduler)      │
                    │   - publicaciones prog.     │
                    │   - agregación de métricas  │
                    └─────────────────────────────┘
```

### Enrutado por ruta (Caddy)
| Ruta | Destino |
|---|---|
| `/` | web — Next.js `:3000` |
| `/admin/*` | admin — build estático (base path `/admin/`) |
| `/api/v1/*` | api — FastAPI `:8000` |

**Sin CORS en producción.** Todo el tráfico pasa por Caddy en el mismo origen.
`COOKIE_SECURE` es configurable por entorno.

---

## Servicios de Docker Compose (previstos)

| Servicio | Descripción |
|---|---|
| `api` | FastAPI (Python 3.12) |
| `worker` | APScheduler — tareas programadas y métricas |
| `db` | PostgreSQL 16 |
| `redis` | Redis — caché y rate limiting |
| `web` | Next.js (App Router) |
| `caddy` | Proxy inverso; sirve el build estático del admin |

> El panel admin se compila con Vite y Caddy lo sirve como archivos estáticos. No tiene servidor propio.

---

## Flujo de publicación

```
Admin UI
  │
  └─► POST /api/v1/admin/posts/{id}/publish
            │
            ├─► API actualiza estado en PostgreSQL (published_at, status)
            │
            └─► API llama POST {WEB_URL}/api/revalidate
                    │  (cabecera x-revalidate-secret)
                    │  body: { paths: ["/blog/{slug}", "/blog", "/",
                    │                  "/tag/{tag}", "/category/{cat}",
                    │                  "/projects/{slug}"] }
                    │
                    ├── [éxito] Next.js regenera solo esas páginas (ISR)
                    │          API registra en webhook_log (status 200)
                    │
                    └── [fallo] API reintenta y registra en webhook_log
                               Red de seguridad: revalidate=3600 en las páginas
```

**Rutas revalidadas:** el post, `/blog`, `/` (home), tag relacionado, categoría relacionada y proyecto relacionado (si aplica).

---

## Flujo de métricas

```
Navegador (cliente web)
  │
  └─► navigator.sendBeacon → POST /api/v1/public/events
              │  (solo desde navegador real)
              │
              ▼
         API calcula:
           - visitor_hash = HMAC(METRICS_SALT_SECRET, fecha + IP + UA)
           - session_hash (ventana 30 min)
           - detección de bots
           - device_type, browser, os (UA parsing)
              │
              ▼
         Guarda en page_views (IP nunca almacenada)
              │
              ▼ (cada noche — worker APScheduler)
         Agrega en daily_stats
              │
              ▼
         Dashboard consulta:
           daily_stats + page_views del día actual (en tiempo real)
```

---

## Estructura de carpetas

```
devnull/
├── backend/
│   ├── app/
│   │   ├── core/          # config, db, redis, seguridad transversal
│   │   ├── modules/       # módulos de negocio (ver regla de capas)
│   │   │   ├── auth/
│   │   │   ├── posts/
│   │   │   ├── projects/
│   │   │   ├── taxonomy/
│   │   │   ├── career/
│   │   │   ├── media/
│   │   │   ├── public/
│   │   │   ├── metrics/
│   │   │   └── revalidation/
│   │   ├── storage/       # StorageBackend (disco; interfaz extensible a S3)
│   │   └── worker/        # APScheduler
│   ├── alembic/           # migraciones de BD
│   └── tests/
├── admin/                 # React + Vite + TypeScript
├── web/                   # Next.js (App Router)
├── infra/
│   └── backup/            # scripts de backup
├── scripts/               # generate-types.sh y utilidades
├── .github/
│   └── workflows/
└── docs/
```

## Regla de capas (backend)

Cada módulo bajo `app/modules/` respeta esta jerarquía estricta:

```
router.py      ← HTTP: validación de entrada, respuesta HTTP, auth guards
   │
service.py     ← lógica de negocio, orquestación, llamadas externas
   │
models.py /    ← SQLAlchemy models + queries; nunca accedidos desde router
repository.py
```

**Los routers nunca tocan la BD directamente.**

---

## Contrato entre aplicaciones

- El **OpenAPI de FastAPI** es la única fuente de verdad del contrato.
- Los tipos TypeScript de `admin/` y `web/` se generan con `scripts/generate-types.sh`.
- Nunca escribir tipos TS a mano para los schemas de la API.

---

## Resiliencia

- Todos los servicios: `restart: unless-stopped`.
- La API ejecuta migraciones Alembic automáticamente al arrancar.
- `GET /ready` verifica la conexión a PostgreSQL y Redis antes de responder `200`.

---

## Decisiones

- **Reintentos del webhook (3.4):** hasta 3 intentos con backoff exponencial (1 s, 2 s),
  configurables con `REVALIDATE_MAX_ATTEMPTS` y `REVALIDATE_BACKOFF_SECONDS`. Cada llamada queda
  en `webhook_log`. Red de seguridad: `revalidate = 3600`.
- **Rutas revalidadas:** el post, `/`, `/blog` (y su paginación `/blog/page/[n]`),
  `/blog/tag/{tag}`, `/blog/category/{cat}`, `/projects` y `/projects/{slug}` si aplica,
  `/rss.xml` y `/sitemap.xml`. Los cambios de settings envían `"*"`, que revalida todo el sitio.
- **Desarrollo sin Caddy:** Vite (admin) y Next.js (web) hacen de proxy de `/api/v1` y `/media`
  hacia la API, así todo funciona en el mismo origen también en local.
- **Media en desarrollo:** la API sirve `/media` con `StaticFiles` solo si `ENV != production`;
  en producción la servirá Caddy desde el volumen.
- **Worker:** proceso aparte (`python -m app.worker`; servicio `worker` en Compose con
  `--profile app`). Publica lo programado cada minuto y agrega métricas cada noche.

## Preguntas abiertas

- **Puerto del admin estático:** ¿Caddy lo sirve desde el filesystem (build de Vite montado como
  volumen) o desde un contenedor propio? Se decide en la fase 8.2.
