#!/usr/bin/env bash
# dev-up.sh — Levanta los servicios de desarrollo (db y redis)
# El servicio api requiere --profile app y se activa en la tarea 0.3
set -euo pipefail

# Ir a la raíz del repositorio independientemente de desde dónde se ejecute el script
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "▶  Levantando db y redis..."
docker compose -f infra/docker-compose.yml --env-file .env up -d --wait db redis

echo "✓  Servicios disponibles:"
docker compose -f infra/docker-compose.yml --env-file .env ps
