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

En Android los navegadores no permiten capturar la pantalla desde una web: para eso se usa el grabador nativo y se importa el vídeo.

## Despliegue
Sitio estático: `netlify.toml` publica esta carpeta tal cual (sin build).
