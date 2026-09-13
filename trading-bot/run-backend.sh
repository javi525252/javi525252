#!/usr/bin/env bash
# run-backend.sh — arranca el bot + la API (Linux / macOS)
set -euo pipefail
cd "$(dirname "$0")/backend"

if [ ! -d .venv ]; then
  echo "Creando entorno virtual..."
  python3 -m venv .venv
  ./.venv/bin/python -m pip install --upgrade pip
  ./.venv/bin/pip install -r requirements.txt
fi

if [ ! -f .env ]; then
  echo "No existe backend/.env — cópialo de .env.example y rellénalo." >&2
  exit 1
fi

echo "Arrancando bot + API..."
exec ./.venv/bin/python main.py
