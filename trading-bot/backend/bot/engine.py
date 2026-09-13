"""
engine.py
=========
El corazón del bot: el bucle híbrido por eventos.

En cada ciclo (cada `poll_interval_sec`):
  1) SALIDAS AUTOMÁTICAS (TP / SL / trailing / tiempo) — siempre, sin LLM.
  2) Lectura de tickers y detección de EVENTOS (movimiento brusco de precio).
  3) ¿Toca decidir?  -> por EVENTO, por RUTINA (cada N ciclos) o MANUAL.
  4) Si se decide: motor de riesgo -> ejecución -> registro.
  5) Publicación del estado por WebSocket para el dashboard.

Todo lo bloqueante (HTTP del exchange, subproceso de Claude) va a un hilo con
`asyncio.to_thread`, así el bucle y el servidor web nunca se congelan.

El bucle está blindado: ninguna excepción de un ciclo puede matarlo.
"""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any

from . import config, decision, executor, metrics, risk, state
from .exchange import Exchange, ExchangeError

#: Nunca bajamos de aquí aunque alguien configure un latido absurdo.
MIN_POLL_SEC = 5


class BotEngine:
    def __init__(self) -> None:
        self.ex: Exchange | None = None
        self.settings: dict = dict(config.DEFAULT_SETTINGS)
        self.running: bool = False
        self.poll_count: int = 0
        self.started_at: float | None = None
        self.last_error: str | None = None

        self.last_prices: dict[str, float] = {}
        self.last_decision_ts: dict[str, float] = {}

        self._manual_requested: bool = False
        self._subscribers: set[asyncio.Queue] = set()
        self._last_tickers: dict[str, dict] = {}
        self._available_quote: float = 0.0
        self._last_decision: dict | None = None
        self._stop_event: asyncio.Event | None = None

    # -- WebSocket pub/sub ---------------------------------------------------
    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=10)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    def broadcast(self) -> None:
        """Envía el estado a todos los paneles conectados (sin bloquear)."""
        if not self._subscribers:
            return
        snap = self.snapshot()
        for q in list(self._subscribers):
            try:
                q.put_nowait(snap)
            except asyncio.QueueFull:
                pass  # panel lento: se perderá este frame, no pasa nada

    # -- Estado para el dashboard -------------------------------------------
    def snapshot(self) -> dict[str, Any]:
        return {
            "running": self.running,
            "testnet": config.env.bybit_testnet,
            "bot_enabled": bool(self.settings.get("bot_enabled", False)),
            "kill_switch": risk.kill_switch_active(),
            "poll_count": self.poll_count,
            "uptime_sec": round(time.time() - self.started_at) if self.started_at else 0,
            "available_quote": round(self._available_quote, 2),
            "quote_asset": self.settings.get("quote_asset", "USDT"),
            "tickers": self._last_tickers,
            "open_positions": state.get_open_positions(),
            "daily": state.get_daily(),
            "performance": state.get_performance(),
            "last_decision": self._last_decision,
            "daily_loss_tripped": risk.daily_loss_tripped(self.settings)[0],
            "last_error": self.last_error,
            "settings": self.settings,
            "ts": time.time(),
        }

    # -- Control externo (desde la API) -------------------------------------
    def request_manual_decision(self) -> None:
        self._manual_requested = True

    async def manual_close(self, pos_id: int) -> dict | None:
        pos = state.get_position(pos_id)
        if not pos or pos.get("status") != "open" or self.ex is None:
            return None
        result = await asyncio.to_thread(executor.close_position, self.ex, pos, "manual")
        self.broadcast()
        return result

    # -- Bucle principal -----------------------------------------------------
    async def run(self) -> None:
        self._stop_event = asyncio.Event()
        self.settings = state.get_settings()

        try:
            self.ex = await asyncio.to_thread(Exchange)
        except ExchangeError as e:
            self.last_error = str(e)
            state.add_log("error", f"No se pudo iniciar el exchange: {e}")
            state.add_log("error", "El bot queda PARADO. Revisa backend/.env y reinicia.")
            return

        self.running = True
        self.started_at = time.time()
        modo = "TESTNET (dinero ficticio)" if config.env.bybit_testnet else "MAINNET (DINERO REAL)"
        state.add_log("info", f"Bot iniciado — {modo}")

        # Saldo inicial del día: base del cortacircuitos de pérdidas.
        try:
            bal = await asyncio.to_thread(
                self.ex.get_available_quote, self.settings["quote_asset"]
            )
            self._available_quote = bal
            state.ensure_daily(bal)
        except ExchangeError as e:
            state.add_log("warn", f"No se pudo leer el saldo inicial: {e}")
            state.ensure_daily(None)

        while self.running:
            try:
                await self._cycle()
                self.last_error = None
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001 - el bucle NUNCA debe morir
                self.last_error = f"{type(e).__name__}: {e}"
                state.add_log("error", f"Error en el ciclo #{self.poll_count}: {e!r}")

            delay = max(MIN_POLL_SEC, int(self.settings.get("poll_interval_sec", 60)))
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=delay)
                break  # se pidió parar
            except asyncio.TimeoutError:
                pass

        self.running = False
        state.add_log("info", "Bot detenido")

    def stop(self) -> None:
        self.running = False
        if self._stop_event is not None:
            try:
                self._stop_event.set()
            except RuntimeError:  # pragma: no cover - loop ya cerrado
                pass

    # -- Un ciclo ------------------------------------------------------------
    async def _cycle(self) -> None:
        self.poll_count += 1
        self.settings = state.get_settings()   # recarga en caliente
        symbols = list(self.settings["symbols"])

        # Saldo + contabilidad del día (con rollover automático a medianoche UTC).
        try:
            self._available_quote = await asyncio.to_thread(
                self.ex.get_available_quote, self.settings["quote_asset"]
            )
            state.ensure_daily(self._available_quote)
        except ExchangeError as e:
            state.add_log("warn", f"No se pudo leer el saldo: {e}")

        # 1) Salidas automáticas: SIEMPRE, pase lo que pase.
        closed = await asyncio.to_thread(
            executor.check_automatic_exits, self.ex, self.settings
        )
        if closed:
            self.broadcast()

        # 2) Tickers + detección de eventos.
        event_symbol, biggest_move = None, 0.0
        for s in symbols:
            try:
                t = await asyncio.to_thread(self.ex.get_ticker, s)
            except ExchangeError as e:
                state.add_log("warn", f"Sin ticker para {s}: {e}")
                continue
            self._last_tickers[s] = t
            prev = self.last_prices.get(s)
            if prev:
                move = abs(t["last"] / prev - 1.0) * 100.0
                if move >= self.settings["event_price_move_pct"] and move > biggest_move:
                    biggest_move, event_symbol = move, s
            self.last_prices[s] = t["last"]

        # Símbolos que ya no se vigilan: fuera del panel.
        for gone in set(self._last_tickers) - set(symbols):
            self._last_tickers.pop(gone, None)
            self.last_prices.pop(gone, None)

        # 3) ¿Toca decidir?
        trigger = None
        if self._manual_requested:
            trigger, self._manual_requested = "manual", False
        elif event_symbol and self._cooldown_ok(event_symbol):
            trigger = "event"
            state.add_log(
                "info",
                f"Evento: {event_symbol} se movió {biggest_move:.2f}% desde el último latido",
            )
        elif self.poll_count % max(1, self.settings["routine_decision_every_n_polls"]) == 0:
            trigger = "routine"

        if trigger:
            await self._run_decision(trigger, event_symbol if trigger == "event" else None)

        self.broadcast()

    def _cooldown_ok(self, symbol: str) -> bool:
        last = self.last_decision_ts.get(symbol, 0.0)
        return (time.time() - last) >= self.settings["decision_cooldown_sec"]

    # -- Decisión + riesgo + ejecución ---------------------------------------
    async def _run_decision(self, trigger: str, focus_symbol: str | None) -> None:
        symbols = list(self.settings["symbols"])
        try:
            context = await asyncio.to_thread(
                metrics.build_decision_context, self.ex, symbols,
                self.settings, trigger, focus_symbol,
            )
        except ExchangeError as e:
            state.add_log("error", f"No se pudo construir el contexto: {e}")
            return

        dec = await asyncio.to_thread(decision.ask_decision, context)

        now = time.time()
        self.last_decision_ts["__any__"] = now
        if focus_symbol:
            self.last_decision_ts[focus_symbol] = now
        if dec.get("symbol"):
            self.last_decision_ts[dec["symbol"]] = now

        dec_id = state.record_decision(
            trigger=trigger,
            symbol=dec.get("symbol"),
            action=dec["action"],
            confidence=dec["confidence"],
            reasoning=dec["reasoning"],
            raw_json=_json_safe(dec),
        )
        cost = f" (~{dec['_cost_usd']:.4f} USD)" if dec.get("_cost_usd") else ""
        state.add_log(
            "info",
            f"Decisión [{trigger}]: {dec['action']} {dec.get('symbol') or ''} "
            f"conf={dec['confidence']:.2f}{cost} — {dec['reasoning']}",
        )
        self._last_decision = {**dec, "id": dec_id, "trigger": trigger, "ts": now}

        if dec["action"] == "OPEN":
            await self._apply_open(dec, dec_id)
        elif dec["action"] == "CLOSE":
            await self._apply_close(dec, dec_id)
        else:
            state.mark_decision_applied(dec_id, 0, None)

    async def _apply_open(self, dec: dict, dec_id: int) -> None:
        verdict = risk.evaluate_open(dec, self.settings, self._available_quote)
        if not verdict.allowed:
            state.mark_decision_applied(dec_id, 0, verdict.reason)
            state.add_log("info", f"OPEN vetado por riesgo: {verdict.reason}")
            return
        res = await asyncio.to_thread(
            executor.open_position, self.ex, dec["symbol"], verdict.quote_usdt, dec_id
        )
        state.mark_decision_applied(dec_id, 1 if res else 0,
                                    None if res else "fallo de ejecución")

    async def _apply_close(self, dec: dict, dec_id: int) -> None:
        verdict = risk.evaluate_close(dec, self.settings)
        if not verdict.allowed:
            state.mark_decision_applied(dec_id, 0, verdict.reason)
            state.add_log("info", f"CLOSE vetado por riesgo: {verdict.reason}")
            return
        pos = state.get_position(verdict.position_id)
        if not pos or pos.get("status") != "open":
            state.mark_decision_applied(dec_id, 0, "la posición ya no está abierta")
            return
        res = await asyncio.to_thread(executor.close_position, self.ex, pos, "llm")
        state.mark_decision_applied(dec_id, 1 if res else 0,
                                    None if res else "fallo de ejecución")


def _json_safe(dec: dict) -> str:
    try:
        return json.dumps(dec, ensure_ascii=False)
    except (TypeError, ValueError):  # pragma: no cover
        return str(dec)


#: Instancia global que usa la API.
engine = BotEngine()
