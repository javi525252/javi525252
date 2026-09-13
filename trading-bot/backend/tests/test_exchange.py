"""Capa de exchange: precisión, mínimos y confirmación de fills."""
import pytest

from bot.exchange import Exchange, ExchangeError


class FakeHTTP:
    """Sesión pybit simulada."""

    def __init__(self, **responses):
        self.responses = responses
        self.calls = []

    def _resp(self, name, **kw):
        self.calls.append((name, kw))
        r = self.responses.get(name)
        if isinstance(r, list):
            return r.pop(0) if len(r) > 1 else r[0]
        if r is None:
            return {"retCode": 10001, "retMsg": f"sin respuesta simulada para {name}"}
        return r

    def get_tickers(self, **kw): return self._resp("get_tickers", **kw)
    def get_kline(self, **kw): return self._resp("get_kline", **kw)
    def get_wallet_balance(self, **kw): return self._resp("get_wallet_balance", **kw)
    def get_instruments_info(self, **kw): return self._resp("get_instruments_info", **kw)
    def place_order(self, **kw): return self._resp("place_order", **kw)
    def get_order_history(self, **kw): return self._resp("get_order_history", **kw)


OK_INSTRUMENT = {"retCode": 0, "result": {"list": [{
    "baseCoin": "BTC", "quoteCoin": "USDT",
    "lotSizeFilter": {"basePrecision": "0.000001", "minOrderQty": "0.000048",
                      "minOrderAmt": "5"},
}]}}


def test_floor_to_precision():
    assert Exchange.floor_to_precision(1.23456789, "0.000001") == "1.234567"
    assert Exchange.floor_to_precision(1.9, "1") == "1"
    assert Exchange.floor_to_precision(0.0000001, "0.000001") == "0.000000"


def test_ticker_normalizado():
    ex = Exchange(session=FakeHTTP(get_tickers={"retCode": 0, "result": {"list": [{
        "lastPrice": "100.5", "bid1Price": "100.4", "ask1Price": "100.6",
        "highPrice24h": "110", "lowPrice24h": "95", "volume24h": "12",
        "turnover24h": "1200", "price24hPcnt": "0.0321",
    }]}}))
    t = ex.get_ticker("BTCUSDT")
    assert t["last"] == 100.5
    assert t["change24h_pct"] == pytest.approx(3.21)


def test_klines_se_reordenan_de_viejo_a_nuevo():
    ex = Exchange(session=FakeHTTP(get_kline={"retCode": 0, "result": {"list": [
        ["3000", "3", "3", "3", "3", "30", "0"],
        ["2000", "2", "2", "2", "2", "20", "0"],
        ["1000", "1", "1", "1", "1", "10", "0"],
    ]}}))
    kl = ex.get_klines("BTCUSDT", "5", 3)
    assert [k["ts"] for k in kl] == [1000, 2000, 3000]
    assert kl[-1]["close"] == 3.0


def test_error_de_bybit_se_convierte_en_exchange_error():
    ex = Exchange(session=FakeHTTP(get_tickers={"retCode": 10001, "retMsg": "params error"}))
    with pytest.raises(ExchangeError, match="params error"):
        ex.get_ticker("BTCUSDT")


def test_excepcion_de_red_se_convierte_en_exchange_error():
    class Rota(FakeHTTP):
        def get_tickers(self, **kw):
            raise ConnectionError("sin red")

    with pytest.raises(ExchangeError, match="ConnectionError"):
        Exchange(session=Rota()).get_ticker("BTCUSDT")


def test_saldo_usa_el_primer_campo_disponible():
    ex = Exchange(session=FakeHTTP(get_wallet_balance={"retCode": 0, "result": {
        "list": [{"coin": [{"coin": "USDT", "availableToWithdraw": "",
                            "free": "", "walletBalance": "532.25"}]}]}}))
    assert ex.get_available_quote("USDT") == pytest.approx(532.25)


def test_compra_por_debajo_del_minimo_de_bybit():
    ex = Exchange(session=FakeHTTP(get_instruments_info=OK_INSTRUMENT))
    with pytest.raises(ExchangeError, match="mínimo"):
        ex.market_buy("BTCUSDT", 2.0)


def test_compra_confirma_el_fill_real():
    http = FakeHTTP(
        get_instruments_info=OK_INSTRUMENT,
        place_order={"retCode": 0, "result": {"orderId": "abc"}},
        get_order_history=[
            {"retCode": 0, "result": {"list": [{"orderStatus": "New"}]}},
            {"retCode": 0, "result": {"list": [{
                "orderStatus": "Filled", "cumExecQty": "0.002",
                "cumExecValue": "100.4", "avgPrice": "50200",
                "cumExecFee": "0.1"}]}},
        ],
    )
    ex = Exchange(session=http)
    fill = ex.market_buy("BTCUSDT", 100.0)
    assert fill["exec_qty"] == 0.002
    assert fill["avg_price"] == 50200.0
    assert fill["fee"] == 0.1
    orden = next(kw for name, kw in http.calls if name == "place_order")
    assert orden["side"] == "Buy" and orden["marketUnit"] == "quoteCoin"


def test_venta_redondea_hacia_abajo_y_usa_base_coin():
    http = FakeHTTP(
        get_instruments_info=OK_INSTRUMENT,
        place_order={"retCode": 0, "result": {"orderId": "s1"}},
        get_order_history={"retCode": 0, "result": {"list": [{
            "orderStatus": "Filled", "cumExecQty": "0.001234",
            "cumExecValue": "62.0", "avgPrice": "50243", "cumExecFee": "0.06"}]}},
    )
    Exchange(session=http).market_sell("BTCUSDT", 0.00123456789)
    orden = next(kw for name, kw in http.calls if name == "place_order")
    assert orden["qty"] == "0.001234"       # truncado, nunca redondeado hacia arriba
    assert orden["marketUnit"] == "baseCoin"


def test_orden_rechazada_lanza_error():
    http = FakeHTTP(
        get_instruments_info=OK_INSTRUMENT,
        place_order={"retCode": 0, "result": {"orderId": "x"}},
        get_order_history={"retCode": 0, "result": {"list": [{"orderStatus": "Rejected"}]}},
    )
    with pytest.raises(ExchangeError, match="Rejected"):
        Exchange(session=http).market_buy("BTCUSDT", 100.0)


def test_fill_sin_confirmar_lanza_error():
    http = FakeHTTP(
        get_instruments_info=OK_INSTRUMENT,
        place_order={"retCode": 0, "result": {"orderId": "x"}},
        get_order_history={"retCode": 0, "result": {"list": [{"orderStatus": "New"}]}},
    )
    ex = Exchange(session=http)
    with pytest.raises(ExchangeError, match="No se pudo confirmar"):
        ex._fill_result("BTCUSDT", "x", retries=2, pause=0.0)
