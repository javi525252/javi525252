#!/usr/bin/env bash
# Compila Ballixart Rec para Android sin Android Studio ni Gradle.
# Herramientas (se descargan solas en .tools/):
#   - android-all (Robolectric, Maven Central): clases y recursos del framework Android 15 → hace de android.jar
#   - aapt2 (paquete npm aaptjs3): compila recursos y manifiesto
#   - dx (Maven Central): convierte .class a .dex
#   - apksig (Maven Central): firma v2
set -euo pipefail
cd "$(dirname "$0")"
T=.tools; B=build; mkdir -p $T
fetch() { [ -s "$T/$2" ] || curl -fsSL -o "$T/$2" "$1"; }
fetch https://repo1.maven.org/maven2/org/robolectric/android-all/15-robolectric-13954326/android-all-15-robolectric-13954326.jar android.jar
fetch https://repo1.maven.org/maven2/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar dx.jar
fetch https://repo1.maven.org/maven2/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar apksig.jar
if [ ! -x $T/aapt2 ]; then
  curl -fsSL https://registry.npmjs.org/aaptjs3/-/aaptjs3-2.0.2.tgz | tar xz -C $T package/bin/x64/linux/aapt2
  mv $T/package/bin/x64/linux/aapt2 $T/aapt2 && rm -rf $T/package && chmod +x $T/aapt2
fi

VERSION_CODE=${VERSION_CODE:-1}; VERSION_NAME=${VERSION_NAME:-1.0}
rm -rf $B && mkdir -p $B/gen $B/classes

echo "› Recursos"
$T/aapt2 compile --dir res -o $B/res.zip
$T/aapt2 link -o $B/base.apk -I $T/android.jar --manifest AndroidManifest.xml --java $B/gen \
  --min-sdk-version 29 --target-sdk-version 34 --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" $B/res.zip

echo "› Java"
javac -nowarn --release 8 -encoding UTF-8 -cp $T/android.jar \
  -d $B/classes $(find src $B/gen -name '*.java')

echo "› DEX"
java -cp $T/dx.jar com.android.dx.command.Main --dex --min-sdk-version=26 --output=$B/classes.dex $B/classes

echo "› APK"
python3 tools/package.py $B/base.apk $B/classes.dex $B/aligned.apk
if [ ! -f ballixart-rec.p12 ]; then
  keytool -genkeypair -storetype PKCS12 -keystore ballixart-rec.p12 -storepass ballixart -keypass ballixart \
    -alias ballixart -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Ballixart, O=Ballixart, C=ES"
fi
javac -nowarn -cp $T/apksig.jar -d $B/tools tools/Sign.java
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED -cp $T/apksig.jar:$B/tools Sign ballixart-rec.p12 ballixart ballixart $B/aligned.apk $B/ballixart-rec.apk
mkdir -p ../descargas && cp $B/ballixart-rec.apk ../descargas/ballixart-rec.apk
echo "✔ APK listo: ballixart-rec/descargas/ballixart-rec.apk ($(du -h $B/ballixart-rec.apk | cut -f1))"
