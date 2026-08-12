#!/usr/bin/env bash
#
# Skrip Rilis APK Otomatis — CoupleGrow
#
# Membaca versi dari Android build.gradle, lalu:
#   1. Build APK release (signed)
#   2. Salin ke frontend/static/CoupleGrow-v<version>.apk (untuk halaman login)
#   3. Update app-version.json (versionName, versionCode, downloadUrl)
#   4. Salin ke folder release/ (cadangan)
#
# Cara pakai:
#   ./release.sh            # build + update semua (default: juga deploy)
#   ./release.sh --no-deploy  # hanya build & file, tanpa deploy backend
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GRADLE_FILE="$ROOT/frontend/android/app/build.gradle"
STATIC_DIR="$ROOT/frontend/static"
RELEASE_DIR="$ROOT/release"
BACKEND_DIR="$ROOT/backend"

DEPLOY=true
for arg in "$@"; do
  if [ "$arg" = "--no-deploy" ]; then DEPLOY=false; fi
done

# --- 1. Baca versi dari build.gradle ---
VERSION_CODE="$(grep -oE 'versionCode [0-9]+' "$GRADLE_FILE" | grep -oE '[0-9]+' | head -1)"
VERSION_NAME="$(grep -oE 'versionName "[^"]+"' "$GRADLE_FILE" | sed -E 's/versionName "([^"]+)"/\1/' | head -1)"

if [ -z "$VERSION_NAME" ] || [ -z "$VERSION_CODE" ]; then
  echo "❌ Gagal membaca versi dari build.gradle"
  exit 1
fi

APK_FILENAME="CoupleGrow-v${VERSION_NAME}.apk"
echo "📦 Rilis versi: $VERSION_NAME (code $VERSION_CODE)"
echo "   Nama file APK : $APK_FILENAME"

# --- 2. Build frontend (web assets) ---
echo ""
echo "🏗️  Build frontend..."
(cd "$ROOT/frontend" && npm run build)

# --- 3. Build APK release ---
echo ""
echo "🏗️  Build APK release..."
(cd "$ROOT/frontend/android" && ./gradlew assembleRelease)

APK_SOURCE="$ROOT/frontend/android/app/build/outputs/apk/release/app-release.apk"
if [ ! -f "$APK_SOURCE" ]; then
  echo "❌ APK release tidak ditemukan: $APK_SOURCE"
  exit 1
fi

# --- 4. Salin APK ke static/ dengan nama sesuai versi ---
echo ""
echo "📄 Salin APK ke static/ ..."
mkdir -p "$STATIC_DIR"
cp "$APK_SOURCE" "$STATIC_DIR/$APK_FILENAME"

# --- 5. Update app-version.json ---
echo ""
echo "⚙️  Update app-version.json ..."
cat > "$STATIC_DIR/app-version.json" <<EOF
{
  "versionCode": $VERSION_CODE,
  "versionName": "$VERSION_NAME",
  "downloadUrl": "/$APK_FILENAME"
}
EOF

# --- 6. Salin cadangan ke release/ ---
echo ""
echo "📁 Salin cadangan ke release/ ..."
mkdir -p "$RELEASE_DIR"
cp "$APK_SOURCE" "$RELEASE_DIR/$APK_FILENAME"

echo ""
echo "✅ File siap:"
echo "   - $STATIC_DIR/$APK_FILENAME"
echo "   - $RELEASE_DIR/$APK_FILENAME"

# --- 7. Deploy backend (opsional) ---
if [ "$DEPLOY" = true ]; then
  echo ""
  echo "🚀 Deploy backend..."
  (cd "$BACKEND_DIR" && npx wrangler deploy)
else
  echo ""
  echo "ℹ️  Lewati deploy (--no-deploy). Jalankan 'cd backend && npx wrangler deploy' manual."
fi

echo ""
echo "🎉 Selesai! APK $APK_FILENAME siap diunduh dari halaman login."
