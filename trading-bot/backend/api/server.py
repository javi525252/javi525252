"""
api/server.py
=============
API FastAPI + WebSocket que expone el bot al dashboard.

- REST para consultar estado, operaciones, decisiones, logs y editar la config.
- WebSocket (/ws) que emite el estado completo en tiempo real en cada ciclo.
- Todo protegido con un token simple (cabecera X-API-Token, o ?token= en el WS).
- Sirve el dashboard compilado (frontend/dist) si existe, para tenerlo todo en
  un único proceso.

El motor del bot arranca como tarea de fondo al iniciar el servidor.
"""
from __future__ import annotations

import asyncio
import contextlib
import secrets

from fastapi import (Depends, FastAPI, Header, HTTPException, Query, WebSocket,
                     WebSocketDisconnect)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from bot import config, risk, state
from bot.engine import engine


def check_token(x_api_token: str | None = Header(default=None)) -> None:
    """Autenticación simple para la API local."""
    expected = config.env.api_token
    if not expected:
        return  # sin token configurado: API abierta (solo para pruebas locales)
    if not x_api_token or not secrets.compare_digest(x_api_token, expected):
        raise HTTPException(status_code=401, detail="Token inválido")


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    state.init_db()
    if not config.env.api_token:
        state.add_log("warn", "API_TOKEN vacío: la API local está SIN protección")
    task = asyncio.create_task(engine.run())
    try:
        yield
    finally:
        engine.stop()
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        state.close_conn()


app = FastAPI(title="Trading Bot API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Modelos ---------------------------------------------------------------
class SettingsUpdate(BaseModel):
    values: dict = Field(default_factory=dict)


class KillSwitchBody(BaseModel):
    on: bool


# --- REST ------------------------------------------------------------------
@app.get("/api/health")
def health():
    """Sin token: sirve para comprobar que el backend está vivo."""
    return {"ok": True, "running": engine.running, "testnet": config.env.bybit_testnet}


@app.get("/api/status", dependencies=[Depends(check_token)])
def get_status():
    return engine.snapshot()


@app.get("/api/trades", dependencies=[Depends(check_token)])
def get_trades(limit: int = Query(50, ge=1, le=500)):
    return state.get_recent_trades(limit)


@app.get("/api/decisions", dependencies=[Depends(check_token)])
def get_decisions(limit: int = Query(50, ge=1, le=500)):
    return state.get_recent_decisions(limit)


@app.get("/api/logs", dependencies=[Depends(check_token)])
def get_logs(limit: int = Query(100, ge=1, le=1000)):
    return state.get_recent_logs(limit)


@app.get("/api/performance", dependencies=[Depends(check_token)])
def get_performance(days: int = Query(30, ge=1, le=365)):
    return {"summary": state.get_performance(), "daily": state.get_daily_history(days)}


@app.get("/api/settings", dependencies=[Depends(check_token)])
def get_settings():
    """Valores actuales + metadatos (tipo, rango, grupo, ayuda) para el panel."""
    return {
        "values": state.get_settings(),
        "defaults": config.DEFAULT_SETTINGS,
        "spec": config.SETTINGS_SPEC,
        "groups": config.SETTINGS_GROUPS,
    }


@app.post("/api/settings", dependencies=[Depends(check_token)])
def update_settings(body: SettingsUpdate):
    """
    Guarda parámetros de forma atómica: si alguno no es válido no se guarda
    ninguno y se devuelve el motivo en claro.
    """
    if not body.values:
        raise HTTPException(status_code=400, detail="No se envió ningún parámetro")
    try:
        applied = state.set_settings(body.values)
    except config.SettingError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
    state.add_log("info", f"Configuración actualizada: {', '.join(sorted(applied))}")
    return {"applied": applied, "values": state.get_settings()}


@app.post("/api/settings/reset", dependencies=[Depends(check_token)])
def reset_settings():
    state.reset_settings()
    state.add_log("warn", "Configuración restaurada a los valores por defecto")
    return {"values": state.get_settings()}


@app.post("/api/decide-now", dependencies=[Depends(check_token)])
def decide_now():
    engine.request_manual_decision()
    return {"ok": True, "message": "Decisión solicitada para el próximo ciclo"}


@app.post("/api/positions/{pos_id}/close", dependencies=[Depends(check_token)])
async def close_position(pos_id: int):
    result = await engine.manual_close(pos_id)
    if result is None:
        raise HTTPException(status_code=404,
                            detail="Posición no encontrada, ya cerrada o venta rechazada")
    return result


@app.post("/api/kill-switch", dependencies=[Depends(check_token)])
def kill_switch(body: KillSwitchBody):
    risk.set_kill_switch(body.on)
    if body.on:
        state.add_log("warn", "KILL SWITCH ACTIVADO — no se abrirán posiciones nuevas")
    else:
        state.add_log("info", "Kill switch desactivado")
    engine.broadcast()
    return {"kill_switch": risk.kill_switch_active()}


# --- WebSocket -------------------------------------------------------------
@app.websocket("/ws")
async def ws(websocket: WebSocket):
    token = websocket.query_params.get("token")
    expected = config.env.api_token
    if expected and not (token and secrets.compare_digest(token, expected)):
        await websocket.close(code=1008)
        return

    await websocket.accept()
    q = engine.subscribe()
    try:
        await websocket.send_json(engine.snapshot())  # estado inicial
        while True:
            snap = await q.get()
            await websocket.send_json(snap)
    except (WebSocketDisconnect, RuntimeError, asyncio.CancelledError):
        pass
    finally:
        engine.unsubscribe(q)


# --- Dashboard compilado (si existe) ---------------------------------------
if config.FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(config.FRONTEND_DIST), html=True),
              name="dashboard")
