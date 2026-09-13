"""Persistencia: settings, posiciones, PnL neto y contabilidad diaria."""
import pytest

from bot import config, state


def test_settings_overlay_y_validacion():
    assert state.get_settings()["max_open_positions"] == 3
    state.set_setting("max_open_positions", 2)
    assert state.get_settings()["max_open_positions"] == 2

    with pytest.raises(config.SettingError):
        state.set_setting("max_open_positions", "dos")
    with pytest.raises(config.SettingError):
        state.set_setting("no_existe", 1)
    # el valor válido anterior sigue intacto
    assert state.get_settings()["max_open_positions"] == 2

    state.reset_settings()
    assert state.get_settings()["max_open_positions"] == 3


def test_guardado_atomico():
    """Si un valor del lote es inválido, no se guarda ninguno."""
    with pytest.raises(config.SettingError):
        state.set_settings({"max_open_positions": 5, "position_size_pct": 999})
    assert state.get_settings()["max_open_positions"] == 3


def test_pnl_neto_de_comisiones():
    state.ensure_daily(1000.0)
    pid = state.add_position("BTCUSDT", "Buy", 0.01, 50_000, 500.0, "ord1", 1,
                             entry_fee=0.5)
    closed = state.close_position(pid, close_price=51_000, close_reason="take_profit",
                                  exit_fee=0.51)
    # (51000 * 0.01) - 500 - 0.5 - 0.51 = 8.99
    assert closed["pnl_usdt"] == pytest.approx(8.99)
    assert closed["pnl_pct"] == pytest.approx(8.99 / 500 * 100)
    assert state.get_daily()["trades_opened"] == 1
    assert state.get_daily()["realized_pnl"] == pytest.approx(8.99)


def test_no_se_cierra_dos_veces():
    pid = state.add_position("ETHUSDT", "Buy", 1.0, 100, 100.0, "o", None)
    assert state.close_position(pid, 110, "llm") is not None
    assert state.close_position(pid, 120, "manual") is None   # ya cerrada
    assert state.get_daily()["realized_pnl"] == pytest.approx(10.0)


def test_posiciones_abiertas_y_consultas():
    a = state.add_position("BTCUSDT", "Buy", 0.1, 100, 10.0, "o1", None)
    state.add_position("ETHUSDT", "Buy", 1.0, 50, 50.0, "o2", None)
    assert len(state.get_open_positions()) == 2
    assert state.get_open_position_for("BTCUSDT")["id"] == a
    assert state.get_open_position_for("SOLUSDT") is None
    state.close_position(a, 120, "manual")
    assert state.get_open_position_for("BTCUSDT") is None
    assert len(state.get_recent_trades()) == 1


def test_trailing_peak_solo_sube():
    pid = state.add_position("BTCUSDT", "Buy", 1.0, 100, 100.0, "o", None)
    state.update_peak_price(pid, 120)
    state.update_peak_price(pid, 110)
    assert state.get_position(pid)["peak_price"] == 120


def test_performance():
    for price, close in ((100, 120), (100, 90), (100, 130)):
        pid = state.add_position("BTCUSDT", "Buy", 1.0, price, float(price), "o", None)
        state.close_position(pid, close, "llm")
    perf = state.get_performance()
    assert perf["closed_trades"] == 3
    assert perf["wins"] == 2 and perf["losses"] == 1
    assert perf["win_rate_pct"] == pytest.approx(66.7, abs=0.1)
    assert perf["total_pnl_usdt"] == pytest.approx(40.0)


def test_logs_y_decisiones():
    state.add_log("info", "hola")
    state.add_log("error", "algo falló")
    logs = state.get_recent_logs(10)
    assert logs[0]["message"] == "algo falló"        # más reciente primero
    did = state.record_decision("routine", "BTCUSDT", "OPEN", 0.8, "porque sí", "{}")
    state.mark_decision_applied(did, 0, "vetada")
    assert state.get_recent_decisions(1)[0]["veto_reason"] == "vetada"
