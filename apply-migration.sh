#!/bin/bash
# Aplica un archivo de supabase/migrations/ a la base de datos del VPS.
# Lleva registro en public._migrations_applied para no aplicar dos veces la misma.
# Uso: ./apply-migration.sh supabase/migrations/0036_lo_que_sea.sql
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Uso: ./apply-migration.sh supabase/migrations/00XX_nombre.sql"
  exit 1
fi

FILE="$1"
if [ ! -f "$FILE" ]; then
  echo "No existe: $FILE"
  exit 1
fi

NAME=$(basename "$FILE")

ssh vps "docker exec supabase-db psql -U postgres -d postgres -c \"create table if not exists public._migrations_applied (name text primary key, applied_at timestamptz not null default now());\"" > /dev/null

ALREADY=$(ssh vps "docker exec supabase-db psql -U postgres -d postgres -tAc \"select 1 from public._migrations_applied where name = '$NAME';\"")
if [ "$ALREADY" = "1" ]; then
  echo "Ya aplicada antes: $NAME (ver public._migrations_applied). Nada que hacer."
  exit 0
fi

echo "== Copiando $NAME al VPS =="
scp "$FILE" "vps:/tmp/$NAME"

echo "== Aplicando contra Postgres (dentro del contenedor supabase-db) =="
ssh vps "docker cp /tmp/$NAME supabase-db:/tmp/$NAME && docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/$NAME"

ssh vps "docker exec supabase-db psql -U postgres -d postgres -c \"insert into public._migrations_applied (name) values ('$NAME');\"" > /dev/null

ssh vps "rm -f /tmp/$NAME && docker exec supabase-db rm -f /tmp/$NAME"
echo "Migración $NAME aplicada y registrada. No olvides hacer commit del archivo en supabase/migrations/."
