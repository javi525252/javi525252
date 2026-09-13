"""Salidas automáticas y ejecución de órdenes contra un exchange simulado."""
from datetime import datetime, timedelta, timezone

import pytest

from bot import executor, state
from bot.exchange import ExchangeError


class FakeExchange:
    """Exchange de mentira: registra las llamadas y devuelve fills controlados."""

    def __init__(self, price=100.0, fail_sell=False):
        self.price = price
        self.fail_sell = fail_sell
        self.buys, self.sells = [], []

    def get_ticker(self, symbol):
        return {"symbol": symbol, "last": self.price}

    def get_instrument(self, symbol):
        return {"symbol": symbol, "base_coin": symbol.replace("USDT", ""),
                "quote_coin": "USDT", "base_precision": "0.000001",
                "min_order_qty": 0.0, "min_order_amt": 5.0}

    def get_base_balance(self, base):
        return 999.0

    def get_available_quote(self, quote="USDT"):
        return 1000.0

    def market_buy(self, symbol, quote_usdt):
        self.buys.append((symbol, quote_usdt))
        qty = quote_usdt / self.price
        return {"order_id": "buy-1", "status": "Filled", "exec_qty": qty,
                "exec_value": quote_usdt, "avg_price": self.price,
                "fee": quote_usdt * 0.001}

    def market_sell(self, symbol, base_qty):
        if self.fail_sell:
            raise ExchangeError("venta rechazada")
        self.sells.append((symbol, base_qty))
        return {"order_id": "sell-1", "status": "Filled", "exec_qty": base_qty,
                "exec_value": base_qty * self.price, "avg_price": self.price,
                "fee": base_qty * self.price * 0.001}


def test_abrir_registra_posicion_con_comision():
    ex = FakeExchange(price=100.0)
    res = executor.open_position(ex, "BTCUSDT", 100.0, decision_id=1)
    assert res["position_id"] > 0
    pos = state.get_open_position_for("BTCUSDT")
    assert pos["qty"] == pytest.approx(1.0)
    assert pos["entry_fee"] == pytest.approx(0.1)
    assert ex.buys == [("BTCUSDT", 100.0)]


def test_abrir_con_orden_rechazada_no_registra_nada():
    class Rechaza(FakeExchange):
        def market_buy(self, symbol, quote_usdt):
            raise ExchangeError("saldo insuficiente en el exchange")

    assert executor.open_position(Rechaza(), "BTCUSDT", 100.0, 1) is None
    assert state.get_open_positions() == []


def test_cerrar_calcula_pnl_neto():
    ex = FakeExchange(price=100.0)
    executor.open_position(ex, "BTCUSDT", 100.0, 1)
    ex.price = 110.0
    pos = state.get_open_position_for("BTCUSDT")
    closed = executor.close_position(ex, pos, "llm")
    # 110 - 100 - 0.1 (compra) - 0.11 (venta) = 9.79
    assert closed["pnl_usdt"] == pytest.approx(9.79)
    assert state.get_open_positions() == []


def test_cerrar_con_venta_fallida_deja_la_posicion_abierta():
    ex = FakeExchange(price=100.0)
    executor.open_position(ex, "BTCUSDT", 100.0, 1)
    ex.fail_sell = True
    pos = state.get_open_position_for("BTCUSDT")
    assert executor.close_position(ex, pos, "llm") is None
    assert len(state.get_open_positions()) == 1


# --- Reglas de salida automática -------------------------------------------
def base_pos(**over):
    pos = {"id": 1, "symbol": "BTCUSDT", "entry_price": 100.0, "qty": 1.0,
           "peak_price": 100.0,
           "opened_at": datetime.now(timezone.utc).isoformat()}
    pos.update(over)
    return pos


def test_take_profit(settings):
    assert executor.exit_reason_for(base_pos(), 103.0, settings) == "take_profit"


def test_stop_loss(settings):
    assert executor.exit_reason_for(base_pos(), 98.0, settings) == "stop_loss"


def test_sin_motivo_en_zona_neutra(settings):
    assert executor.exit_reason_for(base_pos(), 100.5, settings) is None


def test_stop_loss_tiene_prioridad_sobre_take_profit(settings):
    s = {**settings, "take_profit_pct": 0.1, "stop_loss_pct": 0.1}
    assert executor.exit_reason_for(base_pos(), 90.0, s) == "stop_loss"


def test_trailing_stop(settings):
    s = {**settings, "trailing_stop_pct": 1.0, "take_profit_pct": 50.0}
    pos = base_pos(peak_price=102.0)
    assert executor.exit_reason_for(pos, 101.5, s) is None    # cae 0.49%
    assert executor.exit_reason_for(pos, 100.9, s) == "trailing_stop"  # cae 1.08%


def test_trailing_desactivado_por_defecto(settings):
    pos = base_pos(peak_price=102.0)
    assert executor.exit_reason_for(pos, 101.0, settings) is None


def test_cierre_por_tiempo(settings):
    viejo = (datetime.now(timezone.utc) - timedelta(minutes=1000)).isoformat()
    assert executor.exit_reason_for(base_pos(opened_at=viejo), 100.5, settings) == "timeout"


def test_check_automatic_exits_cierra_y_actualiza_pico(settings):
    ex = FakeExchange(price=100.0)
    executor.open_position(ex, "BTCUSDT", 100.0, 1)

    ex.price = 101.0                       # sube pero no dispara nada
    assert executor.check_automatic_exits(ex, settings) == []
    assert state.get_open_position_for("BTCUSDT")["peak_price"] == 101.0

    ex.price = 104.0                       # +4% -> take profit (2.5%)
    closed = executor.check_automatic_exits(ex, settings)
    assert len(closed) == 1 and closed[0]["close_reason"] == "take_profit"


def test_check_automatic_exits_aguanta_un_fallo_de_precio(settings):
    class SinPrecio(FakeExchange):
        def get_ticker(self, symbol):
            raise ExchangeError("timeout")

    state.add_position("BTCUSDT", "Buy", 1.0, 100.0, 100.0, "o", None)
    assert executor.check_automatic_exits(SinPrecio(), settings) == []
    assert len(state.get_open_positions()) == 1     # sigue abierta, no se pierde
