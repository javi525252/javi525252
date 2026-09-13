"""Indicadores técnicos sobre velas sintéticas."""
import pytest

from bot import indicators
from conftest import make_klines


def test_pocas_velas_devuelve_error(settings):
    assert "error" in indicators.compute(make_klines(10), settings)


def test_tendencia_alcista(settings):
    ind = indicators.compute(make_klines(120, drift=1.004), settings)
    assert 0 <= ind["rsi"] <= 100
    assert ind["ema_relation"] == "fast_above_slow"
    assert ind["ema_fast_slope_pct_5c"] > 0
    assert ind["macd_state"] == "bullish"
    assert ind["atr_pct"] > 0
    assert 0 <= ind["position_in_range20_pct"] <= 100


def test_giro_bajista(settings):
    """Subida larga y caída fuerte al final: EMAs y MACD deben virar a bajista."""
    velas = make_klines(100, drift=1.004)
    price = velas[-1]["close"]
    for i in range(30):
        price *= 0.99
        velas.append({"ts": 2_000_000 + i, "open": price * 1.001, "high": price * 1.002,
                      "low": price * 0.998, "close": price, "volume": 2000})
    ind = indicators.compute(velas, settings)
    assert ind["ema_relation"] == "fast_below_slow"
    assert ind["macd_state"] == "bearish"
    assert ind["ema_fast_slope_pct_5c"] < 0
    assert ind["change_last_3_candles_pct"] < 0


def test_precio_plano_no_rompe(settings):
    planas = [{"ts": i, "open": 100.0, "high": 100.0, "low": 100.0,
               "close": 100.0, "volume": 10.0} for i in range(120)]
    ind = indicators.compute(planas, settings)
    assert ind["price"] == 100.0
    assert ind["atr_pct"] == pytest.approx(0.0, abs=1e-9)
    assert ind["position_in_range20_pct"] == 50.0      # rango nulo -> punto medio
    assert ind["rsi"] == pytest.approx(50.0, abs=1.0)
