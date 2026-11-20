# 07 — Roadmap

Cada tarea corresponde a un prompt de implementación. Las tareas se ejecutan en orden dentro de cada fase; las fases son acumulativas.

---

## Fase 0 — Base

- [x] **0.1** Estructura del repositorio, documentación y reglas del agente _(esta tarea)_
- [ ] **0.2** `docker-compose.yml` con servicios: `api`, `db`, `redis`
- [ ] **0.3** FastAPI base: configuración, logging, `GET /health`, `GET /ready`
- [ ] **0.4** Alembic + modelos SQLAlchemy iniciales (`users`, `posts`, `media`, `site_settings`)
- [ ] **0.5** CI básico (GitHub Actions): lint, tipos y tests en cada PR

---

## Fase 1 — Auth + CMS núcleo

- [ ] **1.1** Auth: login, refresh, logout, `GET /auth/me`, `POST /auth/change-password`, CLI `create-admin`
- [ ] **1.2** CRUD taxonomía: tags, categories (admin + público)
- [ ] **1.3** CRUD posts + estados (`draft`, `scheduled`, `published`, `archived`)
- [ ] **1.4** Revisiones de posts (`post_revisions`): guardar, listar, restaurar
- [ ] **1.5** Endpoints públicos de posts: lista paginada, slug, relacionados, búsqueda

---

## Fase 2 — Panel de administración

- [ ] **2.1** Scaffold React + Vite + TypeScript; generación de tipos desde OpenAPI (`scripts/generate-types.sh`)
- [ ] **2.2** Login y layout principal del panel (sidebar, rutas protegidas)
- [ ] **2.3** Lista de posts con filtros y acciones rápidas
- [ ] **2.4** Editor Markdown: formulario completo, preview, SEO, publicación
- [ ] **2.5** Gestión de media: subida, galería, selección desde el editor

---

## Fase 3 — Blog público (MVP)

- [ ] **3.1** Scaffold Next.js (App Router) + cliente de API tipado
- [ ] **3.2** Home y listados: página de inicio, `/blog`, `/blog/tag/[slug]`, `/blog/category/[slug]`
- [ ] **3.3** Página de post: render Markdown, TOC, posts relacionados
- [ ] **3.4** Revalidación ISR: webhook desde la API + `webhook_log`, reintentos
- [ ] **3.5** SEO: `<title>`, Open Graph, `/sitemap.xml`, `/rss.xml`
- [ ] **3.6** Diseño final: tipografía, colores, modo oscuro/claro, favicon, páginas de error (404, 500)

---

## Fase 4 — Proyectos y carrera

- [ ] **4.1** Proyectos: CRUD admin, página pública `/projects`, `/projects/[slug]`, posts de bitácora
- [ ] **4.2** Carrera: CRUD admin con reorden, página pública `/career`
- [ ] **4.3** Settings del sitio: CRUD admin, página pública `/about`, integración en header/footer

---

## Fase 5 — Métricas

- [ ] **5.1** Ingesta: `POST /public/events`, detección de bots, cálculo de hashes, guardado en `page_views`
- [ ] **5.2** Beacon del cliente: script en Next.js con `sendBeacon`, respeto a DNT y flag de admin
- [ ] **5.3** Worker de agregación: APScheduler, agregación nocturna en `daily_stats`, limpieza de 13 meses
- [ ] **5.4** Endpoints de consulta: overview, timeseries, top-posts, referrers, países, dispositivos, realtime
- [ ] **5.5** Dashboard de métricas en el panel admin: gráficos con Recharts

---

## Fase 6 — Pulido

- [ ] **6.1** Búsqueda full-text: índice GIN en PostgreSQL, trigger para `search_vector`, endpoint `/public/search`
- [ ] **6.2** Publicación programada: worker comprueba `scheduled_for` y publica automáticamente
- [ ] **6.3** Caché Redis y rate limiting: caché en endpoints públicos, rate limit en login y eventos
- [ ] **6.4** Tests end-to-end con Playwright: 3 flujos críticos (login, crear post, verificar en blog)
- [ ] **6.5** Backups: script de dump de PostgreSQL + volumen de media, con restauración probada en local

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

## Preguntas abiertas

- **Proveedor de newsletter (fase 7.1):** ¿Resend, Brevo, Mailchimp u otro? A decidir cuando llegue la fase 7.
- **Instancia EC2 (fase 8.1):** tipo de instancia y región de AWS Academy. A confirmar antes de la fase 8.
