#!/usr/bin/env bash
set -euo pipefail

AGENTS_DIR="$HOME/Library/LaunchAgents"
DOMAIN="gui/$(id -u)"
LABEL="com.cazaofertas.cron.kiabi-deals-test"
plist_path="$AGENTS_DIR/${LABEL}.plist"

if [[ -f "$plist_path" ]]; then
  launchctl bootout "$DOMAIN" "$plist_path" 2>/dev/null || true
  rm -f "$plist_path"
  echo "Cron temporal Kiabi eliminado."
else
  echo "No había cron temporal Kiabi instalado."
fi
