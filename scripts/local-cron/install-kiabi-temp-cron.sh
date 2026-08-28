#!/usr/bin/env bash
# Cron temporal Kiabi (una hora:minuto). Para pruebas; desinstala después.
# Uso: bash scripts/local-cron/install-kiabi-temp-cron.sh 15:05
set -euo pipefail

SLOT="${1:-15:05}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUN_SH="$REPO_ROOT/scripts/local-cron/run.sh"
AGENTS_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/Library/Logs/cazaofertas"
DOMAIN="gui/$(id -u)"
LABEL="com.cazaofertas.cron.kiabi-deals-test"
JOB="kiabi-deals"
hour="${SLOT%%:*}"
minute="${SLOT##*:}"

mkdir -p "$AGENTS_DIR" "$LOG_DIR"
[[ -x "$RUN_SH" ]] || chmod +x "$RUN_SH"

plist_path="$AGENTS_DIR/${LABEL}.plist"

cat >"$plist_path" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${RUN_SH}</string>
    <string>${JOB}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${REPO_ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CAZAOFERTAS_CRON_LOG_DIR</key>
    <string>${LOG_DIR}</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/${JOB}-test-launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/${JOB}-test-launchd.err.log</string>
  <key>RunAtLoad</key>
  <false/>
  <key>StartCalendarInterval</key>
  <array>
    <dict>
      <key>Hour</key>
      <integer>${hour}</integer>
      <key>Minute</key>
      <integer>${minute}</integer>
    </dict>
  </array>
</dict>
</plist>
EOF

if launchctl print "$DOMAIN/$LABEL" &>/dev/null; then
  launchctl bootout "$DOMAIN" "$plist_path" 2>/dev/null || true
fi
launchctl bootstrap "$DOMAIN" "$plist_path"
launchctl enable "$DOMAIN/$LABEL" 2>/dev/null || true

echo "Cron temporal Kiabi instalado: hoy y cada día a las ${hour}:$(printf '%02d' "$minute") (hora Mac)"
echo "  Plist: $plist_path"
echo "  Log:   $LOG_DIR/${JOB}.log"
echo
echo "Quitar después de la prueba:"
echo "  bash \"$REPO_ROOT/scripts/local-cron/uninstall-kiabi-temp-cron.sh\""
