"""
config.py
=========
Configuración central del bot.

Hay dos niveles de configuración:

1) SECRETOS y valores de arranque -> vienen del archivo `.env` y NO se pueden
   cambiar en caliente: claves de API, testnet on/off, ruta de Claude, puerto…

2) PARÁMETROS de trading y riesgo -> tienen un valor por defecto aquí, se
   guardan en SQLite y se pueden editar EN CALIENTE desde el dashboard sin
   reiniciar nada. Cada parámetro lleva metadatos (tipo, rango, grupo, ayuda)
   que sirven a la vez para validar lo que llega del dashboard y para pintar
   el formulario de configuración.

El objeto `env` se carga una vez al arrancar. Los `settings` se releen de la BD
en cada ciclo del motor, así que un cambio en el panel se aplica al ciclo
siguiente.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

# --- Rutas -----------------------------------------------------------------
_BACKEND_DIR = Path(__file__).resolve().parents[1]
_PROJECT_DIR = _BACKEND_DIR.parent

load_dotenv(_BACKEND_DIR / ".env")

#: Carpeta aislada donde se ejecuta `claude -p` para tomar decisiones.
DECISION_WORKSPACE = (_PROJECT_DIR / "decision_workspace").resolve()

#: Archivo "kill switch": si existe, el bot NO abre posiciones nuevas.
KILL_SWITCH_FILE = Path(os.getenv("KILL_SWITCH_FILE") or (_BACKEND_DIR / "KILL_SWITCH"))

#: Base de datos SQLite (estado, operaciones, decisiones, logs, settings).
DB_PATH = Path(os.getenv("DB_PATH") or (_BACKEND_DIR / "bot_state.db"))

#: Dashboard compilado (si existe, lo sirve el propio backend).
FRONTEND_DIST = _PROJECT_DIR / "frontend" / "dist"


def _get_bool(name: str, default: bool) -> bool:
    val = os.getenv(name)
    if val is None or val.strip() == "":
        return default
    return val.strip().lower() in ("1", "true", "yes", "on", "si", "sí")


def _get_int(name: str, default: int) -> int:
    try:
        return int(str(os.getenv(name, default)).strip())
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class Env:
    """Configuración inmutable leída del .env al arrancar."""

    bybit_api_key: str
    bybit_api_secret: str
    bybit_testnet: bool

    claude_bin: str
    claude_model: str
    claude_timeout: int
    claude_extra_args: tuple[str, ...]

    api_host: str
    api_port: int
    api_token: str

    @classmethod
    def load(cls) -> "Env":
        extra = os.getenv("CLAUDE_EXTRA_ARGS", "").split()
        return cls(
            bybit_api_key=os.getenv("BYBIT_API_KEY", "").strip(),
            bybit_api_secret=os.getenv("BYBIT_API_SECRET", "").strip(),
            bybit_testnet=_get_bool("BYBIT_TESTNET", True),
            claude_bin=os.getenv("CLAUDE_BIN", "claude").strip() or "claude",
            claude_model=os.getenv("CLAUDE_MODEL", "").strip(),
            claude_timeout=max(15, _get_int("CLAUDE_TIMEOUT", 120)),
            claude_extra_args=tuple(extra),
            api_host=os.getenv("API_HOST", "127.0.0.1").strip() or "127.0.0.1",
            api_port=_get_int("API_PORT", 8000),
            api_token=os.getenv("API_TOKEN", "").strip(),
        )


env = Env.load()


def reload_env() -> Env:
    """Relee el .env (solo lo usan los tests; en marcha la config es inmutable)."""
    global env
    load_dotenv(_BACKEND_DIR / ".env", override=True)
    env = Env.load()
    return env


# ---------------------------------------------------------------------------
#  Parámetros de trading / riesgo editables en caliente.
#  Todos los importes monetarios van en la moneda de cotización (USDT).
#
#  Cada entrada:  default, type, group, label, help, y (opcional) min/max.
#  type ∈ {"bool", "int", "float", "str", "list_str", "choice"}
# ---------------------------------------------------------------------------
SETTINGS_SPEC: dict[str, dict[str, Any]] = {
    # --- Universo de mercados ---
    "symbols": {
        "default": ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
        "type": "list_str",
        "group": "Mercados",
        "label": "Pares vigilados",
        "help": "Pares spot que el bot observa y en los que puede operar.",
    },
    "quote_asset": {
        "default": "USDT",
        "type": "str",
        "group": "Mercados",
        "label": "Moneda de cotización",
        "help": "Moneda con la que se compra (debe coincidir con el sufijo de los pares).",
    },

    # --- Encendido general ---
    "bot_enabled": {
        "default": True,
        "type": "bool",
        "group": "Operativa",
        "label": "Bot habilitado",
        "help": "Si está en false el bot observa y decide, pero no abre posiciones.",
    },

    # --- Tamaño de posición ---
    "position_size_pct": {
        "default": 10.0, "type": "float", "min": 0.1, "max": 100.0,
        "group": "Tamaño de posición",
        "label": "% del saldo por operación",
        "help": "Porcentaje del saldo disponible que se invierte en cada compra.",
    },
    "max_position_usdt": {
        "default": 200.0, "type": "float", "min": 1.0, "max": 1_000_000.0,
        "group": "Tamaño de posición",
        "label": "Tope por operación (USDT)",
        "help": "Nunca se invierte más de este importe en una sola operación.",
    },
    "min_position_usdt": {
        "default": 10.0, "type": "float", "min": 1.0, "max": 1_000_000.0,
        "group": "Tamaño de posición",
        "label": "Mínimo por operación (USDT)",
        "help": "Por debajo de este importe no se opera (Bybit rechaza órdenes pequeñas).",
    },

    # --- Límites de exposición ---
    "max_open_positions": {
        "default": 3, "type": "int", "min": 1, "max": 50,
        "group": "Límites de exposición",
        "label": "Máx. posiciones simultáneas",
        "help": "Número máximo de posiciones abiertas a la vez.",
    },
    "max_trades_per_day": {
        "default": 20, "type": "int", "min": 1, "max": 500,
        "group": "Límites de exposición",
        "label": "Máx. operaciones al día",
        "help": "Tope de posiciones ABIERTAS en un mismo día (UTC).",
    },
    "min_trades_target": {
        "default": 10, "type": "int", "min": 0, "max": 500,
        "group": "Límites de exposición",
        "label": "Objetivo de operaciones/día",
        "help": "Solo informativo: se le muestra al LLM, nunca fuerza a operar.",
    },

    # --- Salidas automáticas (las ejecuta el código, no el LLM) ---
    "take_profit_pct": {
        "default": 2.5, "type": "float", "min": 0.1, "max": 100.0,
        "group": "Salidas automáticas",
        "label": "Take-profit (%)",
        "help": "Se cierra la posición al alcanzar esta ganancia.",
    },
    "stop_loss_pct": {
        "default": 1.5, "type": "float", "min": 0.1, "max": 100.0,
        "group": "Salidas automáticas",
        "label": "Stop-loss (%)",
        "help": "Se cierra la posición al alcanzar esta pérdida.",
    },
    "max_hold_minutes": {
        "default": 720, "type": "int", "min": 1, "max": 100_000,
        "group": "Salidas automáticas",
        "label": "Tiempo máx. en posición (min)",
        "help": "Pasado este tiempo la posición se cierra a mercado.",
    },
    "trailing_stop_pct": {
        "default": 0.0, "type": "float", "min": 0.0, "max": 100.0,
        "group": "Salidas automáticas",
        "label": "Trailing stop (%) — 0 = desactivado",
        "help": "Si >0, se cierra cuando el precio cae ese % desde el máximo alcanzado.",
    },

    # --- Cortacircuitos de pérdidas ---
    "max_daily_loss_pct": {
        "default": 5.0, "type": "float", "min": 0.1, "max": 100.0,
        "group": "Cortacircuitos",
        "label": "Pérdida diaria máx. (% del saldo)",
        "help": "Si el PnL neto del día cae por debajo, deja de abrir hasta mañana.",
    },
    "max_daily_loss_usdt": {
        "default": 100.0, "type": "float", "min": 1.0, "max": 1_000_000.0,
        "group": "Cortacircuitos",
        "label": "Pérdida diaria máx. (USDT)",
        "help": "Mismo cortacircuitos en importe fijo. Se aplica el más restrictivo.",
    },

    # --- Filtro de confianza del LLM ---
    "min_confidence_open": {
        "default": 0.62, "type": "float", "min": 0.0, "max": 1.0,
        "group": "Confianza del LLM",
        "label": "Confianza mínima para ABRIR",
        "help": "Por debajo de este valor la propuesta de apertura se veta.",
    },
    "min_confidence_close": {
        "default": 0.55, "type": "float", "min": 0.0, "max": 1.0,
        "group": "Confianza del LLM",
        "label": "Confianza mínima para CERRAR",
        "help": "Por debajo de este valor no se cierra anticipadamente por el LLM.",
    },

    # --- Cadencia del motor (modo híbrido por eventos) ---
    "poll_interval_sec": {
        "default": 60, "type": "int", "min": 5, "max": 3600,
        "group": "Cadencia",
        "label": "Latido del bucle (s)",
        "help": "Cada cuántos segundos se refrescan métricas y salidas automáticas.",
    },
    "routine_decision_every_n_polls": {
        "default": 5, "type": "int", "min": 1, "max": 1000,
        "group": "Cadencia",
        "label": "Decisión de rutina cada N latidos",
        "help": "Aunque no haya eventos, se consulta al LLM cada N ciclos.",
    },
    "event_price_move_pct": {
        "default": 0.8, "type": "float", "min": 0.05, "max": 50.0,
        "group": "Cadencia",
        "label": "Movimiento que dispara evento (%)",
        "help": "Variación de precio entre latidos que provoca una decisión inmediata.",
    },
    "decision_cooldown_sec": {
        "default": 90, "type": "int", "min": 0, "max": 86_400,
        "group": "Cadencia",
        "label": "Enfriamiento entre decisiones (s)",
        "help": "Tiempo mínimo entre dos llamadas al LLM por el mismo símbolo.",
    },

    # --- Indicadores técnicos ---
    "kline_interval": {
        "default": "5", "type": "choice",
        "choices": ["1", "3", "5", "15", "30", "60", "120", "240", "360", "720", "D"],
        "group": "Indicadores",
        "label": "Temporalidad de las velas (min)",
        "help": "Intervalo de las velas que alimentan los indicadores.",
    },
    "kline_limit": {
        "default": 200, "type": "int", "min": 50, "max": 1000,
        "group": "Indicadores",
        "label": "Nº de velas a descargar",
        "help": "Cuantas más velas, más contexto histórico para los indicadores.",
    },
    "rsi_period": {
        "default": 14, "type": "int", "min": 2, "max": 100,
        "group": "Indicadores", "label": "Periodo RSI", "help": "Periodo del RSI.",
    },
    "ema_fast": {
        "default": 9, "type": "int", "min": 2, "max": 200,
        "group": "Indicadores", "label": "EMA rápida", "help": "Periodo de la EMA rápida.",
    },
    "ema_slow": {
        "default": 21, "type": "int", "min": 3, "max": 400,
        "group": "Indicadores", "label": "EMA lenta", "help": "Periodo de la EMA lenta.",
    },
    "atr_period": {
        "default": 14, "type": "int", "min": 2, "max": 100,
        "group": "Indicadores", "label": "Periodo ATR", "help": "Periodo del ATR (volatilidad).",
    },
}

DEFAULT_SETTINGS: dict[str, Any] = {k: v["default"] for k, v in SETTINGS_SPEC.items()}

#: Orden en el que se agrupan los parámetros en el dashboard.
SETTINGS_GROUPS: list[str] = []
for _spec in SETTINGS_SPEC.values():
    if _spec["group"] not in SETTINGS_GROUPS:
        SETTINGS_GROUPS.append(_spec["group"])


class SettingError(ValueError):
    """Un valor de configuración no es válido."""


def coerce_setting(key: str, value: Any) -> Any:
    """
    Valida y normaliza un valor de configuración que llega del dashboard.

    Devuelve el valor ya con el tipo correcto o lanza SettingError con un
    mensaje entendible por una persona.
    """
    spec = SETTINGS_SPEC.get(key)
    if spec is None:
        raise SettingError(f"parámetro desconocido: '{key}'")

    kind = spec["type"]

    if kind == "bool":
        if isinstance(value, bool):
            return value
        if isinstance(value, str) and value.strip().lower() in ("true", "false"):
            return value.strip().lower() == "true"
        raise SettingError(f"'{key}' debe ser true o false")

    if kind in ("int", "float"):
        if isinstance(value, bool) or not isinstance(value, (int, float, str)):
            raise SettingError(f"'{key}' debe ser un número")
        try:
            num = float(value)
        except (TypeError, ValueError):
            raise SettingError(f"'{key}' debe ser un número, llegó {value!r}") from None
        if num != num or num in (float("inf"), float("-inf")):
            raise SettingError(f"'{key}' debe ser un número finito")
        if kind == "int":
            if float(num).is_integer():
                num = int(num)
            else:
                raise SettingError(f"'{key}' debe ser un número entero")
        lo, hi = spec.get("min"), spec.get("max")
        if lo is not None and num < lo:
            raise SettingError(f"'{key}' debe ser >= {lo}")
        if hi is not None and num > hi:
            raise SettingError(f"'{key}' debe ser <= {hi}")
        return num

    if kind == "str":
        if not isinstance(value, str) or not value.strip():
            raise SettingError(f"'{key}' debe ser un texto no vacío")
        return value.strip().upper() if key == "quote_asset" else value.strip()

    if kind == "choice":
        val = str(value).strip()
        if val not in spec["choices"]:
            raise SettingError(f"'{key}' debe ser uno de: {', '.join(spec['choices'])}")
        return val

    if kind == "list_str":
        if isinstance(value, str):
            value = [p.strip() for p in value.split(",")]
        if not isinstance(value, list):
            raise SettingError(f"'{key}' debe ser una lista")
        items = [str(v).strip().upper() for v in value if str(v).strip()]
        if not items:
            raise SettingError(f"'{key}' no puede quedar vacío")
        if len(set(items)) != len(items):
            raise SettingError(f"'{key}' contiene símbolos repetidos")
        for item in items:
            if not item.isalnum():
                raise SettingError(f"símbolo no válido: '{item}'")
        return items

    raise SettingError(f"tipo de parámetro no soportado: {kind}")  # pragma: no cover


def cross_validate(settings: dict[str, Any]) -> None:
    """Comprobaciones que afectan a varios parámetros a la vez."""
    if settings["min_position_usdt"] > settings["max_position_usdt"]:
        raise SettingError(
            "'min_position_usdt' no puede ser mayor que 'max_position_usdt'"
        )
    if settings["ema_fast"] >= settings["ema_slow"]:
        raise SettingError("'ema_fast' debe ser menor que 'ema_slow'")
    quote = settings["quote_asset"]
    malos = [s for s in settings["symbols"] if not s.endswith(quote)]
    if malos:
        raise SettingError(
            f"estos pares no terminan en {quote}: {', '.join(malos)}"
        )
