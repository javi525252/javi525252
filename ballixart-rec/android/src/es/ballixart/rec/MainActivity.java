package es.ballixart.rec;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.app.RecoverableSecurityException;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.IntentSender;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.Settings;
import android.text.InputType;
import android.text.format.Formatter;
import android.util.Size;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.lang.ref.WeakReference;
import java.text.DateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;

public class MainActivity extends Activity {

    public static final String RELATIVE_PATH = "Movies/BallixartRec/";
    static final String WEB_URL = "https://ballixart-rec.netlify.app";

    private static final int REQ_PERMS = 1, REQ_CAPTURE = 2, REQ_OVERLAY = 3, REQ_DELETE = 4;
    private static final int NAVY = 0xFF00147E, BLUE = 0xFF008ACD, MUTED = 0xFF5A6382,
            LINE = 0xFFDDE2EF, SOFT = 0xFFF2F4FB, TEXT = 0xFF0B1233;

    private static WeakReference<MainActivity> current = new WeakReference<>(null);

    private SharedPreferences prefs;
    private boolean modeCam = true;
    private TextView modeCamBtn, modeScreenBtn, startBtn, libEmpty;
    private Switch micSw, hqSw, countSw;
    private LinearLayout libList;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private Uri pendingDelete;

    /** El servicio avisa al terminar para refrescar la biblioteca. */
    static void notifyChanged() {
        final MainActivity a = current.get();
        if (a != null) a.ui.postDelayed(new Runnable() { public void run() { a.refresh(); } }, 600);
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("prefs", MODE_PRIVATE);
        modeCam = prefs.getBoolean("modeCam", true);
        buildUi();
    }

    @Override protected void onResume() { super.onResume(); current = new WeakReference<>(this); refresh(); }
    @Override protected void onPause() { super.onPause(); current = new WeakReference<>(null); }

    // ───────── Interfaz ─────────
    private int dp(float v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private TextView text(String s, float size, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(size);
        t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.create("sans-serif-black", Typeface.NORMAL));
        return t;
    }

