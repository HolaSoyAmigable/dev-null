# 06 — Convenciones

## Idioma

| Ámbito | Idioma |
|---|---|
| Documentación, textos visibles, comentarios explicativos | Español |
| Código, nombres de archivos, variables, funciones, commits | Inglés |

---

## Backend (Python)

### Herramientas
| Herramienta | Uso |
|---|---|
| `ruff` | Linting y formateo (sustituye a flake8 + black + isort) |
| `mypy` | Tipado estático estricto (`--strict`) |
| `pytest` | Tests unitarios e integración |
| Cobertura | ≥ 80 % en la capa de **services** |

### Convenciones de código
- Nombres en `snake_case` (variables, funciones, módulos, archivos).
- Clases en `PascalCase`.
- Tipos explícitos en todas las funciones (sin `Any` sin justificación).
- Schemas de Pydantic con nombres descriptivos: `PostCreate`, `PostRead`, `PostUpdate`, `PostListRead`.

### Tests
- Tests de integración usan **PostgreSQL real en contenedor** (no SQLite).
- Cada módulo tiene su carpeta de tests en `backend/tests/`.
- Tests de servicios son los que cuentan para la cobertura mínima.

### Migraciones Alembic
- Las migraciones **siempre se revisan manualmente** antes de aplicar en producción.
- No usar `--autogenerate` sin revisar el diff generado.
- Nombre de migración descriptivo: `add_search_vector_to_posts`, `create_career_entries`.

---

## Frontend (TypeScript)

### Herramientas
| Herramienta | Uso |
|---|---|
| `eslint` | Linting (con configuración TypeScript) |
| `tsc --noEmit` | Verificación de tipos sin compilar |
| `vitest` | Tests unitarios de componentes y hooks |
| `playwright` | Tests end-to-end (3 flujos críticos) |

### Convenciones de código
- Componentes en `PascalCase` (archivos y nombres de función/clase).
- Hooks custom con prefijo `use` (`useAuth`, `usePosts`).
- Tipos de API **nunca escritos a mano**: generados desde OpenAPI con `scripts/generate-types.sh`.
- `tailwind` para estilos; sin CSS-in-JS ni módulos CSS salvo casos excepcionales.

### Flujos críticos de Playwright (fase 6.4)
1. Login del administrador.
2. Crear y publicar un post.
3. Verificar que el post aparece en el blog público.

---

## Git

### Ramas
- Una rama por tarea: `task/0.1-scaffold`, `task/1.3-posts-crud`, etc.
- Se trabaja en la rama de la tarea y se fusiona (merge / PR) al terminar.

### Commits convencionales
```
feat:     nueva funcionalidad
fix:      corrección de bug
docs:     cambios en documentación
chore:    mantenimiento, configuración, scaffolding
refactor: refactorización sin cambio de comportamiento
test:     añadir o corregir tests
style:    formateo, sin cambios de lógica
```

### Regla de commits por tarea
- **Un commit por tarea** (o los mínimos necesarios si la tarea es muy grande).
- El mensaje del commit incluye el número de tarea cuando aplica: `feat(1.3): crud posts`.

---

## Prohibiciones

1. **No añadir dependencias** (npm, pip) sin mencionarlo explícitamente al usuario y recibir aprobación.
2. **No tocar módulos fuera del alcance** de la tarea activa (ej. no modificar `auth/` mientras se trabaja en `posts/`).
3. **No hardcodear** secretos, URLs de producción, credenciales ni valores de configuración.
4. **No usar la barra `/`** de `dev/null` en ningún identificador técnico (rutas, slugs, variables, imágenes Docker, claves).
5. **No inventar decisiones de arquitectura.** Si algo es ambiguo, anotarlo en "Preguntas abiertas" del documento correspondiente.
6. **No generar** archivos de despliegue, Docker ni CI hasta la fase indicada en el roadmap.
7. **No usar `Any`** en mypy sin comentario justificado.

---

## Comandos canónicos

```bash
# ── Entorno de desarrollo (disponibles desde tarea 0.2) ──────────────────────
dev-up:         ./scripts/dev-up.sh           # levanta db y redis
dev-down:       ./scripts/dev-down.sh         # detiene los servicios (conserva volúmenes)
dev-down-v:     ./scripts/dev-down.sh --volumes  # detiene y elimina volúmenes

# ── Backend ───────────────────────────────────────────────────────────────────
lint:           ruff check .                  # pendiente (tarea 0.3)
format:         ruff format .                 # pendiente (tarea 0.3)
types:          mypy .                        # pendiente (tarea 0.3)
tests:          pytest                        # pendiente (tarea 0.3)

# ── Frontend (admin y web) ────────────────────────────────────────────────────
lint-fe:        pnpm lint                     # pendiente (tarea 2.1 / 3.1)
types-fe:       pnpm tsc --noEmit             # pendiente (tarea 2.1 / 3.1)
tests-fe:       pnpm vitest                   # pendiente (tarea 2.1 / 3.1)
e2e:            pnpm playwright test          # pendiente (tarea 6.4)

# ── Generación de tipos ───────────────────────────────────────────────────────
generate-types: bash scripts/generate-types.sh  # pendiente (tarea 2.1)
```

### Scripts en Windows

Los scripts `.sh` se ejecutan desde **Git Bash** o **WSL**, no desde PowerShell/CMD:

```bash
./scripts/dev-up.sh
./scripts/dev-down.sh
```

Equivalente en PowerShell:

```powershell
docker compose -f infra/docker-compose.yml --env-file .env up -d db redis
docker compose -f infra/docker-compose.yml --env-file .env down
```

---

## Preguntas abiertas

- **Cobertura de tests en routers y repositorios:** el mínimo del 80 % aplica a la capa de services; ¿se requiere un mínimo diferente para las demás capas? A definir al configurar CI (tarea 0.5).
- **Configuración de eslint:** ¿`eslint-config-next` para web y `eslint` base para admin, o reglas compartidas en un paquete interno? A definir en tareas 2.1 y 3.1.
