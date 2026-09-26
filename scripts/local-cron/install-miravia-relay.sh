#!/usr/bin/env bash
# Instala en el Mac el relé de Miravia (salida residencial de respaldo para el
# VPS) y su túnel inverso. Independiente de com.cazaofertas.vps-tunnel: si
# este falla, el túnel de la base de datos no se ve afectado.
#   com.cazaofertas.miravia-relay         node miravia-relay.mjs (127.0.0.1:8902)
#   com.cazaofertas.miravia-relay-tunnel  ssh -R 127.0.0.1:8901 → 8902 en el VPS
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
AGENTS="$HOME/Library/LaunchAgents"
LOGS="$HOME/Library/Logs/cazaofertas"
NODE_BIN="$(command -v node)"
mkdir -p "$AGENTS" "$LOGS"

cat >"$AGENTS/com.cazaofertas.miravia-relay.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.cazaofertas.miravia-relay</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$REPO_ROOT/scripts/local-cron/miravia-relay.mjs</string>
  </array>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOGS/miravia-relay.log</string>
  <key>StandardErrorPath</key>
  <string>$LOGS/miravia-relay.err.log</string>
</dict>
</plist>
EOF

cat >"$AGENTS/com.cazaofertas.miravia-relay-tunnel.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.cazaofertas.miravia-relay-tunnel</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/ssh</string>
    <string>-N</string>
    <string>-o</string>
    <string>ExitOnForwardFailure=yes</string>
    <string>-o</string>
    <string>ServerAliveInterval=30</string>
    <string>-o</string>
    <string>ServerAliveCountMax=3</string>
    <string>-R</string>
    <string>127.0.0.1:8901:127.0.0.1:8902</string>
    <string>vps</string>
  </array>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>StandardOutPath</key>
  <string>$LOGS/miravia-relay-tunnel.log</string>
  <key>StandardErrorPath</key>
  <string>$LOGS/miravia-relay-tunnel.err.log</string>
</dict>
</plist>
EOF

for label in com.cazaofertas.miravia-relay com.cazaofertas.miravia-relay-tunnel; do
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$AGENTS/$label.plist"
done
echo "Instalado. Comprobar en el VPS: curl -x http://127.0.0.1:8901 https://www.miravia.es/"
