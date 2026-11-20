# 00 — Visión del proyecto

## Propósito

**dev/null** es un blog personal con tres pilares:

1. **Carrera** — historial profesional, educación y certificaciones.
2. **Proyectos** — portafolio de proyectos con bitácora propia: cada post puede pertenecer a un proyecto específico, funcionando como su registro de desarrollo.
3. **Publicaciones** — artículos técnicos y reflexiones independientes.

El blog incluye un CMS propio (panel de administración), una API REST y métricas de visitas propias sin cookies ni banners de consentimiento.

---

## Identidad

| Campo | Valor |
|---|---|
| Nombre visible | `dev/null` |
| Tagline | "Aquí nada se descarta." |
| Identificador técnico | `devnull` |

> **Nota:** El nombre `dev/null` hace referencia al dispositivo especial de Unix que descarta todo lo que recibe. El tagline invierte irónicamente ese significado: aquí todo permanece.

---

## Diseño

### Estética
- **Tema:** terminal sobrio. Inspiración en la estética de línea de comandos, sin imitar una terminal falsa que interfiera con la lectura.
- **Tipografía:**
  - Logo y encabezados: **JetBrains Mono** (monoespaciada).
  - Cuerpo del texto: sans-serif legible (a definir en fase de diseño).
- **Color:** modo oscuro por defecto; modo claro como opción del usuario.
- **Acento:** barra del logo (`/`) en color de acento distintivo.

### Humor sutil
El humor es ligero y consistente con la identidad del nombre, sin ser intrusivo:

| Contexto | Mensaje |
|---|---|
| Página 404 | "Esta ruta fue redirigida a /dev/null." |
| Búsqueda sin resultados | "Sin resultados. Lo que buscas se fue a /dev/null." |
| Pie de página | `exit 0` |

---

## Metas

| Meta | Criterio |
|---|---|
| Accesibilidad | WCAG AA |
| Rendimiento | Lighthouse ≥ 95 (Performance, Accessibility, Best Practices, SEO) |
| SEO | Sólido: sitemap, RSS, Open Graph, canonical URLs |
| `<title>` | Siempre incluye el nombre del blog **y** el nombre personal del autor, para evitar confusión con la documentación de Linux sobre `/dev/null`. |

### Marcador de nombre personal
El nombre del autor aparece en seeds, settings y textos del sitio como `[TU NOMBRE]`.
Es editable desde el panel de administración (`site_settings`).

---

## Solo español

El sitio es completamente en español. No hay internacionalización (i18n).

---

## Preguntas abiertas

- **Tipografía sans-serif del cuerpo:** ¿Inter, Geist, o fuente del sistema? A definir en la fase 3.6 de diseño final.
- **Color de acento exacto:** a definir en la fase 3.6.
- **Favicon / logo:** ¿símbolo `/>` o variante tipográfica de `dev/null`? A definir en la fase 3.6.
