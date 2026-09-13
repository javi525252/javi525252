"""El bucle híbrido: eventos, rutina, cooldown y aplicación de decisiones."""
import asyncio

import pytest

from bot import engine as engine_mod
from bot import state
from bot.engine import BotEngine
from test_executor import FakeExchange


@pytest.fixture
def bot(monkeypatch):
    e = BotEngine()
    e.ex = FakeExchange(price=100.0)
    e.settings = state.get_settings()
    e._available_quote = 1000.0
    e._quote_stale = False
    # Nunca llamamos al LLM de verdad en los tests.
    monkeypatch.setattr(engine_mod.decision, "ask_decision",
                        lambda ctx: engine_mod.decision.hold("test"))
    # Contexto de decisión barato (no toca el exchange).
    monkeypatch.setattr(engine_mod.metrics, "build_decision_context",
                        lambda *a, **k: {"fake": True})
    return e


def run(coro):
    return asyncio.run(coro)


def test_snapshot_tiene_lo_que_pinta_el_panel(bot):
    snap = bot.snapshot()
    for k in ("running", "testnet", "bot_enabled", "kill_switch", "open_positions",
              "daily", "performance", "settings", "tickers"):
        assert k in snap


def test_ciclo_de_rutina_dispara_decision(bot, monkeypatch):
    llamadas = []
    monkeypatch.setattr(bot, "_run_decision",
                        lambda trigger, focus: llamadas.append(trigger) or _noop())
    state.set_setting("routine_decision_every_n_polls", 2)
    run(bot._cycle())          # ciclo 1: nada
    assert llamadas == []
    run(bot._cycle())          # ciclo 2: rutina
    assert llamadas == ["routine"]


async def _noop():
    return None


def test_evento_por_movimiento_de_precio(bot, monkeypatch):
    llamadas = []
    monkeypatch.setattr(bot, "_run_decision",
                        lambda trigger, focus: llamadas.append((trigger, focus)) or _noop())
    state.set_settings({"routine_decision_every_n_polls": 1000,
                        "event_price_move_pct": 1.0})
    run(bot._cycle())                 # primera lectura: sin referencia previa
    assert llamadas == []
    bot.ex.price = 105.0              # +5%
    run(bot._cycle())
    assert llamadas and llamadas[0][0] == "event"


def test_cooldown_evita_spamear_al_llm(bot):
    state.set_setting("decision_cooldown_sec", 600)
    bot.settings = state.get_settings()
    bot.last_decision_ts["BTCUSDT"] = 10 ** 12   # decidido "ahora mismo"
    assert bot._cooldown_ok("BTCUSDT") is False
    assert bot._cooldown_ok("ETHUSDT") is True


def test_peticion_manual_tiene_prioridad(bot, monkeypatch):
    llamadas = []
    monkeypatch.setattr(bot, "_run_decision",
                        lambda trigger, focus: llamadas.append(trigger) or _noop())
    state.set_setting("routine_decision_every_n_polls", 1000)
    bot.request_manual_decision()
    run(bot._cycle())
    assert llamadas == ["manual"]
    run(bot._cycle())                  # la petición se consume una sola vez
    assert llamadas == ["manual"]


def test_salidas_automaticas_corren_siempre(bot):
    """Aunque el bot esté en pausa, lo abierto se sigue protegiendo."""
    state.set_setting("bot_enabled", False)
    bot.ex.price = 100.0
    from bot import executor
    executor.open_position(bot.ex, "BTCUSDT", 100.0, None)
    bot.ex.price = 90.0                # -10%: salta el stop-loss
    run(bot._cycle())
    assert state.get_open_positions() == []
    assert state.get_recent_trades()[0]["close_reason"] == "stop_loss"


