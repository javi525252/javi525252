"""
Configuración común de los tests.

Cada test corre contra una base de datos SQLite temporal y con un kill switch
temporal, así nunca tocan el estado real del bot.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

# Credenciales de mentira: ningún test habla con Bybit de verdad.
os.environ.setdefault("BYBIT_API_KEY", "test-key")
os.environ.setdefault("BYBIT_API_SECRET", "test-secret")
os.environ.setdefault("BYBIT_TESTNET", "true")
os.environ.setdefault("API_TOKEN", "test-token")

from bot import config, state  # noqa: E402


@pytest.fixture(autouse=True)
def clean_db(tmp_path, monkeypatch):
    """BD y kill switch aislados por test."""
    monkeypatch.setattr(config, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(config, "KILL_SWITCH_FILE", tmp_path / "KILL_SWITCH")
    state.close_conn()
    state.init_db()
    yield
    state.close_conn()


@pytest.fixture
def settings():
    return state.get_settings()


def make_klines(n: int = 120, start: float = 100.0, drift: float = 1.002) -> list[dict]:
    """Velas sintéticas con una tendencia suave, para probar indicadores."""
    out, price = [], start
    for i in range(n):
        price *= drift if i % 3 else (2 - drift)
        out.append({
            "ts": 1_700_000_000_000 + i * 300_000,
            "open": price * 0.999,
            "high": price * 1.003,
            "low": price * 0.997,
            "close": price,
            "volume": 1000 + i,
        })
    return out
