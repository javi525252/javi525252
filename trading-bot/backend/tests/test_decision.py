"""Parseo de la salida de Claude Code: pase lo que pase, nunca opera a ciegas."""
import dataclasses
import json

from bot import decision


def envelope(result_text, **extra):
    return json.dumps({"type": "result", "result": result_text,
                       "total_cost_usd": 0.012, **extra})


def test_json_limpio():
    d = decision.parse_output(envelope(
        '{"action":"OPEN","symbol":"BTCUSDT","position_id":null,'
        '"confidence":0.7,"size_fraction":0.8,"reasoning":"cruce alcista"}'))
    assert d["action"] == "OPEN"
    assert d["symbol"] == "BTCUSDT"
    assert d["confidence"] == 0.7
    assert d["size_fraction"] == 0.8
    assert d["_cost_usd"] == 0.012


def test_json_con_vallas_de_codigo_y_texto():
    d = decision.parse_output(envelope(
        'Analizando el mercado...\n```json\n'
        '{"action":"close","symbol":"ETHUSDT","position_id":7,"confidence":0.66,'
        '"reasoning":"pierde momentum"}\n```\nEso es todo.'))
    assert d["action"] == "CLOSE"
    assert d["position_id"] == 7
    assert d["size_fraction"] == 1.0        # por defecto si no viene


def test_structured_output_tiene_prioridad():
    payload = json.dumps({
        "result": "texto suelto",
        "structured_output": {"action": "HOLD", "confidence": 0.3,
                              "reasoning": "sin señal"},
    })
    assert decision.parse_output(payload)["action"] == "HOLD"


def test_decision_desnuda_sin_envoltorio():
    d = decision.parse_output('{"action":"HOLD","confidence":0.1,"reasoning":"nada"}')
    assert d["action"] == "HOLD"


def test_llaves_dentro_de_strings():
    d = decision.parse_output(envelope(
        '{"action":"HOLD","confidence":0.2,"reasoning":"el patrón {abc} no cuenta"}'))
    assert d["action"] == "HOLD"
    assert "{abc}" in d["reasoning"]


def test_salidas_rotas_devuelven_hold():
    for basura in ("", "no soy json", "{roto", envelope("sin json aquí"),
                   json.dumps({"is_error": True, "result": "boom"})):
        d = decision.parse_output(basura)
        assert d["action"] == "HOLD"
        assert d["confidence"] == 0.0


def test_valores_absurdos_se_saturan():
    d = decision.parse_output(envelope(
        '{"action":"BUY_ALL","symbol":123,"confidence":9.9,'
        '"size_fraction":-5,"position_id":"x","reasoning":"' + "x" * 3000 + '"}'))
    assert d["action"] == "HOLD"            # acción inventada -> HOLD
    assert d["confidence"] == 1.0
    assert d["size_fraction"] == 0.0
    assert d["position_id"] is None
    assert d["symbol"] is None              # symbol no textual se descarta
    assert len(d["reasoning"]) == 1000


def test_hold_de_seguridad():
    d = decision.hold("timeout")
    assert d["action"] == "HOLD" and d["confidence"] == 0.0


def test_build_command_incluye_contexto_y_prompt():
    cmd = decision.build_command({"as_of_utc": "2026-01-01T00:00:00Z", "symbols": []})
    assert "-p" in cmd and "--output-format" in cmd and "json" in cmd
    assert "--max-turns" in cmd
    prompt = cmd[cmd.index("-p") + 1]
    assert "as_of_utc" in prompt                     # el contexto viaja en el prompt
    assert "--append-system-prompt" in cmd


def test_ask_decision_sin_binario(monkeypatch):
    """Si el CLI no existe, la decisión debe ser HOLD (nunca operar a ciegas)."""
    roto = dataclasses.replace(decision.config.env,
                               claude_bin="no-existe-este-binario-12345")
    monkeypatch.setattr(decision.config, "env", roto)
    d = decision.ask_decision({"foo": "bar"})
    assert d["action"] == "HOLD"
    assert "no encontrado" in d["reasoning"]
