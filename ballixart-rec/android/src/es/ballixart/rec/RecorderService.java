package es.ballixart.rec;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Outline;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.SurfaceTexture;
import android.graphics.drawable.GradientDrawable;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.MediaRecorder;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.Size;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.Locale;

/** Servicio en primer plano que graba la pantalla (y la burbuja de cámara flotante). */
public class RecorderService extends Service {

    public static final String ACTION_START = "es.ballixart.rec.START";
    public static final String ACTION_STOP = "es.ballixart.rec.STOP";
    public static final String ACTION_PAUSE = "es.ballixart.rec.PAUSE";
    public static final String EXTRA_CODE = "code";
    public static final String EXTRA_DATA = "data";
    public static final String EXTRA_CAM = "cam";
    public static final String EXTRA_MIC = "mic";
    public static final String EXTRA_HQ = "hq";
    public static final String EXTRA_COUNTDOWN = "countdown";

    static final String CH_REC = "rec";
    static final String CH_DONE = "done";
    static final int NOTIF_REC = 1;
    static final int NOTIF_DONE = 2;
    static final int NAVY = 0xFF00147E;
    static final int BLUE = 0xFF008ACD;

    public static volatile boolean running = false;

    private final Handler ui = new Handler(Looper.getMainLooper());
    private MediaProjection projection;
    private VirtualDisplay virtualDisplay;
    private MediaRecorder recorder;
    private ParcelFileDescriptor pfd;
    private Uri outUri;
    private boolean recording, paused, stopping, failed, withMic, withCam, hq;
    private long startedAt, pausedAt, pausedTotal;

    // Burbuja
    private WindowManager wm;
    private LinearLayout overlay;
    private WindowManager.LayoutParams overlayParams;
    private FrameLayout bubble;
    private TextureView texture;
    private TextView timerView, pauseView, countView;
    private int bubbleSizeIdx = 1;
    private static final int[] BUBBLE_DP = {96, 140, 200};

