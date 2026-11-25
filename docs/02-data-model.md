# 02 — Modelo de datos

## Principios generales

- IDs enteros internos (secuenciales, nunca expuestos en URLs públicas).
- `slug` como identificador público en URLs (único, estable).
- PostgreSQL 16. Tipos nativos donde corresponda (JSONB, tsvector, timestamp with time zone).
- Todas las marcas de tiempo en UTC.

---

## Tablas

### `users`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `integer` | PK, autoincremental |
| `email` | `varchar` | único, not null |
| `password_hash` | `varchar` | Argon2id |
| `role` | `varchar` | default `'admin'` |
| `totp_secret` | `varchar` | nullable (fase 7: 2FA) |
| `is_active` | `boolean` | default `true` |
| `created_at` | `timestamptz` | default `now()` |

---

### `posts`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `integer` | PK |
| `title` | `varchar` | not null |
| `slug` | `varchar` | único, not null |
| `excerpt` | `text` | resumen corto |
| `content_md` | `text` | Markdown sin MDX |
| `status` | `varchar` | `draft\|scheduled\|published\|archived` |
| `published_at` | `timestamptz` | nullable |
| `scheduled_for` | `timestamptz` | nullable |
| `updated_at` | `timestamptz` | actualizado automáticamente |
| `cover_media_id` | `integer` | FK → `media.id`, nullable |
| `project_id` | `integer` | FK → `projects.id`, nullable |
| `category_id` | `integer` | FK → `categories.id`, nullable |
| `author_id` | `integer` | FK → `users.id`, not null |
| `reading_minutes` | `integer` | calculado al guardar |
| `seo_title` | `varchar` | nullable |
| `seo_description` | `text` | nullable |
| `canonical_url` | `varchar` | nullable |
| `og_media_id` | `integer` | FK → `media.id`, nullable |
| `github_repo` | `varchar(200)` | nullable; se guarda normalizado como `usuario/repositorio` (migración `0003`) |
| `series_order` | `integer` | nullable; posición en la serie del proyecto (≥ 1). Solo tiene sentido con `project_id` |
| `featured` | `boolean` | not null, por defecto `false`; fija el post en la portada |
| `search_vector` | `tsvector` | mantenido por trigger; índice GIN |

**Índices:** `slug` (unique), `status`, `published_at`, `featured`, `search_vector` (GIN).
**Restricciones:** `series_order IS NULL OR series_order >= 1`. La regla "el orden requiere proyecto" se valida en el servicio (un `CHECK` fallaría al borrar un proyecto, que deja `project_id` en `NULL`).

---

### `post_revisions`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `integer` | PK |
| `post_id` | `integer` | FK → `posts.id`, not null |
| `title` | `varchar` | snapshot del título |
| `content_md` | `text` | snapshot del contenido |
| `created_by` | `integer` | FK → `users.id` |
| `created_at` | `timestamptz` | default `now()` |

> Se guarda una revisión por cada publicación y cada N guardados (N a definir en tarea 1.4).

---

### `projects`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `integer` | PK |
| `name` | `varchar` | not null |
| `slug` | `varchar` | único, not null |
| `summary` | `text` | descripción corta |
| `description_md` | `text` | Markdown completo |
| `repo_url` | `varchar` | nullable |
| `demo_url` | `varchar` | nullable |
| `stack` | `jsonb` | lista de tecnologías |
| `status` | `varchar` | `active\|finished\|paused` |
| `start_date` | `date` | nullable |
| `end_date` | `date` | nullable |
| `cover_media_id` | `integer` | FK → `media.id`, nullable |
| `featured` | `boolean` | default `false` |
| `sort_order` | `integer` | para ordenación manual |

---

### `categories`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `integer` | PK |
| `name` | `varchar` | not null |
| `slug` | `varchar` | único, not null |
| `description` | `text` | nullable |

### `tags`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `integer` | PK |
| `name` | `varchar` | not null |
| `slug` | `varchar` | único, not null |

### `post_tags`

| Columna | Tipo | Notas |
|---|---|---|
| `post_id` | `integer` | FK → `posts.id` |
| `tag_id` | `integer` | FK → `tags.id` |

**PK compuesta:** `(post_id, tag_id)`.

---

