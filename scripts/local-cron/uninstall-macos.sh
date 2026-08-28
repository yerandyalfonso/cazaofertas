#!/usr/bin/env bash
set -euo pipefail

AGENTS_DIR="$HOME/Library/LaunchAgents"
DOMAIN="gui/$(id -u)"

for label in \
  com.cazaofertas.cron.check-prices \
  com.cazaofertas.cron.flash-deals \
  com.cazaofertas.cron.user-alerts
do
  plist="$AGENTS_DIR/${label}.plist"
  if [[ -f "$plist" ]]; then
    launchctl bootout "$DOMAIN" "$plist" 2>/dev/null || true
    rm -f "$plist"
    echo "Eliminado: $label"
  fi
done

echo "Cron local desinstalado."
