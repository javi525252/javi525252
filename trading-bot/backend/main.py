"""
main.py
=======
Punto de entrada: arranca la API, el WebSocket y el motor del bot con un solo
comando.

    python main.py

El motor se lanza como tarea de fondo desde el `lifespan` de la API, así que
esto es todo lo que hay que ejecutar.
"""
from __future__ import annotations

import sys

import uvicorn

from bot import config


def _preflight() -> None:
    """Avisos claros antes de arrancar, en vez de fallos raros luego."""
    problemas = []
    if not config.env.bybit_api_key or not config.env.bybit_api_secret:
        problemas.append(
            "Faltan BYBIT_API_KEY / BYBIT_API_SECRET en backend/.env "
            "(copia .env.example a .env y rellénalo)."
        )
    if not config.env.api_token:
        print("[WARN] API_TOKEN vacío: cualquiera con acceso al puerto podrá "
              "controlar el bot.", flush=True)
    if not config.env.bybit_testnet:
        print("[WARN] ¡MAINNET! Estás operando con DINERO REAL.", flush=True)

    if problemas:
        for p in problemas:
            print(f"[ERROR] {p}", flush=True)
        sys.exit(1)


def main() -> None:
    _preflight()
    print(f"API en http://{config.env.api_host}:{config.env.api_port}", flush=True)
    uvicorn.run(
        "api.server:app",
        host=config.env.api_host,
        port=config.env.api_port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
