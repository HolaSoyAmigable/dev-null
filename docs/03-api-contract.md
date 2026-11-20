# 03 — Contrato de la API

## Principios generales

- **Prefijo:** `/api/v1`
- **Formato:** JSON exclusivamente.
- **Fechas:** ISO 8601 UTC (ej. `"2024-01-15T10:30:00Z"`).
- **Paginación:** parámetros `?page=` y `?page_size=` en endpoints de lista.
- **Schemas:** Pydantic v2 con nombres explícitos (ej. `PostCreate`, `PostRead`, `PostUpdate`).

### Respuesta de lista paginada
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 20
}
```

### Respuesta de error
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "El recurso solicitado no existe.",
    "details": {}
  }
}
```

**Códigos HTTP usados:** `200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `422`, `429`.

---

## Endpoints internos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Siempre `200`. Confirma que el proceso está vivo. |
| `GET` | `/ready` | `200` si PostgreSQL y Redis responden; `503` si no. |

---

## Endpoints públicos

Sin autenticación. Caché corta. Rate limit por IP.

### Posts
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/public/posts` | Lista paginada. Filtros: `page`, `page_size`, `tag`, `category`, `project`, `q` |
| `GET` | `/public/posts/{slug}` | Post completo por slug |
| `GET` | `/public/posts/{slug}/related` | Posts relacionados (mismas etiquetas / categoría) |

### Proyectos
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/public/projects` | Lista de proyectos publicados |
| `GET` | `/public/projects/{slug}` | Proyecto completo + posts relacionados |

### Taxonomía y navegación
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/public/career` | Entradas de carrera visibles, ordenadas |
| `GET` | `/public/tags` | Lista de etiquetas con contador de posts |
| `GET` | `/public/categories` | Lista de categorías con contador de posts |
| `GET` | `/public/search` | Búsqueda full-text. Parámetro: `q` |
| `GET` | `/public/settings` | Settings públicos del sitio (nombre, bio, redes) |
| `GET` | `/public/slugs` | Lista de todos los slugs publicados (para generación estática) |

### Métricas / eventos
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/public/events` | Recibe un evento de pageview (beacon del cliente) |

### Feeds
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/rss.xml` | Feed RSS 2.0 de los últimos posts publicados |
| `GET` | `/sitemap.xml` | Sitemap XML con todas las URLs públicas |

---

## Endpoints de autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/login` | Credenciales → access token (JSON) + refresh token (cookie httpOnly) |
| `POST` | `/auth/refresh` | Rota el refresh token; devuelve nuevo access token |
| `POST` | `/auth/logout` | Invalida el refresh token; borra la cookie |
| `GET` | `/auth/me` | Datos del usuario autenticado |
| `POST` | `/auth/change-password` | Cambia la contraseña (requiere contraseña actual) |

### Tokens
- **Access token:** JWT, vida de 15 minutos, devuelto en el body JSON. El cliente lo guarda en memoria (nunca en localStorage).
- **Refresh token:** JWT, vida de 7 días, en cookie `httpOnly`, `SameSite=Lax`, `Secure` según `COOKIE_SECURE`. Rotación en cada uso (el token anterior se invalida).

---

## Endpoints de administración

Requieren `Authorization: Bearer <access_token>`. Solo el administrador.

### Posts
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/admin/posts` | Lista con todos los estados. Filtros: `status`, `q` |
| `POST` | `/admin/posts` | Crear borrador |
| `GET` | `/admin/posts/{id}` | Obtener post por ID |
| `PATCH` | `/admin/posts/{id}` | Actualizar campos |
| `DELETE` | `/admin/posts/{id}` | Eliminar (solo borradores/archivados) |
| `POST` | `/admin/posts/{id}/publish` | Publicar → actualiza BD + dispara revalidación |
| `POST` | `/admin/posts/{id}/unpublish` | Volver a borrador |
| `POST` | `/admin/posts/{id}/schedule` | Programar publicación (body: `scheduled_for`) |
| `POST` | `/admin/posts/{id}/duplicate` | Duplicar como nuevo borrador |
| `GET` | `/admin/posts/{id}/revisions` | Historial de revisiones |
| `POST` | `/admin/posts/{id}/restore-revision/{revision_id}` | Restaurar revisión |

### Proyectos
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/admin/projects` | Lista de todos los proyectos |
| `POST` | `/admin/projects` | Crear proyecto |
| `GET` | `/admin/projects/{id}` | Obtener por ID |
| `PATCH` | `/admin/projects/{id}` | Actualizar |
| `DELETE` | `/admin/projects/{id}` | Eliminar |

### Carrera
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/admin/career` | Lista de entradas de carrera |
| `POST` | `/admin/career` | Crear entrada |
| `GET` | `/admin/career/{id}` | Obtener por ID |
| `PATCH` | `/admin/career/{id}` | Actualizar |
| `DELETE` | `/admin/career/{id}` | Eliminar |
| `PATCH` | `/admin/career/reorder` | Actualizar `sort_order` en lote |

### Taxonomía
| Método | Ruta | Descripción |
|---|---|---|
| `GET/POST` | `/admin/tags` | Listar / crear etiquetas |
| `PATCH/DELETE` | `/admin/tags/{id}` | Actualizar / eliminar etiqueta |
| `GET/POST` | `/admin/categories` | Listar / crear categorías |
| `PATCH/DELETE` | `/admin/categories/{id}` | Actualizar / eliminar categoría |

### Settings
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/admin/settings` | Obtener todos los settings |
| `PATCH` | `/admin/settings` | Actualizar uno o varios settings |

### Media
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/admin/media` | Lista paginada de archivos |
| `POST` | `/admin/media` | Subir archivo (multipart/form-data) |
| `DELETE` | `/admin/media/{id}` | Eliminar archivo |

---

## Endpoints de métricas (admin)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/admin/metrics/overview` | Totales del período (vistas, únicos, avg lectura) |
| `GET` | `/admin/metrics/timeseries` | Visitas y únicos por día. Params: `start`, `end` |
| `GET` | `/admin/metrics/top-posts` | Posts con más vistas del período |
| `GET` | `/admin/metrics/referrers` | Fuentes de tráfico agrupadas por host |
| `GET` | `/admin/metrics/countries` | Distribución por país (si GeoLite2 está activo) |
| `GET` | `/admin/metrics/devices` | Distribución por tipo de dispositivo |
| `GET` | `/admin/metrics/posts/{id}` | Métricas detalladas de un post |
| `GET` | `/admin/metrics/realtime` | Visitantes y páginas activas (últimos 30 min) |

---

## Endpoint de revalidación (interno entre servicios)

| Método | Ruta (en Next.js) | Descripción |
|---|---|---|
| `POST` | `/api/revalidate` | Recibe lista de rutas a revalidar. Autenticado con `x-revalidate-secret`. |

Este endpoint vive en Next.js, no en FastAPI. La API lo llama internamente tras publicar.

---

## Preguntas abiertas

- **`page_size` máximo y por defecto:** ¿20 por defecto, 100 máximo? A confirmar en tarea 1.5.
- **Formato de `stack` en proyectos:** ¿array de strings o array de objetos `{name, url}`? A definir en tarea 4.1.
- **Autenticación del endpoint `/rss.xml` y `/sitemap.xml`:** se sirven públicos sin auth, pero ¿se cachean en Caddy? A definir en tarea 3.5.
