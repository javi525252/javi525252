"""
decision.py
===========
Motor de decisión: invoca **Claude Code en modo headless** (`claude -p`) con TU
suscripción (no consume créditos de API), le entrega las métricas y recibe una
decisión estructurada en JSON.

Se ejecuta dentro de `decision_workspace/`, una carpeta aislada con su propio
CLAUDE.md y un `.claude/settings.json` que deniega herramientas: ahí el modelo
solo puede razonar y responder.

Forma de la decisión:
    {
      "action": "OPEN" | "CLOSE" | "HOLD",
      "symbol": "BTCUSDT" | null,
      "position_id": 123 | null,
      "confidence": 0.0-1.0,
      "size_fraction": 0.0-1.0,
      "reasoning": "..."
    }

Regla de oro: **ante cualquier fallo se devuelve HOLD**. Un bot que no entiende
la respuesta del modelo no opera; nunca opera a ciegas.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

from . import config, state

_PROMPT_FILE = Path(__file__).resolve().parent / "prompts" / "system_prompt.md"

VALID_ACTIONS = ("OPEN", "CLOSE", "HOLD")

_INSTRUCTION = """\
Eres el motor de decisión de un bot de trading spot. A continuación tienes, en
JSON, el estado de la cuenta y las métricas de mercado del ciclo actual.

Decide UNA sola acción para este ciclo y responde EXCLUSIVAMENTE con un objeto
JSON válido (sin markdown, sin texto antes ni después) con esta forma exacta:

{"action":"OPEN|CLOSE|HOLD","symbol":"PAR o null","position_id":numero o null,
 "confidence":0.0-1.0,"size_fraction":0.0-1.0,"reasoning":"1-3 frases en español"}

No uses herramientas ni leas archivos: razona solo sobre los datos de abajo.

