#!/usr/bin/env bash
# Wrapper para launchd/cron: carga nvm y ejecuta el cron local.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

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
