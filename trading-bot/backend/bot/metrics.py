"""
metrics.py
==========
Recoge y estructura TODAS las métricas que verá el LLM.

Fuentes (todas gratuitas):
  - API pública de Bybit (ticker + velas) -> precio e indicadores técnicos
  - alternative.me Fear & Greed Index      -> sentimiento del mercado cripto

El resultado es un diccionario ordenado y compacto: el modelo recibe datos ya
digeridos, nunca series en crudo. Menos tokens, mejores decisiones.
"""
from __future__ import annotations

import time

import httpx

from . import indicators, state
from .exchange import Exchange, ExchangeError

_FNG_URL = "https://api.alternative.me/fng/?limit=1"
_FNG_TTL_SEC = 600
_fng_cache: dict = {"ts": 0.0, "value": None}


def get_fear_greed() -> dict | None:
    """Índice de miedo/codicia cripto (0-100). Cacheado 10 minutos."""
    if _fng_cache["value"] is not None and time.time() - _fng_cache["ts"] < _FNG_TTL_SEC:
        return _fng_cache["value"]
    try:
        r = httpx.get(_FNG_URL, timeout=10)
        r.raise_for_status()
        d = r.json()["data"][0]
        val = {"value": int(d["value"]), "label": d["value_classification"]}
        _fng_cache.update(ts=time.time(), value=val)
        return val
    except Exception as e:  # noqa: BLE001 - el sentimiento es opcional
        state.add_log("warn", f"No se pudo obtener Fear & Greed: {e}")
        return _fng_cache["value"]


def build_symbol_metrics(ex: Exchange, symbol: str, settings: dict) -> dict:
    """Métricas completas de un símbolo: ticker + indicadores técnicos."""
    ticker = ex.get_ticker(symbol)
    klines = ex.get_klines(symbol, settings["kline_interval"], settings["kline_limit"])
    return {
        "symbol": symbol,
        "ticker": ticker,
        "indicators": indicators.compute(klines, settings),
    }


def build_decision_context(ex: Exchange, symbols: list[str], settings: dict,
                           trigger: str, focus_symbol: str | None = None) -> dict:
    """
    Construye el paquete de contexto que se le entrega al LLM: cuenta,
    posiciones abiertas con su PnL flotante, contabilidad del día, sentimiento
    y métricas por símbolo.

    Un símbolo que falle no tumba el ciclo: se incluye con su error para que el
    modelo sepa que ahí no hay datos fiables.
    """
    quote = settings["quote_asset"]
    try:
        available = ex.get_available_quote(quote)
    except ExchangeError as e:
        state.add_log("warn", f"No se pudo leer el saldo: {e}")
        available = 0.0

    per_symbol: dict[str, dict] = {}
    for s in symbols:
        try:
            per_symbol[s] = build_symbol_metrics(ex, s, settings)
        except ExchangeError as e:
            state.add_log("warn", f"Sin métricas para {s}: {e}")
            per_symbol[s] = {"symbol": s, "error": str(e)}

    open_positions = state.get_open_positions()
    positions_view = []
    for p in open_positions:
        cur_price = (per_symbol.get(p["symbol"], {}).get("ticker") or {}).get("last")
        if cur_price is None:
            cur_price = p["entry_price"]
        float_pnl_pct = (cur_price / p["entry_price"] - 1.0) * 100.0
        held_min = None
        try:
            from .executor import _parse_ts  # import local: evita ciclo de imports
            held_min = round(
                (time.time() - _parse_ts(p["opened_at"]).timestamp()) / 60.0, 1
            )
        except Exception:  # noqa: BLE001 - dato accesorio
            pass
        positions_view.append({
            "id": p["id"],
            "symbol": p["symbol"],
            "entry_price": p["entry_price"],
            "current_price": cur_price,
            "entry_usdt": p["entry_usdt"],
            "qty": p["qty"],
            "unrealized_pnl_pct": round(float_pnl_pct, 3),
            "minutes_held": held_min,
            "opened_at": p["opened_at"],
        })

    daily = state.get_daily()
    return {
        "as_of_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "trigger": trigger,
        "focus_symbol": focus_symbol,
        "account": {
            "quote_asset": quote,
            "available_quote": round(available, 4),
            "open_positions_count": len(open_positions),
            "max_open_positions": settings["max_open_positions"],
            "free_position_slots": max(
                0, settings["max_open_positions"] - len(open_positions)
            ),
        },
        "day": {
            "trades_opened_today": daily.get("trades_opened", 0),
            "max_trades_per_day": settings["max_trades_per_day"],
            "informative_daily_target": settings["min_trades_target"],
            "realized_pnl_today_usdt": round(daily.get("realized_pnl") or 0.0, 4),
            "start_balance_today": daily.get("start_balance"),
        },
        "performance_all_time": state.get_performance(),
        "market_sentiment": {"fear_greed": get_fear_greed()},
        "risk_rules_reminder": {
            "take_profit_pct": settings["take_profit_pct"],
            "stop_loss_pct": settings["stop_loss_pct"],
            "trailing_stop_pct": settings["trailing_stop_pct"],
            "max_hold_minutes": settings["max_hold_minutes"],
            "min_confidence_open": settings["min_confidence_open"],
            "min_confidence_close": settings["min_confidence_close"],
            "note": "El take-profit, el stop-loss, el trailing y el cierre por "
                    "tiempo los ejecuta el código automáticamente. Tú decides "
                    "ENTRADAS y salidas ANTICIPADAS por lectura de mercado.",
        },
        "open_positions": positions_view,
        "symbols": [per_symbol[s] for s in symbols],
    }
