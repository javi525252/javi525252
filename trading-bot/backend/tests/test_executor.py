"""Salidas automáticas y ejecución de órdenes contra un exchange simulado."""
from datetime import datetime, timedelta, timezone

import pytest

from bot import executor, state
from bot.exchange import ExchangeError, OrderUnconfirmed


FEE_RATE = 0.001


class FakeExchange:
    """
    Exchange de mentira que imita a Bybit spot en lo que importa: la comisión
    de COMPRA se cobra en el activo base (recibes menos moneda) y la de VENTA
    en la de cotización.
    """

    def __init__(self, price=100.0, fail_sell=False):
        self.price = price
        self.fail_sell = fail_sell
        self.buys, self.sells = [], []
        self.base_balance = 0.0

    def get_ticker(self, symbol):
        return {"symbol": symbol, "last": self.price}

    def get_instrument(self, symbol):
        return {"symbol": symbol, "base_coin": symbol.replace("USDT", ""),
                "quote_coin": "USDT", "base_precision": "0.000001",
                "min_order_qty": 0.0, "min_order_amt": 5.0}

    def get_base_balance(self, base):
        return self.base_balance

    def get_available_quote(self, quote="USDT"):
        return 1000.0

    def market_buy(self, symbol, quote_usdt):
        self.buys.append((symbol, quote_usdt))
        qty = quote_usdt / self.price
        fee_base = qty * FEE_RATE                 # Bybit la cobra en el base
        self.base_balance += qty - fee_base
        return {"order_id": "buy-1", "status": "Filled", "exec_qty": qty,
                "exec_value": quote_usdt, "avg_price": self.price,
                "fee": fee_base, "fee_currency": symbol.replace("USDT", "")}

    def market_sell(self, symbol, base_qty):
        if self.fail_sell:
            raise ExchangeError("venta rechazada")
        self.sells.append((symbol, base_qty))
        self.base_balance = max(0.0, self.base_balance - base_qty)
        value = base_qty * self.price
        return {"order_id": "sell-1", "status": "Filled", "exec_qty": base_qty,
                "exec_value": value, "avg_price": self.price,
                "fee": value * FEE_RATE, "fee_currency": "USDT"}


def test_abrir_registra_posicion_con_comision():
    ex = FakeExchange(price=100.0)
    res = executor.open_position(ex, "BTCUSDT", 100.0, decision_id=1)
    assert res["position_id"] > 0
    pos = state.get_open_position_for("BTCUSDT")
    assert pos["qty"] == pytest.approx(1.0)
    assert ex.buys == [("BTCUSDT", 100.0)]
    # La comisión de compra se cobró en BTC: ya está reflejada en tener menos
    # BTC, así que en USDT se guarda 0 y no se cuenta dos veces.
    assert pos["entry_fee"] == pytest.approx(0.0)
    assert pos["fee_currency"] == "BTC"


def test_quote_fee_solo_cuenta_la_comision_en_moneda_de_cotizacion():
    compra = {"fee": 0.001, "fee_currency": "BTC"}
    venta = {"fee": 0.11, "fee_currency": "USDT"}
    assert executor.quote_fee(compra, "USDT") == 0.0
    assert executor.quote_fee(venta, "USDT") == pytest.approx(0.11)
    # Sin dato de moneda asumimos la de cotización (conservador: resta).
    assert executor.quote_fee({"fee": 0.5}, "USDT") == pytest.approx(0.5)
    assert executor.quote_fee({"fee": 0.0, "fee_currency": "BTC"}, "USDT") == 0.0


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

    # Compramos 1 BTC por 100 USDT y la comisión (0.001 BTC) nos dejó 0.999.
    # Vendemos eso a 110 -> 109.89, menos 0.10989 de comisión de venta.
    vendido = 0.999
    bruto = vendido * 110.0
    esperado = bruto - 100.0 - bruto * FEE_RATE
    assert ex.sells == [("BTCUSDT", pytest.approx(vendido))]
    assert closed["pnl_usdt"] == pytest.approx(esperado)
    assert state.get_open_positions() == []


