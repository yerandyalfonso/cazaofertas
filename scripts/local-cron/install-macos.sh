#!/usr/bin/env bash
# Instala LaunchAgents de macOS para cron local (scrape desde tu Mac).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUN_SH="$REPO_ROOT/scripts/local-cron/run.sh"
AGENTS_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/Library/Logs/cazaofertas"
DOMAIN="gui/$(id -u)"

if [[ ! -x "$RUN_SH" ]]; then
  chmod +x "$RUN_SH"
fi

mkdir -p "$AGENTS_DIR" "$LOG_DIR"

write_plist() {
  local label="$1"
  local job="$2"
  local interval="${3:-}"
  local times="${4:-}"
  local plist_path="$AGENTS_DIR/${label}.plist"

  {
    cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${RUN_SH}</string>
    <string>${job}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${REPO_ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CAZAOFERTAS_CRON_LOG_DIR</key>
    <string>${LOG_DIR}</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/${job}-launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/${job}-launchd.err.log</string>
  <key>RunAtLoad</key>
  <false/>
EOF

    if [[ -n "$interval" ]]; then
      echo "  <key>StartInterval</key>"
      echo "  <integer>${interval}</integer>"
    fi

    if [[ -n "$times" ]]; then
      echo "  <key>StartCalendarInterval</key>"
      echo "  <array>"
      for slot in $times; do
        hour="${slot%%:*}"
        minute="${slot##*:}"
        echo "    <dict>"
        if [[ "$hour" != "*" ]]; then
          echo "      <key>Hour</key>"
          echo "      <integer>${hour}</integer>"
        fi
        echo "      <key>Minute</key>"
        echo "      <integer>${minute}</integer>"
        echo "    </dict>"
      done
      echo "  </array>"
    fi

    echo "</dict>"
    echo "</plist>"
  } >"$plist_path"

  echo "  → $plist_path"
}

unload_if_loaded() {
  local label="$1"
  if launchctl print "$DOMAIN/$label" &>/dev/null; then
    launchctl bootout "$DOMAIN" "$AGENTS_DIR/${label}.plist" 2>/dev/null || true
  fi
}

load_agent() {
  local label="$1"
  unload_if_loaded "$label"
  launchctl bootstrap "$DOMAIN" "$AGENTS_DIR/${label}.plist"
  launchctl enable "$DOMAIN/$label" 2>/dev/null || true
}

echo "CazaOfertas — instalando cron local"
echo "Repo: $REPO_ROOT"
echo "Logs: $LOG_DIR"
echo

write_plist "com.cazaofertas.cron.check-prices" "check-prices" "" "*:0 *:10 *:20 *:30 *:40 *:50"
write_plist "com.cazaofertas.cron.flash-deals" "flash-deals" "" "0:30 3:30 6:30 9:30 12:30 15:30 18:30 21:30"
write_plist "com.cazaofertas.cron.user-alerts" "user-alerts" "" "8:15 20:15"

echo
echo "Cargando LaunchAgents..."
load_agent "com.cazaofertas.cron.check-prices"
load_agent "com.cazaofertas.cron.flash-deals"
load_agent "com.cazaofertas.cron.user-alerts"

echo
echo "Listo. Horarios (hora local del Mac):"
echo "  • check-prices: 2 productos — :00, :10, :20, :30, :40, :50 (2,5 s entre ellos)"
echo "  • flash-deals:  3 productos — 00:30, 03:30, … cada 3 h (5 min entre ellos)"
echo "  • user-alerts:  08:15 y 20:15 (1 min entre alertas)"
echo
echo "Prueba manual:"
echo "  cd \"$REPO_ROOT\" && npm run cron:local:prices"
echo
echo "Ver logs:"
echo "  tail -f \"$LOG_DIR/check-prices.log\""
