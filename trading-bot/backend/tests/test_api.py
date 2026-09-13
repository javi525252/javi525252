"""API REST: autenticación, configuración en caliente y controles del panel."""
import pytest
from fastapi.testclient import TestClient

from bot import config, risk, state

AUTH = {"X-API-Token": "test-token"}


@pytest.fixture
def client(monkeypatch):
    # La API arranca el motor en su lifespan; aquí queremos solo el servidor.
    from api import server

    monkeypatch.setattr(server.engine, "run", _fake_run)
    with TestClient(server.app) as c:
        yield c


async def _fake_run():
    return None


def test_health_no_pide_token(client):
    assert client.get("/api/health").json()["ok"] is True


def test_endpoints_protegidos(client):
    assert client.get("/api/status").status_code == 401
    assert client.get("/api/status", headers={"X-API-Token": "malo"}).status_code == 401
    assert client.get("/api/status", headers=AUTH).status_code == 200


def test_settings_expone_metadatos(client):
    body = client.get("/api/settings", headers=AUTH).json()
    assert body["values"]["max_open_positions"] == 3
    assert body["spec"]["take_profit_pct"]["group"] == "Salidas automáticas"
    assert "Cortacircuitos" in body["groups"]


def test_guardar_configuracion_en_caliente(client):
    r = client.post("/api/settings", headers=AUTH,
                    json={"values": {"take_profit_pct": 3.5, "symbols": "btcusdt,ethusdt"}})
    assert r.status_code == 200
    assert state.get_settings()["take_profit_pct"] == 3.5
    assert state.get_settings()["symbols"] == ["BTCUSDT", "ETHUSDT"]


def test_configuracion_invalida_devuelve_400_y_no_guarda(client):
    r = client.post("/api/settings", headers=AUTH,
                    json={"values": {"take_profit_pct": 999, "stop_loss_pct": 1.0}})
    assert r.status_code == 400
    assert "take_profit_pct" in r.json()["detail"]
    assert state.get_settings()["take_profit_pct"] == 2.5     # intacto
    assert state.get_settings()["stop_loss_pct"] == 1.5       # atómico


def test_reset_de_configuracion(client):
    client.post("/api/settings", headers=AUTH, json={"values": {"take_profit_pct": 9.0}})
    client.post("/api/settings/reset", headers=AUTH)
    assert state.get_settings()["take_profit_pct"] == 2.5


def test_kill_switch(client):
    assert client.post("/api/kill-switch", headers=AUTH,
                       json={"on": True}).json()["kill_switch"] is True
    assert risk.kill_switch_active()
    assert client.post("/api/kill-switch", headers=AUTH,
                       json={"on": False}).json()["kill_switch"] is False
    assert not risk.kill_switch_active()


def test_decidir_ahora(client):
    from api.server import engine
    assert client.post("/api/decide-now", headers=AUTH).json()["ok"] is True
    assert engine._manual_requested is True
    engine._manual_requested = False


def test_cerrar_posicion_inexistente(client):
    assert client.post("/api/positions/999/close", headers=AUTH).status_code == 404


def test_listados(client):
    pid = state.add_position("BTCUSDT", "Buy", 1.0, 100, 100.0, "o", None)
    state.close_position(pid, 110, "take_profit")
    state.record_decision("routine", "BTCUSDT", "OPEN", 0.8, "razón", "{}")
    state.add_log("info", "hola")

    assert len(client.get("/api/trades", headers=AUTH).json()) == 1
    assert len(client.get("/api/decisions", headers=AUTH).json()) == 1
    assert client.get("/api/logs", headers=AUTH).json()[0]["message"] == "hola"

    perf = client.get("/api/performance", headers=AUTH).json()
    assert perf["summary"]["closed_trades"] == 1
    assert perf["daily"][0]["realized_pnl"] == pytest.approx(10.0)


def test_limites_de_paginacion(client):
    assert client.get("/api/trades?limit=0", headers=AUTH).status_code == 422
    assert client.get("/api/trades?limit=9999", headers=AUTH).status_code == 422
