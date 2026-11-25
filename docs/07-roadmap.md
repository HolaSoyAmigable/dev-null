# 07 — Roadmap

Cada tarea corresponde a un prompt de implementación. Las tareas se ejecutan en orden dentro de cada fase; las fases son acumulativas.

---

## Fase 0 — Base

- [x] **0.1** Estructura del repositorio, documentación y reglas del agente
- [x] **0.2** `docker-compose.yml` con servicios: `api`, `db`, `redis`
- [x] **0.3** FastAPI base: configuración, logging, `GET /health`, `GET /ready`
- [x] **0.4** Alembic + modelos SQLAlchemy iniciales (`users`, `posts`, `media`, `site_settings`)
- [x] **0.5** CI básico (GitHub Actions): lint, tipos y tests en cada PR

---

## Fase 1 — Auth + CMS núcleo

- [x] **1.1** Auth: login, refresh, logout, `GET /auth/me`, `POST /auth/change-password`, CLI `create-admin`
- [x] **1.2** CRUD taxonomía: tags, categories (admin + público)
- [x] **1.3** CRUD posts + estados (`draft`, `scheduled`, `published`, `archived`)
- [x] **1.4** Revisiones de posts (`post_revisions`): guardar, listar, restaurar
- [x] **1.5** Endpoints públicos de posts: lista paginada, slug, relacionados, búsqueda

---

## Fase 2 — Panel de administración

- [x] **2.1** Scaffold React + Vite + TypeScript; generación de tipos desde OpenAPI (`scripts/generate-types.sh`)
- [x] **2.2** Login y layout principal del panel (sidebar, rutas protegidas)
- [x] **2.3** Lista de posts con filtros y acciones rápidas
- [x] **2.4** Editor Markdown: formulario completo, preview, SEO, publicación
- [x] **2.5** Gestión de media: subida, galería, selección desde el editor

---

## Fase 3 — Blog público (MVP)

- [x] **3.1** Scaffold Next.js (App Router) + cliente de API tipado
- [x] **3.2** Home y listados: página de inicio, `/blog`, `/blog/tag/[slug]`, `/blog/category/[slug]`
- [x] **3.3** Página de post: render Markdown, TOC, posts relacionados
- [x] **3.4** Revalidación ISR: webhook desde la API + `webhook_log`, reintentos
- [x] **3.5** SEO: `<title>`, Open Graph, `/sitemap.xml`, `/rss.xml`
- [x] **3.6** Diseño final: tipografía, colores, modo oscuro/claro, favicon, páginas de error (404, 500)

---

## Fase 4 — Proyectos y carrera

- [x] **4.1** Proyectos: CRUD admin, página pública `/projects`, `/projects/[slug]`, posts de bitácora
- [x] **4.2** Carrera: CRUD admin con reorden, página pública `/career`
- [x] **4.3** Settings del sitio: CRUD admin, página pública `/about`, integración en header/footer

---

## Fase 5 — Métricas

- [x] **5.1** Ingesta: `POST /public/events`, detección de bots, cálculo de hashes, guardado en `page_views`
- [x] **5.2** Beacon del cliente: script en Next.js con `sendBeacon`, respeto a DNT y flag de admin
- [x] **5.3** Worker de agregación: APScheduler, agregación nocturna en `daily_stats`, limpieza de 13 meses
- [x] **5.4** Endpoints de consulta: overview, timeseries, top-posts, referrers, países, dispositivos, realtime
- [x] **5.5** Dashboard de métricas en el panel admin: gráficos con Recharts

---

## Fase 6 — Pulido

- [x] **6.1** Búsqueda full-text: índice GIN en PostgreSQL, trigger para `search_vector`, endpoint `/public/search`
- [x] **6.2** Publicación programada: worker comprueba `scheduled_for` y publica automáticamente
- [x] **6.3** Caché Redis y rate limiting: caché en endpoints públicos, rate limit en login y eventos
- [x] **6.4** Tests end-to-end con Playwright: 3 flujos críticos (login, crear post, verificar en blog)
- [x] **6.5** Backups: script de dump de PostgreSQL + volumen de media, con restauración probada en local

---

## Fase 7 — Extras

- [ ] **7.1** Newsletter (integración con proveedor externo, TBD)
- [ ] **7.2** Comentarios con [Giscus](https://giscus.app/) (GitHub Discussions)
- [ ] **7.3** 2FA TOTP para el administrador

---

## Fase 8 — Despliegue

> **Fuera del alcance hasta esta fase.** No generar nada de infraestructura antes.

- [ ] **8.1** AWS EC2 (AWS Academy): instancia, Elastic IP, grupo de seguridad
- [ ] **8.2** Docker Compose de producción con Caddy, TLS automático
- [ ] **8.3** Variables de entorno de producción, secretos seguros
- [ ] **8.4** Reinicio automático (`restart: unless-stopped`), migraciones al arrancar
- [ ] **8.5** Backups descargables desde EC2, restauración documentada

---

## Estado

Fases 0–6 completadas. Pendiente: fase 7 (extras) y fase 8 (despliegue).

- 0.4 y 6.1: el esquema completo vive en dos migraciones revisadas a mano
  (`0001_create_initial_schema` y `0002_add_search_vector_trigger_and_seed_settings`, que crea el
  trigger de `search_vector`, el índice GIN y el seed de `site_settings`).
- País (GeoLite2) **no** está activo: `country` queda en `null` (ver `04-metrics.md`).

## Preguntas abiertas

- **Proveedor de newsletter (fase 7.1):** ¿Resend, Brevo, Mailchimp u otro? A decidir cuando llegue la fase 7.
- **Instancia EC2 (fase 8.1):** tipo de instancia y región de AWS Academy. A confirmar antes de la fase 8.
