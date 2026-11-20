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

## Preguntas abiertas

- **Lista de bots para rate limiting y métricas:** ¿se usa una biblioteca externa (ej. `user-agents`) o una lista mantenida manualmente? A decidir en tarea 5.1.
- **Invalidación de refresh tokens:** ¿lista blanca en Redis o lista negra? A definir en tarea 1.1.
- **Tamaño máximo de subida de media:** valor específico (ej. 10 MB, 50 MB). A definir en tarea 2.5.
- **CSP exacto:** los valores concretos dependen de las fuentes de fuentes (fonts), CDN de imágenes y scripts de terceros usados. A definir en tarea 3.6.
