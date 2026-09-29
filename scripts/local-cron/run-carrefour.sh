#!/usr/bin/env bash
# Wrapper launchd para carrefour-deals (mismo arranque que run.sh).
# Los argumentos extra se pasan a run-carrefour.ts (p. ej. --no-notify).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

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

LOG_DIR="${CAZAOFERTAS_CRON_LOG_DIR:-$HOME/Library/Logs/cazaofertas}"
mkdir -p "$LOG_DIR"

{
  echo "===== $(date -Iseconds) carrefour-deals $* ====="
  npm run cron:local:carrefour -- "$@"
  echo "===== done $(date -Iseconds) ====="
} >>"$LOG_DIR/carrefour-deals.log" 2>&1
