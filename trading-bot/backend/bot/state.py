"""
state.py
========
Toda la persistencia del bot en un único archivo SQLite (`bot_state.db`).

Guarda:
  - settings   -> parámetros editables en caliente (overlay sobre los defaults)
  - positions  -> posiciones abiertas y cerradas, con PnL neto de comisiones
  - decisions  -> cada decisión del LLM (para auditar POR QUÉ operó)
  - logs       -> eventos legibles desde el dashboard
  - daily      -> contabilidad del día (saldo inicial, PnL realizado, nº ops)

Es deliberadamente simple y sin dependencias: SQLite sobra para 10-20
operaciones al día y hace el bot 100% portable (un archivo y listo).
"""
from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Any

from . import config

_lock = threading.RLock()
_conn: sqlite3.Connection | None = None

#: Máximo de líneas de log que se conservan (se podan las más viejas).
MAX_LOG_ROWS = 5_000


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def get_conn() -> sqlite3.Connection:
    global _conn
    with _lock:
        if _conn is None:
            config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
            _conn = sqlite3.connect(config.DB_PATH, check_same_thread=False)
            _conn.row_factory = sqlite3.Row
            _conn.execute("PRAGMA journal_mode=WAL")
            _conn.execute("PRAGMA synchronous=NORMAL")
        return _conn


def close_conn() -> None:
    """Cierra la conexión (lo usan los tests y el apagado limpio)."""
    global _conn
    with _lock:
        if _conn is not None:
            _conn.close()
            _conn = None


_SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS positions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol        TEXT    NOT NULL,
    side          TEXT    NOT NULL,   -- siempre 'Buy': spot largo
    qty           REAL    NOT NULL,   -- cantidad del activo base
    entry_price   REAL    NOT NULL,
    entry_usdt    REAL    NOT NULL,   -- USDT realmente gastados
    entry_fee     REAL    DEFAULT 0,   -- comisión de compra YA en moneda de cotización
    fee_currency  TEXT,                -- moneda en la que Bybit la cobró (auditoría)
    opened_at     TEXT    NOT NULL,
    status        TEXT    NOT NULL,   -- 'open' | 'closed'
    closing       INTEGER DEFAULT 0,  -- 1 mientras se está ejecutando la venta
    peak_price    REAL,               -- máximo visto (para el trailing stop)
    close_price   REAL,
    closed_at     TEXT,
    exit_fee      REAL    DEFAULT 0,
    pnl_usdt      REAL,               -- neto de comisiones
    pnl_pct       REAL,
    close_reason  TEXT,               -- take_profit|stop_loss|trailing_stop|timeout|llm|manual
    order_id      TEXT,
    close_order_id TEXT,
    decision_id   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE TABLE IF NOT EXISTS decisions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          TEXT NOT NULL,
    trigger     TEXT,                 -- 'routine' | 'event' | 'manual'
    symbol      TEXT,
    action      TEXT,                 -- 'OPEN' | 'CLOSE' | 'HOLD'
    confidence  REAL,
    reasoning   TEXT,
    raw_json    TEXT,
    applied     INTEGER DEFAULT 0,    -- 1 si el código llegó a ejecutarla
    veto_reason TEXT                  -- por qué la vetó el motor de riesgo
);
CREATE TABLE IF NOT EXISTS logs (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    ts      TEXT NOT NULL,
    level   TEXT NOT NULL,            -- info | warn | error | trade
    message TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS daily (
    date          TEXT PRIMARY KEY,
    start_balance REAL,
    realized_pnl  REAL    DEFAULT 0,
    trades_opened INTEGER DEFAULT 0
);
"""


def init_db() -> None:
    with _lock:
        c = get_conn()
        c.executescript(_SCHEMA)
        c.commit()


# ---------------------------------------------------------------------------
#  Settings (overlay sobre los valores por defecto)
# ---------------------------------------------------------------------------
def get_settings() -> dict[str, Any]:
    """Defaults combinados con las overrides guardadas en la BD."""
    with _lock:
        rows = get_conn().execute("SELECT key, value FROM settings").fetchall()
    merged = dict(config.DEFAULT_SETTINGS)
    for r in rows:
        if r["key"] in config.SETTINGS_SPEC:  # ignora claves obsoletas
            try:
                merged[r["key"]] = json.loads(r["value"])
            except json.JSONDecodeError:
                continue
    return merged


def set_settings(values: dict[str, Any]) -> dict[str, Any]:
    """
    Valida y guarda un lote de parámetros de forma ATÓMICA: si alguno es
    inválido no se guarda ninguno. Devuelve los valores aplicados.

    Lanza config.SettingError con un mensaje legible si algo no cuadra.
    """
    coerced = {k: config.coerce_setting(k, v) for k, v in values.items()}
    config.cross_validate({**get_settings(), **coerced})
    with _lock:
        c = get_conn()
        with c:  # transacción
            for key, val in coerced.items():
                c.execute(
                    "INSERT INTO settings(key, value) VALUES(?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                    (key, json.dumps(val)),
                )
    return coerced


def set_setting(key: str, value: Any) -> Any:
    """Atajo para un único parámetro."""
    return set_settings({key: value})[key]


def reset_settings() -> None:
    with _lock:
        c = get_conn()
        with c:
            c.execute("DELETE FROM settings")


# ---------------------------------------------------------------------------
#  Posiciones
# ---------------------------------------------------------------------------
def add_position(symbol: str, side: str, qty: float, entry_price: float,
                 entry_usdt: float, order_id: str | None,
                 decision_id: int | None, entry_fee: float = 0.0,
                 fee_currency: str | None = None) -> int:
    with _lock:
        c = get_conn()
        with c:
            c.execute(
                "INSERT OR IGNORE INTO daily(date, start_balance, realized_pnl, "
                "trades_opened) VALUES(?, NULL, 0, 0)", (_today(),),
            )
            cur = c.execute(
                "INSERT INTO positions(symbol, side, qty, entry_price, entry_usdt, "
                "entry_fee, fee_currency, opened_at, status, closing, peak_price, "
                "order_id, decision_id) VALUES(?,?,?,?,?,?,?,?,'open',0,?,?,?)",
                (symbol, side, qty, entry_price, entry_usdt, entry_fee, fee_currency,
                 _now(), entry_price, order_id, decision_id),
            )
            c.execute(
                "UPDATE daily SET trades_opened = COALESCE(trades_opened,0) + 1 "
                "WHERE date=?",
                (_today(),),
            )
        return int(cur.lastrowid)


def update_peak_price(pos_id: int, price: float) -> None:
    """Sube la marca de agua del trailing stop (nunca baja)."""
    with _lock:
        c = get_conn()
        with c:
            c.execute(
                "UPDATE positions SET peak_price = MAX(COALESCE(peak_price, 0), ?) "
                "WHERE id=? AND status='open'",
                (price, pos_id),
            )


def claim_position_for_close(pos_id: int) -> dict | None:
    """
    Reserva una posición para venderla, de forma atómica.

    Devuelve la posición si esta llamada ha ganado la carrera, o None si ya
    estaba cerrada o si otro camino (salida automática, cierre manual desde el
    panel, decisión del LLM) la está vendiendo ya. Sin esto, dos caminos
    simultáneos podrían mandar DOS ventas a mercado de la misma posición.
    """
    with _lock:
        c = get_conn()
        with c:
            cur = c.execute(
                "UPDATE positions SET closing=1 "
                "WHERE id=? AND status='open' AND COALESCE(closing,0)=0",
                (pos_id,),
            )
            if cur.rowcount != 1:
                return None
            row = c.execute("SELECT * FROM positions WHERE id=?", (pos_id,)).fetchone()
    return dict(row) if row else None


def release_position(pos_id: int) -> None:
    """Libera una reserva cuando la venta no ha llegado a ejecutarse."""
    with _lock:
        c = get_conn()
        with c:
            c.execute("UPDATE positions SET closing=0 WHERE id=? AND status='open'",
                      (pos_id,))


def close_position(pos_id: int, close_price: float, close_reason: str,
                   exit_fee: float = 0.0, close_order_id: str | None = None,
                   qty_sold: float | None = None) -> dict | None:
    """
    Marca la posición como cerrada y calcula el PnL NETO de comisiones.

    Devuelve la fila resultante, o None si la posición ya no estaba abierta
    (protege contra cierres duplicados desde el panel y el motor a la vez).
    """
    with _lock:
        c = get_conn()
        with c:
            row = c.execute(
                "SELECT * FROM positions WHERE id=? AND status='open'", (pos_id,)
            ).fetchone()
            if row is None:
                return None

            qty = qty_sold if qty_sold is not None else row["qty"]
            gross_out = close_price * qty
            # `entry_fee` y `exit_fee` llegan YA convertidos a la moneda de
            # cotización por el executor (ver executor.quote_fee): cuando Bybit
            # cobra la comisión en el activo base su efecto ya está en `qty`,
            # así que allí se guarda 0 y aquí no hay nada que descontar.
            entry_fee = row["entry_fee"] or 0.0
            pnl_usdt = gross_out - row["entry_usdt"] - entry_fee - exit_fee
            pnl_pct = (pnl_usdt / row["entry_usdt"] * 100.0) if row["entry_usdt"] else 0.0

            c.execute(
                "UPDATE positions SET status='closed', closing=0, close_price=?, "
                "closed_at=?, exit_fee=?, pnl_usdt=?, pnl_pct=?, close_reason=?, "
                "close_order_id=? WHERE id=?",
                (close_price, _now(), exit_fee, pnl_usdt, pnl_pct, close_reason,
                 close_order_id, pos_id),
            )
            c.execute(
                "INSERT OR IGNORE INTO daily(date, start_balance, realized_pnl, "
                "trades_opened) VALUES(?, NULL, 0, 0)", (_today(),),
            )
            c.execute(
                "UPDATE daily SET realized_pnl = COALESCE(realized_pnl,0) + ? WHERE date=?",
                (pnl_usdt, _today()),
            )

        result = dict(row)
        result.update(
            status="closed", close_price=close_price, closed_at=_now(),
            exit_fee=exit_fee, pnl_usdt=pnl_usdt, pnl_pct=pnl_pct,
            close_reason=close_reason, close_order_id=close_order_id,
        )
        return result


def get_open_positions() -> list[dict]:
    with _lock:
        rows = get_conn().execute(
            "SELECT * FROM positions WHERE status='open' ORDER BY id"
        ).fetchall()
    return [dict(r) for r in rows]


def get_position(pos_id: int) -> dict | None:
    with _lock:
        row = get_conn().execute("SELECT * FROM positions WHERE id=?", (pos_id,)).fetchone()
    return dict(row) if row else None


def get_open_position_for(symbol: str) -> dict | None:
    with _lock:
        row = get_conn().execute(
            "SELECT * FROM positions WHERE symbol=? AND status='open' ORDER BY id LIMIT 1",
            (symbol,),
        ).fetchone()
    return dict(row) if row else None


def get_recent_trades(limit: int = 50) -> list[dict]:
    with _lock:
        rows = get_conn().execute(
            "SELECT * FROM positions WHERE status='closed' ORDER BY id DESC LIMIT ?",
            (int(limit),),
        ).fetchall()
    return [dict(r) for r in rows]


def get_performance() -> dict:
    """Resumen histórico de la operativa (para el panel de rendimiento)."""
    with _lock:
        row = get_conn().execute(
            "SELECT COUNT(*) AS n, "
            "       COALESCE(SUM(pnl_usdt), 0) AS total, "
            "       COALESCE(SUM(CASE WHEN pnl_usdt > 0 THEN 1 ELSE 0 END), 0) AS wins, "
            "       COALESCE(AVG(CASE WHEN pnl_usdt > 0 THEN pnl_usdt END), 0) AS avg_win, "
            "       COALESCE(AVG(CASE WHEN pnl_usdt <= 0 THEN pnl_usdt END), 0) AS avg_loss, "
            "       COALESCE(MAX(pnl_usdt), 0) AS best, "
            "       COALESCE(MIN(pnl_usdt), 0) AS worst "
            "FROM positions WHERE status='closed'"
        ).fetchone()
    n = row["n"] or 0
    return {
        "closed_trades": n,
        "total_pnl_usdt": round(row["total"] or 0.0, 4),
        "wins": row["wins"] or 0,
        "losses": n - (row["wins"] or 0),
        "win_rate_pct": round((row["wins"] or 0) / n * 100.0, 1) if n else 0.0,
        "avg_win_usdt": round(row["avg_win"] or 0.0, 4),
        "avg_loss_usdt": round(row["avg_loss"] or 0.0, 4),
        "best_usdt": round(row["best"] or 0.0, 4),
        "worst_usdt": round(row["worst"] or 0.0, 4),
    }


# ---------------------------------------------------------------------------
#  Decisiones del LLM
# ---------------------------------------------------------------------------
def record_decision(trigger: str, symbol: str | None, action: str, confidence: float,
                    reasoning: str, raw_json: str, applied: int = 0,
                    veto_reason: str | None = None) -> int:
    with _lock:
        c = get_conn()
        with c:
            cur = c.execute(
                "INSERT INTO decisions(ts, trigger, symbol, action, confidence, "
                "reasoning, raw_json, applied, veto_reason) VALUES(?,?,?,?,?,?,?,?,?)",
                (_now(), trigger, symbol, action, confidence, reasoning, raw_json,
                 applied, veto_reason),
            )
        return int(cur.lastrowid)


def mark_decision_applied(decision_id: int, applied: int,
                          veto_reason: str | None = None) -> None:
    with _lock:
        c = get_conn()
        with c:
            c.execute(
                "UPDATE decisions SET applied=?, veto_reason=? WHERE id=?",
                (applied, veto_reason, decision_id),
            )


def get_recent_decisions(limit: int = 50) -> list[dict]:
    with _lock:
        rows = get_conn().execute(
            "SELECT * FROM decisions ORDER BY id DESC LIMIT ?", (int(limit),)
        ).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
#  Logs
# ---------------------------------------------------------------------------
def add_log(level: str, message: str) -> None:
    with _lock:
        c = get_conn()
        with c:
            c.execute("INSERT INTO logs(ts, level, message) VALUES(?,?,?)",
                      (_now(), level, message))
            c.execute(
                "DELETE FROM logs WHERE id <= "
                "(SELECT MAX(id) - ? FROM logs)", (MAX_LOG_ROWS,)
            )
    print(f"[{level.upper()}] {message}", flush=True)


def get_recent_logs(limit: int = 100) -> list[dict]:
    with _lock:
        rows = get_conn().execute(
            "SELECT * FROM logs ORDER BY id DESC LIMIT ?", (int(limit),)
        ).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
#  Contabilidad diaria (base del cortacircuitos de pérdidas)
# ---------------------------------------------------------------------------
def ensure_daily(start_balance: float | None) -> dict:
    """Crea la fila del día si no existe, fijando el saldo inicial."""
    with _lock:
        c = get_conn()
        with c:
            c.execute(
                "INSERT OR IGNORE INTO daily(date, start_balance, realized_pnl, "
                "trades_opened) VALUES(?,?,0,0)",
                (_today(), start_balance),
            )
            # Si el saldo inicial se guardó como NULL (p.ej. fallo de red al
            # arrancar), lo rellenamos en cuanto tengamos un valor bueno.
            if start_balance is not None:
                c.execute(
                    "UPDATE daily SET start_balance=? WHERE date=? AND start_balance IS NULL",
                    (start_balance, _today()),
                )
        row = c.execute("SELECT * FROM daily WHERE date=?", (_today(),)).fetchone()
    return dict(row)


def get_daily() -> dict:
    with _lock:
        row = get_conn().execute("SELECT * FROM daily WHERE date=?", (_today(),)).fetchone()
    if row is None:
        return {"date": _today(), "start_balance": None, "realized_pnl": 0.0,
                "trades_opened": 0}
    return dict(row)


def get_daily_history(limit: int = 30) -> list[dict]:
    with _lock:
        rows = get_conn().execute(
            "SELECT * FROM daily ORDER BY date DESC LIMIT ?", (int(limit),)
        ).fetchall()
    return [dict(r) for r in rows]
