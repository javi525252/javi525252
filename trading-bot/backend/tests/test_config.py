"""Validación de los parámetros configurables en caliente."""
import pytest

from bot import config


def test_defaults_cubren_todo_el_spec():
    assert set(config.DEFAULT_SETTINGS) == set(config.SETTINGS_SPEC)
    assert config.DEFAULT_SETTINGS["max_open_positions"] == 3


def test_coerce_numeros_y_rangos():
    assert config.coerce_setting("position_size_pct", "12.5") == 12.5
    assert config.coerce_setting("max_open_positions", 4.0) == 4
    with pytest.raises(config.SettingError):
        config.coerce_setting("max_open_positions", 2.5)     # no es entero
    with pytest.raises(config.SettingError):
        config.coerce_setting("position_size_pct", 500)      # fuera de rango
    with pytest.raises(config.SettingError):
        config.coerce_setting("min_confidence_open", -0.1)   # fuera de rango


def test_coerce_booleanos_y_textos():
    assert config.coerce_setting("bot_enabled", "false") is False
    assert config.coerce_setting("bot_enabled", True) is True
    assert config.coerce_setting("quote_asset", " usdt ") == "USDT"
    with pytest.raises(config.SettingError):
        config.coerce_setting("bot_enabled", 1)


def test_coerce_listas_y_choices():
    assert config.coerce_setting("symbols", "btcusdt, ethusdt") == ["BTCUSDT", "ETHUSDT"]
    with pytest.raises(config.SettingError):
        config.coerce_setting("symbols", [])
    with pytest.raises(config.SettingError):
        config.coerce_setting("symbols", ["BTCUSDT", "BTCUSDT"])
    with pytest.raises(config.SettingError):
        config.coerce_setting("symbols", ["BTC/USDT"])
    assert config.coerce_setting("kline_interval", 15) == "15"
    with pytest.raises(config.SettingError):
        config.coerce_setting("kline_interval", "7")


def test_parametro_desconocido():
    with pytest.raises(config.SettingError):
        config.coerce_setting("no_existe", 1)


def test_cross_validate():
    base = dict(config.DEFAULT_SETTINGS)
    config.cross_validate(base)  # los defaults son coherentes

    with pytest.raises(config.SettingError):
        config.cross_validate({**base, "ema_fast": 30, "ema_slow": 21})
    with pytest.raises(config.SettingError):
        config.cross_validate({**base, "min_position_usdt": 500.0, "max_position_usdt": 200.0})
    with pytest.raises(config.SettingError):
        config.cross_validate({**base, "symbols": ["BTCEUR"]})
