#!/bin/bash
# Despliega la rama actual del VPS: git pull + build + restart de los servicios.
# Uso: ./deploy.sh          -> despliega ambas apps
#      ./deploy.sh caza     -> solo CazaOfertas
#      ./deploy.sh chollos  -> solo Chollos de Hoy
set -euo pipefail
TARGET="${1:-all}"

echo "== git pull en el VPS =="
ssh vps "cd /opt/cazaofertas/app && git pull --ff-only"

echo "== install + build =="
ssh vps 'export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; cd /opt/cazaofertas/app && npm ci'

case "$TARGET" in
  caza)
    ssh vps 'export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; cd /opt/cazaofertas/app && npm run build'
    ssh vps "sudo systemctl restart cazaofertas"
    ;;
  chollos)
    ssh vps 'export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; cd /opt/cazaofertas/app && npm run build:chollos'
    ssh vps "sudo systemctl restart chollosdehoy"
    ;;
  all)
    ssh vps 'export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; cd /opt/cazaofertas/app && npm run build:all'
    ssh vps "sudo systemctl restart cazaofertas chollosdehoy"
    ;;
  *)
    echo "Uso: ./deploy.sh [all|caza|chollos]"
    exit 1
    ;;
esac

echo "== estado =="
ssh vps "sudo systemctl is-active cazaofertas chollosdehoy"
echo "Deploy OK."