    private GradientDrawable box(int fill, int stroke, int radius) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(fill);
        if (stroke != 0) g.setStroke(dp(1.5f), stroke);
        g.setCornerRadius(dp(radius));
        return g;
    }

    private LinearLayout card(LinearLayout parent, String title) {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setBackground(box(Color.WHITE, LINE, 4));
        c.setPadding(dp(16), dp(14), dp(16), dp(14));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.topMargin = dp(14);
        parent.addView(c, lp);
        TextView t = text(title.toUpperCase(), 12, NAVY, true);
        t.setLetterSpacing(0.1f);
        c.addView(t);
        return c;
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFitsSystemWindows(true);
        scroll.setBackgroundColor(Color.WHITE);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(14), dp(18), dp(28));
        scroll.addView(root);

        // Cabecera con el logo original
        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.logo);
        head.addView(logo, new LinearLayout.LayoutParams(dp(48), dp(48)));
        TextView brand = text("BALLIXART ", 18, NAVY, true);
        brand.setPadding(dp(10), 0, 0, 0);
        head.addView(brand);
        head.addView(text("REC", 18, BLUE, true));
        root.addView(head);

        TextView h1 = text("GRABA. EXPLICA.\nCOMPARTE.", 30, NAVY, true);
        h1.setPadding(0, dp(22), 0, 0);
        h1.setLineSpacing(0, 0.95f);
        root.addView(h1);
        View accent = new View(this);
        accent.setBackgroundColor(BLUE);
        LinearLayout.LayoutParams alp = new LinearLayout.LayoutParams(dp(56), dp(4));
        alp.topMargin = dp(12);
        root.addView(accent, alp);
        TextView sub = text("Tu pantalla y tu cara en un solo vídeo. Se guarda en Películas/BallixartRec, listo para compartir.", 15, MUTED, false);
        sub.setPadding(0, dp(12), 0, dp(4));
        root.addView(sub);

        // Modo
        LinearLayout modeCard = card(root, "Modo de grabación");
        modeCamBtn = modeButton(modeCard, "Pantalla + cámara", "Burbuja flotante con tu cara");
        modeScreenBtn = modeButton(modeCard, "Solo pantalla", "Sin cámara");
        modeCamBtn.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { setMode(true); } });
        modeScreenBtn.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { setMode(false); } });
        setMode(modeCam);

        // Ajustes
        LinearLayout set = card(root, "Ajustes");
        micSw = toggle(set, "Micrófono", "mic", true);
        hqSw = toggle(set, "Full HD 1080p (si no, 720p)", "hq", true);
        countSw = toggle(set, "Cuenta atrás de 3 segundos", "count", true);

        startBtn = new TextView(this);
        startBtn.setText("●  EMPEZAR GRABACIÓN");
        startBtn.setTextColor(Color.WHITE);
        startBtn.setTextSize(16);
        startBtn.setTypeface(Typeface.create("sans-serif-black", Typeface.NORMAL));
        startBtn.setGravity(Gravity.CENTER);
        startBtn.setBackground(box(NAVY, 0, 4));
        LinearLayout.LayoutParams slp = new LinearLayout.LayoutParams(-1, dp(58));
        slp.topMargin = dp(18);
        root.addView(startBtn, slp);
        startBtn.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                if (RecorderService.running) {
                    startService(new Intent(MainActivity.this, RecorderService.class).setAction(RecorderService.ACTION_STOP));
                    ui.postDelayed(new Runnable() { public void run() { refresh(); } }, 800);
                } else beginFlow();
            }
        });

        TextView tip = text("Consejo: toca la burbuja para cambiar su tamaño y arrástrala para moverla. También puedes pausar o terminar desde la notificación.", 13, MUTED, false);
        tip.setPadding(0, dp(10), 0, 0);
        root.addView(tip);

        // Biblioteca
        TextView libTitle = text("BIBLIOTECA", 22, NAVY, true);
        libTitle.setPadding(0, dp(28), 0, dp(4));
        root.addView(libTitle);
        libEmpty = text("Aún no hay grabaciones. Tus vídeos aparecerán aquí.", 14, MUTED, false);
        root.addView(libEmpty);
        libList = new LinearLayout(this);
        libList.setOrientation(LinearLayout.VERTICAL);
        root.addView(libList);

        TextView foot = text("© Ballixart · ballixart.es", 12, MUTED, false);
        foot.setGravity(Gravity.CENTER);
        foot.setPadding(0, dp(28), 0, 0);
        root.addView(foot, new LinearLayout.LayoutParams(-1, -2));

        setContentView(scroll);
    }

    private TextView modeButton(LinearLayout parent, String title, String sub) {
        TextView b = new TextView(this);
        b.setText(title + "\n" + sub);
        b.setTextSize(15);
        b.setTextColor(TEXT);
        b.setPadding(dp(14), dp(12), dp(14), dp(12));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.topMargin = dp(10);
        parent.addView(b, lp);
        return b;
    }

    private void setMode(boolean cam) {
        modeCam = cam;
        prefs.edit().putBoolean("modeCam", cam).apply();
        modeCamBtn.setBackground(box(cam ? SOFT : Color.WHITE, cam ? NAVY : LINE, 4));
        modeScreenBtn.setBackground(box(!cam ? SOFT : Color.WHITE, !cam ? NAVY : LINE, 4));
        modeCamBtn.setTypeface(null, cam ? Typeface.BOLD : Typeface.NORMAL);
        modeScreenBtn.setTypeface(null, !cam ? Typeface.BOLD : Typeface.NORMAL);
    }

    private Switch toggle(LinearLayout parent, String label, final String key, boolean def) {
        Switch s = new Switch(this);
        s.setText(label);
        s.setTextSize(15);
        s.setTextColor(TEXT);
        s.setChecked(prefs.getBoolean(key, def));
        s.setPadding(0, dp(10), 0, 0);
        s.setOnCheckedChangeListener(new android.widget.CompoundButton.OnCheckedChangeListener() {
            public void onCheckedChanged(android.widget.CompoundButton b, boolean on) { prefs.edit().putBoolean(key, on).apply(); }
        });
        parent.addView(s, new LinearLayout.LayoutParams(-1, -2));
        return s;
    }

    private void refresh() {
        if (startBtn != null) {
            startBtn.setText(RecorderService.running ? "■  TERMINAR GRABACIÓN" : "●  EMPEZAR GRABACIÓN");
            startBtn.setBackground(box(RecorderService.running ? BLUE : NAVY, 0, 4));
        }
        loadLibrary();
    }

    // ───────── Flujo de permisos ─────────
    private void beginFlow() {
        List<String> need = new ArrayList<>();
        if (micSw.isChecked() && !granted(Manifest.permission.RECORD_AUDIO)) need.add(Manifest.permission.RECORD_AUDIO);
        if (modeCam && !granted(Manifest.permission.CAMERA)) need.add(Manifest.permission.CAMERA);
        if (Build.VERSION.SDK_INT >= 33 && !granted(Manifest.permission.POST_NOTIFICATIONS)) need.add(Manifest.permission.POST_NOTIFICATIONS);
        if (!need.isEmpty()) requestPermissions(need.toArray(new String[0]), REQ_PERMS);
        else afterPermissions();
    }

    private boolean granted(String p) { return checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED; }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code == REQ_PERMS) afterPermissions();
    }

    private void afterPermissions() {
        if (modeCam && granted(Manifest.permission.CAMERA) && !Settings.canDrawOverlays(this)) {
            new AlertDialog.Builder(this)
                    .setTitle("Burbuja de cámara")
                    .setMessage("Para que tu cámara flote sobre otras apps, activa «Mostrar sobre otras aplicaciones» para Ballixart Rec y vuelve atrás.")
                    .setPositiveButton("Activar", new DialogInterface.OnClickListener() {
                        public void onClick(DialogInterface d, int w) {
                            startActivityForResult(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                    Uri.parse("package:" + getPackageName())), REQ_OVERLAY);
                        }
                    })
                    .setNegativeButton("Sin burbuja", new DialogInterface.OnClickListener() {
                        public void onClick(DialogInterface d, int w) { requestCapture(); }
                    })
                    .show();
            return;
        }
        requestCapture();
    }

    private void requestCapture() {
        MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        try {
            startActivityForResult(mpm.createScreenCaptureIntent(), REQ_CAPTURE);
        } catch (RuntimeException e) {
            Toast.makeText(this, "Este dispositivo no permite grabar la pantalla", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int req, int result, Intent data) {
        super.onActivityResult(req, result, data);
        if (req == REQ_OVERLAY) {
            if (!Settings.canDrawOverlays(this)) Toast.makeText(this, "Grabaré sin burbuja de cámara", Toast.LENGTH_SHORT).show();
            requestCapture();
        } else if (req == REQ_CAPTURE) {
            if (result != RESULT_OK || data == null) {
                Toast.makeText(this, "Grabación cancelada", Toast.LENGTH_SHORT).show();
                return;
            }
            boolean cam = modeCam && granted(Manifest.permission.CAMERA) && Settings.canDrawOverlays(this);
            Intent svc = new Intent(this, RecorderService.class)
                    .setAction(RecorderService.ACTION_START)
                    .putExtra(RecorderService.EXTRA_CODE, result)
                    .putExtra(RecorderService.EXTRA_DATA, data)
                    .putExtra(RecorderService.EXTRA_CAM, cam)
                    .putExtra(RecorderService.EXTRA_MIC, micSw.isChecked() && granted(Manifest.permission.RECORD_AUDIO))
                    .putExtra(RecorderService.EXTRA_HQ, hqSw.isChecked())
                    .putExtra(RecorderService.EXTRA_COUNTDOWN, countSw.isChecked());
            startForegroundService(svc);
            refresh();
            moveTaskToBack(true);
        } else if (req == REQ_DELETE) {
            if (result == RESULT_OK && pendingDelete != null && Build.VERSION.SDK_INT < 30) {
                try { getContentResolver().delete(pendingDelete, null, null); } catch (RuntimeException ignored) { }
            }
            pendingDelete = null;
            refresh();
        }
    }

    // ───────── Biblioteca ─────────
    static class Rec { Uri uri; String name; long duration, size, date; }

    private void loadLibrary() {
        final List<Rec> recs = new ArrayList<>();
        String[] proj = {MediaStore.Video.Media._ID, MediaStore.Video.Media.DISPLAY_NAME, MediaStore.Video.Media.DURATION,
                MediaStore.Video.Media.SIZE, MediaStore.Video.Media.DATE_ADDED};
        try (Cursor c = getContentResolver().query(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, proj,
                MediaStore.Video.Media.RELATIVE_PATH + " LIKE ?", new String[]{RELATIVE_PATH + "%"},
                MediaStore.Video.Media.DATE_ADDED + " DESC")) {
            while (c != null && c.moveToNext()) {
                Rec r = new Rec();
                r.uri = ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, c.getLong(0));
                r.name = c.getString(1);
                r.duration = c.getLong(2);
                r.size = c.getLong(3);
                r.date = c.getLong(4) * 1000L;
                recs.add(r);
            }
        } catch (RuntimeException ignored) { }
        libList.removeAllViews();
        libEmpty.setVisibility(recs.isEmpty() ? View.VISIBLE : View.GONE);
        for (Rec r : recs) libList.addView(row(r));
    }

    private View row(final Rec r) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.VERTICAL);
        row.setBackground(box(Color.WHITE, LINE, 4));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.topMargin = dp(12);
        row.setLayoutParams(lp);

        final ImageView thumb = new ImageView(this);
        thumb.setScaleType(ImageView.ScaleType.CENTER_CROP);
        thumb.setBackgroundColor(SOFT);
        row.addView(thumb, new LinearLayout.LayoutParams(-1, dp(180)));
        new Thread(new Runnable() {
            public void run() {
                try {
                    final Bitmap b = getContentResolver().loadThumbnail(r.uri, new Size(640, 360), null);
                    ui.post(new Runnable() { public void run() { thumb.setImageBitmap(b); } });
                } catch (Exception ignored) { }
            }
        }).start();

        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(12), dp(10), dp(12), dp(10));
        String title = r.name == null ? "Vídeo" : r.name.replaceAll("\\.mp4$", "");
        TextView t = text(title, 15, NAVY, false);
        t.setTypeface(null, Typeface.BOLD);
        body.addView(t);
        body.addView(text(RecorderService.format(r.duration) + " · " + Formatter.formatShortFileSize(this, r.size) + " · "
                + DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(new Date(r.date)), 12, MUTED, false));

        LinearLayout actions = new LinearLayout(this);
        actions.setPadding(0, dp(8), 0, 0);
        actions.addView(action("Ver", true, new View.OnClickListener() { public void onClick(View v) { play(r); } }));
        actions.addView(action("Compartir", false, new View.OnClickListener() { public void onClick(View v) { share(r); } }));
        actions.addView(action("Renombrar", false, new View.OnClickListener() { public void onClick(View v) { rename(r); } }));
        actions.addView(action("Eliminar", false, new View.OnClickListener() { public void onClick(View v) { confirmDelete(r); } }));
        body.addView(actions);
        row.addView(body);
        thumb.setOnClickListener(new View.OnClickListener() { public void onClick(View v) { play(r); } });
        return row;
    }

    private TextView action(String label, boolean primary, View.OnClickListener l) {
        TextView b = new TextView(this);
        b.setText(label);
        b.setTextSize(13);
        b.setTypeface(null, Typeface.BOLD);
        b.setGravity(Gravity.CENTER);
        b.setTextColor(primary ? Color.WHITE : NAVY);
        b.setBackground(box(primary ? NAVY : Color.WHITE, primary ? 0 : LINE, 4));
        b.setPadding(dp(6), dp(8), dp(6), dp(8));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, -2, 1f);
        lp.rightMargin = dp(6);
        b.setLayoutParams(lp);
        b.setOnClickListener(l);
        return b;
    }

    private void play(Rec r) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(r.uri, "video/mp4").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
        } catch (RuntimeException e) {
            Toast.makeText(this, "No hay reproductor de vídeo instalado", Toast.LENGTH_SHORT).show();
        }
    }

    private void share(Rec r) {
        Intent s = new Intent(Intent.ACTION_SEND).setType("video/mp4").putExtra(Intent.EXTRA_STREAM, r.uri)
                .putExtra(Intent.EXTRA_TEXT, "Grabado con Ballixart Rec").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(Intent.createChooser(s, "Compartir vídeo"));
    }

    private void rename(final Rec r) {
        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        input.setText(r.name == null ? "" : r.name.replaceAll("\\.mp4$", ""));
        input.setSelectAllOnFocus(true);
        LinearLayout wrap = new LinearLayout(this);
        wrap.setPadding(dp(20), dp(8), dp(20), 0);
        wrap.addView(input, new LinearLayout.LayoutParams(-1, -2));
        new AlertDialog.Builder(this).setTitle("Renombrar vídeo").setView(wrap)
                .setPositiveButton("Guardar", new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface d, int w) {
                        String n = input.getText().toString().replaceAll("[\\\\/:*?\"<>|]", "").trim();
                        if (n.isEmpty()) return;
                        ContentValues v = new ContentValues();
                        v.put(MediaStore.Video.Media.DISPLAY_NAME, n + ".mp4");
                        try { getContentResolver().update(r.uri, v, null, null); }
                        catch (RuntimeException e) { Toast.makeText(MainActivity.this, "No se pudo renombrar", Toast.LENGTH_SHORT).show(); }
                        refresh();
                    }
                })
                .setNegativeButton("Cancelar", null).show();
    }

    private void confirmDelete(final Rec r) {
        new AlertDialog.Builder(this).setTitle("Eliminar vídeo").setMessage("¿Eliminar este vídeo? No se puede deshacer.")
                .setPositiveButton("Eliminar", new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface d, int w) { delete(r); }
                })
                .setNegativeButton("Cancelar", null).show();
    }

    private void delete(Rec r) {
        try {
            getContentResolver().delete(r.uri, null, null);
            refresh();
        } catch (SecurityException e) {
            // Vídeos de una instalación anterior: Android pide confirmación al usuario.
            try {
                IntentSender sender;
                if (Build.VERSION.SDK_INT >= 30) {
                    PendingIntent pi = MediaStore.createDeleteRequest(getContentResolver(), Collections.singletonList(r.uri));
                    sender = pi.getIntentSender();
                } else if (e instanceof RecoverableSecurityException) {
                    sender = ((RecoverableSecurityException) e).getUserAction().getActionIntent().getIntentSender();
                } else throw e;
                pendingDelete = r.uri;
                startIntentSenderForResult(sender, REQ_DELETE, null, 0, 0, 0);
            } catch (Exception e2) {
                Toast.makeText(this, "No se pudo eliminar", Toast.LENGTH_SHORT).show();
            }
        }
    }
}
