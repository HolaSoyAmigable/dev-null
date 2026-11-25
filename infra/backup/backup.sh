#!/usr/bin/env bash
# backup.sh — Copia de seguridad de PostgreSQL (pg_dump, formato custom) y del volumen de media.
# Uso:   ./infra/backup/backup.sh
# Vars:  BACKUP_DIR (por defecto ./backups), BACKUP_KEEP (copias a conservar, por defecto 14),
#        MEDIA_VOLUME (por defecto devnull_media_data), BACKUP_MEDIA_DIR (carpeta local si no hay volumen; por defecto backend/media).
set -euo pipefail
export MSYS_NO_PATHCONV=1  # Git Bash en Windows: no reescribir rutas de los contenedores.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"
LOCAL_MEDIA="${BACKUP_MEDIA_DIR:-$REPO_ROOT/backend/media}"
set -a; source .env; set +a

COMPOSE=(docker compose -f infra/docker-compose.yml --env-file .env)
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
MEDIA_VOLUME="${MEDIA_VOLUME:-devnull_media_data}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="$BACKUP_DIR/$STAMP"
mkdir -p "$TARGET"

echo "▶  Volcando PostgreSQL ($POSTGRES_DB)..."
"${COMPOSE[@]}" exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner \
  > "$TARGET/db.dump"

echo "▶  Empaquetando media..."
if docker volume inspect "$MEDIA_VOLUME" >/dev/null 2>&1; then
  docker run --rm -v "$MEDIA_VOLUME:/media:ro" alpine:3 tar czf - -C /media . > "$TARGET/media.tar.gz"
elif [ -d "$LOCAL_MEDIA" ]; then
  tar czf "$TARGET/media.tar.gz" -C "$LOCAL_MEDIA" .
else
  echo "   (sin media que respaldar)"
  tar czf "$TARGET/media.tar.gz" --files-from /dev/null
fi

( cd "$TARGET" && sha256sum db.dump media.tar.gz > SHA256SUMS )
echo "✓  Backup en $TARGET"
du -h "$TARGET"/* | sed 's/^/   /'

# Retención: conserva las BACKUP_KEEP copias más recientes.
mapfile -t OLD < <(ls -1d "$BACKUP_DIR"/*/ 2>/dev/null | sort | head -n -"$BACKUP_KEEP")
for dir in "${OLD[@]}"; do rm -rf "$dir"; echo "   eliminado backup antiguo: $(basename "$dir")"; done
