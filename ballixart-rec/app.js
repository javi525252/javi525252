/* Ballixart Rec — grabador de pantalla, cámara y voz (100% en el navegador). */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ───────── Capacidades del navegador ─────────
  const CAN_SCREEN = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  const CAN_DOC_PIP = 'documentPictureInPicture' in window;
  const CAN_PIP = 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
  const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && !CAN_SCREEN);

  const FORMATS = [
    { id: 'mp4', label: 'MP4 (máxima compatibilidad)', ext: 'mp4', types: ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4'] },
    { id: 'webm', label: 'WebM (archivo más ligero)', ext: 'webm', types: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] },
  ];
  const supported = (t) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t);
  const availableFormats = FORMATS.map(f => ({ ...f, mime: f.types.find(supported) })).filter(f => f.mime);

  // ───────── Preferencias ─────────
  const PREFS_KEY = 'bxrec-prefs';
  const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { return {}; } })();
  const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {} };

  // ───────── IndexedDB ─────────
  const DB = (() => {
    let dbp;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('ballixart-rec', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('recordings', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const tx = async (mode, fn) => {
      const db = await open();
      return new Promise((res, rej) => {
        const t = db.transaction('recordings', mode);
        const req = fn(t.objectStore('recordings'));
        t.oncomplete = () => res(req && req.result);
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      });
    };
    return {
      all: () => tx('readonly', s => s.getAll()),
      get: (id) => tx('readonly', s => s.get(id)),
      put: (rec) => tx('readwrite', s => s.put(rec)),
      del: (id) => tx('readwrite', s => s.delete(id)),
    };
  })();

  // ───────── Utilidades ─────────
  const fmtTime = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(sec).padStart(2, '0');
  };
  const fmtShort = (s) => { s = Math.max(0, s || 0); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
  const fmtSize = (b) => b > 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB';
  const fmtDate = (t) => new Date(t).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const extFor = (mime) => (mime || '').includes('mp4') ? 'mp4' : (mime || '').includes('quicktime') ? 'mov' : 'webm';
  const safeName = (t) => (t || 'grabacion').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || 'grabacion';
  const defaultTitle = () => 'Grabación ' + new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const stopStream = (s) => s && s.getTracks().forEach(t => t.stop());

  let toastTimer;
  function toast(msg, ms = 3200) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  function busy(on, text, pct) {
    $('#busy').hidden = !on;
    if (text) $('#busyText').textContent = text;
    $('#busyBar').style.width = (pct == null ? 0 : Math.round(pct * 100)) + '%';
    $('#busyBar').parentElement.hidden = pct == null;
  }

  // Los WebM de MediaRecorder no traen duración: forzamos al navegador a calcularla.
  function ensureDuration(video) {
    return new Promise((res) => {
      const done = () => res(isFinite(video.duration) ? video.duration : 0);
      const ready = () => {
        if (isFinite(video.duration) && video.duration > 0) return done();
        const onUpd = () => {
          if (isFinite(video.duration)) { video.removeEventListener('durationchange', onUpd); video.currentTime = 0; done(); }
        };
        video.addEventListener('durationchange', onUpd);
        video.currentTime = 1e7;
        setTimeout(() => { video.removeEventListener('durationchange', onUpd); done(); }, 4000);
      };
      if (video.readyState >= 1) ready(); else video.addEventListener('loadedmetadata', ready, { once: true });
    });
  }

  async function makeThumb(blob) {
    const url = URL.createObjectURL(blob);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    try {
      const dur = await ensureDuration(v);
      await new Promise((res, rej) => {
        v.onseeked = res; v.onerror = rej;
        v.currentTime = Math.min(1, (dur || 0) / 2) || 0.1;
        setTimeout(res, 3000);
      });
      const w = 480, h = Math.round(w * (v.videoHeight || 9) / (v.videoWidth || 16));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(v, 0, 0, w, h);
      const thumb = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.78));
      return { thumb, duration: dur, width: v.videoWidth, height: v.videoHeight };
    } catch {
      return { thumb: null, duration: 0 };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ───────── Navegación ─────────
  let currentView = 'record';
  function show(view) {
    currentView = view;
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.nav === view || (view === 'review' && t.dataset.nav === 'library')));
    $('.tabs').style.visibility = view === 'recording' ? 'hidden' : '';
    if (view === 'library') renderLibrary();
    if (view !== 'review') { const p = $('#player'); p.pause(); }
    window.scrollTo({ top: 0 });
  }
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (!nav) return;
    e.preventDefault();
    if (currentView === 'recording') return;
    show(nav.dataset.nav);
  });

  // ───────── Configuración inicial ─────────
  const modeInputs = $$('input[name="mode"]');
  const getMode = () => (modeInputs.find(i => i.checked) || {}).value;

  function initSetup() {
    $('#year').textContent = new Date().getFullYear();

    if (!CAN_SCREEN) {
      $$('.mode[data-needs="screen"]').forEach(m => m.classList.add('disabled'));
      $('#noScreenNote').hidden = false;
      $('#sysAudioRow').hidden = true;
    }
    const startMode = CAN_SCREEN ? (prefs.mode || 'screen-cam') : 'cam';
    (modeInputs.find(i => i.value === startMode) || modeInputs[2]).checked = true;

    const fmtSel = $('#format');
    if (!availableFormats.length) {
      fmtSel.innerHTML = '<option>No compatible</option>';
      $('#startBtn').disabled = true;
      toast('Tu navegador no permite grabar vídeo. Prueba con Chrome, Edge o Firefox actualizados.', 8000);
    } else {
      fmtSel.innerHTML = availableFormats.map(f => `<option value="${f.id}">${f.label}</option>`).join('');
      fmtSel.value = availableFormats.some(f => f.id === prefs.format) ? prefs.format : availableFormats[0].id;
    }
    if (prefs.quality) $('#quality').value = prefs.quality;
    if (prefs.sysAudio === false) $('#sysAudio').checked = false;
    if (prefs.countdown === false) $('#countdown').checked = false;
    if (IS_MOBILE && !prefs.quality) $('#quality').value = '720';

    $('#flipBtn').hidden = !IS_MOBILE;
    updateModeUI();

    modeInputs.forEach(i => i.addEventListener('change', () => { prefs.mode = getMode(); savePrefs(); updateModeUI(); }));
    $('#format').addEventListener('change', e => { prefs.format = e.target.value; savePrefs(); });
    $('#quality').addEventListener('change', e => { prefs.quality = e.target.value; savePrefs(); });
    $('#sysAudio').addEventListener('change', e => { prefs.sysAudio = e.target.checked; savePrefs(); });
    $('#countdown').addEventListener('change', e => { prefs.countdown = e.target.checked; savePrefs(); });
    $('#camSelect').addEventListener('change', () => { prefs.cam = $('#camSelect').value; savePrefs(); if (previewStream) startPreview(); });
    $('#micSelect').addEventListener('change', () => { prefs.mic = $('#micSelect').value; savePrefs(); if (previewStream) startPreview(); });
    $('#camTestBtn').addEventListener('click', startPreview);
    $('#flipBtn').addEventListener('click', () => {
      facing = facing === 'user' ? 'environment' : 'user';
      $('#camSelect').value = '';
      startPreview();
    });

    listDevices();
    if (navigator.mediaDevices) navigator.mediaDevices.addEventListener?.('devicechange', listDevices);
  }

  function updateModeUI() {
    const mode = getMode();
    const usesCam = mode !== 'screen';
    $('#fieldCam').style.display = usesCam ? '' : 'none';
    $('.preview-card').style.display = usesCam ? '' : 'none';
    $('#sysAudioRow').style.display = mode === 'cam' || !CAN_SCREEN ? 'none' : '';
    if (!usesCam) stopPreview();
  }

  async function listDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devs = await navigator.mediaDevices.enumerateDevices();
    const cams = devs.filter(d => d.kind === 'videoinput');
    const mics = devs.filter(d => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications');
    const camSel = $('#camSelect'), micSel = $('#micSelect');
    const camVal = camSel.value || prefs.cam || '', micVal = micSel.value || prefs.mic || 'default';
    camSel.innerHTML = '<option value="">Cámara predeterminada</option>' +
      cams.filter(c => c.deviceId).map((c, i) => `<option value="${c.deviceId}">${c.label || 'Cámara ' + (i + 1)}</option>`).join('');
    micSel.innerHTML = '<option value="default">Micrófono predeterminado</option><option value="off">Sin micrófono</option>' +
      mics.filter(m => m.deviceId).map((m, i) => `<option value="${m.deviceId}">${m.label || 'Micrófono ' + (i + 1)}</option>`).join('');
    if ([...camSel.options].some(o => o.value === camVal)) camSel.value = camVal;
    if ([...micSel.options].some(o => o.value === micVal)) micSel.value = micVal;
  }

  // ───────── Vista previa de cámara + vúmetro ─────────
  let previewStream = null, facing = 'user', meterCtx = null, meterRAF = 0;

  function camConstraints() {
    const id = $('#camSelect').value;
    const q = +$('#quality').value;
    const base = IS_MOBILE ? { width: { ideal: Math.round(q * 4 / 3) }, height: { ideal: q } } : { width: { ideal: 1280 }, height: { ideal: 720 } };
    return id ? { ...base, deviceId: { exact: id } } : { ...base, facingMode: facing };
  }
  function micConstraints() {
    const id = $('#micSelect').value;
    if (id === 'off') return false;
    const base = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    return id && id !== 'default' ? { ...base, deviceId: { exact: id } } : base;
  }
  function isMirrored(stream) {
    const t = stream && stream.getVideoTracks()[0];
    const fm = t && t.getSettings && t.getSettings().facingMode;
    return fm ? fm === 'user' : !$('#camSelect').value ? facing === 'user' : true;
  }

  async function startPreview() {
    stopPreview();
    try {
      previewStream = await navigator.mediaDevices.getUserMedia({ video: camConstraints(), audio: micConstraints() });
    } catch (err) {
      try { previewStream = await navigator.mediaDevices.getUserMedia({ video: camConstraints(), audio: false }); }
      catch (e2) { return toast(permissionMsg(e2)); }
    }
    const v = $('#camPreview');
    v.srcObject = previewStream;
    $('#camPreviewWrap').classList.toggle('mirror', isMirrored(previewStream));
    $('#camOff').hidden = true;
    startMeter(previewStream);
    listDevices();
  }
  function stopPreview() {
    stopStream(previewStream); previewStream = null;
    $('#camPreview').srcObject = null;
    $('#camOff').hidden = false;
    stopMeter();
  }
  function startMeter(stream) {
    stopMeter();
    if (!stream.getAudioTracks().length) return;
    try {
      meterCtx = new (window.AudioContext || window.webkitAudioContext)();
      const an = meterCtx.createAnalyser(); an.fftSize = 512;
      meterCtx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let peak = 0; for (const x of buf) peak = Math.max(peak, Math.abs(x - 128));
        $('#micLevel').style.width = Math.min(100, peak / 128 * 180) + '%';
        meterRAF = requestAnimationFrame(loop);
      };
      loop();
    } catch {}
  }
  function stopMeter() {
    cancelAnimationFrame(meterRAF);
    if (meterCtx) { meterCtx.close().catch(() => {}); meterCtx = null; }
    $('#micLevel').style.width = '0';
  }

  function permissionMsg(err) {
    const n = err && err.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'Permiso denegado. Revisa los permisos de cámara/micrófono/pantalla del navegador.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No se encontró el dispositivo seleccionado.';
    if (n === 'NotReadableError') return 'El dispositivo está siendo usado por otra aplicación.';
    if (n === 'AbortError') return 'Se canceló la selección.';
    return 'No se pudo iniciar: ' + (err && err.message || err);
  }

  // ───────── Grabación ─────────
  const S = {
    screen: null, cam: null, mic: null, mixCtx: null, out: null,
    recorder: null, chunks: [], mime: '', mode: '',
    startedAt: 0, pausedTotal: 0, pausedAt: 0, tick: 0,
    pip: null, discarding: false, restarting: false, wakeLock: null,
  };
  const elapsed = () => ((S.pausedAt || performance.now()) - S.startedAt - S.pausedTotal) / 1000;

  async function startRecording() {
    if (!availableFormats.length) return;
    const mode = getMode();
    const fmt = availableFormats.find(f => f.id === $('#format').value) || availableFormats[0];
    const q = +$('#quality').value;
    S.mode = mode; S.mime = fmt.mime;
    stopPreview();

    try {
      // La ventana PiP debe abrirse con el gesto del usuario, antes de los diálogos de permisos.
      if (mode === 'screen-cam' && CAN_DOC_PIP) await openDocPip().catch(() => {});

      if (mode !== 'screen') {
        S.cam = await navigator.mediaDevices.getUserMedia({ video: mode === 'cam' ? camConstraints() : { ...camConstraints(), width: { ideal: 640 }, height: { ideal: 640 } }, audio: false });
      }
      const micC = micConstraints();
      if (micC) {
        try { S.mic = await navigator.mediaDevices.getUserMedia({ audio: micC, video: false }); }
        catch (e) { toast('Sin micrófono: ' + permissionMsg(e)); }
      }
      if (mode !== 'cam') {
        S.screen = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: Math.round(q * 16 / 9) }, height: { ideal: q }, frameRate: { ideal: 30, max: 60 } },
          audio: $('#sysAudio').checked ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : false,
          selfBrowserSurface: 'exclude',
          surfaceSwitching: 'include',
          systemAudio: 'include',
          monitorTypeSurfaces: 'include',
        });
        S.screen.getVideoTracks()[0].addEventListener('ended', () => { if (S.recorder && S.recorder.state !== 'inactive') stopRecording(); });
      }
    } catch (err) {
      cleanupStreams();
      return toast(permissionMsg(err), 5000);
    }

    // Componer el stream final: vídeo + audio mezclado
    const videoTrack = (S.screen || S.cam).getVideoTracks()[0];
    const audioSources = [S.mic, S.screen].filter(s => s && s.getAudioTracks().length);
    let audioTracks = [];
    if (audioSources.length === 1) {
      audioTracks = audioSources[0].getAudioTracks();
    } else if (audioSources.length > 1) {
      S.mixCtx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = S.mixCtx.createMediaStreamDestination();
      audioSources.forEach(s => S.mixCtx.createMediaStreamSource(s).connect(dest));
      audioTracks = dest.stream.getAudioTracks();
    }
    S.out = new MediaStream([videoTrack, ...audioTracks]);

    // Escenario en vivo
    const live = $('#liveVideo');
    live.srcObject = mode === 'cam' ? S.cam : S.screen;
    $('.live-stage').classList.toggle('mirror', mode === 'cam' && isMirrored(S.cam));
    $('#bubbleBtn').hidden = !(mode === 'screen-cam' && S.cam && !S.pip && CAN_PIP);
    $('#liveHint').textContent = mode === 'screen-cam'
      ? (S.pip ? 'La burbuja de cámara flota sobre todas las ventanas: aparecerá en el vídeo si compartes la pantalla completa. Puedes controlar la grabación desde ella.'
               : 'Pulsa «Burbuja» para que tu cámara flote sobre las demás ventanas (se grabará si compartes la pantalla completa).')
      : mode === 'screen' ? 'Puedes cambiar de ventana libremente. Vuelve aquí o usa «Dejar de compartir» del navegador para terminar.'
      : IS_MOBILE ? 'La pantalla se mantiene encendida mientras grabas.' : 'Atajos: P pausa · S termina.';
    show('recording');

    if ($('#countdown').checked) await countdown(3);
    if (!S.out) return; // descartado durante la cuenta atrás

    beginRecorder();
    try { S.wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
  }

  function beginRecorder() {
    S.chunks = [];
    const q = +$('#quality').value;
    const vbps = q >= 1440 ? 8e6 : q >= 1080 ? 5e6 : 2.5e6;
    try {
      S.recorder = new MediaRecorder(S.out, { mimeType: S.mime, videoBitsPerSecond: vbps, audioBitsPerSecond: 128000 });
    } catch {
      S.recorder = new MediaRecorder(S.out);
      S.mime = S.recorder.mimeType || 'video/webm';
    }
    S.recorder.ondataavailable = (e) => { if (e.data && e.data.size) S.chunks.push(e.data); };
    S.recorder.onstop = onRecorderStop;
    S.recorder.start(1000);
    S.startedAt = performance.now(); S.pausedTotal = 0; S.pausedAt = 0;
    setPausedUI(false);
    clearInterval(S.tick);
    S.tick = setInterval(updateTimer, 250);
    updateTimer();
  }

  function updateTimer() {
    const t = fmtTime(elapsed());
    $('#timer').textContent = t;
    if (S.pip) { const el = S.pip.document.getElementById('pt'); if (el) el.textContent = t; }
    document.title = (S.pausedAt ? '❚❚ ' : '● ') + t + ' · Ballixart Rec';
  }

  function togglePause() {
    const r = S.recorder;
    if (!r || r.state === 'inactive') return;
    if (r.state === 'recording') { r.pause(); S.pausedAt = performance.now(); setPausedUI(true); }
    else { r.resume(); S.pausedTotal += performance.now() - S.pausedAt; S.pausedAt = 0; setPausedUI(false); }
    updateTimer();
  }
  function setPausedUI(p) {
    $('.live').classList.toggle('paused', p);
    $('#liveState').textContent = p ? 'EN PAUSA' : 'GRABANDO';
    $('#pauseBtn span').textContent = p ? 'Seguir' : 'Pausa';
    $('#pauseBtn svg').innerHTML = p ? '<path d="M7 5l12 7-12 7z"/>' : '<path d="M7 5h3v14H7zM14 5h3v14h-3z"/>';
    if (S.pip) {
      const b = S.pip.document.getElementById('pp');
      if (b) b.innerHTML = p ? '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>';
      S.pip.document.body.classList.toggle('paused', p);
    }
  }

  function stopRecording() {
    if (S.recorder && S.recorder.state !== 'inactive') {
      if (S.pausedAt) { S.pausedTotal += performance.now() - S.pausedAt; S.pausedAt = 0; }
      S.duration = elapsed();
      S.recorder.stop();
    } else {
      cleanupAll(); show('record');
    }
  }
  function discardRecording() {
    if (S.recorder && S.recorder.state !== 'inactive' && elapsed() > 5 && !confirm('¿Descartar esta grabación? No se podrá recuperar.')) return;
    S.discarding = true;
    if (S.recorder && S.recorder.state !== 'inactive') S.recorder.stop();
    else { cleanupAll(); show('record'); toast('Grabación descartada'); }
  }
  function restartRecording() {
    if (!S.recorder || S.recorder.state === 'inactive') return;
    if (elapsed() > 5 && !confirm('¿Reiniciar? Se perderá lo grabado hasta ahora.')) return;
    S.restarting = true;
    S.recorder.stop();
  }

  async function onRecorderStop() {
    clearInterval(S.tick);
    if (S.restarting) {
      S.restarting = false;
      if ($('#countdown').checked) await countdown(3);
      return beginRecorder();
    }
    const chunks = S.chunks, mime = S.mime, mode = S.mode, duration = S.duration;
    const discarded = S.discarding;
    cleanupAll();
    if (discarded) { show('record'); return toast('Grabación descartada'); }
    if (!chunks.length) { show('record'); return toast('No se grabó ningún dato.'); }

    busy(true, 'Guardando grabación…');
    const blob = new Blob(chunks, { type: mime.split(';')[0] });
    const info = await makeThumb(blob);
    const rec = {
      id: uid(), title: defaultTitle(), created: Date.now(), mode,
      duration: info.duration || duration || 0, mime: blob.type, size: blob.size,
      width: info.width, height: info.height, blob, thumb: info.thumb,
    };
    try { await DB.put(rec); } catch (e) { toast('No se pudo guardar en el dispositivo: ' + e.message, 6000); }
    busy(false);
    updateCount();
    openReview(rec);
    toast('Grabación guardada en tu biblioteca');
  }

  function cleanupStreams() {
    [S.screen, S.cam, S.mic].forEach(stopStream);
    S.screen = S.cam = S.mic = null;
    if (S.mixCtx) { S.mixCtx.close().catch(() => {}); S.mixCtx = null; }
    closePip();
  }
  function cleanupAll() {
    clearInterval(S.tick);
    cleanupStreams();
    S.out = null; S.recorder = null; S.chunks = []; S.discarding = false; S.restarting = false;
    $('#liveVideo').srcObject = null;
    if (S.wakeLock) { S.wakeLock.release().catch(() => {}); S.wakeLock = null; }
    document.title = 'Ballixart Rec';
  }

  function countdown(n) {
    return new Promise(async (res) => {
      const el = $('#countdown'), num = $('#countNum');
      el.hidden = false;
      for (let i = n; i > 0; i--) {
        num.textContent = i;
        num.style.animation = 'none'; void num.offsetWidth; num.style.animation = '';
        await sleep(1000);
        if (!S.out) break;
      }
      el.hidden = true;
      res();
    });
  }

  // ───────── Burbuja de cámara (Picture-in-Picture) ─────────
  async function openDocPip() {
    const w = await window.documentPictureInPicture.requestWindow({ width: 240, height: 300 });
    S.pip = w;
    const d = w.document;
    d.title = 'Ballixart Rec';
    const style = d.createElement('style');
    style.textContent = `
      html,body{margin:0;height:100%;background:#fff;font-family:Montserrat,system-ui,sans-serif;overflow:hidden}
      body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
      .bub{width:min(78vw,74vh);aspect-ratio:1;border-radius:50%;overflow:hidden;border:4px solid #008ACD;box-shadow:0 0 0 3px #00147E;background:#00147E}
      .bub video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
      .bar{display:flex;align-items:center;gap:4px;background:#00147E;border-radius:4px;padding:4px}
      .bar span{color:#fff;font-weight:700;font-variant-numeric:tabular-nums;padding:0 8px;font-size:14px}
      .bar span::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff4d5e;margin-right:6px;vertical-align:1px}
      body.paused .bar span::before{background:#ffc542}
      button{width:32px;height:32px;border:0;border-radius:4px;background:transparent;color:#cfe6f5;cursor:pointer;display:grid;place-items:center}
      button:hover{background:rgba(255,255,255,.12);color:#fff}
      button.stop{background:#008ACD;color:#fff}
      svg{width:18px;height:18px;fill:currentColor}`;
    d.head.append(style);
    d.body.innerHTML = `
      <div class="bub"><video autoplay muted playsinline></video></div>
      <div class="bar"><span id="pt">00:00</span>
        <button id="pp" title="Pausa"><svg viewBox="0 0 24 24"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg></button>
        <button id="ps" class="stop" title="Terminar"><svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1"/></svg></button>
      </div>`;
    d.getElementById('pp').onclick = togglePause;
    d.getElementById('ps').onclick = stopRecording;
    w.addEventListener('pagehide', () => { S.pip = null; if (S.recorder && S.mode === 'screen-cam' && CAN_PIP) $('#bubbleBtn').hidden = false; });
    // El stream de cámara llega después; lo asignamos en cuanto exista.
    const attach = () => {
      if (!S.pip) return;
      if (S.cam) { d.querySelector('video').srcObject = S.cam; d.querySelector('video').style.transform = isMirrored(S.cam) ? 'scaleX(-1)' : 'none'; }
      else setTimeout(attach, 200);
    };
    attach();
  }
  function closePip() {
    if (S.pip) { try { S.pip.close(); } catch {} S.pip = null; }
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
  }
  async function showBubble() {
    if (!S.cam) return;
    if (CAN_DOC_PIP) { try { await openDocPip(); $('#bubbleBtn').hidden = true; return; } catch {} }
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.srcObject = S.cam;
    await v.play().catch(() => {});
    try { await v.requestPictureInPicture(); } catch (e) { toast('No se pudo abrir la burbuja: ' + e.message); }
  }

  // ───────── Revisar ─────────
  let currentRec = null, playerURL = null;

  async function openReview(rec) {
    currentRec = rec;
    if (playerURL) URL.revokeObjectURL(playerURL);
    playerURL = URL.createObjectURL(rec.blob);
    const p = $('#player');
    p.src = playerURL;
    p.playbackRate = 1;
    $$('#speedChips button').forEach(b => b.classList.toggle('on', b.dataset.rate === '1'));
    $('#titleInput').value = rec.title;
    renderMeta();
    show('review');
    const dur = await ensureDuration(p);
    if (dur && Math.abs(dur - rec.duration) > 0.5) { rec.duration = dur; DB.put(rec).catch(() => {}); renderMeta(); }
    setupTrim(rec.duration || dur);
    $('#trimBox').hidden = !(p.captureStream || p.mozCaptureStream);
    $('#shareBtn').textContent = canShareFile(rec) ? 'Compartir' : 'Copiar vídeo';
    if (!canShareFile(rec) && !(navigator.clipboard && window.ClipboardItem)) $('#shareBtn').hidden = true; else $('#shareBtn').hidden = false;
  }
  function renderMeta() {
    const r = currentRec;
    const res = r.height ? ` · ${r.width}×${r.height}` : '';
    $('#reviewMeta').textContent = `${fmtTime(r.duration)} · ${fmtSize(r.size)} · ${extFor(r.mime).toUpperCase()}${res} · ${fmtDate(r.created)}`;
  }
  const fileOf = (rec) => new File([rec.blob], safeName(rec.title) + '.' + extFor(rec.mime), { type: rec.blob.type || rec.mime });
  const canShareFile = (rec) => { try { return !!(navigator.canShare && navigator.canShare({ files: [fileOf(rec)] })); } catch { return false; } };

  $('#titleInput').addEventListener('change', async () => {
    if (!currentRec) return;
    currentRec.title = $('#titleInput').value.trim() || defaultTitle();
    $('#titleInput').value = currentRec.title;
    await DB.put(currentRec);
    toast('Título actualizado');
  });
  $('#titleInput').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });

  $('#downloadBtn').addEventListener('click', () => {
    if (!currentRec) return;
    const a = document.createElement('a');
    a.href = playerURL; a.download = fileOf(currentRec).name;
    document.body.append(a); a.click(); a.remove();
  });
  $('#shareBtn').addEventListener('click', async () => {
    if (!currentRec) return;
    const file = fileOf(currentRec);
    if (canShareFile(currentRec)) {
      try { await navigator.share({ files: [file], title: currentRec.title, text: currentRec.title + ' — grabado con Ballixart Rec' }); }
      catch (e) { if (e.name !== 'AbortError') toast('No se pudo compartir: ' + e.message); }
    } else {
      try { await navigator.clipboard.write([new ClipboardItem({ [file.type]: file })]); toast('Vídeo copiado: pégalo en tu chat o correo'); }
      catch { toast('Tu navegador no permite compartir el archivo directamente. Usa «Descargar».'); }
    }
  });
  $('#deleteBtn').addEventListener('click', async () => {
    if (!currentRec || !confirm(`¿Eliminar «${currentRec.title}»? No se puede deshacer.`)) return;
    await DB.del(currentRec.id);
    currentRec = null;
    $('#player').removeAttribute('src'); $('#player').load();
    updateCount();
    show('library');
    toast('Grabación eliminada');
  });
  $('#newRecBtn').addEventListener('click', () => show('record'));
  $('#speedChips').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $('#player').playbackRate = +b.dataset.rate;
    $$('#speedChips button').forEach(x => x.classList.toggle('on', x === b));
  });

  // ───────── Recortar ─────────
  function setupTrim(dur) {
    const s = $('#trimStart'), e = $('#trimEnd');
    s.max = e.max = dur || 0;
    s.value = 0; e.value = dur || 0;
    syncTrim();
  }
  function syncTrim(changed) {
    const s = $('#trimStart'), e = $('#trimEnd');
    if (+s.value > +e.value - 0.5) { if (changed === s) s.value = Math.max(0, +e.value - 0.5); else e.value = Math.min(+e.max, +s.value + 0.5); }
    $('#trimStartOut').textContent = fmtShort(+s.value);
    $('#trimEndOut').textContent = fmtShort(+e.value);
  }
  $('#trimStart').addEventListener('input', e => { syncTrim(e.target); $('#player').currentTime = +e.target.value; });
  $('#trimEnd').addEventListener('input', e => { syncTrim(e.target); $('#player').currentTime = +e.target.value; });
  $('#setStartBtn').addEventListener('click', () => { $('#trimStart').value = $('#player').currentTime; syncTrim($('#trimStart')); });
  $('#setEndBtn').addEventListener('click', () => { $('#trimEnd').value = $('#player').currentTime; syncTrim($('#trimEnd')); });

  $('#trimBtn').addEventListener('click', async () => {
    const rec = currentRec; if (!rec) return;
    const start = +$('#trimStart').value, end = +$('#trimEnd').value;
    if (start <= 0.05 && end >= rec.duration - 0.05) return toast('Mueve el inicio o el fin para recortar.');
    const p = $('#player');
    const cap = p.captureStream ? p.captureStream.bind(p) : p.mozCaptureStream.bind(p);
    p.pause(); p.playbackRate = 1; p.controls = false;
    p.currentTime = start;
    await new Promise(r => { p.onseeked = r; setTimeout(r, 1500); });
    const stream = cap();
    const mime = supported(rec.mime) ? rec.mime : (availableFormats[0] || {}).mime;
    const chunks = [];
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 5e6 } : undefined);
    mr.ondataavailable = ev => ev.data.size && chunks.push(ev.data);
    let cancelled = false;
    $('#busyCancel').hidden = false;
    $('#busyCancel').onclick = () => { cancelled = true; p.pause(); mr.stop(); };
    busy(true, 'Recortando… (' + fmtShort(end - start) + ')', 0);
    $('#busy').style.background = 'rgba(255,255,255,.35)';
    const done = new Promise(r => { mr.onstop = r; });
    mr.start(500);
    await p.play();
    const watch = setInterval(() => {
      busy(true, null, (p.currentTime - start) / (end - start));
      if (p.currentTime >= end || p.ended) { clearInterval(watch); p.pause(); if (mr.state !== 'inactive') mr.stop(); }
    }, 50);
    await done;
    clearInterval(watch);
    stream.getTracks().forEach(t => t.stop());
    p.controls = true;
    $('#busyCancel').hidden = true; $('#busy').style.background = '';
    if (cancelled || !chunks.length) { busy(false); return toast('Recorte cancelado'); }
    busy(true, 'Guardando copia…');
    const blob = new Blob(chunks, { type: (mime || 'video/webm').split(';')[0] });
    const info = await makeThumb(blob);
    const copy = { id: uid(), title: rec.title + ' (recorte)', created: Date.now(), mode: rec.mode, duration: info.duration || end - start, mime: blob.type, size: blob.size, width: info.width, height: info.height, blob, thumb: info.thumb };
    await DB.put(copy);
    busy(false);
    updateCount();
    openReview(copy);
    toast('Copia recortada guardada');
  });

  // ───────── Biblioteca ─────────
  const thumbURLs = [];
  async function renderLibrary() {
    thumbURLs.splice(0).forEach(u => URL.revokeObjectURL(u));
    let recs = [];
    try { recs = await DB.all(); } catch { toast('No se pudo leer la biblioteca'); }
    recs.sort((a, b) => b.created - a.created);
    const q = $('#libSearch').value.trim().toLowerCase();
    const list = q ? recs.filter(r => r.title.toLowerCase().includes(q)) : recs;
    const grid = $('#libGrid');
    grid.innerHTML = '';
    $('#libEmpty').hidden = recs.length > 0;
    for (const r of list) {
      const b = document.createElement('button');
      b.className = 'item'; b.type = 'button';
      let bg = '';
      if (r.thumb) { const u = URL.createObjectURL(r.thumb); thumbURLs.push(u); bg = `style="background-image:url('${u}')"`; }
      b.innerHTML = `<div class="thumb" ${bg}><span class="dur">${fmtTime(r.duration)}</span></div>
        <div class="item-body"><div class="item-title"></div><div class="item-meta">${fmtDate(r.created)} · ${fmtSize(r.size)}</div></div>`;
      b.querySelector('.item-title').textContent = r.title;
      b.addEventListener('click', () => openReview(r));
      grid.append(b);
    }
    const total = recs.reduce((s, r) => s + (r.size || 0), 0);
    let info = recs.length ? `${recs.length} grabación${recs.length > 1 ? 'es' : ''} · ${fmtSize(total)} en este dispositivo.` : '';
    try {
      const est = await navigator.storage?.estimate();
      if (est && est.quota) info += ` Espacio disponible: ${fmtSize(Math.max(0, est.quota - est.usage))}.`;
    } catch {}
    $('#storageInfo').textContent = info + ' Las grabaciones se guardan solo en este navegador: descarga las importantes.';
    updateCount(recs.length);
  }
  $('#libSearch').addEventListener('input', renderLibrary);

  async function updateCount(n) {
    if (n == null) { try { n = (await DB.all()).length; } catch { n = 0; } }
    $('#libCount').textContent = n || '';
  }

  // Importar vídeos (p. ej. del grabador de pantalla nativo de Android)
  $('#importInput').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    let last;
    for (const [i, f] of files.entries()) {
      busy(true, `Importando ${i + 1} de ${files.length}…`);
      const info = await makeThumb(f);
      last = { id: uid(), title: f.name.replace(/\.[^.]+$/, ''), created: Date.now(), mode: 'import', duration: info.duration, mime: f.type || 'video/mp4', size: f.size, width: info.width, height: info.height, blob: f, thumb: info.thumb };
      await DB.put(last);
    }
    busy(false);
    updateCount();
    if (files.length === 1) openReview(last); else show('library');
    toast(files.length > 1 ? `${files.length} vídeos importados` : 'Vídeo importado');
  });

  // ───────── Eventos ─────────
  $('#startBtn').addEventListener('click', startRecording);
  $('#pauseBtn').addEventListener('click', togglePause);
  $('#stopBtn').addEventListener('click', stopRecording);
  $('#discardBtn').addEventListener('click', discardRecording);
  $('#restartBtn').addEventListener('click', restartRecording);
  $('#bubbleBtn').addEventListener('click', showBubble);
  document.addEventListener('keydown', (e) => {
    if (currentView !== 'recording' || e.target.matches('input, select, textarea')) return;
    if (e.key === 'p' || e.key === 'P') togglePause();
    if (e.key === 's' || e.key === 'S') stopRecording();
  });
  window.addEventListener('beforeunload', (e) => {
    if (S.recorder && S.recorder.state !== 'inactive') { e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && S.recorder && !S.wakeLock) { try { S.wakeLock = await navigator.wakeLock?.request('screen'); } catch {} }
  });

  // ───────── Arranque ─────────
  initSetup();
  updateCount();
  navigator.storage?.persist?.().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  const params = new URLSearchParams(location.search);
  if (params.get('view') === 'library') show('library');
})();