### `career_entries`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `integer` | PK |
| `type` | `varchar` | `work\|education\|achievement\|certification` |
| `title` | `varchar` | not null |
| `organization` | `varchar` | nullable |
| `location` | `varchar` | nullable |
| `start_date` | `date` | not null |
| `end_date` | `date` | nullable — `null` significa "actual" |
| `description_md` | `text` | nullable |
| `skills` | `jsonb` | lista de habilidades relacionadas |
| `sort_order` | `integer` | ordenación manual |
| `visible` | `boolean` | default `true` |

---

### `site_settings`

| Columna | Tipo | Notas |
|---|---|---|
| `key` | `varchar` | PK |
| `value` | `jsonb` | valor configurable |

Claves previstas: `site_name`, `author_name`, `short_bio`, `social_links`, `about_md`.

---

### `media`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `integer` | PK |
| `storage_key` | `varchar` | ruta interna en el volumen |
| `url` | `varchar` | URL pública |
| `alt_text` | `varchar` | nullable |
| `mime` | `varchar` | tipo MIME validado |
| `size_bytes` | `integer` | tamaño del archivo |
| `width` | `integer` | nullable (para imágenes) |
| `height` | `integer` | nullable (para imágenes) |
| `created_at` | `timestamptz` | default `now()` |

---

### `page_views`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `bigint` | PK |
| `occurred_at` | `timestamptz` | not null |
| `path` | `varchar` | URL path visitada |
| `post_id` | `integer` | FK → `posts.id`, nullable |
| `project_id` | `integer` | FK → `projects.id`, nullable |
| `visitor_hash` | `varchar` | HMAC(salt, fecha+IP+UA) — sin IP |
| `session_hash` | `varchar` | ventana de 30 min de inactividad |
| `referrer_host` | `varchar` | nullable |
| `referrer_url` | `varchar` | nullable |
| `utm_source` | `varchar` | nullable |
| `utm_medium` | `varchar` | nullable |
| `utm_campaign` | `varchar` | nullable |
| `country` | `char(2)` | nullable (GeoLite2, fase pulido) |
| `device_type` | `varchar` | `desktop\|mobile\|tablet` |
| `browser` | `varchar` | nullable |
| `os` | `varchar` | nullable |
| `is_bot` | `boolean` | default `false` |

**Índices:** `(occurred_at)`, `(post_id, occurred_at)`, `(visitor_hash, occurred_at)`.

---

### `engagement_events`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `bigint` | PK |
| `page_view_id` | `bigint` | FK → `page_views.id` |
| `max_scroll_pct` | `smallint` | 0–100 |
| `seconds_active` | `integer` | segundos de lectura activa |

---

### `daily_stats`

| Columna | Tipo | Notas |
|---|---|---|
| `date` | `date` | parte de la PK |
| `post_id` | `integer` | FK → `posts.id`, nullable. `null` = total del sitio |
| `views` | `integer` | visitas totales del día |
| `unique_visitors` | `integer` | visitantes únicos |
| `avg_seconds` | `numeric` | promedio de segundos activos |
| `avg_scroll_pct` | `numeric` | promedio de scroll máximo |

**PK compuesta:** `(date, post_id)`.

---

### `webhook_log`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `integer` | PK |
| `target` | `varchar` | URL del webhook (Next.js revalidate) |
| `paths` | `jsonb` | lista de rutas revalidadas |
| `status_code` | `integer` | último código HTTP recibido |
| `attempts` | `integer` | número de intentos |
| `created_at` | `timestamptz` | default `now()` |

---

## Cambios respecto al diseño inicial

- `posts.created_at` (timestamptz) y `posts.saves_since_revision` (contador para las revisiones
  cada N guardados).
- `daily_stats` usa `id` como PK y `UNIQUE NULLS NOT DISTINCT (date, post_id)`: una PK no admite
  `post_id = NULL` (total del sitio). El upsert del worker usa esa restricción.
- `engagement_events.page_view_id` es único: los eventos sucesivos de una visita actualizan los
  máximos (scroll y segundos).
- `media.storage_key` es único.
- Claves foráneas: `ON DELETE SET NULL` para portada, OG, proyecto y categoría; `CASCADE` en
  `post_tags`, `post_revisions`, `engagement_events` y `daily_stats`.

## Decisiones

- **Retención de `page_views` (5.3):** job diario del worker que borra los registros de más de
  13 meses (`engagement_events` se borra en cascada). Sin particionado.
- **Revisiones (1.4):** N = 5 guardados con cambios en título o contenido. También se guarda una
  revisión al publicar y otra con el estado previo al restaurar.

## Preguntas abiertas

- **Particionado de `page_views`:** solo si el volumen lo exige; con el tráfico de un blog
  personal no es necesario.
