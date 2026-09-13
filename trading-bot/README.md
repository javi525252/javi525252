# 🤖 Bot de trading autónomo — Bybit (spot) + Claude Code

Bot de trading **sin human-in-the-loop**: recoge métricas de mercado, se las pasa
ordenadas a un LLM que decide por CLI (Claude Code, usando **tu suscripción**), y
un motor de riesgo determinista valida y ejecuta las operaciones en Bybit. Todo
configurable y visible en tiempo real desde un dashboard.

Configuración de esta versión: **Bybit · spot sin apalancamiento · testnet**.

---

## ⚠️ Léelo antes de nada (riesgo)

- Un bot autónomo puede perder dinero de forma rápida y continua. **Empieza en
  testnet** (así viene por defecto) y no pases a real hasta tener semanas de
  histórico que te convenzan.
- El LLM **propone**; el **motor de riesgo (código) dispone**. Las barreras duras
  (tamaño, nº de operaciones, stop-loss, cortacircuitos de pérdidas, kill switch)
  están *fuera* del LLM a propósito: aunque el modelo se equivoque, la pérdida
  está acotada.
- Spot sin apalancamiento = no hay liquidaciones ni margen. Como mucho pierdes lo
  invertido en cada compra. Es la variante más segura para automatizar.
- Esto no es asesoramiento financiero. Operas bajo tu responsabilidad.

---

## 🧠 Cómo funciona

```
                 ┌─────────────────────────────────────────────┐
                 │              BUCLE (cada 60 s)              │
                 └─────────────────────────────────────────────┘
  Bybit API ──► métricas (velas, ticker) ──► indicadores (RSI, EMA, MACD, ATR…)
  alternative.me ──► Fear & Greed                    │
                                                     ▼
   1) SALIDAS AUTOMÁTICAS (TP / SL / trailing / tiempo)  ← siempre, sin LLM
   2) Detección de EVENTOS (movimiento de precio > umbral)
   3) ¿Toca decidir?  (evento │ rutina cada N ciclos │ manual)
                                                     │
                                                     ▼
        contexto JSON ──►  claude -p  ──►  decisión {OPEN|CLOSE|HOLD}
                                                     │
                                                     ▼
                 MOTOR DE RIESGO (veta o aprueba)  ──►  EJECUTA en Bybit
                                                     │
                                                     ▼
                       SQLite (estado) ──►  WebSocket ──►  Dashboard React
```

**Disparo híbrido por eventos:** el LLM no se llama a lo loco. Se llama cuando hay
un movimiento brusco en algún símbolo (evento), o de forma programada cada N
ciclos (rutina), o cuando tú pulsas «Decidir ahora». Con eso salen de sobra tus
10–20 operaciones/día sin quemar contexto.

### Barreras de riesgo (todas configurables en caliente)
- Tamaño por operación: % del saldo con tope fijo en USDT y mínimo por orden.
- Máximo de posiciones simultáneas y máximo de operaciones por día.
- Una sola posición por símbolo a la vez.
- **Take-profit**, **stop-loss** y **trailing stop** automáticos por posición
  (los ejecuta el código, no el LLM).
- Cierre por tiempo máximo de la posición.
- **Cortacircuitos de pérdidas diarias**: si el PnL neto del día cae por debajo
  del límite (% o USDT), deja de abrir hasta el día siguiente.
- Umbral mínimo de confianza del LLM para abrir y para cerrar.
- **Kill switch**: botón (y archivo `KILL_SWITCH`) que corta la apertura de
  posiciones nuevas al instante.
- Ante cualquier fallo del LLM (timeout, salida rara, CLI caído) la decisión es
  **HOLD**: el bot nunca opera a ciegas.

---

## 📦 Estructura

