"""
exchange.py
===========
Capa de ejecución sobre Bybit V5 (spot) con la librería oficial `pybit`.

Diseño para SPOT SIN APALANCAMIENTO:
  - Abrir posición  = COMPRA a mercado gastando N USDT   (marketUnit=quoteCoin)
  - Cerrar posición = VENTA a mercado del activo base    (marketUnit=baseCoin)

No hay margen ni liquidaciones: como mucho se pierde lo invertido en cada
compra. Es la variante más segura para automatizar.

Todo respeta `BYBIT_TESTNET` del .env.
"""
from __future__ import annotations

import math
import time
from decimal import Decimal

from pybit.unified_trading import HTTP

from . import config


class ExchangeError(Exception):
    """Cualquier problema hablando con Bybit (red, credenciales o rechazo)."""


class Exchange:
    def __init__(self, session: HTTP | None = None):
        if session is not None:  # inyección para tests
            self.session = session
        else:
            if not config.env.bybit_api_key or not config.env.bybit_api_secret:
                raise ExchangeError(
                    "Faltan BYBIT_API_KEY / BYBIT_API_SECRET en backend/.env"
                )
            self.session = HTTP(
                testnet=config.env.bybit_testnet,
                api_key=config.env.bybit_api_key,
                api_secret=config.env.bybit_api_secret,
            )
        self._instrument_cache: dict[str, dict] = {}

    # -- utilidad interna: valida el retCode de Bybit -----------------------
    @staticmethod
    def _check(resp: dict, ctx: str) -> dict:
        if not isinstance(resp, dict):
            raise ExchangeError(f"{ctx}: respuesta inesperada {resp!r}")
        if resp.get("retCode", -1) != 0:
            raise ExchangeError(f"{ctx}: {resp.get('retCode')} {resp.get('retMsg')}")
        return resp.get("result") or {}

    def _call(self, fn, ctx: str, **kwargs) -> dict:
        """Llama a pybit convirtiendo cualquier excepción en ExchangeError."""
        try:
            resp = fn(**kwargs)
        except ExchangeError:
            raise
        except Exception as e:  # noqa: BLE001 - pybit lanza de todo (red, HTTP…)
            raise ExchangeError(f"{ctx}: {type(e).__name__}: {e}") from e
        return self._check(resp, ctx)

    # -----------------------------------------------------------------------
    #  Datos de mercado (endpoints públicos)
    # -----------------------------------------------------------------------
    def get_ticker(self, symbol: str) -> dict:
        r = self._call(self.session.get_tickers, "get_tickers",
                       category="spot", symbol=symbol)
        lst = r.get("list") or []
        if not lst:
            raise ExchangeError(f"Sin ticker para {symbol}")
        t = lst[0]
        last = float(t["lastPrice"])
        return {
            "symbol": symbol,
            "last": last,
            "bid": float(t.get("bid1Price") or last),
            "ask": float(t.get("ask1Price") or last),
            "high24h": float(t.get("highPrice24h") or last),
            "low24h": float(t.get("lowPrice24h") or last),
            "vol24h": float(t.get("volume24h") or 0),
            "turnover24h": float(t.get("turnover24h") or 0),
            "change24h_pct": float(t.get("price24hPcnt") or 0) * 100.0,
        }

    def get_klines(self, symbol: str, interval: str, limit: int) -> list[dict]:
        """Velas ordenadas de más antigua a más reciente."""
        r = self._call(self.session.get_kline, "get_kline",
                       category="spot", symbol=symbol, interval=str(interval),
                       limit=int(limit))
        rows = r.get("list") or []
        # Bybit devuelve [start, open, high, low, close, volume, turnover]
        # y de la más nueva a la más vieja: le damos la vuelta.
        return [
            {
                "ts": int(k[0]),
                "open": float(k[1]),
                "high": float(k[2]),
                "low": float(k[3]),
                "close": float(k[4]),
                "volume": float(k[5]),
            }
            for k in reversed(rows)
        ]

    # -----------------------------------------------------------------------
    #  Cuenta
    # -----------------------------------------------------------------------
    def _coin_balance(self, coin_name: str) -> float:
        r = self._call(self.session.get_wallet_balance, "get_wallet_balance",
                       accountType="UNIFIED", coin=coin_name)
        lst = r.get("list") or []
        if not lst:
            return 0.0
        for coin in lst[0].get("coin", []):
            if coin.get("coin") == coin_name:
                # Según el modo de cuenta unos campos vienen vacíos y otros no.
                for field in ("availableToWithdraw", "free", "walletBalance"):
                    val = coin.get(field)
                    if val not in (None, ""):
                        try:
                            return float(val)
                        except ValueError:
                            continue
        return 0.0

    def get_available_quote(self, quote_asset: str = "USDT") -> float:
        """Saldo disponible en la moneda de cotización."""
        return self._coin_balance(quote_asset)

    def get_base_balance(self, base_asset: str) -> float:
        """Saldo disponible del activo base (lo que realmente se puede vender)."""
        return self._coin_balance(base_asset)

    # -----------------------------------------------------------------------
    #  Información del instrumento (precisión y mínimos)
    # -----------------------------------------------------------------------
    def get_instrument(self, symbol: str) -> dict:
        if symbol in self._instrument_cache:
            return self._instrument_cache[symbol]
        r = self._call(self.session.get_instruments_info, "get_instruments_info",
                       category="spot", symbol=symbol)
        lst = r.get("list") or []
        if not lst:
            raise ExchangeError(f"Instrumento no encontrado en Bybit spot: {symbol}")
        info = lst[0]
        lot = info.get("lotSizeFilter", {})
        parsed = {
            "symbol": symbol,
            "base_coin": info["baseCoin"],
            "quote_coin": info["quoteCoin"],
            "base_precision": lot.get("basePrecision") or "0.00000001",
            "min_order_qty": float(lot.get("minOrderQty") or 0),
            "min_order_amt": float(lot.get("minOrderAmt") or 0),  # mínimo en USDT
        }
        self._instrument_cache[symbol] = parsed
        return parsed

    @staticmethod
    def floor_to_precision(qty: float, precision_str: str) -> str:
        """Redondea SIEMPRE hacia abajo a la precisión del activo base."""
        decimals = max(0, -Decimal(str(precision_str)).normalize().as_tuple().exponent)
        factor = 10 ** decimals
        floored = math.floor(qty * factor) / factor
        return f"{floored:.{decimals}f}"

    # -----------------------------------------------------------------------
    #  Órdenes
    # -----------------------------------------------------------------------
    def market_buy(self, symbol: str, quote_usdt: float) -> dict:
        """Compra a mercado gastando `quote_usdt`. Devuelve el fill real."""
        inst = self.get_instrument(symbol)
        if inst["min_order_amt"] and quote_usdt < inst["min_order_amt"]:
            raise ExchangeError(
                f"{symbol}: importe {quote_usdt:.2f} USDT por debajo del mínimo "
                f"de Bybit ({inst['min_order_amt']} USDT)"
            )
        r = self._call(self.session.place_order, "place_order(Buy)",
                       category="spot", symbol=symbol, side="Buy",
                       orderType="Market", qty=f"{quote_usdt:.2f}",
                       marketUnit="quoteCoin")
        return self._fill_result(symbol, r["orderId"])

    def market_sell(self, symbol: str, base_qty: float) -> dict:
        """Vende a mercado `base_qty` del activo base. Devuelve el fill real."""
        inst = self.get_instrument(symbol)
        qty_str = self.floor_to_precision(base_qty, inst["base_precision"])
        if float(qty_str) <= 0:
            raise ExchangeError(f"{symbol}: la cantidad a vender redondea a 0 ({base_qty})")
        if inst["min_order_qty"] and float(qty_str) < inst["min_order_qty"]:
            raise ExchangeError(
                f"{symbol}: cantidad {qty_str} por debajo del mínimo "
                f"({inst['min_order_qty']})"
            )
        r = self._call(self.session.place_order, "place_order(Sell)",
                       category="spot", symbol=symbol, side="Sell",
                       orderType="Market", qty=qty_str, marketUnit="baseCoin")
        return self._fill_result(symbol, r["orderId"])

    def _fill_result(self, symbol: str, order_id: str, retries: int = 8,
                     pause: float = 0.5) -> dict:
        """
        Consulta el resultado REAL de una orden de mercado (precio medio,
        cantidad y comisión). Reintenta porque el historial tarda un instante
        en reflejar la ejecución.
        """
        last: dict = {}
        for _ in range(retries):
            try:
                r = self._call(self.session.get_order_history, "get_order_history",
                               category="spot", symbol=symbol, orderId=order_id)
                for o in (r.get("list") or []):
                    last = o
                    status = o.get("orderStatus", "")
                    exec_qty = float(o.get("cumExecQty") or 0)
                    exec_val = float(o.get("cumExecValue") or 0)
                    if status in ("Filled", "PartiallyFilledCanceled") and exec_qty > 0:
                        avg = float(o.get("avgPrice") or 0) or (exec_val / exec_qty)
                        return {
                            "order_id": order_id,
                            "status": status,
                            "exec_qty": exec_qty,
                            "exec_value": exec_val or avg * exec_qty,
                            "avg_price": avg,
                            "fee": float(o.get("cumExecFee") or 0),
                        }
                    if status in ("Rejected", "Cancelled", "Deactivated"):
                        raise ExchangeError(
                            f"Orden {order_id} ({symbol}) terminó en estado {status}"
                        )
            except ExchangeError as e:
                if "terminó en estado" in str(e):
                    raise
            time.sleep(pause)
        raise ExchangeError(
            f"No se pudo confirmar la ejecución de {order_id} ({symbol}). "
            f"Último estado conocido: {last.get('orderStatus', 'desconocido')}"
        )