def test_no_se_vende_mas_de_lo_que_hay_en_cartera():
    """La comisión en base deja menos moneda: nunca se intenta vender de más."""
    ex = FakeExchange(price=100.0)
    executor.open_position(ex, "BTCUSDT", 100.0, 1)
    pos = state.get_open_position_for("BTCUSDT")
    executor.close_position(ex, pos, "manual")
    assert ex.sells[0][1] <= pos["qty"]


def test_cerrar_con_venta_fallida_deja_la_posicion_abierta_y_reintentable():
    ex = FakeExchange(price=100.0)
    executor.open_position(ex, "BTCUSDT", 100.0, 1)
    ex.fail_sell = True
    pos = state.get_open_position_for("BTCUSDT")
    assert executor.close_position(ex, pos, "llm") is None
    assert len(state.get_open_positions()) == 1
    # La reserva se liberó: un segundo intento debe poder venderla.
    ex.fail_sell = False
    assert executor.close_position(ex, state.get_open_position_for("BTCUSDT"),
                                   "manual") is not None


def test_dos_cierres_simultaneos_solo_venden_una_vez():
    """
    El caso caro: salida automática y cierre manual a la vez. Solo uno debe
    llegar al exchange; el otro tiene que abortar sin vender.
    """
    ex = FakeExchange(price=100.0)
    executor.open_position(ex, "BTCUSDT", 100.0, 1)
    pos = state.get_open_position_for("BTCUSDT")

    primero = executor.close_position(ex, dict(pos), "stop_loss")
    segundo = executor.close_position(ex, dict(pos), "manual")

    assert primero is not None
    assert segundo is None
    assert len(ex.sells) == 1               # una sola venta a mercado
    assert state.get_recent_trades()[0]["close_reason"] == "stop_loss"


def test_reserva_bloquea_mientras_se_vende():
    ex = FakeExchange(price=100.0)
    executor.open_position(ex, "BTCUSDT", 100.0, 1)
    pid = state.get_open_position_for("BTCUSDT")["id"]

    assert state.claim_position_for_close(pid) is not None
    assert state.claim_position_for_close(pid) is None    # ya reservada
    state.release_position(pid)
    assert state.claim_position_for_close(pid) is not None


def test_orden_de_venta_sin_confirmar_no_libera_la_reserva():
    """
    Si no sabemos si la venta se ejecutó, reintentar podría vender dos veces:
    la posición queda bloqueada y se avisa por el log para revisarla a mano.
    """
    class SinConfirmar(FakeExchange):
        def market_sell(self, symbol, base_qty):
            raise OrderUnconfirmed("sin respuesta", symbol=symbol,
                                   order_id="s-99", side="Sell")

    ex = SinConfirmar(price=100.0)
    executor.open_position(ex, "BTCUSDT", 100.0, 1)
    pos = state.get_open_position_for("BTCUSDT")
    assert executor.close_position(ex, pos, "llm") is None
    assert state.claim_position_for_close(pos["id"]) is None   # sigue bloqueada
    assert any("SIN CONFIRMAR" in l["message"] for l in state.get_recent_logs(10))


def test_compra_sin_confirmar_no_registra_posicion_y_avisa():
    class SinConfirmar(FakeExchange):
        def market_buy(self, symbol, quote_usdt):
            raise OrderUnconfirmed("sin respuesta", symbol=symbol,
                                   order_id="b-99", side="Buy")

    assert executor.open_position(SinConfirmar(), "BTCUSDT", 100.0, 1) is None
    assert state.get_open_positions() == []
    aviso = state.get_recent_logs(5)[0]
    assert "SIN CONFIRMAR" in aviso["message"] and "b-99" in aviso["message"]


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
