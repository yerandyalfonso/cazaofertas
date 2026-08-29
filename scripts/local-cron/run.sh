#!/usr/bin/env bash
# Wrapper para launchd/cron: carga nvm y ejecuta el cron local.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# launchd no carga .env.local; tsx --env-file a veces no inyecta en subprocesos.
# Solo exportamos KEY=VALUE (ignora basura/comentarios para no tumbar el cron).
if [[ -f "$REPO_ROOT/.env.local" ]]; then
  set -a
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      # shellcheck disable=SC2163
      export "${line?}"
    fi
  done <"$REPO_ROOT/.env.local"
  set +a
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "$NVM_DIR/nvm.sh"
fi

JOB="${1:-check-prices}"
LOG_DIR="${CAZAOFERTAS_CRON_LOG_DIR:-$HOME/Library/Logs/cazaofertas}"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/${JOB}.log"

{
  echo "===== $(date -Iseconds) $JOB ====="
  npm run cron:local -- "$JOB"
  echo "===== done $(date -Iseconds) ====="
} >>"$LOG_FILE" 2>&1