```
trading-bot/
├─ backend/
│  ├─ bot/                # lógica del bot
│  │  ├─ config.py        # configuración (.env + parámetros en caliente)
│  │  ├─ exchange.py      # Bybit V5 spot (pybit)
│  │  ├─ metrics.py       # recogida y estructurado de métricas
│  │  ├─ indicators.py    # RSI, EMA, MACD, ATR, rango, volumen…
│  │  ├─ decision.py      # invoca `claude -p` y parsea la decisión
│  │  ├─ risk.py          # motor de riesgo (veta / aprueba)
│  │  ├─ executor.py      # órdenes + salidas automáticas
│  │  ├─ state.py         # persistencia SQLite
│  │  ├─ engine.py        # el bucle híbrido
│  │  └─ prompts/system_prompt.md
│  ├─ api/server.py       # FastAPI + WebSocket
│  ├─ tests/              # 85 tests (pytest), sin tocar Bybit ni Claude
│  ├─ main.py             # arranque (bot + API en un comando)
│  ├─ check_setup.py      # comprobación previa: .env, Bybit y Claude
│  ├─ requirements.txt
│  └─ .env.example
├─ frontend/              # dashboard React (Vite)
├─ decision_workspace/    # carpeta aislada donde corre `claude -p`
├─ deploy/                # unidad systemd de ejemplo (VPS 24/7)
├─ run-backend.ps1        # arranque en Windows
├─ run-backend.sh         # arranque en Linux / macOS
└─ README.md
```

---

## ✅ Requisitos

- **Python 3.10+**  (`python --version`)
- **Node.js 18+**   (`node --version`)
- **Claude Code CLI** instalado y con sesión iniciada en tu suscripción
  (`claude` debe funcionar en tu terminal).
- Una cuenta en **testnet de Bybit**: https://testnet.bybit.com

---

## 🚀 Puesta en marcha (paso a paso, Windows PowerShell)

### 1) Crear la API key de testnet en Bybit
1. Entra en https://testnet.bybit.com e inicia sesión (o regístrate).
2. Consigue fondos ficticios: menú de la cuenta → **Request funds** (te dan USDT
   de prueba).
3. Ve a **API** → **Create New Key** → tipo **System-generated**.
4. Permisos: activa **Read-Write** y marca **Spot Trading**. **NO** actives
   *Withdraw*. Si te deja, restringe por IP a la de tu equipo.
5. Copia la **API Key** y el **API Secret** (el secret solo se muestra una vez).

### 2) Colocar el proyecto
Copia la carpeta `trading-bot/` donde quieras, por ejemplo `C:\trading-bot`, y
abre PowerShell ahí:
```powershell
cd C:\trading-bot
```

### 3) Configurar el backend
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
```
En `.env` rellena `BYBIT_API_KEY`, `BYBIT_API_SECRET`, deja `BYBIT_TESTNET=true`,
y pon un `API_TOKEN` largo y aleatorio (te lo pedirá el dashboard). Guarda.

> Si `claude` no está en el PATH, pon la ruta completa en `CLAUDE_BIN`
> (p. ej. `C:\Users\Javi\AppData\Roaming\npm\claude.cmd`).

### 4) Comprobar que todo está en su sitio
```powershell
python check_setup.py
```
Verifica el `.env`, la conexión con Bybit, tus pares y que Claude Code responde.
**No coloca ninguna orden.** Si sale todo `[OK]`, adelante.

### 5) Arrancar el bot + la API
```powershell
python main.py
```
Verás el log del bot en la consola. La API queda en `http://127.0.0.1:8000`.
(Alternativa en un clic: desde la raíz del proyecto, `.\run-backend.ps1`.)

### 6) Arrancar el dashboard (otra ventana de PowerShell)
```powershell
cd C:\trading-bot\frontend
npm install
npm run dev
```
Abre lo que indique Vite (normalmente `http://localhost:5173`), introduce el
`API_TOKEN` de tu `.env` y listo: verás estado, posiciones, decisiones y
configuración en tiempo real.

> **Opción «todo en uno»**: en vez del paso 6 puedes compilar el dashboard con
> `npm run build`. El backend servirá el panel directamente en
> `http://127.0.0.1:8000`, sin necesidad de tener Vite corriendo.

### En Linux / macOS
Los mismos pasos cambiando PowerShell por bash: `python3 -m venv .venv`,
`source .venv/bin/activate`, `cp .env.example .env`… o directamente
`./run-backend.sh`, que crea el entorno e instala todo la primera vez.

---

## 🎛️ Uso del dashboard

