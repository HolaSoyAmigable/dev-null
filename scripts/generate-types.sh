#!/usr/bin/env bash
# generate-types.sh — Genera los tipos TypeScript de admin/ y web/ desde el OpenAPI de FastAPI.
# El OpenAPI es la única fuente de verdad del contrato: nunca se escriben tipos de la API a mano.
# Uso: bash scripts/generate-types.sh   (o: corepack pnpm generate-types)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SPEC="backend/openapi.json"

echo "▶  Exportando OpenAPI desde FastAPI..."
(
  cd backend
  uv run python -c "import json, sys; from app.main import app; json.dump(app.openapi(), sys.stdout, ensure_ascii=False, indent=2)" > openapi.json
)

for target in admin/src/api/schema.d.ts web/src/lib/api/schema.d.ts; do
  mkdir -p "$(dirname "$target")"
  echo "▶  Generando $target"
  corepack pnpm exec openapi-typescript "$SPEC" -o "$target" --alphabetize
done

echo "✓  Tipos generados."
