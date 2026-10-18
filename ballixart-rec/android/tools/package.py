"""Añade classes.dex al APK de aapt2 y alinea a 4 bytes las entradas sin comprimir (equivale a zipalign -p 4)."""
import sys, zipfile

src, dex, out = sys.argv[1:4]
STORE = ('.arsc', '.png', '.jpg', '.webp')  # resources.arsc debe ir sin comprimir y alineado (targetSdk >= 30)

with zipfile.ZipFile(src) as zin, open(out, 'wb') as f:
    entries = [(i, zin.read(i.filename)) for i in zin.infolist()]
    entries.append((zipfile.ZipInfo('classes.dex', (2008, 1, 1, 0, 0, 0)), open(dex, 'rb').read()))
    with zipfile.ZipFile(f, 'w') as zout:
        for info, data in entries:
            zi = zipfile.ZipInfo(info.filename, (2008, 1, 1, 0, 0, 0))
            zi.external_attr = 0o644 << 16
            if info.filename.endswith(STORE):
                zi.compress_type = zipfile.ZIP_STORED
                # cabecera local = 30 bytes + nombre + extra; rellenamos el campo extra hasta alinear los datos
                offset = f.tell() + 30 + len(zi.filename.encode())
                pad = (-offset) % 4
                zi.extra = b'\x00' * pad
            else:
                zi.compress_type = zipfile.ZIP_DEFLATED
            zout.writestr(zi, data)
print('Empaquetado:', out)
