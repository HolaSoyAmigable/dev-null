# 04 — Métricas

## Principios

- **Sin cookies.** Sin banner de consentimiento.
- **Sin almacenar IPs.** La identificación de visitantes es mediante huellas anónimas.
- **Privacidad por diseño:** solo se guarda lo necesario para el análisis de tráfico.

---

## Visitante único

La huella de visitante se calcula con HMAC:

```
visitor_hash = HMAC-SHA256(METRICS_SALT_SECRET, fecha_diaria + IP + User-Agent)
```

- `fecha_diaria`: la fecha en formato `YYYY-MM-DD` (UTC). Cambia cada día, lo que limita el tracking a 24 horas máximo.
- La IP se usa **solo** para calcular el hash y nunca se almacena.
- El `METRICS_SALT_SECRET` es un secreto de servidor; sin él el hash no puede invertirse.

---

## Sesión

```
session_hash = HMAC-SHA256(METRICS_SALT_SECRET, visitor_hash + ventana_temporal)
```

- La **ventana temporal** es un bloque de 30 minutos de inactividad.
- Si el visitante no genera eventos durante 30 minutos, el siguiente evento inicia una nueva sesión.
- Implementación: el `session_hash` incluye el timestamp del inicio de la ventana actual redondeado a 30 minutos.

---

## Envío desde el cliente

El cliente web usa [`navigator.sendBeacon`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon) para enviar el evento:

```
POST /api/v1/public/events
Content-Type: application/json

{
  "path": "/blog/mi-primer-post",
  "referrer": "https://twitter.com/...",
  "utm_source": "twitter",
  "utm_medium": "social",
  "utm_campaign": "lanzamiento"
}
```

- `sendBeacon` garantiza que el request se completa aunque el usuario navegue a otra página.
- **Solo corre en el navegador.** No hay tracking en SSR ni en bots.

---

## Detección y exclusión de bots

**Detectados como bots:**
- User-agents en lista de bots conocidos (Googlebot, Bingbot, etc.).
- Requests que no provienen de un contexto de navegador real (sin headers típicos del navegador).
- El beacon solo se ejecuta en el cliente JavaScript; los crawlers que no ejecutan JS no generan eventos.

**Excluidos del conteo:**
- El navegador del administrador autenticado (flag `devnull_admin=1` en `localStorage`, establecido tras el login).
- Visitantes con [Do Not Track](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/DNT) activo (`navigator.doNotTrack === "1"`).

Los registros marcados como `is_bot = true` se guardan pero no se cuentan en las estadísticas del dashboard.

---

## País

- **Opcional y nullable.** La columna `country` en `page_views` es `char(2)` nullable.
- Requiere la base de datos **GeoLite2** de MaxMind (lookup por IP en memoria).
- Se activa en la **fase de pulido** (tarea 6.x). Hasta entonces, `country = null`.
- La IP se usa solo para el lookup y no se almacena.

---

## Retención de datos

| Tabla | Retención |
|---|---|
| `page_views` | 13 meses (rolling) |
| `engagement_events` | 13 meses (rolling, ligado a `page_views`) |
| `daily_stats` | Indefinida |

La limpieza de registros antiguos es responsabilidad del worker (APScheduler).

---

## Consultas del dashboard

| Vista | Fuente de datos |
|---|---|
| Visitas y únicos por día | `daily_stats` + `page_views` del día actual |
| Top posts por período | `daily_stats` agrupado por `post_id` |
| Fuentes de tráfico | `page_views.referrer_host` agrupado |
| Distribución por país | `page_views.country` agrupado (cuando esté activo GeoLite2) |
| Distribución por dispositivo | `page_views.device_type` agrupado |
| Métricas de un post | `daily_stats` + `engagement_events` filtrado por `post_id` |
| Tasa de lectura | `engagement_events.avg_scroll_pct` y `avg_seconds` por post |
| Tiempo real (últimos 30 min) | `page_views` donde `occurred_at > now() - interval '30 min'` |

---

## Agregación nocturna (worker)

El worker APScheduler ejecuta cada noche (hora configurable, TBD en tarea 5.3):

1. Agrupa `page_views` del día anterior por `post_id` (y `null` para el total del sitio).
2. Calcula `views`, `unique_visitors`, `avg_seconds`, `avg_scroll_pct` cruzando con `engagement_events`.
3. Inserta o actualiza `daily_stats` con `ON CONFLICT DO UPDATE`.
4. Elimina `page_views` más antiguos de 13 meses.

---

## Preguntas abiertas

- **Hora de la agregación nocturna:** ¿medianoche UTC o medianoche hora local del autor? A definir en tarea 5.3.
- **Implementación de GeoLite2:** ¿biblioteca `geoip2` de MaxMind o alternativa? A decidir en la fase de pulido.
- **Umbral de scroll para "leído":** ¿qué porcentaje de scroll y cuántos segundos se consideran una lectura completa? A definir en tarea 5.2.
