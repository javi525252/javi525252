// Base de la API: en desarrollo (puerto 5173) apunta al backend en :8000;
// servido desde el backend, usa el mismo origen.
export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (location.port === "5173" ? "http://127.0.0.1:8000" : "");

export const WS_BASE =
  (API_BASE || location.origin).replace(/^http/, "ws");

export function getToken() {
  try {
    return localStorage.getItem("bot_token") || "";
  } catch {
    return "";
  }
}

export function setToken(t) {
  try {
    localStorage.setItem("bot_token", t);
  } catch {
    /* modo privado: seguimos en memoria */
  }
}

async function req(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "X-API-Token": getToken(),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      detail = (await res.text()) || detail;
    }
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  status: () => req("/api/status"),
  trades: (limit = 50) => req(`/api/trades?limit=${limit}`),
  decisions: (limit = 50) => req(`/api/decisions?limit=${limit}`),
  logs: (limit = 120) => req(`/api/logs?limit=${limit}`),
  performance: () => req("/api/performance"),
  settings: () => req("/api/settings"),
  saveSettings: (values) =>
    req("/api/settings", { method: "POST", body: JSON.stringify({ values }) }),
  resetSettings: () => req("/api/settings/reset", { method: "POST" }),
  decideNow: () => req("/api/decide-now", { method: "POST" }),
  closePosition: (id) => req(`/api/positions/${id}/close`, { method: "POST" }),
  killSwitch: (on) =>
    req("/api/kill-switch", { method: "POST", body: JSON.stringify({ on }) }),
};