- **Habilitar bot / Pausar**: con el bot en pausa solo observa y decide, pero no
  abre posiciones. Las salidas automáticas siguen protegiendo lo abierto.
- **KILL SWITCH**: corta al instante la apertura de posiciones nuevas.
- **Decidir ahora**: fuerza una llamada al LLM en el próximo ciclo.
- **Configuración**: edita cualquier parámetro (tamaños, límites, umbrales,
  cadencia, indicadores…) agrupado y con su explicación. Se aplica **en
  caliente**, sin reiniciar, y el backend valida rangos antes de guardar.
- **Cerrar** una posición manualmente desde su fila.
- **Rendimiento histórico**: operaciones cerradas, aciertos, PnL total, mejor y
  peor operación.

---

## 🧪 Tests

La lógica determinista (riesgo, PnL, indicadores, parseo de decisiones, bucle y
API) está cubierta por tests que **no tocan Bybit ni Claude**:

```powershell
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

---

## 💸 Pasar a dinero real (cuando estés listo)

1. Ten histórico suficiente en testnet y entiende por qué opera (mira las
   decisiones y su razonamiento).
2. Crea una API key en **mainnet** (https://www.bybit.com), mismos permisos:
   **Spot Trading**, **sin Withdraw**, restringida por IP.
3. En `.env`: cambia las claves por las de mainnet y pon `BYBIT_TESTNET=false`.
4. **Empieza pequeño**: baja `position_size_pct` y `max_position_usdt`, y ajusta
   `max_daily_loss_usdt` a una cantidad que puedas perder sin drama.
5. Vigila los primeros días. El kill switch es tu amigo.

---

## 🖥️ Dejarlo funcionando 24/7

El bot es un proceso Python que debe estar **siempre encendido** (no vale Netlify
ni funciones serverless: es un bucle persistente). Opciones:

- **Tu PC encendido**: deja `python main.py` corriendo. Sencillo para empezar.
- **Programador de tareas de Windows / NSSM**: para arrancarlo como servicio y
  que reviva si se cae.
- **Un VPS barato (Linux)**: lo más robusto. Tienes una unidad systemd lista en
  `deploy/trading-bot.service`:
  ```bash
  sudo cp deploy/trading-bot.service /etc/systemd/system/
  sudo nano /etc/systemd/system/trading-bot.service   # ajusta User y rutas
  sudo systemctl daemon-reload
  sudo systemctl enable --now trading-bot
  journalctl -u trading-bot -f
  ```

Requisito en cualquier caso: en esa máquina debe estar Claude Code instalado y
logueado con tu suscripción, porque ahí es donde se ejecuta `claude -p`.

---

## 🔧 Problemas comunes

- **«No se encontró el ejecutable de Claude»** → pon la ruta completa en
  `CLAUDE_BIN` dentro de `.env`.
- **El LLM siempre responde HOLD** → normal al principio (es conservador). Mira
  el log de decisiones: si el razonamiento empieza por «HOLD de seguridad» es un
  fallo técnico, no criterio del modelo; ejecuta `python check_setup.py`. Si es
  criterio real, baja `min_confidence_open` con cuidado.
- **Órdenes rechazadas por importe mínimo** → sube `min_position_usdt` /
  `position_size_pct`; Bybit exige un mínimo por orden (suele ser ~5–10 USDT).
  `check_setup.py` te dice el mínimo exacto de cada par.
- **El dashboard no conecta** → revisa que el backend esté arriba y que el
  `API_TOKEN` coincida exactamente. `http://127.0.0.1:8000/api/health` debe
  responder sin token.
- **Rate limit de Bybit** → improbable con esta cadencia; si pasa, sube
  `poll_interval_sec`.
- **El bot arranca pero no ve precios** → suele ser red o firewall bloqueando
  `api.bybit.com`; el bot lo registra como aviso y sigue vivo reintentando.

---

## 🗺️ Ideas para más adelante
- Backtesting con velas históricas antes de tocar dinero real.
- Notificaciones (Telegram/email) en cada operación y al saltar el kill switch.
- Métricas adicionales para el LLM (order book, funding, correlaciones).
- Salidas parciales (cerrar media posición en el primer objetivo).

*El LLM propone, el motor de riesgo dispone. Opera con cabeza.*
