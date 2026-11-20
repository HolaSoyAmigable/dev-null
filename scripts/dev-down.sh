#!/usr/bin/env bash
# dev-down.sh — Detiene los servicios de desarrollo (conserva los volúmenes de datos)
# Para eliminar también los volúmenes: dev-down.sh --volumes
set -euo pipefail

# Ir a la raíz del repositorio independientemente de desde dónde se ejecute el script
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "▶  Deteniendo servicios..."
docker compose -f infra/docker-compose.yml --env-file .env down "$@"

echo "✓  Servicios detenidos."