    // Cámara
    private CameraDevice camera;
    private CameraCaptureSession session;
    private HandlerThread camThread;
    private Handler camHandler;
    private Size previewSize;

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_START.equals(action)) {
            if (running) return START_NOT_STICKY;
            start(intent);
        } else if (ACTION_STOP.equals(action)) {
            stopRecording();
        } else if (ACTION_PAUSE.equals(action)) {
            togglePause();
        }
        return START_NOT_STICKY;
    }

    // ───────── Inicio ─────────
    private void start(Intent intent) {
        withCam = intent.getBooleanExtra(EXTRA_CAM, false);
        withMic = intent.getBooleanExtra(EXTRA_MIC, false);
        hq = intent.getBooleanExtra(EXTRA_HQ, true);
        boolean countdown = intent.getBooleanExtra(EXTRA_COUNTDOWN, true);
        createChannels();

        int type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION;
        if (Build.VERSION.SDK_INT >= 30) {
            if (withCam) type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
            if (withMic) type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
        }
        try {
            startForeground(NOTIF_REC, buildRecNotification(getString(R.string.app_name) + " · preparando…"), type);
        } catch (RuntimeException e) {
            // Si el sistema rechaza cámara/micrófono, seguimos solo con la pantalla.
            withCam = false;
            withMic = false;
            startForeground(NOTIF_REC, buildRecNotification("Preparando…"), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        }
        running = true;

        MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        Intent data = intent.getParcelableExtra(EXTRA_DATA);
        int code = intent.getIntExtra(EXTRA_CODE, 0);
        try {
            projection = mpm.getMediaProjection(code, data);
        } catch (RuntimeException e) {
            projection = null;
        }
        if (projection == null) {
            fail("No se pudo iniciar la captura de pantalla.");
            return;
        }
        projection.registerCallback(new MediaProjection.Callback() {
            @Override public void onStop() { ui.post(new Runnable() { public void run() { stopRecording(); } }); }
        }, ui);

        wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        if (withCam && Settings.canDrawOverlays(this)) showOverlay();

        if (countdown) runCountdown(3); else ui.postDelayed(new Runnable() { public void run() { startRecorder(); } }, 400);
    }

    private void runCountdown(final int n) {
        if (stopping) return;
        if (n == 0) {
            if (countView != null) countView.setVisibility(View.GONE);
            startRecorder();
            return;
        }
        if (countView != null) { countView.setText(String.valueOf(n)); countView.setVisibility(View.VISIBLE); }
        else if (n == 3) Toast.makeText(this, "La grabación empieza en 3 segundos", Toast.LENGTH_SHORT).show();
        if (timerView != null) timerView.setText("Empieza en " + n);
        ui.postDelayed(new Runnable() { public void run() { runCountdown(n - 1); } }, 1000);
    }

    private void startRecorder() {
        if (stopping) return;
        try {
            ContentValues v = new ContentValues();
            String name = "Ballixart Rec " + new SimpleDateFormat("yyyy-MM-dd HH.mm.ss", Locale.US).format(new Date()) + ".mp4";
            v.put(MediaStore.Video.Media.DISPLAY_NAME, name);
            v.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
            v.put(MediaStore.Video.Media.RELATIVE_PATH, MainActivity.RELATIVE_PATH);
            v.put(MediaStore.Video.Media.IS_PENDING, 1);
            outUri = getContentResolver().insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, v);
            if (outUri == null) throw new IllegalStateException("No se pudo crear el archivo");
            pfd = getContentResolver().openFileDescriptor(outUri, "rw");

            // Si el codificador rechaza la calidad alta, reintentamos en 720p.
            int[] size = captureSize(hq);
            try {
                prepareRecorder(size, hq);
            } catch (Exception first) {
                if (recorder != null) { recorder.release(); recorder = null; }
                size = captureSize(false);
                prepareRecorder(size, false);
            }

            virtualDisplay = projection.createVirtualDisplay("BallixartRec", size[0], size[1], size[2],
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, recorder.getSurface(), null, null);
            recorder.start();
            recording = true;
            startedAt = SystemClock.elapsedRealtime();
            pausedTotal = 0;
            updateRecNotification();
            ui.post(tick);
        } catch (Exception e) {
            fail("No se pudo grabar: " + e.getMessage());
        }
    }

    private void prepareRecorder(int[] size, boolean high) throws Exception {
        recorder = Build.VERSION.SDK_INT >= 31 ? new MediaRecorder(this) : new MediaRecorder();
        if (withMic) recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
        recorder.setVideoSource(MediaRecorder.VideoSource.SURFACE);
        recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
        recorder.setOutputFile(pfd.getFileDescriptor());
        recorder.setVideoEncoder(MediaRecorder.VideoEncoder.H264);
        if (withMic) {
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioEncodingBitRate(128000);
            recorder.setAudioSamplingRate(44100);
        }
        recorder.setVideoSize(size[0], size[1]);
        recorder.setVideoFrameRate(30);
        recorder.setVideoEncodingBitRate(high ? 8000000 : 4000000);
        recorder.prepare();
    }

    /** Tamaño de captura: resolución real limitada a 720p/1080p y múltiplo de 16 (requisito habitual del codificador). */
    private int[] captureSize(boolean high) {
        DisplayMetrics m = getResources().getDisplayMetrics();
        int w, h;
        if (Build.VERSION.SDK_INT >= 30) {
            Rect b = wm.getMaximumWindowMetrics().getBounds();
            w = b.width(); h = b.height();
        } else {
            DisplayMetrics real = new DisplayMetrics();
            wm.getDefaultDisplay().getRealMetrics(real);
            w = real.widthPixels; h = real.heightPixels;
        }
        // Muchos codificadores H.264 no pasan de 1920 px en el lado largo.
        int maxShort = high ? 1080 : 720, maxLong = high ? 1920 : 1280;
        float s = Math.min(1f, Math.min((float) maxShort / Math.min(w, h), (float) maxLong / Math.max(w, h)));
        w = Math.round(w * s); h = Math.round(h * s);
        w = Math.max(16, w / 16 * 16);
        h = Math.max(16, h / 16 * 16);
        return new int[]{w, h, m.densityDpi};
    }

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (!recording) return;
            if (timerView != null) timerView.setText(format(elapsed()));
            ui.postDelayed(this, 500);
        }
    };

    private long elapsed() {
        long now = paused ? pausedAt : SystemClock.elapsedRealtime();
        return now - startedAt - pausedTotal;
    }

    static String format(long ms) {
        long s = ms / 1000;
        return String.format(Locale.US, "%02d:%02d", s / 60, s % 60);
    }

    private void togglePause() {
        if (!recording || recorder == null) return;
        try {
            if (!paused) {
                recorder.pause();
                paused = true;
                pausedAt = SystemClock.elapsedRealtime();
            } else {
                recorder.resume();
                paused = false;
                pausedTotal += SystemClock.elapsedRealtime() - pausedAt;
            }
        } catch (RuntimeException e) {
            return;
        }
        if (pauseView != null) pauseView.setText(paused ? "▶" : "❚❚");
        if (timerView != null) timerView.setText(format(elapsed()));
        updateRecNotification();
    }

    // ───────── Fin ─────────
    private void stopRecording() {
        if (stopping) return;
        stopping = true;
        ui.removeCallbacksAndMessages(null);
        boolean ok = false;
        if (recorder != null) {
            if (recording) {
                try {
                    if (paused) recorder.resume();
                    recorder.stop();
                    ok = true;
                } catch (RuntimeException e) {
                    ok = false;
                }
            }
            recorder.release();
            recorder = null;
        }
        recording = false;
        if (virtualDisplay != null) { virtualDisplay.release(); virtualDisplay = null; }
        if (projection != null) { try { projection.stop(); } catch (RuntimeException ignored) { } projection = null; }
        closeCamera();
        removeOverlay();
        if (pfd != null) { try { pfd.close(); } catch (Exception ignored) { } pfd = null; }

        if (outUri != null) {
            if (ok) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Video.Media.IS_PENDING, 0);
                getContentResolver().update(outUri, v, null, null);
                notifySaved(outUri);
                Toast.makeText(this, "Vídeo guardado en Películas/BallixartRec", Toast.LENGTH_LONG).show();
            } else {
                getContentResolver().delete(outUri, null, null);
                if (!failed) Toast.makeText(this, "La grabación era demasiado corta y no se guardó", Toast.LENGTH_LONG).show();
            }
            outUri = null;
        }
        running = false;
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
        MainActivity.notifyChanged();
    }

    private void fail(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
        failed = true;
        recording = false;
        stopRecording();
    }

    @Override
    public void onDestroy() {
        if (!stopping) stopRecording();
        super.onDestroy();
    }

    // ───────── Notificaciones ─────────
    private void createChannels() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel rec = new NotificationChannel(CH_REC, "Grabación en curso", NotificationManager.IMPORTANCE_LOW);
        rec.setShowBadge(false);
        nm.createNotificationChannel(rec);
        nm.createNotificationChannel(new NotificationChannel(CH_DONE, "Vídeos guardados", NotificationManager.IMPORTANCE_DEFAULT));
    }

    private PendingIntent serviceIntent(String action, int req) {
        Intent i = new Intent(this, RecorderService.class).setAction(action);
        return PendingIntent.getService(this, req, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private Notification buildRecNotification(String text) {
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Notification.Builder b = new Notification.Builder(this, CH_REC)
                .setSmallIcon(R.drawable.ic_notif)
                .setColor(NAVY)
                .setContentTitle(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_SERVICE)
                .setContentIntent(PendingIntent.getActivity(this, 10, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        if (recording) {
            b.addAction(new Notification.Action.Builder(null, paused ? "Reanudar" : "Pausar", serviceIntent(ACTION_PAUSE, 1)).build());
            if (!paused) b.setUsesChronometer(true).setWhen(System.currentTimeMillis() - elapsed()).setShowWhen(true);
        }
        b.addAction(new Notification.Action.Builder(null, "Terminar", serviceIntent(ACTION_STOP, 2)).build());
        if (Build.VERSION.SDK_INT >= 31) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        return b.build();
    }

    private void updateRecNotification() {
        String t = paused ? "En pausa · " + format(elapsed()) : "Grabando pantalla";
        getSystemService(NotificationManager.class).notify(NOTIF_REC, buildRecNotification(t));
    }

    private void notifySaved(Uri uri) {
        Intent view = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "video/mp4")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        Intent share = Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("video/mp4")
                .putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION), "Compartir vídeo")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Notification n = new Notification.Builder(this, CH_DONE)
                .setSmallIcon(R.drawable.ic_notif)
                .setColor(NAVY)
                .setContentTitle("Vídeo guardado")
                .setContentText("Toca para verlo en tu biblioteca de Ballixart Rec")
                .setAutoCancel(true)
                .setContentIntent(PendingIntent.getActivity(this, 20, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT))
                .addAction(new Notification.Action.Builder(null, "Ver", PendingIntent.getActivity(this, 21, view, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT)).build())
                .addAction(new Notification.Action.Builder(null, "Compartir", PendingIntent.getActivity(this, 22, share, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT)).build())
                .build();
        getSystemService(NotificationManager.class).notify(NOTIF_DONE, n);
    }

    // ───────── Burbuja flotante ─────────
    private int dp(float v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private void showOverlay() {
        overlay = new LinearLayout(this);
        overlay.setOrientation(LinearLayout.VERTICAL);
        overlay.setGravity(Gravity.CENTER_HORIZONTAL);

        bubble = new FrameLayout(this);
        bubble.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View view, Outline outline) { outline.setOval(0, 0, view.getWidth(), view.getHeight()); }
        });
        bubble.setClipToOutline(true);
        bubble.setBackgroundColor(NAVY);
        GradientDrawable ring = new GradientDrawable();
        ring.setShape(GradientDrawable.OVAL);
        ring.setStroke(dp(4), BLUE);
        ring.setColor(Color.TRANSPARENT);
        bubble.setForeground(ring);

        texture = new TextureView(this);
        texture.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            @Override public void onSurfaceTextureAvailable(SurfaceTexture st, int w, int h) { openCamera(st); }
            @Override public void onSurfaceTextureSizeChanged(SurfaceTexture st, int w, int h) { applyTransform(); }
            @Override public boolean onSurfaceTextureDestroyed(SurfaceTexture st) { return true; }
            @Override public void onSurfaceTextureUpdated(SurfaceTexture st) { }
        });
        bubble.addView(texture, new FrameLayout.LayoutParams(-1, -1));

        countView = new TextView(this);
        countView.setTextColor(Color.WHITE);
        countView.setTextSize(48);
        countView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        countView.setGravity(Gravity.CENTER);
        countView.setBackgroundColor(0xB300147E);
        countView.setVisibility(View.GONE);
        bubble.addView(countView, new FrameLayout.LayoutParams(-1, -1));

        int s = dp(BUBBLE_DP[bubbleSizeIdx]);
        overlay.addView(bubble, new LinearLayout.LayoutParams(s, s));

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        GradientDrawable barBg = new GradientDrawable();
        barBg.setColor(NAVY);
        barBg.setCornerRadius(dp(6));
        bar.setBackground(barBg);
        bar.setPadding(dp(10), dp(4), dp(4), dp(4));

        timerView = new TextView(this);
        timerView.setTextColor(Color.WHITE);
        timerView.setTextSize(14);
        timerView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        timerView.setText("00:00");
        bar.addView(timerView);

        pauseView = barButton("❚❚", false);
        pauseView.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { togglePause(); } });
        bar.addView(pauseView);
        TextView stop = barButton("■", true);
        stop.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { stopRecording(); } });
        bar.addView(stop);

        LinearLayout.LayoutParams barLp = new LinearLayout.LayoutParams(-2, -2);
        barLp.topMargin = dp(6);
        overlay.addView(bar, barLp);

        int type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        overlayParams = new WindowManager.LayoutParams(-2, -2, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                        | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT);
        overlayParams.gravity = Gravity.TOP | Gravity.START;
        overlayParams.x = dp(16);
        overlayParams.y = getResources().getDisplayMetrics().heightPixels / 2;

        bubble.setOnTouchListener(new View.OnTouchListener() {
            float downX, downY; int startX, startY; boolean moved;
            @Override public boolean onTouch(View v, MotionEvent e) {
                switch (e.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        downX = e.getRawX(); downY = e.getRawY();
                        startX = overlayParams.x; startY = overlayParams.y; moved = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = e.getRawX() - downX, dy = e.getRawY() - downY;
                        if (Math.abs(dx) > dp(6) || Math.abs(dy) > dp(6)) moved = true;
                        if (moved) {
                            overlayParams.x = startX + Math.round(dx);
                            overlayParams.y = startY + Math.round(dy);
                            wm.updateViewLayout(overlay, overlayParams);
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (!moved) cycleBubbleSize();
                        return true;
                }
                return false;
            }
        });

        try {
            wm.addView(overlay, overlayParams);
        } catch (RuntimeException e) {
            overlay = null;
            timerView = null; pauseView = null; countView = null;
        }
    }

    private TextView barButton(String label, boolean primary) {
        TextView b = new TextView(this);
        b.setText(label);
        b.setTextColor(Color.WHITE);
        b.setTextSize(16);
        b.setGravity(Gravity.CENTER);
        if (primary) {
            GradientDrawable bg = new GradientDrawable();
            bg.setColor(BLUE);
            bg.setCornerRadius(dp(4));
            b.setBackground(bg);
        }
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(40), dp(36));
        lp.leftMargin = dp(6);
        b.setLayoutParams(lp);
        return b;
    }

    private void cycleBubbleSize() {
        bubbleSizeIdx = (bubbleSizeIdx + 1) % BUBBLE_DP.length;
        int s = dp(BUBBLE_DP[bubbleSizeIdx]);
        LinearLayout.LayoutParams lp = (LinearLayout.LayoutParams) bubble.getLayoutParams();
        lp.width = s; lp.height = s;
        bubble.setLayoutParams(lp);
        bubble.invalidateOutline();
    }

    private void removeOverlay() {
        if (overlay != null && wm != null) {
            try { wm.removeView(overlay); } catch (RuntimeException ignored) { }
        }
        overlay = null; timerView = null; pauseView = null; countView = null;
    }

    // ───────── Cámara frontal ─────────
    private void openCamera(final SurfaceTexture st) {
        if (checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) return;
        try {
            CameraManager cm = (CameraManager) getSystemService(Context.CAMERA_SERVICE);
            String id = null;
            for (String c : cm.getCameraIdList()) {
                Integer facing = cm.getCameraCharacteristics(c).get(CameraCharacteristics.LENS_FACING);
                if (facing != null && facing == CameraCharacteristics.LENS_FACING_FRONT) { id = c; break; }
                if (id == null) id = c;
            }
            if (id == null) return;
            StreamConfigurationMap map = cm.getCameraCharacteristics(id).get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
            previewSize = pickSize(map != null ? map.getOutputSizes(SurfaceTexture.class) : null);
            st.setDefaultBufferSize(previewSize.getWidth(), previewSize.getHeight());
            applyTransform();
            final Surface surface = new Surface(st);

            camThread = new HandlerThread("camera");
            camThread.start();
            camHandler = new Handler(camThread.getLooper());
            cm.openCamera(id, new CameraDevice.StateCallback() {
                @Override public void onOpened(CameraDevice d) {
                    camera = d;
                    try {
                        d.createCaptureSession(Arrays.asList(surface), new CameraCaptureSession.StateCallback() {
                            @Override public void onConfigured(CameraCaptureSession s) {
                                if (camera == null) return;
                                session = s;
                                try {
                                    CaptureRequest.Builder rb = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
                                    rb.addTarget(surface);
                                    rb.set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO);
                                    s.setRepeatingRequest(rb.build(), null, camHandler);
                                } catch (CameraAccessException | IllegalStateException ignored) { }
                            }
                            @Override public void onConfigureFailed(CameraCaptureSession s) { }
                        }, camHandler);
                    } catch (CameraAccessException | IllegalStateException ignored) { }
                }
                @Override public void onDisconnected(CameraDevice d) { d.close(); camera = null; }
                @Override public void onError(CameraDevice d, int error) { d.close(); camera = null; }
            }, camHandler);
        } catch (CameraAccessException | SecurityException | IllegalArgumentException e) {
            Toast.makeText(this, "No se pudo abrir la cámara", Toast.LENGTH_SHORT).show();
        }
    }

    private Size pickSize(Size[] sizes) {
        if (sizes == null || sizes.length == 0) return new Size(640, 480);
        Size best = sizes[0];
        long bestScore = Long.MAX_VALUE;
        for (Size s : sizes) {
            long score = Math.abs((long) s.getWidth() * s.getHeight() - 640L * 480L);
            if (s.getWidth() * 3 == s.getHeight() * 4) score /= 2; // preferimos 4:3
            if (score < bestScore) { bestScore = score; best = s; }
        }
        return best;
    }

    /** Recorte centrado: el sensor entrega una imagen apaisada que se muestra en vertical dentro de un círculo. */
    private void applyTransform() {
        if (texture == null || previewSize == null) return;
        int vw = texture.getWidth(), vh = texture.getHeight();
        if (vw == 0 || vh == 0) return;
        float pw = Math.max(previewSize.getWidth(), previewSize.getHeight());
        float ph = Math.min(previewSize.getWidth(), previewSize.getHeight());
        Matrix m = new Matrix();
        // En vertical la imagen ocupa ph x pw; al estirarse a un cuadrado hay que devolverle la proporción.
        m.setScale(1f, pw / ph, vw / 2f, vh / 2f);
        texture.setTransform(m);
    }

    private void closeCamera() {
        try { if (session != null) session.close(); } catch (RuntimeException ignored) { }
        session = null;
        if (camera != null) { camera.close(); camera = null; }
        if (camThread != null) { camThread.quitSafely(); camThread = null; }
    }
}
