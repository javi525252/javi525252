"""
indicators.py
=============
Indicadores técnicos calculados con pandas a partir de las velas de Bybit.

Estos números son "hechos objetivos" que se le entregan al LLM ya masticados:
el modelo interpreta, nunca calcula. Así la parte cuantitativa es determinista
y auditable, y el LLM solo aporta criterio.
"""
from __future__ import annotations

import pandas as pd

#: Velas mínimas para que los indicadores tengan sentido.
MIN_CANDLES = 30


def _ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def _rsi(close: pd.Series, period: int) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, 1e-12)
    rsi = 100 - (100 / (1 + rs))
    # Sin movimiento no hay ni fuerza compradora ni vendedora: RSI neutro (50).
    return rsi.mask((avg_gain + avg_loss) == 0, 50.0)


def _atr(df: pd.DataFrame, period: int) -> pd.Series:
    high, low, close = df["high"], df["low"], df["close"]
    prev_close = close.shift(1)
    tr = pd.concat(
        [(high - low), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr.ewm(alpha=1 / period, adjust=False).mean()


def _macd(close: pd.Series) -> tuple[float, float, float]:
    macd_line = _ema(close, 12) - _ema(close, 26)
    signal = _ema(macd_line, 9)
    hist = macd_line - signal
    return float(macd_line.iloc[-1]), float(signal.iloc[-1]), float(hist.iloc[-1])


def compute(klines: list[dict], settings: dict) -> dict:
    """
    Recibe las velas (de más antigua a más reciente) y devuelve un resumen
    compacto y legible de indicadores para un símbolo.

    Ante datos insuficientes devuelve {"error": ...} en vez de romper: el
    motor sigue funcionando y el LLM ve explícitamente que faltan datos.
    """
    if len(klines) < MIN_CANDLES:
        return {"error": f"insuficientes velas ({len(klines)} < {MIN_CANDLES})"}

    df = pd.DataFrame(klines)
    close = df["close"]

    ema_fast = _ema(close, settings["ema_fast"])
    ema_slow = _ema(close, settings["ema_slow"])
    rsi = _rsi(close, settings["rsi_period"])
    atr = _atr(df, settings["atr_period"])

    last = float(close.iloc[-1])
    if last <= 0:
        return {"error": "precio de cierre no válido"}

    ema_f = float(ema_fast.iloc[-1])
    ema_s = float(ema_slow.iloc[-1])
    ema_f_prev = float(ema_fast.iloc[-2])
    ema_s_prev = float(ema_slow.iloc[-2])

    # Cruce de EMAs en la última vela cerrada.
    cross = "none"
    if ema_f_prev <= ema_s_prev and ema_f > ema_s:
        cross = "bullish_cross"
    elif ema_f_prev >= ema_s_prev and ema_f < ema_s:
        cross = "bearish_cross"

    # Pendiente de la EMA rápida en las últimas 5 velas (% de variación).
    ema_f_ref = float(ema_fast.iloc[-6])
    slope_pct = (ema_f / ema_f_ref - 1.0) * 100.0 if ema_f_ref else 0.0

    # Volatilidad relativa: ATR como % del precio.
    atr_pct = float(atr.iloc[-1]) / last * 100.0

    # Posición dentro del rango de las últimas 20 velas.
    recent = df.tail(20)
    hi20 = float(recent["high"].max())
    lo20 = float(recent["low"].min())
    pos_in_range = (last - lo20) / (hi20 - lo20) * 100.0 if hi20 > lo20 else 50.0

    # Momentum corto: variación en las últimas 3 velas.
    change_3 = (last / float(close.iloc[-4]) - 1.0) * 100.0

    # Volumen de la última vela frente a la media de las 20 anteriores.
    vol_avg20 = float(df["volume"].tail(21).head(20).mean())
    vol_ratio = float(df["volume"].iloc[-1]) / vol_avg20 if vol_avg20 > 0 else 1.0

    macd_line, macd_signal, macd_hist = _macd(close)

    return {
        "price": round(last, 8),
        "rsi": round(float(rsi.iloc[-1]), 1),
        "ema_fast": round(ema_f, 8),
        "ema_slow": round(ema_s, 8),
        "ema_relation": "fast_above_slow" if ema_f > ema_s else "fast_below_slow",
        "ema_cross_last_candle": cross,
        "ema_fast_slope_pct_5c": round(slope_pct, 3),
        "macd_hist": round(macd_hist, 8),
        "macd_state": "bullish" if macd_hist > 0 else "bearish",
        "atr_pct": round(atr_pct, 3),
        "change_last_3_candles_pct": round(change_3, 3),
        "volume_vs_avg20": round(vol_ratio, 2),
        "range20_high": round(hi20, 8),
        "range20_low": round(lo20, 8),
        "position_in_range20_pct": round(pos_in_range, 1),
    }
