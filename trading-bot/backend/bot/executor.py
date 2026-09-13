"""
executor.py
===========
Ejecuta en el exchange lo que el motor de riesgo ya ha aprobado, y lo registra
todo en la base de datos.

Aquí viven también las **salidas automáticas** deterministas (take-profit,
stop-loss, trailing stop y cierre por tiempo). No dependen del LLM: se
comprueban en cada ciclo y son la red de seguridad principal de cada posición.
"""
from __future__ import annotations

from datetime import datetime, timezone

from . import state
from .exchange import Exchange, ExchangeError, OrderUnconfirmed


def _parse_ts(value: str) -> datetime:
    dt = datetime.fromisoformat(value)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def quote_fee(fill: dict, quote_coin: str) -> float:
    """
    Comisión del fill expresada en la moneda de cotización.

    Bybit spot cobra la comisión de COMPRA en el activo base y la de VENTA en
    el de cotización. Si viene en el activo base devolvemos 0: su efecto ya
    está en haber recibido menos moneda, y restarla otra vez sería contarla
    dos veces (y en unidades distintas, que es peor).
    """
    fee = float(fill.get("fee") or 0.0)
    currency = (fill.get("fee_currency") or "").upper()
    if not fee:
        return 0.0
    if currency and currency != quote_coin.upper():
        return 0.0
    return fee


def _warn_orphan(e: OrderUnconfirmed) -> None:
    """Aviso muy visible: puede haber quedado una orden viva en el exchange."""
    state.add_log(
        "error",
        f"ORDEN SIN CONFIRMAR ({e.side} {e.symbol}, id {e.order_id}). "
        f"PUEDE HABERSE EJECUTADO EN BYBIT SIN QUE EL BOT LA REGISTRE. "
        f"Revísala a mano en Bybit y, si existe, ciérrala o anótala. {e}",
    )


def open_position(ex: Exchange, symbol: str, quote_usdt: float,
                  decision_id: int | None) -> dict | None:
    """Compra a mercado y registra la posición. None si la orden falla."""
    try:
        inst = ex.get_instrument(symbol)
        fill = ex.market_buy(symbol, quote_usdt)
    except OrderUnconfirmed as e:
        _warn_orphan(e)
        return None
    except ExchangeError as e:
        state.add_log("error", f"Fallo al COMPRAR {symbol}: {e}")
        return None

    pos_id = state.add_position(
        symbol=symbol,
        side="Buy",
        qty=fill["exec_qty"],
        entry_price=fill["avg_price"],
        entry_usdt=fill["exec_value"],
        order_id=fill["order_id"],
        decision_id=decision_id,
        entry_fee=quote_fee(fill, inst["quote_coin"]),
        fee_currency=fill.get("fee_currency"),
    )
    state.add_log(
        "trade",
        f"ABIERTA #{pos_id} {symbol}: {fill['exec_qty']} @ {fill['avg_price']:.6f} "
        f"({fill['exec_value']:.2f} USDT)",
    )
    return {"position_id": pos_id, **fill}


def close_position(ex: Exchange, pos: dict, reason: str) -> dict | None:
    """
    Vende a mercado toda la posición y la cierra en la BD.

    Primero RESERVA la posición: las salidas automáticas, el cierre manual
    desde el panel y una decisión CLOSE del LLM pueden coincidir en el tiempo,
    y sin reserva se mandarían dos ventas a mercado de lo mismo.
    """
    pos_id = pos["id"]
    claimed = state.claim_position_for_close(pos_id)
    if claimed is None:
        return None      # ya cerrada, o alguien la está vendiendo ahora mismo
    pos = claimed
    symbol = pos["symbol"]

    try:
        inst = ex.get_instrument(symbol)
        # Vende lo que REALMENTE hay en cartera: la comisión de compra puede
        # haberse cobrado en el activo base y dejar menos de lo comprado.
        wallet_base = ex.get_base_balance(inst["base_coin"])
    except ExchangeError as e:
        state.add_log("warn", f"No se pudo leer el saldo de {symbol}: {e}")
        inst = {"quote_coin": "USDT"}
        wallet_base = 0.0

    qty_to_sell = min(pos["qty"], wallet_base) if wallet_base > 0 else pos["qty"]

    try:
        fill = ex.market_sell(symbol, qty_to_sell)
    except OrderUnconfirmed as e:
        # No liberamos la reserva: la posición podría estar ya vendida y
        # reintentar sería vender dos veces. Que lo mire una persona.
        _warn_orphan(e)
        return None
    except ExchangeError as e:
        state.release_position(pos_id)
        state.add_log("error", f"Fallo al VENDER {symbol} (posición #{pos_id}): {e}")
        return None

    closed = state.close_position(
        pos_id,
        close_price=fill["avg_price"],
        close_reason=reason,
        exit_fee=quote_fee(fill, inst.get("quote_coin", "USDT")),
        close_order_id=fill.get("order_id"),
        qty_sold=fill["exec_qty"],
    )
    if closed is None:
        state.add_log("warn", f"La posición #{pos_id} ya estaba cerrada al vender")
        return None

    state.add_log(
        "trade",
        f"CERRADA #{pos_id} {symbol} @ {fill['avg_price']:.6f} | motivo={reason} | "
        f"PnL={closed['pnl_usdt']:+.2f} USDT ({closed['pnl_pct']:+.2f}%)",
    )
    return closed


def exit_reason_for(pos: dict, price: float, settings: dict,
                    now: datetime | None = None) -> str | None:
    """
    Decide si una posición debe cerrarse ya, y por qué.

    Orden de prioridad: stop-loss > trailing stop > take-profit > tiempo.
    (Primero lo que protege capital.)
    """
    pnl_pct = (price / pos["entry_price"] - 1.0) * 100.0

    if pnl_pct <= -abs(settings["stop_loss_pct"]):
        return "stop_loss"

    trailing = settings.get("trailing_stop_pct") or 0.0
    peak = pos.get("peak_price") or pos["entry_price"]
    if trailing > 0 and peak > pos["entry_price"]:
        drop_from_peak = (price / peak - 1.0) * 100.0
        if drop_from_peak <= -abs(trailing):
            return "trailing_stop"

    if pnl_pct >= abs(settings["take_profit_pct"]):
        return "take_profit"

    now = now or datetime.now(timezone.utc)
    held_min = (now - _parse_ts(pos["opened_at"])).total_seconds() / 60.0
    if held_min >= settings["max_hold_minutes"]:
        return "timeout"

    return None


def check_automatic_exits(ex: Exchange, settings: dict) -> list[dict]:
    """
    Recorre las posiciones abiertas y cierra las que toquen TP/SL/trailing/tiempo.
    Se ejecuta SIEMPRE, en cada ciclo, haya o no llamada al LLM.
    """
    closed: list[dict] = []
    for pos in state.get_open_positions():
        try:
            price = ex.get_ticker(pos["symbol"])["last"]
        except ExchangeError as e:
            state.add_log("warn", f"Sin precio para {pos['symbol']}: {e}")
            continue

        # Marca de agua para el trailing stop.
        if price > (pos.get("peak_price") or 0):
            state.update_peak_price(pos["id"], price)
            pos["peak_price"] = price

        reason = exit_reason_for(pos, price, settings)
        if reason:
            result = close_position(ex, pos, reason)
            if result:
                closed.append(result)
    return closed
