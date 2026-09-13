import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, getToken, setToken, WS_BASE } from "./api.js";
import Settings from "./Settings.jsx";

const fmt = (n, d = 2) =>
  n === null || n === undefined || Number.isNaN(Number(n)) ? "—" : Number(n).toFixed(d);
const price = (n) => (n === null || n === undefined ? "—" : fmt(n, n < 10 ? 4 : 2));
const sign = (n) => (n > 0 ? "pos" : n < 0 ? "neg" : "");
const pct = (n) => (n === null || n === undefined ? "—" : `${n > 0 ? "+" : ""}${fmt(n)}%`);

const ago = (iso) => {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

const uptime = (sec) => {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

export default function App() {
  const [token, setTok] = useState(getToken());
  const [tokenInput, setTokenInput] = useState(getToken());
  const [connected, setConnected] = useState(false);
  const [authError, setAuthError] = useState("");
  const [status, setStatus] = useState(null);
  const [trades, setTrades] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settingsData, setSettingsData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const wsRef = useRef(null);
  const retryRef = useRef(null);

  const flash = (text, kind = "ok") => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 4000);
  };

  const guard = async (fn, okMsg) => {
    try {
      const r = await fn();
      if (okMsg) flash(okMsg);
      return r;
    } catch (e) {
      flash(String(e.message || e), "err");
      return null;
    }
  };

  // --- WebSocket con reconexión automática ---------------------------------
  const connectWs = useCallback(() => {
    if (!token) return;
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    const ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);
    ws.onopen = () => { setConnected(true); setAuthError(""); };
    ws.onmessage = (e) => setStatus(JSON.parse(e.data));
    ws.onclose = (e) => {
      setConnected(false);
      if (e.code === 1008) setAuthError("Token rechazado por el backend.");
      clearTimeout(retryRef.current);
      retryRef.current = setTimeout(connectWs, 3000);
    };
    wsRef.current = ws;
  }, [token]);

  useEffect(() => {
    connectWs();
    return () => {
      clearTimeout(retryRef.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    };
  }, [connectWs]);

  // --- Tablas secundarias (polling suave) ----------------------------------
  const refreshTables = useCallback(async () => {
    if (!token) return;
    try {
      const [t, d, l] = await Promise.all([api.trades(), api.decisions(), api.logs()]);
      setTrades(t); setDecisions(d); setLogs(l);
    } catch {
      /* silencioso: el WebSocket ya avisa de la desconexión */
    }
  }, [token]);

  useEffect(() => {
    refreshTables();
    const id = setInterval(refreshTables, 8000);
    return () => clearInterval(id);
  }, [refreshTables]);

  // --- Configuración --------------------------------------------------------
  const loadSettings = useCallback(async () => {
    if (!token) return;
    try {
      const s = await api.settings();
      setSettingsData(s);
      setDraft(s.values);
    } catch { /* sin token válido aún */ }
  }, [token]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveSettings = async () => {
    setSaving(true);
    const r = await guard(() => api.saveSettings(draft), "Configuración guardada");
    if (r) { setSettingsData({ ...settingsData, values: r.values }); setDraft(r.values); }
    setSaving(false);
  };

  const resetSettings = async () => {
    if (!confirm("¿Restaurar TODA la configuración a los valores por defecto?")) return;
    const r = await guard(() => api.resetSettings(), "Configuración restaurada");
    if (r) { setSettingsData({ ...settingsData, values: r.values }); setDraft(r.values); }
  };

  // --- Controles ------------------------------------------------------------
  const toggleBot = async () => {
    const v = !status.bot_enabled;
    const r = await guard(() => api.saveSettings({ bot_enabled: v }),
      v ? "Bot habilitado" : "Bot en pausa (solo observa)");
    if (r) { setSettingsData((s) => s && { ...s, values: r.values }); setDraft(r.values); }
  };

  const toggleKill = async () => {
    const on = !status.kill_switch;
    if (on && !confirm("¿Activar el KILL SWITCH? Se dejarán de abrir posiciones.")) return;
    await guard(() => api.killSwitch(on),
      on ? "KILL SWITCH activado" : "Kill switch desactivado");
  };

  const decideNow = () => guard(() => api.decideNow(), "Decisión solicitada");

  const closePos = async (id) => {
    if (!confirm(`¿Cerrar la posición #${id} a precio de mercado?`)) return;
    const r = await guard(() => api.closePosition(id), `Posición #${id} cerrada`);
    if (r) refreshTables();
  };

  const entrar = () => { setToken(tokenInput); setTok(tokenInput); };

  // --- Pantalla de acceso ---------------------------------------------------
  if (!token) {
    return (
      <div className="container">
        <header><h1>🤖 Trading Bot · Panel</h1></header>
        <div className="panel" style={{ maxWidth: 480 }}>
          <h2>Token de la API</h2>
          <small>Es el valor de <code>API_TOKEN</code> de tu <code>backend/.env</code>.</small>
          <form
            style={{ display: "flex", gap: 8, marginTop: 12 }}
            onSubmit={(e) => { e.preventDefault(); entrar(); }}
          >
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="API_TOKEN"
              autoFocus
            />
            <button className="primary" type="submit">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  const s = status;
  const perf = s?.performance;

  return (
    <div className="container">
      <header>
        <h1>🤖 Trading Bot</h1>
        <span className={`badge ${s?.testnet ? "amber" : "red"}`}>
          {s?.testnet ? "TESTNET" : "💸 DINERO REAL"}
        </span>
        <span className={`badge ${connected ? "green" : "gray"}`}>
          {connected ? "● en vivo" : "○ desconectado"}
        </span>
        <span className={`badge ${s?.bot_enabled ? "green" : "gray"}`}>
          {s?.bot_enabled ? "operando" : "en pausa"}
        </span>
        {s?.kill_switch && <span className="badge red">🛑 KILL SWITCH</span>}
        {s?.daily_loss_tripped && <span className="badge red">cortacircuitos disparado</span>}
        <div className="spacer" />
        <button className="ghost" onClick={() => { setToken(""); setTok(""); }}>
          Salir
        </button>
      </header>

      {authError && <div className="alert">{authError}</div>}
      {s?.last_error && <div className="alert warn">Último error del motor: {s.last_error}</div>}
      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}

      {/* Controles */}
      <div className="panel section">
        <div className="controls">
          <button className={s?.bot_enabled ? "warn" : "primary"} onClick={toggleBot}>
            {s?.bot_enabled ? "⏸ Pausar bot" : "▶ Habilitar bot"}
          </button>
          <button className="danger" onClick={toggleKill}>
            {s?.kill_switch ? "Desactivar KILL SWITCH" : "🛑 KILL SWITCH"}
          </button>
          <button onClick={decideNow}>⚡ Decidir ahora</button>
          <div className="spacer" />
          <small>
            ciclo #{s?.poll_count ?? 0} · activo {uptime(s?.uptime_sec)} ·
            latido {s?.settings?.poll_interval_sec ?? "—"}s
          </small>
        </div>
      </div>

      <div className="grid section">
        {/* Cuenta */}
        <div className="panel">
          <h2>Cuenta</h2>
          <div className="kpi">
            <span>Saldo disponible</span>
            <span className="v">{fmt(s?.available_quote)} {s?.quote_asset}</span>
          </div>
          <div className="kpi">
            <span>Posiciones abiertas</span>
            <span className="v">
              {s?.open_positions?.length ?? 0} / {s?.settings?.max_open_positions ?? "—"}
            </span>
          </div>
          <div className="kpi">
            <span>Operaciones hoy</span>
            <span className="v">
              {s?.daily?.trades_opened ?? 0} / {s?.settings?.max_trades_per_day ?? "—"}
            </span>
          </div>
          <div className="kpi">
            <span>PnL realizado hoy</span>
            <span className={`v ${sign(s?.daily?.realized_pnl)}`}>
              {fmt(s?.daily?.realized_pnl)} {s?.quote_asset}
            </span>
          </div>
        </div>

        {/* Rendimiento */}
        <div className="panel">
          <h2>Rendimiento histórico</h2>
          <div className="kpi">
            <span>Operaciones cerradas</span><span className="v">{perf?.closed_trades ?? 0}</span>
          </div>
          <div className="kpi">
            <span>Aciertos</span>
            <span className="v">
              {perf?.wins ?? 0}/{perf?.closed_trades ?? 0} ({fmt(perf?.win_rate_pct, 1)}%)
            </span>
          </div>
          <div className="kpi">
            <span>PnL total</span>
            <span className={`v ${sign(perf?.total_pnl_usdt)}`}>
              {fmt(perf?.total_pnl_usdt)} {s?.quote_asset}
            </span>
          </div>
          <div className="kpi">
            <span>Mejor / peor</span>
            <span className="v">
              <span className="pos">{fmt(perf?.best_usdt)}</span>
              {" / "}
              <span className="neg">{fmt(perf?.worst_usdt)}</span>
            </span>
          </div>
        </div>

        {/* Mercado */}
        <div className="panel">
          <h2>Mercado</h2>
          {s?.tickers && Object.values(s.tickers).length > 0 ? (
            Object.values(s.tickers).map((t) => (
              <div className="kpi" key={t.symbol}>
                <span>{t.symbol}</span>
                <span className="v">
                  {price(t.last)}{" "}
                  <span className={sign(t.change24h_pct)}>({pct(t.change24h_pct)} 24h)</span>
                </span>
              </div>
            ))
          ) : (
            <small>Esperando al primer ciclo…</small>
          )}
        </div>

        {/* Última decisión */}
        <div className="panel">
          <h2>Última decisión del LLM</h2>
          {s?.last_decision ? (
            <>
              <div className="kpi">
                <span>Acción</span>
                <span className="v">
                  <ActionBadge action={s.last_decision.action} />{" "}
                  {s.last_decision.symbol || ""}
                </span>
              </div>
              <div className="kpi">
                <span>Confianza</span><span className="v">{fmt(s.last_decision.confidence, 2)}</span>
              </div>
              <div className="kpi">
                <span>Disparo</span><span className="v">{s.last_decision.trigger}</span>
              </div>
              <small className="reasoning">{s.last_decision.reasoning}</small>
            </>
          ) : (
            <small>Aún no hay decisiones en esta sesión.</small>
          )}
        </div>
      </div>

      {/* Posiciones abiertas */}
      <div className="panel section">
        <h2>Posiciones abiertas</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Símbolo</th><th>Entrada</th><th>Actual</th>
                <th>Invertido</th><th>PnL flotante</th><th>Antigüedad</th><th></th>
              </tr>
            </thead>
            <tbody>
              {(s?.open_positions || []).map((p) => {
                const cur = s?.tickers?.[p.symbol]?.last;
                const pnl = cur ? (cur / p.entry_price - 1) * 100 : null;
                return (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.symbol}</td>
                    <td>{price(p.entry_price)}</td>
                    <td>{price(cur)}</td>
                    <td>{fmt(p.entry_usdt)}</td>
                    <td className={sign(pnl)}>{pct(pnl)}</td>
                    <td>{ago(p.opened_at)}</td>
                    <td>
                      <button className="danger small" onClick={() => closePos(p.id)}>
                        Cerrar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {(!s?.open_positions || s.open_positions.length === 0) && (
                <tr><td colSpan={8}><small>Sin posiciones abiertas.</small></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configuración */}
      {settingsData && draft && (
        <Settings
          data={settingsData}
          draft={draft}
          setDraft={setDraft}
          onSave={saveSettings}
          onReset={resetSettings}
          saving={saving}
        />
      )}

      <div className="grid section">
        {/* Decisiones */}
        <div className="panel">
          <h2>Decisiones recientes</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Hora</th><th>Acción</th><th>Símb.</th><th>Conf.</th><th>Resultado</th></tr>
              </thead>
              <tbody>
                {decisions.slice(0, 15).map((d) => (
                  <tr key={d.id} title={d.reasoning || ""}>
                    <td><small>{new Date(d.ts).toLocaleTimeString()}</small></td>
                    <td><ActionBadge action={d.action} /></td>
                    <td>{d.symbol || "—"}</td>
                    <td>{fmt(d.confidence, 2)}</td>
                    <td>
                      {d.applied ? (
                        <span className="pos">ejecutada</span>
                      ) : d.veto_reason ? (
                        <span className="neg" title={d.veto_reason}>vetada</span>
                      ) : (
                        <small>—</small>
                      )}
                    </td>
                  </tr>
                ))}
                {decisions.length === 0 && (
                  <tr><td colSpan={5}><small>Todavía nada.</small></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operaciones cerradas */}
        <div className="panel">
          <h2>Operaciones cerradas</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Símb.</th><th>Entrada</th><th>Salida</th><th>PnL</th><th>%</th><th>Motivo</th></tr>
              </thead>
              <tbody>
                {trades.slice(0, 15).map((t) => (
                  <tr key={t.id}>
                    <td>{t.symbol}</td>
                    <td>{price(t.entry_price)}</td>
                    <td>{price(t.close_price)}</td>
                    <td className={sign(t.pnl_usdt)}>{fmt(t.pnl_usdt)}</td>
                    <td className={sign(t.pnl_pct)}>{pct(t.pnl_pct)}</td>
                    <td><small>{t.close_reason}</small></td>
                  </tr>
                ))}
                {trades.length === 0 && (
                  <tr><td colSpan={6}><small>Todavía nada.</small></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Log */}
      <div className="panel section">
        <h2>Log de eventos</h2>
        <div className="logbox">
          {logs.map((l) => (
            <div key={l.id} className={`logline ${l.level}`}>
              <span className="logts">{new Date(l.ts).toLocaleTimeString()}</span>
              {l.message}
            </div>
          ))}
          {logs.length === 0 && <small>Sin eventos.</small>}
        </div>
      </div>

      <footer>
        <small>
          El LLM propone, el motor de riesgo dispone · esto no es asesoramiento
          financiero · operas bajo tu responsabilidad
        </small>
      </footer>
    </div>
  );
}

function ActionBadge({ action }) {
  const cls = action === "OPEN" ? "green" : action === "CLOSE" ? "red" : "gray";
  return <span className={`badge ${cls}`}>{action}</span>;
}
