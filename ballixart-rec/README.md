# Ballixart Rec

Grabador de pantalla, cámara y voz inspirado en Loom, con la identidad de Ballixart.
Web app (PWA) 100% estática: todo se procesa y guarda en el navegador del usuario.

## Funciones
- **Pantalla + cámara**: burbuja de cámara flotante (Document Picture-in-Picture) con temporizador, pausa y stop, visible sobre cualquier ventana.
- **Solo pantalla** (pantalla completa, ventana o pestaña) con audio del sistema/pestaña.
- **Solo cámara** (frontal/trasera en móvil).
- Micrófono seleccionable, vúmetro, calidad 720p/1080p/1440p, MP4 o WebM.
- Cuenta atrás, pausa/reanudar, reiniciar, descartar. Atajos P / S.
- Biblioteca local (IndexedDB) con miniaturas, búsqueda, renombrar, eliminar.
- Reproductor con velocidad 1×–2×, recorte (crea copia), descarga y compartir nativo (WhatsApp, Drive, Gmail… en Android).
- Importar vídeos (p. ej. del grabador nativo de Android).
- Instalable como app y funciona sin conexión.

## Compatibilidad
| Plataforma | Pantalla | Cámara | Burbuja flotante |
|---|---|---|---|
| Chrome / Edge escritorio | ✅ | ✅ | ✅ |
| Firefox escritorio | ✅ | ✅ | PiP estándar |
| Safari macOS | ✅ | ✅ | PiP estándar |
| Chrome Android | ❌ (limitación del navegador) | ✅ | — |
| **App Android (APK)** | ✅ | ✅ | ✅ (sobre cualquier app) |

En Android los navegadores no permiten capturar la pantalla desde una web. Para eso está la **app nativa** (`android/`), que se descarga desde la propia web en `descargas/ballixart-rec.apk`.

## App Android (`android/`)
App nativa en Java (sin dependencias, Android 10+):
- Graba la pantalla con MediaProjection + MediaRecorder (H.264/AAC, 720p o 1080p) y el micrófono.
- Burbuja de cámara frontal flotante sobre cualquier app (arrastrar para mover, tocar para cambiar tamaño) con temporizador, pausa y stop.
- Controles también desde la notificación. Cuenta atrás de 3 s.
- Vídeos en `Películas/BallixartRec`, con biblioteca integrada: ver, compartir, renombrar, eliminar.

Compilar: `./android/build.sh` (descarga las herramientas desde Maven Central y npm; no necesita Android Studio ni el SDK).
Deja el APK firmado en `descargas/ballixart-rec.apk`. La clave de firma es `android/ballixart-rec.p12`
(contraseña `ballixart`): consérvala para que las actualizaciones se instalen encima de la versión anterior.

## Despliegue
Sitio estático: `netlify.toml` publica esta carpeta tal cual (sin build).