### DATOS DEL CICLO
```json
{contexto}
```
"""


def _read_system_prompt() -> str:
    try:
        return _PROMPT_FILE.read_text(encoding="utf-8")
    except OSError as e:  # pragma: no cover - solo si falta el archivo
        state.add_log("warn", f"No se pudo leer el system prompt: {e}")
        return ""


def build_command(context: dict) -> list[str]:
    """
    Construye la línea de comandos de Claude Code.

    En Windows, si el ejecutable es un .cmd/.bat hay que invocarlo por `cmd /c`
    o Python no sabe lanzarlo.
    """
    args = [
        "-p", _INSTRUCTION.replace(
            "{contexto}", json.dumps(context, ensure_ascii=False, indent=1)
        ),
        "--output-format", "json",
        "--max-turns", "1",
    ]
    system_prompt = _read_system_prompt()
    if system_prompt:
        args += ["--append-system-prompt", system_prompt]
    if config.env.claude_model:
        args += ["--model", config.env.claude_model]
    args += list(config.env.claude_extra_args)

    binary = config.env.claude_bin
    resolved = shutil.which(binary) or binary
    if os.name == "nt" and resolved.lower().endswith((".cmd", ".bat")):
        return ["cmd", "/c", resolved, *args]
    return [resolved, *args]


def ask_decision(context: dict) -> dict:
    """Lanza Claude y devuelve la decisión ya normalizada (HOLD si algo falla)."""
    cmd = build_command(context)
    try:
        proc = subprocess.run(
            cmd,
            input="",
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=str(config.DECISION_WORKSPACE),
            timeout=config.env.claude_timeout,
        )
    except subprocess.TimeoutExpired:
        state.add_log("error",
                      f"Claude no respondió en {config.env.claude_timeout}s "
                      f"-> HOLD de seguridad")
        return hold("timeout llamando a Claude")
    except FileNotFoundError:
        state.add_log("error",
                      f"No se encontró el ejecutable de Claude "
                      f"('{config.env.claude_bin}'). Revisa CLAUDE_BIN en el .env.")
        return hold("claude no encontrado")
    except OSError as e:
        state.add_log("error", f"No se pudo lanzar Claude: {e}")
        return hold(f"error lanzando claude: {e}")

    if proc.returncode != 0:
        state.add_log("error",
                      f"Claude devolvió código {proc.returncode}: "
                      f"{(proc.stderr or '').strip()[:500]}")
        return hold(f"claude exit {proc.returncode}")

    return parse_output(proc.stdout)


# ---------------------------------------------------------------------------
#  Parseo robusto de la salida
# ---------------------------------------------------------------------------
def _extract_json_object(text: str) -> dict | None:
    """
    Saca el primer objeto JSON de un texto que puede venir con ruido:
    vallas ```json, frases antes/después, etc.
    """
    if not text:
        return None
    text = text.strip()
    try:
        obj = json.loads(text)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        pass

    # Búsqueda del primer objeto balanceado, ignorando llaves dentro de strings.
    start = text.find("{")
    while start != -1:
        depth, in_str, esc = 0, False, False
        for i in range(start, len(text)):
            ch = text[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    try:
                        obj = json.loads(text[start:i + 1])
                        if isinstance(obj, dict):
                            return obj
                    except json.JSONDecodeError:
                        break
        start = text.find("{", start + 1)
    return None


def _as_float(value: Any, default: float) -> float:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return default
    if num != num:  # NaN
        return default
    return num


def _as_int_or_none(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def normalize(raw: dict, cost_usd: float | None = None) -> dict:
    """Convierte la respuesta del modelo en una decisión con tipos seguros."""
    action = str(raw.get("action", "HOLD")).strip().upper()
    if action not in VALID_ACTIONS:
        action = "HOLD"

    symbol = raw.get("symbol")
    symbol = str(symbol).strip().upper() if isinstance(symbol, str) and symbol.strip() else None

    confidence = min(1.0, max(0.0, _as_float(raw.get("confidence"), 0.0)))
    size_fraction = min(1.0, max(0.0, _as_float(raw.get("size_fraction"), 1.0)))

    return {
        "action": action,
        "symbol": symbol,
        "position_id": _as_int_or_none(raw.get("position_id")),
        "confidence": confidence,
        "size_fraction": size_fraction,
        "reasoning": str(raw.get("reasoning", "") or "")[:1000],
        "_cost_usd": cost_usd,
    }


def parse_output(stdout: str) -> dict:
    """
    Interpreta la salida de `claude -p --output-format json`.

    Formato esperado: un JSON con, entre otros, `result` (el texto de la
    respuesta) y `total_cost_usd`. Se admite también `structured_output` por si
    se usa un esquema, y como último recurso se busca el objeto de decisión
    directamente en la salida.
    """
    envelope = _extract_json_object(stdout)
    if envelope is None:
        state.add_log("error", f"Salida de Claude no interpretable: {stdout[:300]}")
        return hold("salida no interpretable")

    cost = envelope.get("total_cost_usd")
    cost = cost if isinstance(cost, (int, float)) else None

    if envelope.get("is_error"):
        state.add_log("error", f"Claude devolvió error: {str(envelope.get('result'))[:300]}")
        return hold("claude devolvió is_error")

    candidate = envelope.get("structured_output")
    if not isinstance(candidate, dict):
        result_text = envelope.get("result")
        candidate = _extract_json_object(result_text) if isinstance(result_text, str) else None

    if not isinstance(candidate, dict):
        # ¿Y si la propia salida YA era la decisión, sin envoltorio?
        if "action" in envelope:
            candidate = envelope
        else:
            state.add_log("error",
                          f"No se encontró la decisión en la respuesta: {stdout[:300]}")
            return hold("sin decisión en la respuesta")

    return normalize(candidate, cost)


def hold(reason: str) -> dict:
    """Decisión segura por defecto."""
    return {
        "action": "HOLD",
        "symbol": None,
        "position_id": None,
        "confidence": 0.0,
        "size_fraction": 0.0,
        "reasoning": f"HOLD de seguridad: {reason}",
        "_cost_usd": None,
    }
