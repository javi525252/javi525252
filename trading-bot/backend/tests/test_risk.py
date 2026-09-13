"""El muro de contención: nada se ejecuta sin pasar por aquí."""
import pytest

from bot import risk, state

DEC_OPEN = {"action": "OPEN", "symbol": "BTCUSDT", "confidence": 0.9,
            "size_fraction": 1.0}


def test_open_permitido(settings):
    v = risk.evaluate_open(DEC_OPEN, settings, available_quote=1000.0)
    assert v.allowed
    # 10% de 1000 = 100, por debajo del tope de 200
    assert v.quote_usdt == pytest.approx(100.0)


def test_open_respeta_tope_por_operacion(settings):
    v = risk.evaluate_open(DEC_OPEN, settings, available_quote=100_000.0)
    assert v.quote_usdt == pytest.approx(settings["max_position_usdt"])


def test_size_fraction_reduce_el_importe(settings):
    v = risk.evaluate_open({**DEC_OPEN, "size_fraction": 0.5}, settings, 1000.0)
    assert v.quote_usdt == pytest.approx(50.0)


def test_open_vetos_basicos(settings):
    assert not risk.evaluate_open({**DEC_OPEN, "confidence": 0.1}, settings, 1000.0).allowed
    assert not risk.evaluate_open({**DEC_OPEN, "symbol": "DOGEUSDT"}, settings, 1000.0).allowed
    assert not risk.evaluate_open({**DEC_OPEN, "symbol": None}, settings, 1000.0).allowed
    assert not risk.evaluate_open(DEC_OPEN, settings, 5.0).allowed        # saldo corto
    assert not risk.evaluate_open(DEC_OPEN, {**settings, "bot_enabled": False},
                                  1000.0).allowed


def test_kill_switch_bloquea(settings):
    risk.set_kill_switch(True)
    v = risk.evaluate_open(DEC_OPEN, settings, 1000.0)
    assert not v.allowed and "KILL SWITCH" in v.reason
    risk.set_kill_switch(False)
    assert risk.evaluate_open(DEC_OPEN, settings, 1000.0).allowed


def test_una_posicion_por_simbolo(settings):
    state.add_position("BTCUSDT", "Buy", 1, 100, 100.0, "o", None)
    v = risk.evaluate_open(DEC_OPEN, settings, 1000.0)
    assert not v.allowed and "ya hay una posición" in v.reason


def test_maximo_de_posiciones(settings):
    for s in ("BTCUSDT", "ETHUSDT", "SOLUSDT"):
        state.add_position(s, "Buy", 1, 100, 100.0, "o", None)
    v = risk.evaluate_open({**DEC_OPEN, "symbol": "BTCUSDT"}, settings, 1000.0)
    assert not v.allowed


def test_maximo_de_operaciones_diarias():
    state.set_setting("max_trades_per_day", 2)
    s = state.get_settings()
    for sym in ("ETHUSDT", "SOLUSDT"):
        pid = state.add_position(sym, "Buy", 1, 100, 100.0, "o", None)
        state.close_position(pid, 100, "manual")
    v = risk.evaluate_open(DEC_OPEN, s, 1000.0)
    assert not v.allowed and "operaciones del día" in v.reason


def test_cortacircuitos_de_perdidas():
    state.ensure_daily(1000.0)
    state.set_setting("max_daily_loss_usdt", 50.0)
    s = state.get_settings()
    assert risk.daily_loss_tripped(s) == (False, "")

    pid = state.add_position("ETHUSDT", "Buy", 1.0, 100, 100.0, "o", None)
    state.close_position(pid, 40, "stop_loss")          # -60 USDT
    tripped, why = risk.daily_loss_tripped(s)
    assert tripped and "pérdida diaria" in why

    v = risk.evaluate_open(DEC_OPEN, s, 1000.0)
    assert not v.allowed and "cortacircuitos" in v.reason


def test_cortacircuitos_por_porcentaje():
    state.ensure_daily(1000.0)
    state.set_settings({"max_daily_loss_usdt": 1_000_000.0, "max_daily_loss_pct": 2.0})
    s = state.get_settings()
    pid = state.add_position("ETHUSDT", "Buy", 1.0, 100, 100.0, "o", None)
    state.close_position(pid, 75, "stop_loss")          # -25 USDT = 2.5% de 1000
    tripped, why = risk.daily_loss_tripped(s)
    assert tripped and "%" in why


def test_close_requiere_posicion_y_confianza(settings):
    pid = state.add_position("BTCUSDT", "Buy", 1, 100, 100.0, "o", None)

    baja = risk.evaluate_close({"confidence": 0.1, "position_id": pid}, settings)
    assert not baja.allowed

    ok = risk.evaluate_close({"confidence": 0.9, "position_id": pid}, settings)
    assert ok.allowed and ok.position_id == pid

    # sin position_id, se resuelve por símbolo
    por_simbolo = risk.evaluate_close(
        {"confidence": 0.9, "position_id": None, "symbol": "BTCUSDT"}, settings)
    assert por_simbolo.position_id == pid

    inexistente = risk.evaluate_close(
        {"confidence": 0.9, "position_id": 999, "symbol": "XRPUSDT"}, settings)
    assert not inexistente.allowed
