#!/usr/bin/env bash
# restore.sh — Restaura un backup creado con backup.sh.
# Uso:   ./infra/backup/restore.sh backups/<STAMP> [--yes]
# Vars:  RESTORE_DB (BD destino; por defecto POSTGRES_DB), MEDIA_VOLUME / BACKUP_MEDIA_DIR como en backup.sh,
#        SKIP_MEDIA=1 para restaurar solo la base de datos.
# ⚠  Sobrescribe los datos de la BD destino y la media. Detén api y worker antes de restaurar.
set -euo pipefail
export MSYS_NO_PATHCONV=1

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE="$(cd "${1:?Indica la carpeta del backup, p. ej. backups/20260101T000000Z}" && pwd)"
cd "$REPO_ROOT"
LOCAL_MEDIA="${BACKUP_MEDIA_DIR:-$REPO_ROOT/backend/media}"
set -a; source .env; set +a

COMPOSE=(docker compose -f infra/docker-compose.yml --env-file .env)
RESTORE_DB="${RESTORE_DB:-$POSTGRES_DB}"
MEDIA_VOLUME="${MEDIA_VOLUME:-devnull_media_data}"

echo "▶  Verificando checksums..."
( cd "$SOURCE" && sha256sum -c SHA256SUMS )

if [ "${2:-}" != "--yes" ]; then
  read -r -p "Se sobrescribirá la base de datos '$RESTORE_DB'. ¿Continuar? [s/N] " answer
  [[ "$answer" =~ ^[sS]$ ]] || { echo "Cancelado."; exit 1; }
fi

echo "▶  Restaurando PostgreSQL en '$RESTORE_DB'..."
"${COMPOSE[@]}" exec -T db psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -q \
  -c "SELECT 1 FROM pg_database WHERE datname = '$RESTORE_DB'" | grep -q 1 \
  || "${COMPOSE[@]}" exec -T db createdb -U "$POSTGRES_USER" "$RESTORE_DB"
"${COMPOSE[@]}" exec -T db pg_restore -U "$POSTGRES_USER" -d "$RESTORE_DB" \
  --clean --if-exists --no-owner --exit-on-error < "$SOURCE/db.dump"

if [ "${SKIP_MEDIA:-0}" != "1" ]; then
  echo "▶  Restaurando media..."
  if docker volume inspect "$MEDIA_VOLUME" >/dev/null 2>&1; then
    docker run --rm -i -v "$MEDIA_VOLUME:/media" alpine:3 \
      sh -c 'find /media -mindepth 1 -delete && tar xzf - -C /media' < "$SOURCE/media.tar.gz"
  else
    mkdir -p "$LOCAL_MEDIA"
    find "$LOCAL_MEDIA" -mindepth 1 -delete
    tar xzf "$SOURCE/media.tar.gz" -C "$LOCAL_MEDIA"
  fi
fi
echo "✓  Restauración completada desde $SOURCE"
