"""
check_setup.py
==============
Comprobación previa: verifica que todo está en su sitio ANTES de dejar el bot
operando. No coloca ninguna orden.

    python check_setup.py

Comprueba, en este orden:
  1. Archivo .env y credenciales presentes.
  2. Conexión con Bybit y saldo de la cuenta (testnet o mainnet).
  3. Que los pares configurados existen en Bybit spot y sus mínimos de orden.
  4. Que Claude Code responde y devuelve una decisión válida.
"""
from __future__ import annotations

import json
import sys

from bot import config, decision, state

OK, FAIL, WARN = "  [OK]  ", " [FALLO]", " [AVISO]"


def _p(mark: str, text: str) -> None:
    print(f"{mark} {text}", flush=True)


def check_env() -> bool:
    print("\n1) Configuración (.env)")
    ok = True
    if not (config._BACKEND_DIR / ".env").exists():
        _p(FAIL, "No existe backend/.env. Copia .env.example a .env y rellénalo.")
        return False
    if not config.env.bybit_api_key or not config.env.bybit_api_secret:
        _p(FAIL, "Faltan BYBIT_API_KEY / BYBIT_API_SECRET.")
        ok = False
    else:
        _p(OK, f"Credenciales presentes (key ...{config.env.bybit_api_key[-4:]}).")
    if config.env.bybit_testnet:
        _p(OK, "Modo TESTNET (dinero ficticio).")
    else:
        _p(WARN, "Modo MAINNET: se operará con DINERO REAL.")
    if not config.env.api_token:
        _p(WARN, "API_TOKEN vacío: la API local quedará sin protección.")
    elif len(config.env.api_token) < 16:
        _p(WARN, "API_TOKEN muy corto. Usa una cadena larga y aleatoria.")
    else:
        _p(OK, "API_TOKEN configurado.")
    return ok


def check_bybit() -> bool:
    print("\n2) Conexión con Bybit")
    from bot.exchange import Exchange, ExchangeError
    try:
        ex = Exchange()
        balance = ex.get_available_quote(state.get_settings()["quote_asset"])
    except ExchangeError as e:
        _p(FAIL, f"No se pudo conectar: {e}")
        return False
    _p(OK, f"Conectado. Saldo disponible: {balance:.2f} "
           f"{state.get_settings()['quote_asset']}")
    if balance <= 0:
        _p(WARN, "Saldo 0: en testnet pide fondos con 'Request funds'.")

    print("\n3) Pares configurados")
    ok = True
    for symbol in state.get_settings()["symbols"]:
        try:
            inst = ex.get_instrument(symbol)
            ticker = ex.get_ticker(symbol)
        except ExchangeError as e:
            _p(FAIL, f"{symbol}: {e}")
            ok = False
            continue
        _p(OK, f"{symbol}: precio {ticker['last']}, mínimo por orden "
               f"{inst['min_order_amt']} {inst['quote_coin']}")
        if inst["min_order_amt"] > state.get_settings()["min_position_usdt"]:
            _p(WARN, f"{symbol}: 'min_position_usdt' está por debajo del mínimo "
                     f"de Bybit ({inst['min_order_amt']}). Súbelo o no se abrirá nada.")
    return ok


def check_claude() -> bool:
    print("\n4) Motor de decisión (Claude Code)")
    contexto = {
        "as_of_utc": "2026-01-01T00:00:00Z",
        "trigger": "check_setup",
        "account": {"quote_asset": "USDT", "available_quote": 0.0,
                    "open_positions_count": 0, "max_open_positions": 3,
                    "free_position_slots": 0},
        "open_positions": [],
        "symbols": [],
        "note": "Comprobación de instalación: no hay datos de mercado, "
                "responde HOLD.",
    }
    dec = decision.ask_decision(contexto)
    if dec["action"] == "HOLD" and dec["reasoning"].startswith("HOLD de seguridad"):
        _p(FAIL, f"Claude no respondió correctamente: {dec['reasoning']}")
        _p(WARN, "Prueba a mano:  claude -p \"responde solo: ok\" --output-format json")
        return False
    _p(OK, f"Claude responde. Decisión de prueba: {dec['action']} "
           f"(confianza {dec['confidence']:.2f})")
    _p(OK, f"Razonamiento: {dec['reasoning'][:120]}")
    return True


def main() -> int:
    print("=" * 62)
    print(" COMPROBACIÓN DEL BOT DE TRADING (no se coloca ninguna orden)")
    print("=" * 62)
    state.init_db()

    resultados = [check_env()]
    if resultados[0]:
        resultados.append(check_bybit())
    resultados.append(check_claude())

    print("\n" + "=" * 62)
    if all(resultados):
        print(" TODO LISTO. Puedes arrancar con:  python main.py")
        print("=" * 62)
        return 0
    print(" HAY PROBLEMAS. Revisa los [FALLO] de arriba antes de arrancar.")
    print("=" * 62)
    return 1


if __name__ == "__main__":
    sys.exit(main())
