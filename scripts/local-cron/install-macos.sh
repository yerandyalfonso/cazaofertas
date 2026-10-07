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
# Flash Amazon: cada 10 min (antes 3 min; reduce egress Supabase).
write_plist "com.cazaofertas.cron.flash-deals" "flash-deals" "600" ""
# Miravia aparte: cada 30 min (ya no va dentro de flash).
write_plist "com.cazaofertas.cron.miravia-deals" "miravia-deals" "1800" ""
write_plist "com.cazaofertas.cron.user-alerts" "user-alerts" "" "8:15 20:15"
write_plist "com.cazaofertas.cron.kiabi-deals" "kiabi-deals" "" "9:30 18:30"
write_plist "com.cazaofertas.cron.coupons-discover" "coupons-discover" "" "10:00 18:00"
# MediaMarkt: solo desde el Mac (a la IP del VPS le da 403).
write_plist "com.cazaofertas.cron.mediamarkt-deals" "mediamarkt-deals" "" "8:15 12:15 16:15 20:15"
# PcComponentes: Google Chrome con ventana (Cloudflare), solo Mac.
write_plist "com.cazaofertas.cron.pccomponentes-deals" "pccomponentes-deals" "" "9:45 17:45"

echo
echo "Cargando LaunchAgents..."
load_agent "com.cazaofertas.cron.check-prices"
load_agent "com.cazaofertas.cron.flash-deals"
load_agent "com.cazaofertas.cron.miravia-deals"
load_agent "com.cazaofertas.cron.user-alerts"
load_agent "com.cazaofertas.cron.kiabi-deals"
load_agent "com.cazaofertas.cron.coupons-discover"
load_agent "com.cazaofertas.cron.mediamarkt-deals"
load_agent "com.cazaofertas.cron.pccomponentes-deals"

echo
echo "Listo. Horarios (hora local del Mac):"
echo "  • flash-deals:   cada 10 min · Amazon discovery (encola Telegram)"
echo "  • miravia-deals: cada 30 min · Miravia discovery"
echo "  • check-prices:  cada 10 min · precios + lote Telegram si toca"
echo "  • user-alerts:   08:15 y 20:15 (40 alertas, 40 s entre cada una)"
echo "  • kiabi-deals:   09:30 y 18:30 (requiere KIABI_DEALS_ENABLED=1)"
echo "  • coupons:       10:00 y 18:00"
echo "  • mediamarkt:    08:15, 12:15, 16:15 y 20:15"
echo "  • pccomponentes: 09:45 y 17:45 (abre Chrome minimizado)"
echo "  • telegram:      lote al grupo según intervalo admin (default 4 h)"
echo
echo "Prueba manual:"
echo "  cd \"$REPO_ROOT\" && npm run cron:local:flash"
echo "  cd \"$REPO_ROOT\" && npm run cron:local:miravia"
echo "  cd \"$REPO_ROOT\" && npm run cron:local:prices"
echo "  cd \"$REPO_ROOT\" && npm run coupons:discover"
echo
echo "Ver logs:"
echo "  tail -f \"$LOG_DIR/flash-deals.log\""
echo "  tail -f \"$LOG_DIR/miravia-deals.log\""
echo "  tail -f \"$LOG_DIR/check-prices.log\""
echo "  tail -f \"$LOG_DIR/coupons-discover.log\""
echo
echo "IMPORTANTE: reinstala con este script para aplicar intervalos nuevos."
echo "Perfil alta frecuencia (legacy): npm run cron:local:install:high-freq"
echo "Ver: scripts/local-cron/schedules.md"