def test_decision_open_aprobada_se_ejecuta(bot, monkeypatch):
    monkeypatch.setattr(
        engine_mod.decision, "ask_decision",
        lambda ctx: {"action": "OPEN", "symbol": "BTCUSDT", "position_id": None,
                     "confidence": 0.95, "size_fraction": 1.0,
                     "reasoning": "señal clara", "_cost_usd": 0.01})
    run(bot._run_decision("manual", None))
    assert state.get_open_position_for("BTCUSDT") is not None
    assert state.get_recent_decisions(1)[0]["applied"] == 1


def test_decision_open_vetada_no_ejecuta_nada(bot, monkeypatch):
    monkeypatch.setattr(
        engine_mod.decision, "ask_decision",
        lambda ctx: {"action": "OPEN", "symbol": "BTCUSDT", "position_id": None,
                     "confidence": 0.10, "size_fraction": 1.0,
                     "reasoning": "dudoso", "_cost_usd": None})
    run(bot._run_decision("routine", None))
    assert state.get_open_positions() == []
    d = state.get_recent_decisions(1)[0]
    assert d["applied"] == 0 and "confianza" in d["veto_reason"]


def test_decision_close_cierra_la_posicion(bot, monkeypatch):
    from bot import executor
    executor.open_position(bot.ex, "BTCUSDT", 100.0, None)
    pid = state.get_open_position_for("BTCUSDT")["id"]
    monkeypatch.setattr(
        engine_mod.decision, "ask_decision",
        lambda ctx: {"action": "CLOSE", "symbol": "BTCUSDT", "position_id": pid,
                     "confidence": 0.9, "size_fraction": 0.0,
                     "reasoning": "pierde fuelle", "_cost_usd": None})
    run(bot._run_decision("event", "BTCUSDT"))
    assert state.get_open_positions() == []
    assert state.get_recent_trades()[0]["close_reason"] == "llm"


def test_no_se_abre_con_saldo_no_fiable(bot, monkeypatch):
    """Dimensionar una compra con un saldo viejo es como operar a ciegas."""
    monkeypatch.setattr(
        engine_mod.decision, "ask_decision",
        lambda ctx: {"action": "OPEN", "symbol": "BTCUSDT", "position_id": None,
                     "confidence": 0.95, "size_fraction": 1.0,
                     "reasoning": "señal clara", "_cost_usd": None})
    bot._quote_stale = True
    run(bot._run_decision("manual", None))
    assert state.get_open_positions() == []
    assert "saldo no fiable" in state.get_recent_decisions(1)[0]["veto_reason"]


def test_saldo_ilegible_marca_el_estado_como_no_fiable(bot):
    class SinSaldo(FakeExchange):
        def get_available_quote(self, quote="USDT"):
            from bot.exchange import ExchangeError
            raise ExchangeError("timeout")

    bot.ex = SinSaldo(price=100.0)
    run(bot._cycle())
    assert bot._quote_stale is True
    assert bot.snapshot()["available_quote_stale"] is True


def test_hold_no_toca_nada(bot):
    run(bot._run_decision("routine", None))
    assert state.get_open_positions() == []
    assert state.get_recent_decisions(1)[0]["action"] == "HOLD"


def test_un_ciclo_que_revienta_no_mata_el_bucle(bot, monkeypatch):
    """El bucle debe sobrevivir a cualquier excepción de un ciclo."""
    ciclos = {"n": 0}

    async def cycle_que_falla():
        ciclos["n"] += 1
        if ciclos["n"] == 1:
            raise RuntimeError("boom")
        bot.stop()

    monkeypatch.setattr(engine_mod, "Exchange", lambda: FakeExchange(price=100.0))
    monkeypatch.setattr(engine_mod, "MIN_POLL_SEC", 0)
    monkeypatch.setattr(state, "get_settings",
                        lambda: {**bot.settings, "poll_interval_sec": 0})
    monkeypatch.setattr(bot, "_cycle", cycle_que_falla)

    run(asyncio.wait_for(bot.run(), timeout=10))
    assert ciclos["n"] == 2            # siguió vivo tras el error
    assert bot.last_error is None      # y el error se limpió al ir bien
    assert bot.running is False
