#!/usr/bin/env bash
# generate-types.sh — Genera los tipos TypeScript desde el OpenAPI de cada API de FastAPI.
# Cada API publica su propio contrato; es la única fuente de verdad: nunca se escriben tipos de la API a mano.
#   API de administración (backend/openapi.admin.json)  → admin/src/api/schema.d.ts
#   API pública           (backend/openapi.public.json) → web/src/lib/api/schema.d.ts
# Uso: bash scripts/generate-types.sh   (o: corepack pnpm generate-types)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# módulo_de_la_app | spec | destino de tipos
TARGETS=(
  "app.apps.admin|backend/openapi.admin.json|admin/src/api/schema.d.ts"
  "app.apps.public|backend/openapi.public.json|web/src/lib/api/schema.d.ts"
)

for target in "${TARGETS[@]}"; do
  IFS='|' read -r module spec types <<< "$target"

  echo "▶  Exportando OpenAPI de $module → $spec"
  # Se escribe el archivo en UTF-8 explícito (la redirección de stdout usa la codificación de
  # Windows y generaba bytes inválidos que difieren de los generados en Linux/CI).
  (
    cd backend
    uv run python -c "import importlib, json, sys; app = importlib.import_module(sys.argv[1]).app; f = open(sys.argv[2], 'w', encoding='utf-8', newline='\n'); json.dump(app.openapi(), f, ensure_ascii=False, indent=2); f.close()" \
      "$module" "$(basename "$spec")"
  )

  echo "▶  Generando $types"
  mkdir -p "$(dirname "$types")"
  corepack pnpm exec openapi-typescript "$spec" -o "$types" --alphabetize
done

echo "✓  Tipos generados."
