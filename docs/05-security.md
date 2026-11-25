# 05 — Seguridad

## Contraseñas

- Algoritmo: **Argon2id** (resistente a ataques de GPU y side-channel).
- Se aplica a la contraseña del administrador al crearla (`python -m app.cli create-admin`).
- No hay registro público; un solo administrador.

---

## Rate limiting

| Endpoint | Límite | Ventana |
|---|---|---|
| `POST /auth/login` | 5 intentos | por IP, por minuto |
| `POST /public/events` | configurable | por IP (proteger la ingesta de métricas) |
| Endpoints públicos en general | configurable | por IP |

Implementado en Redis (contador deslizante). Responde `429 Too Many Requests` al superarlo.

**IP del cliente.** `X-Forwarded-For` solo se usa con `TRUST_PROXY_HEADERS=true`, y se toma la entrada situada `TRUSTED_PROXY_HOPS` posiciones desde el final (la que añade el proxy de confianza), nunca la primera, que el cliente puede falsear. Por defecto está desactivado. Actívalo únicamente si la API no es accesible sin pasar por el proxy.

---

## Secretos y variables de entorno

- **Ningún secreto se hardcodea** en el código ni en archivos versionados.
- Todos los secretos se leen de **variables de entorno** (`.env` en desarrollo, variables del sistema en producción).
- `.env` está en `.gitignore`. Solo `.env.example` (sin valores reales) está versionado.
- Variables sensibles: `JWT_SECRET`, `REFRESH_SECRET`, `METRICS_SALT_SECRET`, `REVALIDATE_SECRET`.

---

## Subida de archivos (media)

1. **Validación de MIME real:** no confiar en la extensión ni en el `Content-Type` declarado. Se inspecciona el contenido del archivo (magic bytes).
2. **Tamaño máximo:** límite configurado en la API (valor a definir en tarea 2.5).
3. **Renombrado:** el archivo se guarda con un nombre generado (UUID o hash), nunca con el nombre original del cliente.
4. **Nunca ejecutable:** el directorio de media está fuera del alcance de ejecución del servidor web. Caddy lo sirve como archivos estáticos sin ejecutar nada.
5. **StorageBackend:** los archivos se guardan en disco local (volumen Docker) detrás de la interfaz `StorageBackend`, diseñada para poder sustituirse por S3 en el futuro.

---

## Markdown

- Todo el contenido Markdown que se renderiza en el blog público se pasa por **rehype-sanitize** antes de generar HTML.
- Esto previene XSS en caso de que el contenido del CMS sea comprometido o mal formado.
- La sanitización se aplica también al preview en el editor del panel admin.
- **Fórmulas (KaTeX):** se renderizan *después* de sanear, con `trust: false` (los comandos como `\href` o `\url` no generan enlaces) y `throwOnError: false`. El saneado solo admite las clases que `remark-math` necesita.
- **Diagramas (Mermaid):** se renderizan en el navegador con `securityLevel: "strict"` (sin HTML ni eventos dentro del diagrama) y la biblioteca se carga solo cuando hay un diagrama. Sin JavaScript o ante un error se muestra el código fuente.
- **Borradores locales del editor:** el autoguardado usa `localStorage` del navegador (nunca se envían al servidor) y se borran al guardar. En un equipo compartido el texto sin publicar queda en ese navegador hasta guardarlo o descartarlo.
- **Enlace al repositorio:** `github_repo` se valida y normaliza en el backend (`usuario/repositorio`) y el blog solo construye la URL `https://github.com/…` si ese formato se cumple.

---

## Webhook de revalidación

- El endpoint `POST /api/revalidate` en Next.js está protegido con el secreto `REVALIDATE_SECRET`.
- La API envía el secreto en la cabecera `x-revalidate-secret`.
- El secreto es compartido entre la API y Next.js; nunca expuesto al cliente.

---

## Cabeceras HTTP de seguridad

Configuradas en Caddy para todas las respuestas:

| Cabecera | Valor / Propósito |
|---|---|
| `Content-Security-Policy` | Restricción de fuentes de scripts, estilos e imágenes |
| `X-Frame-Options` | `DENY` — previene clickjacking |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Deshabilitar APIs no usadas |
| `Strict-Transport-Security` | HSTS en producción |

> Los valores exactos de CSP se definen en la tarea de Caddy (fase 0.2 / 3.6).

---

## Logs

- Los logs de la aplicación **no incluyen datos sensibles**: sin contraseñas, sin tokens, sin IPs completas, sin hashes de visitante.
- Los errores de autenticación se loguean con el nivel de error pero sin la contraseña intentada.
- Los logs de acceso de Caddy pueden contener IPs; es responsabilidad del operador su manejo.

---

## Tokens JWT

- **Access token:** vida de 15 minutos. El cliente lo guarda en memoria (variable JS), nunca en `localStorage` ni `sessionStorage`.
- **Refresh token:** vida de 7 días. Cookie `httpOnly`, `SameSite=Lax`, `Secure` según `COOKIE_SECURE`. Se rota en cada uso (el token anterior queda invalidado). Almacenado en lista de tokens válidos en Redis.

---

## 2FA (TOTP)

- Planificado para la **fase 7**.
- El campo `totp_secret` en `users` ya está en el modelo de datos para esta fase.
- Hasta la fase 7, el campo es nullable y el 2FA no está activo.

---

## Decisiones

- **Refresh tokens (1.1):** lista blanca en Redis (`auth:refresh:{jti}`, TTL 7 días). Rotar o
  cerrar sesión borra la entrada; cambiar la contraseña revoca todas las sesiones.
- **Rate limiting (6.3):** login 5/min, eventos 60/min y endpoints públicos 300/min por IP
  (configurables). Si Redis falla, no se bloquea el tráfico.
- **Media (2.5):** máximo 10 MB (`MEDIA_MAX_BYTES`). Tipos por magic bytes: PNG, JPEG, GIF, WebP,
  AVIF y PDF. **SVG rechazado** (puede contener scripts). Nombre `AAAA/MM/<uuid>.<ext>`.
- **Lista de bots (5.1):** mantenida a mano, sin dependencias externas.
- **CSP (3.6):** `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'
  'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self';
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`.
  `'unsafe-inline'` es necesario para el script de tema sin parpadeo y los estilos de Shiki. Hoy
  la aplica Next.js; en la fase 8 se moverá a Caddy junto con HSTS.
- **Contraseña del admin:** mínimo 12 caracteres; la CLI nunca la acepta como argumento.

## Preguntas abiertas

- **CSP con nonces:** quitar `'unsafe-inline'` de `script-src` con nonces de Next.js (requiere
  renderizado dinámico). Evaluar en la fase 8.
