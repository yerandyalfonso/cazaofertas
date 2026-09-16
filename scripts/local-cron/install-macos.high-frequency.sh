#!/usr/bin/env bash
# Perfil ALTA FRECUENCIA (config anterior a la optimización de egress Supabase).
# Flash cada 3 min e incluye Miravia en la misma pasada.
#
# Uso:
#   npm run cron:local:install:high-freq
#   bash scripts/local-cron/install-macos.high-frequency.sh
#
# Para volver al perfil bajo egress:
#   npm run cron:local:install
#
# Ver: scripts/local-cron/schedules.md
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
  local extra_env="${5:-}"
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
EOF

    if [[ -n "$extra_env" ]]; then
      # extra_env: KEY=VALUE KEY2=VALUE2
      for pair in $extra_env; do
        key="${pair%%=*}"
        value="${pair#*=}"
        echo "    <key>${key}</key>"
        echo "    <string>${value}</string>"
      done
    fi

    cat <<EOF
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

remove_agent() {
  local label="$1"
  unload_if_loaded "$label"
  rm -f "$AGENTS_DIR/${label}.plist"
}

echo "CazaOfertas — instalando cron local (perfil ALTA FRECUENCIA / legacy)"
echo "Repo: $REPO_ROOT"
echo "Logs: $LOG_DIR"
echo "AVISO: sube el egress de Supabase (flash cada 3 min + Miravia en flash)."
echo

write_plist "com.cazaofertas.cron.check-prices" "check-prices" "" "*:0 *:10 *:20 *:30 *:40 *:50"
# Config anterior: flash cada 180 s e incluye Miravia en la misma pasada.
write_plist "com.cazaofertas.cron.flash-deals" "flash-deals" "180" "" \
  "CAZAOFERTAS_FLASH_INCLUDE_MIRAVIA=1"
write_plist "com.cazaofertas.cron.user-alerts" "user-alerts" "" "8:15 20:15"
write_plist "com.cazaofertas.cron.kiabi-deals" "kiabi-deals" "" "9:30 18:30"
write_plist "com.cazaofertas.cron.coupons-discover" "coupons-discover" "" "10:00 18:00"

# En este perfil Miravia va dentro de flash; quitar el agente separado.
remove_agent "com.cazaofertas.cron.miravia-deals"

echo
echo "Cargando LaunchAgents..."
load_agent "com.cazaofertas.cron.check-prices"
load_agent "com.cazaofertas.cron.flash-deals"
load_agent "com.cazaofertas.cron.user-alerts"
load_agent "com.cazaofertas.cron.kiabi-deals"
load_agent "com.cazaofertas.cron.coupons-discover"

echo
echo "Listo. Horarios (perfil alta frecuencia):"
echo "  • flash-deals:  cada 3 min · Amazon + Miravia en la misma pasada"
echo "  • check-prices: cada 10 min · precios + lote Telegram si toca"
echo "  • user-alerts:  08:15 y 20:15"
echo "  • kiabi-deals:  09:30 y 18:30"
echo "  • coupons:      10:00 y 18:00"
echo "  • miravia-deals: desactivado (va dentro de flash)"
echo
echo "Volver al perfil bajo egress:"
echo "  npm run cron:local:install"
echo
echo "Documentación: scripts/local-cron/schedules.md"
