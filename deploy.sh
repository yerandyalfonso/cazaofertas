#!/bin/bash
# Despliega la rama actual del VPS: git pull + build + restart de los servicios.
# Uso: ./deploy.sh          -> despliega ambas apps
#      ./deploy.sh caza     -> solo CazaOfertas
#      ./deploy.sh chollos  -> solo Chollos de Hoy
set -euo pipefail
TARGET="${1:-all}"

echo "== comprobando que subiste tus cambios =="
git fetch origin main --quiet
LOCAL=$(git rev-parse main)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" != "$REMOTE" ]; then
  echo "ABORTADO: tu 'main' local ($LOCAL) no coincide con origin/main ($REMOTE)."
  echo "Probablemente te falta 'git push'. El VPS solo puede desplegar lo que ya está en GitHub."
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "AVISO: tienes cambios sin commitear en tu checkout local (no se van a desplegar):"
  git status --short
fi

echo "== git pull en el VPS =="
ssh vps "cd /opt/cazaofertas/app && git pull --ff-only"

echo "== install + build =="
ssh vps 'export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; cd /opt/cazaofertas/app && npm ci'

healthcheck() {
  local name="$1" port="$2"
  sleep 2
  local code
  code=$(ssh vps "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$port/")
  if [ "$code" = "200" ]; then
    echo "  $name (puerto $port): OK (HTTP $code)"
  else
    echo "  $name (puerto $port): !! RESPUESTA INESPERADA (HTTP $code) — revisa 'journalctl -u $name'"
  fi
}

case "$TARGET" in
  caza)
    ssh vps 'export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; cd /opt/cazaofertas/app && npm run build'
    ssh vps "sudo systemctl restart cazaofertas"
    healthcheck cazaofertas 3000
    ;;
  chollos)
    ssh vps 'export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; cd /opt/cazaofertas/app && npm run build:chollos'
    ssh vps "sudo systemctl restart chollosdehoy"
    healthcheck chollosdehoy 3001
    ;;
  all)
    ssh vps 'export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; cd /opt/cazaofertas/app && npm run build:all'
    ssh vps "sudo systemctl restart cazaofertas chollosdehoy"
    healthcheck cazaofertas 3000
    healthcheck chollosdehoy 3001
    ;;
  *)
    echo "Uso: ./deploy.sh [all|caza|chollos]"
    exit 1
    ;;
esac

echo "== estado systemd =="
ssh vps "sudo systemctl is-active cazaofertas chollosdehoy"
echo "Deploy terminado — revisa el healthcheck de arriba antes de dar por bueno el deploy."
