#!/usr/bin/env bash
# Deploy Chollos de Hoy desde la raíz del monorepo (Vercel root: apps/chollosdehoy).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
vercel link --project chollosdehoy --yes
vercel deploy --prod --yes
vercel link --project cazaofertas --yes