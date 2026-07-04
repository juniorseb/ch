#!/usr/bin/env bash
# Backup Postgres de la stack Supabase self-hosted (pg_dumpall) + rotation.
# À planifier en cron, ex. tous les jours à 3h :
#   0 3 * * * /var/www/mamelodie/deploy/selfhost/backup.sh >> /var/log/mamelodie-backup.log 2>&1
#
# Pense à COPIER les dumps HORS du VPS (rsync/S3) pour une vraie sécurité.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/mamelodie}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"   # nom du conteneur Postgres de la stack

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/supabase-$STAMP.sql.gz"

docker exec -t "$DB_CONTAINER" pg_dumpall -U postgres | gzip > "$OUT"

# Rotation : supprime les backups plus vieux que RETENTION_DAYS.
find "$BACKUP_DIR" -name 'supabase-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

echo "✓ Backup : $OUT"
