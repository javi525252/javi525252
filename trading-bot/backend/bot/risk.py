"""
risk.py
=======
EL MURO DE CONTENCIÓN. El LLM propone; este módulo dispone.

Ninguna operación llega al exchange sin pasar por aquí. Estas comprobaciones
son deterministas (código, no IA) y son la razón por la que un bot autónomo
guiado por un LLM puede ser razonablemente seguro: aunque el modelo alucine una
señal, la pérdida está acotada por reglas duras.

ABRIR (OPEN) exige:
  - bot habilitado y kill switch inactivo
  - confianza del LLM por encima del umbral
  - hueco de posiciones (max_open_positions)
  - ninguna posición abierta ya en ese símbolo
  - no haber agotado el cupo de operaciones del día
  - cortacircuitos de pérdidas diarias NO disparado
  - saldo suficiente y un importe dentro de [mínimo, máximo]

CERRAR (CLOSE) exige:
  - confianza por encima del umbral de cierre
  - que la posición exista y siga abierta
"""
from __future__ import annotations

from dataclasses import dataclass

from . import config, state


@dataclass
class RiskVerdict:
    """Resultado de evaluar una propuesta del LLM."""
    allowed: bool
    reason: str
    quote_usdt: float = 0.0          # importe a gastar (solo OPEN)
    position_id: int | None = None   # posición a cerrar (solo CLOSE)


def kill_switch_active() -> bool:
    return config.KILL_SWITCH_FILE.exists()


def set_kill_switch(on: bool) -> None:
    if on:
        config.KILL_SWITCH_FILE.parent.mkdir(parents=True, exist_ok=True)
        config.KILL_SWITCH_FILE.touch()
    else:
        config.KILL_SWITCH_FILE.unlink(missing_ok=True)


def daily_loss_tripped(settings: dict) -> tuple[bool, str]:
    """¿Está disparado el cortacircuitos de pérdidas del día?"""
    daily = state.get_daily()
    realized = daily.get("realized_pnl") or 0.0
    start_bal = daily.get("start_balance")

    limit_usdt = abs(settings["max_daily_loss_usdt"])
    if realized <= -limit_usdt:
        return True, f"pérdida diaria {realized:.2f} USDT <= -{limit_usdt:.2f} USDT"

    if start_bal:
        limit_pct_usdt = abs(start_bal * settings["max_daily_loss_pct"] / 100.0)
        if realized <= -limit_pct_usdt:
            return True, (f"pérdida diaria {realized:.2f} USDT <= "
                          f"-{settings['max_daily_loss_pct']}% del saldo inicial "
                          f"({limit_pct_usdt:.2f} USDT)")
    return False, ""


def position_size(settings: dict, available_quote: float,
                  size_fraction: float = 1.0) -> float:
    """Importe en USDT que corresponde a una operación, ya recortado por topes."""
    base = available_quote * settings["position_size_pct"] / 100.0
    amount = min(base, settings["max_position_usdt"])
    amount *= max(0.0, min(1.0, size_fraction))
    return round(amount, 2)


def evaluate_open(decision: dict, settings: dict, available_quote: float) -> RiskVerdict:
    symbol = decision.get("symbol")

    if not settings["bot_enabled"]:
        return RiskVerdict(False, "bot en pausa (bot_enabled = false)")
    if kill_switch_active():
        return RiskVerdict(False, "KILL SWITCH activo")
    if not symbol or symbol not in settings["symbols"]:
        return RiskVerdict(False, f"símbolo no vigilado: {symbol}")
    if decision["confidence"] < settings["min_confidence_open"]:
        return RiskVerdict(
            False,
            f"confianza {decision['confidence']:.2f} < umbral "
            f"{settings['min_confidence_open']}",
        )

    open_positions = state.get_open_positions()
    if len(open_positions) >= settings["max_open_positions"]:
        return RiskVerdict(
            False, f"máx. de posiciones simultáneas alcanzado "
                   f"({settings['max_open_positions']})")
    if any(p["symbol"] == symbol for p in open_positions):
        return RiskVerdict(False, f"ya hay una posición abierta en {symbol}")

    daily = state.get_daily()
    if (daily.get("trades_opened") or 0) >= settings["max_trades_per_day"]:
        return RiskVerdict(
            False, f"máx. de operaciones del día alcanzado "
                   f"({settings['max_trades_per_day']})")

    tripped, why = daily_loss_tripped(settings)
    if tripped:
        return RiskVerdict(False, f"cortacircuitos de pérdidas: {why}")

    quote_usdt = position_size(settings, available_quote,
                               decision.get("size_fraction", 1.0))
    if quote_usdt < settings["min_position_usdt"]:
        return RiskVerdict(
            False, f"importe calculado {quote_usdt:.2f} USDT < mínimo "
                   f"{settings['min_position_usdt']} USDT")
    if quote_usdt > available_quote:
        return RiskVerdict(False, f"saldo insuficiente ({available_quote:.2f} USDT)")

    return RiskVerdict(True, "ok", quote_usdt=quote_usdt)


def evaluate_close(decision: dict, settings: dict) -> RiskVerdict:
    if decision["confidence"] < settings["min_confidence_close"]:
        return RiskVerdict(
            False, f"confianza de cierre {decision['confidence']:.2f} < umbral "
                   f"{settings['min_confidence_close']}")

    pos = None
    pid = decision.get("position_id")
    if pid is not None:
        pos = next((p for p in state.get_open_positions() if p["id"] == pid), None)
    if pos is None and decision.get("symbol"):
        pos = state.get_open_position_for(decision["symbol"])
    if pos is None:
        return RiskVerdict(False, "no existe una posición abierta que cerrar")

    return RiskVerdict(True, "ok", position_id=pos["id"])
