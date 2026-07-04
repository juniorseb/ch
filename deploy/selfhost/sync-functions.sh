#!/usr/bin/env bash
# Copie les Edge Functions Mamélodie (dont _shared) dans la stack Supabase
# self-hosted, à côté du routeur `main` existant.
#
# Usage :
#   SUPABASE_DOCKER=/chemin/vers/supabase/docker ./deploy/selfhost/sync-functions.sh
#   (puis : cd $SUPABASE_DOCKER && docker compose restart functions)
set -euo pipefail

# Racine du projet Mamélodie (2 niveaux au-dessus de ce script).
MAMELODIE="${MAMELODIE:-$(cd "$(dirname "$0")/../.." && pwd)}"
: "${SUPABASE_DOCKER:?Définis SUPABASE_DOCKER=/chemin/vers/supabase/docker}"

SRC="$MAMELODIE/supabase/functions"
DEST="$SUPABASE_DOCKER/volumes/functions"

[ -d "$SRC" ] || { echo "Introuvable : $SRC"; exit 1; }
mkdir -p "$DEST"

# Copie le CONTENU de functions/ (nos fonctions + _shared) sans supprimer le
# routeur `main` fourni par la stack.
cp -r "$SRC/." "$DEST/"

echo "✓ Fonctions copiées dans $DEST"
echo "  Relance : (cd \"$SUPABASE_DOCKER\" && docker compose restart functions)"
