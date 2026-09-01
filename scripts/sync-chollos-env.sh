#!/usr/bin/env bash
# Copia las variables Supabase del .env.local raíz al marketplace (chollosdehoy).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/.env.local"
TARGET="$ROOT/apps/chollosdehoy/.env.local"

if [[ ! -f "$SOURCE" ]]; then
  echo "No existe $SOURCE — crea .env.local en la raíz primero."
  exit 1
fi

read_var() {
  grep -E "^${1}=" "$SOURCE" | head -1 | cut -d= -f2- | sed 's/^"//;s/"$//'
}

URL="$(read_var NEXT_PUBLIC_SUPABASE_URL)"
ANON="$(read_var NEXT_PUBLIC_SUPABASE_ANON_KEY)"
SERVICE="$(read_var SUPABASE_SERVICE_ROLE_KEY)"

cat > "$TARGET" <<EOF
# Generado por scripts/sync-chollos-env.sh — no editar a mano salvo overrides locales.
NEXT_PUBLIC_SUPABASE_URL=${URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE}
NEXT_PUBLIC_SITE_URL=http://localhost:3001
NEXT_PUBLIC_SITE_NAME="Chollos de Hoy"
EOF

echo "✓ Escrito $TARGET"
