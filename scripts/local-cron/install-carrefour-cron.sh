#!/usr/bin/env bash
# Instala el LaunchAgent de carrefour-deals (cada 2 h). Solo Mac: necesita
# Google Chrome con ventana (Cloudflare bloquea headless).
#   bash scripts/local-cron/install-carrefour-cron.sh              # sin avisos Telegram
#   CARREFOUR_CRON_NOTIFY=1 bash scripts/local-cron/install-carrefour-cron.sh
# Desinstalar:
#   launchctl bootout gui/$(id -u)/com.cazaofertas.cron.carrefour-deals
#   rm ~/Library/LaunchAgents/com.cazaofertas.cron.carrefour-deals.plist
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUN_SH="$REPO_ROOT/scripts/local-cron/run-carrefour.sh"
LABEL="com.cazaofertas.cron.carrefour-deals"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$HOME/Library/Logs/cazaofertas"
DOMAIN="gui/$(id -u)"
INTERVAL="${CARREFOUR_CRON_INTERVAL:-7200}"

chmod +x "$RUN_SH"
mkdir -p "$(dirname "$PLIST")" "$LOG_DIR"

EXTRA_ARG=""
if [[ "${CARREFOUR_CRON_NOTIFY:-0}" != "1" ]]; then
  EXTRA_ARG="    <string>--no-notify</string>"
fi

cat >"$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${RUN_SH}</string>
${EXTRA_ARG}
  </array>
  <key>WorkingDirectory</key>
  <string>${REPO_ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CAZAOFERTAS_CRON_LOG_DIR</key>
    <string>${LOG_DIR}</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/carrefour-deals-launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/carrefour-deals-launchd.err.log</string>
  <key>RunAtLoad</key>
  <false/>
  <key>StartInterval</key>
  <integer>${INTERVAL}</integer>
</dict>
</plist>
PLIST

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"
echo "Instalado $LABEL (cada ${INTERVAL}s) → $PLIST"
echo "Log: $LOG_DIR/carrefour-deals.log"
