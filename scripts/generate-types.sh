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
  # Se escribe el archivo en UTF-8 explícito (la redirección de stdout usa la codificación de
  # Windows y generaba bytes inválidos que difieren de los generados en Linux/CI).
  uv run python -c "import json; from app.main import app; f = open('openapi.json', 'w', encoding='utf-8', newline='\n'); json.dump(app.openapi(), f, ensure_ascii=False, indent=2); f.close()"
)

for target in admin/src/api/schema.d.ts web/src/lib/api/schema.d.ts; do
  mkdir -p "$(dirname "$target")"
  echo "▶  Generando $target"
  corepack pnpm exec openapi-typescript "$SPEC" -o "$target" --alphabetize
done

echo "✓  Tipos generados."
